import {
  getBookingAttendeeStatuses,
  type BookingStatuses
} from "@/lib/actions/calendar"
import type { AttendeeStatus } from "@/lib/google-calendar"
import type {
  HostBooking,
  HostUpcomingBooking
} from "@/sanity/queries/bookings"

export type BookingWithGoogleEvent = HostBooking | HostUpcomingBooking

export type ProcessedBooking<T extends BookingWithGoogleEvent> = T & {
  guestStatus?: AttendeeStatus
}

export async function processBookingsWithStatuses<
  T extends BookingWithGoogleEvent
>(
  bookings: T[]
): Promise<{
  statuses: Record<string, BookingStatuses>
  activeBookings: ProcessedBooking<T>[]
}> {
  const statuses = await getBookingAttendeeStatuses(
    bookings
      .filter((b): b is T & { googleEventId: string; guestEmail: string } => 
        !!b.googleEventId && !!b.guestEmail
      )
      .map(b => ({
        id: b._id,
        googleEventId: b.googleEventId!,
        guestEmail: b.guestEmail!
      }))
  )

  const activeBookings = bookings
    .filter(booking => {
      const bookingStatus = statuses[booking._id]
      return !booking.googleEventId || !bookingStatus?.isCancelled
    })
    .map(booking => {
      const bookingStatus = statuses[booking._id]
      return {
        ...booking,
        guestStatus: bookingStatus?.guestStatus
      }
    })

    return { statuses, activeBookings }
}