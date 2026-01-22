"use client"

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
    <div>Admin Page</div>
  )
}