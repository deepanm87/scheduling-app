import { auth } from "@clerk/nextjs/server"
import { redirect } from "next/navigation"
import { startOfWeek, addWeeks } from "date-fns"
import { sanityFetch } from "@/sanity/lib/live"

export default function AvailabilityPage() {
  return (
    <div>Availability Page</div>
  )
}