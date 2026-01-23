export interface TimeBlock {
  id: string
  start: Date
  end: Date
}

export interface BusyBlock {
  id: string
  start: Date
  end: Date
  title: string
  accountEmail: string
}

import type { AttendeeStatus } from "@/lib/google-calendar"

export type { AttendeeStatus }

export interface BookedBlock {
  id: string
  start: Date
  end: Date
  guestName: string
  guestEmail: string
  googleEventId?: string
  meetLink?: string
  attendeeStatus?: AttendeeStatus
}

export type CalendarEvent = TimeBlock | BusyBlock | BookedBlock

export function isBusyBlock(event: CalendarEvent): event is BusyBlock {
  return "accountEmail" in event
}

export function isBookedBlock(event: CalendarEvent): event is BookedBlock {
  return "guestName" in event
}

export interface SlotInfo {
  start: Date
  end: Date
}

export interface TimeBlockInteraction {
  event: TimeBlock
  start: Date
  end: Date
}