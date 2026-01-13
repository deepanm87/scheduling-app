import { defineQuery } from "next-sanity"
import type {
  HOST_BOOKINGS_BY_CLERK_ID_QUERYResult,
  HOST_UPCOMING_BOOKINGS_QUERYResult
} from "@/sanity.types"

export type HostBooking = NonNullable<HOST_BOOKINGS_BY_CLERK_ID_QUERYResult>[number]

export type HostUpcomingBooking = NonNullable<HOST_UPCOMING_BOOKINGS_QUERYResult>[number]

export const BOOKINGS_BY_HOST_QUERY = defineQuery(`*[
  _type == "booking"
  && host._ref == $hostId
] | order(startTime asc) {
  _id,
  _type,
  guestName,
  guestEmail,
  startTime,
  endTime,
  notes,
  googleEventId,
  meetLink
}`)

export const BOOKINGS_IN_RANGE_QUERY = defineQuery(`*[
  _type == "booking"
  && host._ref == $hostId
  && startTime >= $startDate
  && startTime <= $endDate
] | order(startTime asc) {
  _id,
  startTime,
  endTime,
  googleEventId,
  guestEmail
}`)

export const BOOKING_BY_ID_QUERY = defineQuery(`*[
  _type == "booking"
  && _id == $bookingId
][0]{
  _id,
  _type,
  host->{
    _id,
    name,
    email
  },
  guestName,
  guestEmail,
  startTime,
  endTime,
  notes,
  googleEventId,
  meetLink
}`)

export const BOOKING_WITH_HOST_CALENDAR_QUERY = defineQuery(`*[
  _type == "booking"
  && _id == $bookignId
][0]{
  _id,
  googleEventId,
  host->{
    _id,
    connectedAccounts[isDefault == true][0]{
      _key,
      accountId,
      email,
      accessToken,
      refreshToken,
      expiryDate,
      isDefault
    }
  }
}`)

export const HOST_BOOKINGS_BY_CLERK_ID_QUERY = defineQuery(`*[
  _type == "booking"
  && host->clerkId = $clerkId
] | order(startTime asc) {
  _id,
  _type,
  guestName,
  guestEmail,
  startTime,
  endTime,
  notes,
  googleEventId,
  meetLink
}`)

export const HOST_UPCOMING_BOOKINGS_QUERY = defineQuery(`*[
  _type == "booking"
  && host->clerkId == $clerkId
  && startTime >= $startDate
] | order(startTime asc) {
  _id,
  guestName,
  guestEmail,
  startTime,
  endTime,
  googleEventId,
  meetLink
}`)

export const BOOKINGS_BY_HOST_SLUG_IN_RANGE_QUERY = defineQuery(`*[
  _type == "booking"
  && host->slug.current = $hostSlug
  && startTime >= $startDate
  && startTime <= $endDate
] | order(startTime asc) {
  _id,
  startTime,
  endTime
}`)

export const ALL_BOOKINGS_BY_HOST_SLUG_QUERY = defineQuery(`*[
  _type == "booking"
  && host->slug.current == $hostSlug
] | order(startTime asc) {
  _id,
  startTime,
  endTime,
  googleEventId,
  guestEmail
}`)