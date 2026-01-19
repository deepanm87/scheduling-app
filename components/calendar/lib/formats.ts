import { format } from "date-fns"

export const formatTimeRange = (start: Date, end: Date): string => 
  `${format(start, "HH:mm")} - ${format(end, "HH:mm")}`

export const calendarFormats = {
  timeGutterFormat: (date: Date) => format(date, "HH:mm"),
  eventTimeRangeFormat: ({ start, end }: { start: Date; end: Date }) => 
    formatTimeRange(start, end),
  selectRangeFormat: ({ start, end }: { start: Date; end: Date }) => 
    formatTimeRange(start, end)
}

export const calendarMessages = {
  showMore: (count: number) => `+${count} more`
}