"use server"

import { auth } from "@clerk/nextjs/server"
import { writeClient } from "@/sanity/lib/writeClient"
import { client } from "@/sanity/lib/client"
import { 
  USER_WITH_TOKENS_QUERY,
  type ConnectedAccountWithTokens
} from "@/sanity/queries/users"
import { BOOKING_WITH_HOST_CALENDAR_QUERY } from "@/sanity/queries/bookings"
import {
  getCalendarClient,
  revokeGoogleToken,
  getEventAttendeeStatuses,
  fetchCalendarEvents,
  type AttendeeStatus
} from "@/lib/google-calendar"

export type BusySlot = {
  start: string
  end: string
  accountEmail: string
  title: string
}

export async function getUserConnectedAccountsCount(): Promise<number> {
  const { userId } = await auth()
  if (!userId) {
    return 0
  }

  const user = await client.fetch(USER_WITH_TOKENS_QUERY, { clerkId: userId })
  return user?.connectedAccounts?.length ?? 0
}

export async function getGoogleBusyTimes(
  startDate: Date,
  endDate: Date
): Promise<BusySlot[]> {
  const { userId } = await auth()
  if (!userId) {
    throw new Error("Unauthorized")
  }

  const user = await client.fetch(USER_WITH_TOKENS_QUERY, { clerkId: userId })
  if (!user?.connectedAccounts?.length) {
    return []
  }

  const events = await fetchCalendarEvents(
    user.connectedAccounts,
    startDate,
    endDate
  )

  return events.map(event => ({
    start: event.start.toISOString(),
    end: event.end.toISOString(),
    accountEmail: event.accountEmail,
    title: event.title
  }))
}

export async function disconnectGoogleAccount(
  accountKey: string
): Promise<void> {
  const { userId } = await auth()
  if (!userId) {
    throw new Error("Unauthorized")
  }

  const user = await client.fetch(USER_WITH_TOKENS_QUERY, { clerkId: userId })
  if (!user) {
    throw new Error("User not found")
  }

  const account = user.connectedAccounts?.find((a: { _key: string }) => a._key === accountKey)
  if (!account) {
    throw new Error("Account not found")
  }

  if (account.accessToken) {
    await revokeGoogleToken(account.accessToken)
  }

  const wasDefault = account.isDefault
  const remainingAccounts = user.connectedAccounts?.filter(
    (a: { _key: string }) => a._key !== accountKey
  )

  await writeClient
    .patch(user._id)
    .unset([`connectedAccounts[_key=="${accountKey}"]`])
    .commit()

  if (wasDefault && remainingAccounts && remainingAccounts.length > 0) {
    const newDefaultKey = remainingAccounts[0]._key
    await writeClient
      .patch(user._id)
      .set({
        [`connectedAccounts[_key=="${newDefaultKey}"].isDefault`]: true
      })
      .commit()
  }
}

export async function setDefaultCalendarAccount(
  accountKey: string
): Promise<void> {
  const { userId } = await auth()
  if (!userId) {
    throw new Error("Unauthorized")
  }

  const user = await client.fetch(USER_WITH_TOKENS_QUERY, { clerkId: userId })
  if (!user) {
    throw new Error("User not found")
  }

  const account = user.connectedAccounts?.find((a: { _key: string }) => a._key === accountKey)
  if (!account) {
    throw new Error("Account not found")
  }

  for (const acc of (user.connectedAccounts ?? []) as Array<{ _key: string; isDefault?: boolean }>) {
    if (acc._key !== accountKey && acc.isDefault) {
      await writeClient
        .patch(user._id)
        .set({
          [`connectedAccounts[_key=="${acc._key}"].isDefault`]: false
        })
        .commit()
    }
  }

  await writeClient
    .patch(user._id)
    .set({
      [`connectedAccounts[_key=="${accountKey}"].isDefault`]: true
    })
    .commit()
}

export async function cancelBooking(bookingId: string): Promise<void> {
  const { userId } = await auth()
  if (!userId) {
    throw new Error("Unauthorized")
  }

  const booking = await client.fetch(BOOKING_WITH_HOST_CALENDAR_QUERY, {
    bookingId
  })

  if (!booking) {
    throw new Error("Booking not found")
  }

  if (booking.googleEventId && booking.host?.connectedAccounts) {
    const account = booking.host.connectedAccounts
    if (account.accessToken && account.refreshToken) {
      try {
        const calendar = await getCalendarClient(account)
        await calendar.events.delete({
          calendarId: "primary",
          eventId: booking.googleEventId,
          sendUpdates: "all"
        })
      } catch (error) {
        console.error(`Failed to delete Google Calendar event: ${error}`)
      }
    }
  }

  await writeClient.delete(bookingId)
}

