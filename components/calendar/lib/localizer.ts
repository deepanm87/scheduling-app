import { dateFnsLocalizer } from "react-big-calendar"
import { format, getDay, parse, startOfWeek } from "date-fns"
import { enUS } from "date-fns/locale"

const getWeekStartDay = (): 0 | 1 => {
  if (typeof navigator === "undefined") {
    return 1
  }
  const lang = navigator.language
  return ["en-US", "en-CA", "ja", "ja-JP"].includes(lang) ? 0 : 1
}

export const localizer = dateFnsLocalizer({
  format,
  parse: (value: string, formatStr: string) => parse(value, formatStr, new Date()),
  startOfWeek: () => 
    startOfWeek(new Date(), { weekStartsOn: getWeekStartDay() }),
  getDay,
  locales: { "en-US": enUS }
})