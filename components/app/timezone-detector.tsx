"use client"

import { useEffect } from "react"

export function TimezoneDetector() {
  useEffect(() => {
    const timezone = Intl.DateTimeFormat().resolvedOptions().timeZone

    if (timezone) {
      document.cookie = `timezone=${timezone}; path=/; max-age=31536000; SameSite=Lax`
    }
  }, [])

  return null
}