export type BookingStatuses = {
  guestStatus: AttendeeStatus
  isCancelled: boolean
}

async function cleanupCancelledBooking(
  account: ConnectedAccountWithTokens,
  bookingId: string,
  googleEventId: string,
  eventStillExists: boolean
): Promise<void> {
  if (eventStillExists && account.accessToken && account.refreshToken) {
    try {
      const calendar = await getCalendarClient(account)
      await calendar.events.delete({
        calendarId: "primary",
        eventId: googleEventId,
        sendUpdates: "all"
      })
    } catch (error) {
      console.error(`Failed to delete Google Calendar event: ${error}`)
    }
  }

  try {
    await writeClient.delete(bookingId)
  } catch (error) {
    console.error(`Failed to delete booking from Sanity: ${error}`)
  }
}

export async function getBookingAttendeeStatuses(
  bookings: Array<{
    id: string
    googleEventId: string | null
    guestEmail: string
  }>
): Promise<Record<string, BookingStatuses>> {
  const { userId } = await auth()
  if (!userId) {
    throw new Error("Unauthorized")
  }

  const user = await client.fetch(USER_WITH_TOKENS_QUERY, { clerkId: userId })
  if (!user?.connectedAccounts?.length) {
    return {}
  }

  const account = user.connectedAccounts.find((a: { isDefault?: boolean }) => a.isDefault)
  if (!account?.accessToken || !account?.refreshToken) {
    return {}
  }

  const hostEmail = account.email
  const statuses: Record<string, BookingStatuses> = {}

  const bookingsWithEvents = bookings.filter((b: { googleEventId: string | null }) => b.googleEventId)

  await Promise.all(
    bookingsWithEvents.map(async (booking: { id: string; googleEventId: string | null; guestEmail: string }) => {
      if (booking.googleEventId) {
        const { hostStatus, guestStatus } = await getEventAttendeeStatuses(
          account,
          booking.googleEventId,
          hostEmail,
          booking.guestEmail
        )

        const isCancelled = hostStatus === "declined" || guestStatus === "declined"
        statuses[booking.id] = { guestStatus, isCancelled }

        if (isCancelled) {
          await cleanupCancelledBooking(
            account,
            booking.id,
            booking.googleEventId,
            hostStatus !== "declined"
          )
        }
      }
    })
  )

  return statuses
}

export async function getActiveBookingIds(
  hostAccount: {
    accessToken: string | null
    refreshToken: string | null
    expiryDate?: number | null
    _key: string
    email: string
  } | null,
  bookings: Array<{
    id: string
    googleEventId: string | null
    guestEmail: string
  }>
): Promise<Set<string>> {
  const activeIds = new Set<string>()

  if (!hostAccount?.accessToken || !hostAccount?.refreshToken) {
    for (const b of bookings) {
      activeIds.add(b.id)
    }
    return activeIds
  }

  const accessToken = hostAccount.accessToken
  const refreshToken = hostAccount.refreshToken

  await Promise.all(
    bookings.map(async booking => {
      if (!booking.googleEventId) {
        activeIds.add(booking.id)
        return
      }

      try {
        const account = {
          _key: hostAccount._key,
          accessToken,
          refreshToken,
          expiryDate: hostAccount.expiryDate ?? null,
          email: hostAccount.email,
          accountId: "",
          isDefault: true
        }

        const { hostStatus, guestStatus } = await getEventAttendeeStatuses(
          account,
          booking.googleEventId,
          hostAccount.email,
          booking.guestEmail
        )

        const isCancelled = hostStatus === "declined" || guestStatus === "declined"

        if (isCancelled) {
          await cleanupCancelledBooking(
            account,
            booking.id,
            booking.googleEventId,
            hostStatus !== "declined"
          )
        } else {
          activeIds.add(booking.id)
        }
      } catch (error) {
        console.error(`Failed to check booking ${booking.id}: ${error}`)
        activeIds.add(booking.id)
      }
    })
  )

  return activeIds
}
