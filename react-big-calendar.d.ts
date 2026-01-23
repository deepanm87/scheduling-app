declare module "react-big-calendar" {
  import { ComponentType, ReactNode } from "react"

  export interface DateLocalizer {
    formats: Record<string, any>
    startOfWeek: (date: Date) => Date
    endOfWeek: (date: Date) => Date
    format: (date: Date, format: string, culture?: string) => string
    parse: (value: string, format: string) => Date
    getDay: (date: Date) => number
  }

  export function dateFnsLocalizer(config: {
    format: (date: Date, format: string) => string
    parse: (value: string, format: string) => Date
    startOfWeek: () => Date
    getDay: (date: Date) => number
    locales?: Record<string, any>
  }): DateLocalizer

  export interface CalendarProps<TEvent = any> {
    localizer: DateLocalizer
    events?: TEvent[]
    startAccessor?: string | ((event: TEvent) => Date)
    endAccessor?: string | ((event: TEvent) => Date)
    titleAccessor?: string | ((event: TEvent) => string)
    eventPropGetter?: (event: TEvent) => { style?: React.CSSProperties; className?: string }
    onSelectSlot?: (slotInfo: { start: Date; end: Date; slots: Date[]; action: "select" | "click" | "doubleClick" }) => void
    onSelectEvent?: (event: TEvent) => void
    onEventDrop?: (args: { event: TEvent; start: Date; end: Date; isAllDay: boolean }) => void
    onEventResize?: (args: { event: TEvent; start: Date; end: Date; isAllDay: boolean }) => void
    view?: View
    date?: Date
    views?: View[]
    onView?: (view: View) => void
    onNavigate?: (date: Date, view: View, action: "PREV" | "NEXT" | "TODAY" | "DATE") => void
    onDrillDown?: (date: Date) => void
    selectable?: boolean
    resizable?: boolean
    draggableAccessor?: (event: TEvent) => boolean
    popup?: boolean
    min?: Date
    max?: Date
    step?: number
    timeslot?: number
    slotPropGetter?: (date: Date) => { style?: React.CSSProperties; className?: string }
    dayPropGetter?: (date: Date) => { style?: React.CSSProperties; className?: string }
    components?: {
      toolbar?: ComponentType<any>
      event?: ComponentType<any>
      eventWrapper?: ComponentType<any>
      day?: ComponentType<any>
      week?: ComponentType<any>
      month?: ComponentType<any>
    }
    style?: React.CSSProperties
    formats?: Record<string, any>
    messages?: Record<string, any>
  }

  export type View = "month" | "week" | "day" | "agenda" | "work_week"

  export const Views: {
    MONTH: View
    WEEK: View
    DAY: View
    AGENDA: View
    WORK_WEEK: View
  }

  export interface ToolbarProps<TEvent = any, TResource = any> {
    date: Date
    view: View
    views: View[]
    label: string
    onNavigate: (action: "PREV" | "NEXT" | "TODAY" | "DATE", date?: Date) => void
    onView: (view: View) => void
    localizer: DateLocalizer
  }

  export const Calendar: ComponentType<CalendarProps>
  export default Calendar
}

declare module "react-big-calendar/lib/addons/dragAndDrop" {
  import { ComponentType } from "react"
  import { CalendarProps } from "react-big-calendar"

  export interface EventInteractionArgs<TEvent = any> {
    event: TEvent
    start: Date
    end: Date
    isAllDay: boolean
  }

  export default function withDragAndDrop<TEvent = any>(
    Calendar: ComponentType<CalendarProps<TEvent>>
  ): ComponentType<CalendarProps<TEvent> & {
    onEventDrop?: (args: EventInteractionArgs<TEvent>) => void
    onEventResize?: (args: EventInteractionArgs<TEvent>) => void
  }>
}
