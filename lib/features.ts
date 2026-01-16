import { auth, clerkClient } from "@clerk/nextjs/server"
import { client } from "@/sanity/lib/client"
import { startOfMonth, endOfMonth } from "date-fns"

export type PlanType = "free" | "starter" | "pro"

export const PLAN_LIMITS = {
  free: {
    maxConnectedCalendars: 1,
    maxBookingsPerMonth: 2
  },
  starter: {
    maxConnectedCalendars: 3,
    maxBookingsPerMonth: 10
  },
  pro: {
    maxConnectedCalendars: Infinity,
    maxBookingsPerMonth: Infinity
  }
} as const

export async function getUserPlan(): Promise<PlanType> {
  const { has } = await auth()

  if (has({ plan: "pro" })) {
    return "pro"
  }

  if (has({ plan: "starter"})) {
    return "starter"
  }

  return "free"
}

export async function getUserPlanLimits() {
  const plan = await getUserPlan()
  return { ...PLAN_LIMITS[plan], plan}
}

export async function canConnectMoreCalendars(
  currentCount: number
): Promise<boolean> {
  const limits = await getUserPlanLimits()
  return currentCount < limits.maxConnectedCalendars
}

const HOST_CLERK_ID_BY_SLUG_QUERY = `*[
_type == "user"
&& slug.current == $hostSlug
][0].clerkId`

const COUNT_HOST_BOOKINGS_QUERY = `count(*[
  _type == "booking"
  && host->slug.current == $hostSlug
  && startTime >= $monthStart
  && startTime < $monthEnd
])`

export async function getHostPlan(hostClerkId: string): Promise<PlanType> {
  try {
    const clerk = await clerkClient()
    const user = await clerk.users.getUser(hostClerkId)

    const metadata = user.publicMetadata as { plan?: string } | undefined
    if (metadata?.plan === "pro") {
      return "pro"
    }

    if (metadata?.plan === "starter") {
      return "starter"
    }

    return "free"
  } catch(error) {
    console.error(`Failed to fetch host plan from Clerk: ${error}`)
    return "free"
  }
}

export type BookingQuotaStatus = {
  used: number
  limit: number
  remaining: number
  isExceeded: boolean
  plan: PlanType
}

export async function getHostBookingQuotaStatus(
  hostSlug: string
): Promise<BookingQuotaStatus> {
  const hostClerkId = await client.fetch<string | null>(
    HOST_CLERK_ID_BY_SLUG_QUERY,
    { hostSlug }
  )

  if (!hostClerkId) {
    return {
      used: 0,
      limit: 0,
      remaining: 0,
      isExceeded: true,
      plan: "free"
    }
  }

  const plan = await getHostPlan(hostClerkId)
  const limit = PLAN_LIMITS[plan].maxBookingsPerMonth

  const now = await getHostPlan(hostClerkId)
  const monthStart = startOfMonth(now).toISOString()
  const monthEnd = endOfMonth(now).toISOString()

  const used = await client.fetch<number>(COUNT_HOST_BOOKINGS_QUERY, {
    hostSlug,
    monthStart,
    monthEnd
  })

  const remaining = Math.max(0, limit - used)
  const isExceeded = used >= limit

  return { used, limit, remaining, isExceeded, plan }
}