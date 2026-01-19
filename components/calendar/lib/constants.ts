export const CALENDAR_CONFIG = {
  step: 15,
  timeslots: 4
} as const

export const MIN_TIME = new Date(1970, 0, 1, 0, 0, 0)
export const MAX_TIME = new Date(1970, 0, 1, 23, 59, 59)

export const DAYS_OF_WEEK = [
  "Monday",
  "Tuesday",
  "Wednesday",
  "Thursday",
  "Friday",
  "Saturday",
  "Sunday"
] as const

export const AVAILABILITY_COLORS = {
  background: "#f3f4f6",
  border: "#d1d5db",
  backgroundHover: "#f9fafb"
} as const

export const BUSY_BLOCK_COLORS = {
  background: "#fecaca",
  border: "#f87171",
  text: "#991b1b"
} as const

export const BOOKING_STATUS_COLORS = {
  declined: {
    background: "#ef4444",
    border: "#dc2626",
    text: "#ffffff"
  },
  tentative: {
    background: "#f59e0b",
    border: "#d97706",
    text: "#ffffff"
  },
  accepted: {
    background: "#16a34a",
    border: "#15803d",
    text: "#ffffff"
  },
  default: {
    background: "#6b7280",
    border: "#4b5563",
    text: "#ffffff"
  }
} as const