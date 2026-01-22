"use server"

import { writeClient } from "@/sanity/lib/writeClient"
import { client } from "@/sanity/lib/client"
import {
  HOST_BY_SLUG_WITH_TOKENS_QUERY,
  type HostWithTokens
} from "@/sanity/queries/users"
import { BOOKINGS_IN_RANGE_QUERY } from "@/sanity/queries/bookings"
import { MEETING_TYPE_BY_SLUGS_QUERY } from "@/sanity/queries/meetingTypes"
import {
  getCalendarClient,
  getEventAttendeeStatus,
  fetchCalendarEvents
} from "@/lib/google-calendar"
import { getHostBookingQuotaStatus } from "@/lib/features"
import {
  startOfDay,
  endOfDay,
  addMinutes,
  isWithinInterval,
  parseISO
} from "date-fns"
import { computeAvailableDates } from "@/lib/availability"

export type TimeSlot = {
  start: Date
  end: Date
}

export type BookingData = {
  hostSlug: string
  meetingTypeSlug?: string
  startTime: Date
  endTime: Date
  guestName: string
  guestEmail: string
  notes?: string
}

export async function getAvailableSlots(
  hostSlug: string,
  date: Date,
  slotDurationMinutes = 30
): Promise<TimeSlot[]> {
  const host = await client.fetch(HOST_BY_SLUG_WITH_TOKENS_QUERY, {
    slug: hostSlug
  })

  if (!host) {
    throw new Error("Host not found")
  }

  const dayStart = startOfDay(date)
  const dayEnd = endOfDay(date)

  const availabilityForDate = (host.availability ?? []).filter(slot => {
    const slotStart = parseISO(slot.startDateTime)
    const slotEnd = parseISO(slot.endDateTime)

    return (
      isWithinInterval(slotStart, { start: dayStart, end: dayEnd }) ||
      isWithinInterval(slotEnd, { start: dayStart, end: dayEnd }) ||
      (slotStart <= dayStart && slotEnd >= dayEnd)
    )
  })

  if (availabilityForDate.length === 0) {
    return []
  }

  const existingBookings = await client.fetch(BOOKINGS_IN_RANGE_QUERY, {
    hostId: host._id,
    startDate: dayStart.toISOString(),
    endDate: dayEnd.toISOString()
  })

  const defaultAccount = host.connectedAccounts?.find(a => a.isDefault())
  const declinedBookingIds = new Set<string>()

  if (defaultAccount?.accessToken && defaultAccount?.refreshToken) {
    await Promise.all(
      existingBookings
        .filter(b => b.googleEventId && b.guestEmail)
        .map(async booking => {
          if (!booking.googleEventId) {
            return
          }

          try {
            const status = await getEventAttendeeStatus(
              defaultAccount,
              booking.googleEventId,
              booking.guestEmail
            )
            if (status === "declined") {
              declinedBookingIds.add(booking._id)
            }
          } catch {

          }
        })
    )
  }

  const activeBookings = existingBookings.filter(
    b => !declinedBookingIds.has(b._id)
  )

  const busyTimes = await getGoogleBusyTimes(
    host.connectedAccounts,
    dayStart,
    dayEnd
  )

  const allSlots: TimeSlot[] = []

  for (const availSlot of availabilityForDate) {
    const availStart = parseISO(availSlot.startDateTime)
    const availEnd = parseISO(availSlot.endDateTime)

    const slotStart = availStart < dayStart ? dayStart : availStart
    const slotEnd = availEnd > dayEnd ? dayEnd : availEnd

    let currentStart = slotStart
    while (addMinutes(currentStart, slotDurationMinutes) <= slotEnd) {
      const currentEnd = addMinutes(currentStart, slotDurationMinutes)
      allSlots.push({ start: currentStart, end: currentEnd })
      currentStart = currentEnd
    }
  }

  const availableSlots = allSlots.filter(slot => {
    const hasBookingConflict = activeBookings.some(booking => {
      const bookingStart = parseISO(booking.startTime)
      const bookingEnd = parseISO(booking.endTime)
      return slot.start < bookingEnd && slot.end > bookingStart
    })

    if (hasBookingConflict) {
      return false
    }

    const hasBusyConflict = busyTimes.some(busy => {
      return slot.start < busy.end && slot.end > busy.start
    })

    return !hasBusyConflict
  })

  return availableSlots
}

export async function getAvailableDates(
  hostSlug: string,
  startDate: Date,
  endDate: Date,
  slotDurationMinutes = 30
): Promise<string[]> {
  const host = await client.fetch(HOST_BY_SLUG_WITH_TOKENS_QUERY, {
    slug: hostSlug
  })

  if (!host) {
    return []
  }

  const existingBookings = await client.fetch(BOOKINGS_IN_RANGE_QUERY, {
    hostId: host._id,
    startDate: startDate.toISOString(),
    endDate: endDate.toISOString()
  })

  let busyTimes: Array<{ 
    start: Date
    end: Date
  }> = []
  try {
    busyTimes = await getGoogleBusyTimes(
      host.connectedAccounts,
      startDate,
      endDate
    )
  } catch {

  }

  return computeAvailableDates(
    host.availability ?? [],
    existingBookings,
    startDate,
    endDate,
    slotDurationMinutes,
    busyTimes
  )
}

