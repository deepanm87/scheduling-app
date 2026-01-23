import { notFound } from "next/navigation"
import { cookies } from "next/headers"
import { sanityFetch } from "@/sanity/lib/live"
import { MEETING_TYPE_BY_SLUGS_QUERY } from "@/sanity/queries/meetingTypes"
import { ALL_BOOKINGS_BY_HOST_SLUG_QUERY } from "@/sanity/queries/bookings"
import { BookingCalendar } from "@/components/booking/booking-calendar"
import { QuotaExceeded } from "@/components/booking/quota-exceeded"
import {
  computeAvailableDates,
  computeAvailableSlots
} from "@/lib/availability"
import { getActiveBookingIds } from "@/lib/actions/calendar"
import { getGoogleBusyTimes } from "@/lib/actions/booking"
import { getHostBookingQuotaStatus } from "@/lib/features"
import { HostHeader } from "@/components/booking/host-header"
import { startOfDay, parseISO } from "date-fns"
import { formatInTimeZone } from "date-fns-tz"

interface BookingPageProps {
  params: Promise<{ 
    slug: string
    meetingType: string
  }>
}

export default async function MeetingTypeBookingPage({
  params
}: BookingPageProps) {
  const { slug, meetingType } = await params

  const quotaStatus = await getHostBookingQuotaStatus(slug)

  const cookieStore = await cookies()
  let visitorTimezone = cookieStore.get("timezone")?.value ?? "UTC"

  try {
    Intl.DateTimeFormat(undefined, { timeZone: visitorTimezone })
  } catch {
    visitorTimezone = "UTC"
  }

  const [{ data: meetingTypeData }, { data: bookings }] = await Promise.all([
    sanityFetch({
      query: MEETING_TYPE_BY_SLUGS_QUERY,
      params: { hostSlug: slug, meetingTypeSlug: meetingType }
    }),
    sanityFetch({
      query: ALL_BOOKINGS_BY_HOST_SLUG_QUERY,
      params: { hostSlug: slug }
    })
  ])

  if (!meetingTypeData || !meetingTypeData.host) {
    notFound()
  }

  const host = meetingTypeData.host

  if (quotaStatus.isExceeded) {
    return <QuotaExceeded hostName={host.name ?? "This host"} />
  }

  const duration = meetingTypeData.duration ?? 30
  const availability = host.availability ?? []
  const allBookingsRaw = bookings ?? []

  const hostAccount = host.connectedAccounts?.find((a: { isDefault?: boolean }) => a.isDefault) ?? null
  const activeBookingIds = await getActiveBookingIds(
    hostAccount
      ? {
        _key: hostAccount._key,
        email: hostAccount.email,
        accessToken: hostAccount.accessToken,
        refreshToken: hostAccount.refreshToken,
        expiryDate: hostAccount.expiryDate
      }
      : null,
    allBookingsRaw.map((b: { _id: string; googleEventId?: string | null; guestEmail?: string | null }) => ({
      id: b._id,
      googleEventId: b.googleEventId,
      guestEmail: b.guestEmail
    }))
  )

  const allBookings = allBookingsRaw.filter((b: { _id: string }) => activeBookingIds.has(b._id))

  const today = startOfDay(new Date())

  const latestEndDate = availability.reduce((latest: Date, slot: { endDateTime: string }) => {
    const slotEnd = parseISO(slot.endDateTime)
    return slotEnd > latest ? slotEnd : latest
  }, today)

  const busyTimes = await getGoogleBusyTimes(
    host.connectedAccounts,
    today,
    latestEndDate
  )

  const serverDates = computeAvailableDates(
    availability,
    allBookings,
    today,
    latestEndDate,
    duration,
    busyTimes
  )

  const slotsByDate: Record<string, Array<{ 
    start: string
    end: string
  }>> = {}

  for (const dateStr of serverDates) {
    const date = new Date(dateStr)
    const slots = computeAvailableSlots(
      availability,
      allBookings,
      date,
      duration,
      busyTimes
    )

    for (const slot of slots) {
      const localDateKey = formatInTimeZone(
        slot.start,
        visitorTimezone,
        "yyyy-MM-dd"
      )

      if (!slotsByDate[localDateKey]) {
        slotsByDate[localDateKey] = []
      }

      slotsByDate[localDateKey].push({
        start: slot.start.toISOString(),
        end: slot.end.toISOString()
      })
    }
  }

  const availableDates = Object.keys(slotsByDate).sort()

  return (
    <main className="min-h-screen bg-linear-to-br from-slate-50 to-slate-100 dark:from-slate-950 dark:to-slate-900">
      <div className="container mx-auto px-4 py-12 max-w-4xl">
        <HostHeader 
          hostName={host.name}
          meetingType={{
            name: meetingTypeData.name,
            duration: meetingTypeData.duration ?? 30,
            description: meetingTypeData.description
          }}
        />

        <BookingCalendar 
          hostSlug={slug}
          hostName={host.name ?? "Host"}
          meetingTypeSlug={meetingType}
          meetingTypeName={meetingTypeData.name ?? "Meeting"}
          duration={duration}
          availableDates={availableDates}
          slotsByDate={slotsByDate}
          timezone={visitorTimezone}
        />
      </div>
    </main>
  )
}
