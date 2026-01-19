"use server"

import { auth, currentUser } from "@clerk/nextjs/server"
import { startOfMonth, endOfMonth } from "date-fns"
import { defineQuery } from "next-sanity"
import { writeClient } from "@/sanity/lib/writeClient"
import { client } from "@/sanity/lib/client"
import { sanityFetch } from "@/sanity/lib/live"
import {
  USER_ID_BY_CLERK_ID_QUERY,
  USER_SLUG_QUERY
} from "@/sanity/queries/users"
import {
  MEETING_TYPES_BY_HOST_QUERY,
  HOST_ID_BY_CLERK_ID_QUERY,
  type MeetingTypeForHost
} from "@/sanity/queries/meetingTypes"
import { generateSlug, getBaseUrl } from "@/lib/url"
import { PLAN_LIMITS, getUserPlan } from "../features"
import type { TimeBlock } from "@/components/calendar/types"
import type { BookingQuotaStatus } from "../features"

export async function getOrCreateUser(clerkId: string) {
  const existingUser = await client.fetch(USER_ID_BY_CLERK_ID_QUERY, {
    clerkId
  })

  if (existingUser) {
    return existingUser
  }

  const clerkUser = await currentUser()
  if (!clerkUser) {
    throw new Error("User not found in Clerk")
  }

  const newUser = await writeClient.create({
    _type: "user",
    clerkId,
    name: 
      clerkUser.firstName && clerkUser.lastName
        ? `${clerkUser.firstName} ${clerkUser.lastName}`
        : clerkUser.username || "User",
    email: clerkUser.emailAddresses[0]?.emailAddress,
    availability: []
  })

  return { _id: newUser._id }
}

export async function saveAvailability(
  blocks: TimeBlock[]
): Promise<Array<{ 
  id: string
  start: string
  end: string
}>> {
  const { userId } = await auth()
  if (!userId) {
    throw new Error("Unauthorized")
  }

  const user = await getOrCreateUser(userId)

  const sanityBlocks = blocks.map(block => ({
    _key: crypto.randomUUID(),
    startDateTime: block.start.toISOString(),
    endDateTime: block.end.toISOString()
  }))

  await writeClient
    .patch(user._id)
    .set({ availability: sanityBlocks })
    .commit()

  return sanityBlocks.map(block => ({
    id: block._key,
    start: block.startDateTime,
    end: block.endDateTime
  }))
}

export async function getOrCreateBookingLink(): Promise<{
  slug: string
  url: string
}> {
  const { userId } = await auth()
  if (!userId) {
    throw new Error("Unauthorized")
  }

  const user = await client.fetch(USER_SLUG_QUERY, { clerkId: userId })

  if (!user) {
    const newUser = await getOrCreateUser(userdId)
    const clerkUser = await currentUser()
    const name = clerkUser?.firstName
      ? `${clerkUser.firstName} ${clerkUser.lastName || ""}`.trim()
      : clerkUser?.username || "user"

    const baseSlug = generateSlug(name)
    const uniqueSlug = `${baseSlug}-${Date.now().toString(36)}`

    await writeClient
      .patch(newUser._id)
      .set({ slug: {
        _type: "slug",
        current: uniqueSlug
      }})
      .commit()
    
    const baseUrl = getBaseUrl()
    return {
      slug: uniqueSlug,
      url: `${baseUrl}/book/${uniqueSlug}`
    }
  }

  if (user.slug?.current) {
    const baseUrl = getBaseUrl()
    return {
      slug: user.slug.current,
      url: `${baseUrl}/book/${user.slug.current}`
    }
  }

  const name = user.name || "user"
  const baseSlug = generateSlug(name)
  const uniqueSlug = `${baseSlug}-${Date.now().toString(36)}`

  await writeClient
    .patch(user._id)
    .set({ slug: { _type: "slug", current: uniqueSlug }})
    .commit()
    
  const baseUrl = getBaseUrl()
  return {
    slug: uniqueSlug,
    url: `${baseUrl}/book/${uniqueSlug}`
  }
}

