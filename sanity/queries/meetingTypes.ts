import { defineQuery } from "next-sanity"
import type { MEETING_TYPES_BY_HOST_QUERYResult } from "@/sanity/types"

export const MEETING_TYPES_BY_HOST_QUERY = defineQuery(`*[
  _type == "meetingType"
  && host->clerkId == $clerkId
] | order(isDefault desc, name asc) {
  _id,
  name,
  "slug": slug.current,
  duration,
  description,
  isDefault
}`)

export type MeetingTypeForHost = NonNullable<MEETING_TYPES_BY_HOST_QUERYResult>[number]

export const MEETING_TYPE_BY_SLUGS_QUERY = defineQuery(`*[
  _type == "meetingType"
  && host->slug.current == $hostSlug
  && slug.current == $meetingTypeSlug
][0] {
  _id,
  name,
  "slug": slug.current,
  duration,
  description,
  host-> {
    _id,
    name,
    email,
    "slug": slug.current,
    availability[] {
      _key,
      startDateTime,
      endDateTime
    },
    connectedAccounts[] {
      _key,
      accountId,
      email,
      isDefault,
      accessToken,
      refreshToken,
      expiryDate
    }
  }
}`)

export const MEETING_TYPES_BY_HOST_SLUG_QUERY = defineQuery(`*[
  _type == "meetingType"
  && host->slug.current == $hostSlug
] | order(isDefault desc, name asc) {
  _id,
  name,
  "slug": slug.current,
  duration,
  description,
  isDefault
}`)

export type MeetingTypePublic = MeetingTypeForHost

export const HOST_ID_BY_CLERK_ID_QUERY = defineQuery(`*[
  _type == "user"
  && clerkId = $clerkId
][0]._id`)