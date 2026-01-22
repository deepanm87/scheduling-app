"use client"

import { Suspense } from "react"
import { InsightsSection } from "@/components/admin/insights/InsightsSection"
import { Spinner } from "@/components/ui/spinner"

function LoadingFallback() {
  return (
    <div className="flex items-center justify-center p-8">
      <Spinner className="size-6 text-amber-500" />
    </div>
  )
}

export default function AdminDashboard() {
  return (
    <div className="p-4 md:p-6 lg:p-8">
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 lg:gap-5 auto-rows-min">
        <Suspense fallback={<LoadingFallback />}>
          <InsightsSection />
        </Suspense>
      </div>
    </div>
  )
}