export async function createBooking(
  data: BookingData
): Promise<{ _id: string }> {
  const host = await client.fetch(HOST_BY_SLUG_WITH_TOKENS_QUERY, {
    slug: data.hostSlug
  })

  if (!host) {
    throw new Error("Host not found")
  }

  const quotaStatus = await getHostBookingQuotaStatus(data.hostSlug)
  if (quotaStatus.isExceeded) {
    throw new Error("Host has reached their monthly booking limit")
  }

  let meetingTypeId: string | undefined
  let meetingTypeName: string | undefined

  if (data.meetingTypeSlug) {
    const meetingType = await client.fetch(MEETING_TYPE_BY_SLUGS_QUERY, {
      hostSlug: data.hostSlug,
      meetingTypeSlug: data.meetingTypeSlug
    })

    if (meetingType) {
      meetingTypeId = meetingType._id
      meetingTypeName = meetingType.name ?? undefined
    }
  }

  const isAvailable = await checkSlotAvailable(
    host,
    data.startTime,
    data.endTime
  )

  if (!isAvailable) {
    throw new Error("This time slot is no longer available")
  }

  const defaultAccount = host.connectedAccounts?.find(a => a.isDefault)

  let googleEventId: string | undefined
  let meetLink: string | undefined

  if (defaultAccount?.accessToken && defaultAccount?.refreshToken) {
    try {
      const calendar = await getCalendarClient(defaultAccount)

      const summary = meetingTypeName
        ? `${meetingTypeName}: ${host.name} x ${data.guestName}`
        : `Meeting ${host.name} x ${data.guestName}`

      const event = await calendar.events.insert({
        calendarId: "primary",
        sendUpdates: "all",
        conferenceDataVersion: 1,
        requestBody: {
          summary,
          description: data.notes || undefined,
          start: {
            dateTime: data.startTime.toISOString()
          },
          end: {
            dateTime: data.endTime.toISOString()
          },
          attendees: [
            { email: host.email, responseStatus: "accepted" },
            { email: data.guestEmail }
          ],
          conferenceData: {
            createRequest: {
              requestId: `booking-${Date.now()}-${Math.random()
                .toString(36)
                .substring(7)}`,
              conferenceSolutionKey: {
                type: "hangoutsMeet"
              }
            }
          }
        }
      })

      googleEventId = event.data.id ?? undefined
      meetLink = event.data.hangoutLink ?? undefined
    } catch (error) {
      console.error(`Failed to create Google Calendar event: ${error}`)
    }
  }

  const booking = await writeClient.create({
    _type: "booking",
    host: { _type: "reference", _ref: host._id },
    ...(meetingTypeId && {
      meetingType: { _type: "reference", _ref: meetingTypeId }
    }),
    guestName: data.guestName,
    guestEmail: data.guestEmail,
    startTime: data.startTime.toISOString(),
    endTime: data.endTime.toISOString(),
    googleEventId,
    meetLink,
    status: "confirmed",
    notes: data.notes
  })

  return {
    _id: booking._id
  }
}

export async function getGoogleBusyTimes(
  connectedAccounts: HostWithTokens["connectedAcounts"],
  startDate: Date,
  endDate: Date
): Promise<Array<{ 
  start: Date
  end: Date
}>> {
  const events = await fetchCalendarEvents(
    connectedAccounts ?? [],
    startDate,
    endDate
  )

  return events.map(event => ({
    start: event.start,
    end: event.end
  }))
}

async function checkSlotAvailable(
  host: HostWithTokens,
  startTime: Date,
  endTime: Date
): Promise<boolean> {
  const existingBookings = await client.fetch(BOOKINGS_IN_RANGE_QUERY, {
    hostId: host._id,
    startDate: startTime.toISOString(),
    endDate: endTime.toISOString()
  })

  const defaultAccount = host.connectedAccounts?.find(a => a.isDefault())
  const declinedBookingIds = new Set <string>()

  if (defaultAccount?.accessToken && defaultAccount?.refreshToken) {
    const overlappingBookings = existingBookings.filter(booking => {
      const bookingStart = parseISO(booking.startTime)
      const bookingEnd = parseISO(booking.endTime)
      return startTime < bookingEnd && endTime > bookingStart
    })

    await Promise.all(
      overlappingBookings
        .filter(b => b.googleEventId && b.guestEmail)
        .map(async booking => {
          if (!booking.googleEventId) {
            return
          }

          try {
            const status = await getEventAttendeeStatus(
              defaultAccount,
              booking.googleEventId,
              booking.guestEmail
            )
            if (status === "declined") {
              declinedBookingIds.add(booking._id)
            }
          } catch {

          }
        })
    )
  }

  return !existingBookings.some(booking => {
    if (declinedBookingIds.has(booking._id)) {
      return false
    }
    const bookingStart = parseISO(booking.startTime)
    const bookingEnd = parseISO(booking.endTime)
    return startTime < bookingEnd && endTime > bookingStart
  })
}