export async function getMeetingTypes(): Promise<MeetingTypeForHost[]> {
  const { userId } = await auth()
  if (!userId) {
    throw new Error("Unauthorized")
  }

  const { data: meetingTypes } = await sanityFetch({
    query: MEETING_TYPES_BY_HOST_QUERY,
    params: { clerkId: userId }
  })

  return meetingTypes
}

type MeetingDuration = 15 | 30 | 45 | 60 | 90

export async function createMeetingType(data: {
  name: string
  duration: MeetingDuration
  description?: string
  isDefault?: boolean
}): Promise<MeetingTypeForHost> {
  const { userId } = await auth()
  if (!userId) {
    throw new Error("Unauthorized")
  }

  const hostId = await client.fetch(HOST_ID_BY_CLERK_ID_QUERY, {
    clerkId: userId
  })

  if (!hostId) {
    const user = await getOrCreateUser(userId)
    const slug = generateSlug(data.name)

    const meetingType = await writeClient.create({
      _type: "meetingType",
      name: data.name,
      slug: { _type: "slug", current: slug },
      duration: data.duration,
      description: data.description,
      isDefault: data.isDefault ?? true,
      host: { _type: "reference", _ref: user._id }
    })

    return {
      _id: meetingType._id,
      name: data.name,
      slug,
      duration: data.duration,
      description: data.description ?? null,
      isDefault: data.isDefault ?? true
    }
  }

  const slug = generateSlug(data.name)

  const meetingType = await writeClient.create({
    _type: "meetingType",
    name: data.name,
    slug: { _type: "slug", current: slug },
    duration: data.duration,
    description: data.description,
    isDefault: data.isDefault ?? true,
    host: { _type: "reference", _ref: hostId }
  })

  return {
    _id: meetingType._id,
    name: data.name,
    slug,
    duration: data.duration,
    description: data.description ?? null,
    isDefault: data.isDefault ?? true
  }
}

export async function getBookingLinkWithMeetingType(
  meetingTypeSlug: string
): Promise<{
  url: string
}> {
  const { userId } = await auth()
  if (!userId) {
    throw new Error("Unauthorized")
  }

  const { slug: userSlug } = await getOrCreateBookingLink()

  const baseUrl = getBaseUrl()
  return {
    url: `${baseUrl}/book/${userSlug}/${meetingTypeSlug}`
  }
}

const COUNT_USER_BOOKINGS_QUERY = defineQuery(`count(*[
  _type == "booking"
  && host->clerkId == $clerkId
  && startTime >= $monthStart
  && startTime < $monthEnd
])`)

export async function getBookingQuota(): Promise<BookingQuotaStatus> {
  const { userId } = await auth()

  if (!userId) {
    return {
      used: 0,
      limit: 0,
      remaining: 0,
      isExceeded: true,
      plan: "free"
    }
  }

  const plan = await getUserPlan()
  const limit = PLAN_LIMITS[plan].maxBookingsPerMonth

  const now = new Date()
  const monthStart = startOfMonth(now).toISOString()
  const monthEnd = endOfMonth(now).toISOString()

  const { data: used } = await sanityFetch({
    query: COUNT_USER_BOOKINGS_QUERY,
    params: { clerkId: userId, monthStart, monthEnd }
  })

  const remaining = limit === Infinity ? Infinity : Math.max(0, limit - used)
  const isExceeded = limit !== Infinity && used >= limit

  return { used, limit, remaining, isExceeded, plan }
}

const HAS_CONNECTED_ACCOUNT_QUERY = defineQuery(`count(*[
  _type == "user"
  && clerkId == $clerkId
  && defined(connectedAccounts)
  && length(connectedAccounts) > 0
]) > 0`)

export async function hasConnectedAccount(): Promise<boolean> {
  const { userId } = await auth()
  if (!userId) {
    return false
  }

  const { data } = await sanityFetch({
    query: HAS_CONNECTED_ACCOUNT_QUERY,
    params: { clerkId: userId }
  })

  return data
}


