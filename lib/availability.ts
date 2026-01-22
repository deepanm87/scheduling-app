import {
  startOfDay,
  endOfDay,
  addMinutes,
  addDays,
  isWithinInterval,
  parseISO,
  format
} from "date-fns"

export type AvailabilitySlot = {
  _key: string
  startDateTime: string
  endDateTime: string
}

export type BookingSlot = {
  _id: string
  startTime: string
  endTime: string
}

export type BusyTime = {
  start: Date
  end: Date
}

export function computeAvailableDates(
  availability: AvailabilitySlot[],
  bookings: BookingSlot[],
  startDate: Date,
  endDate: Date,
  slotDurationMinutes = 30,
  busyTimes: BusyTime[] = []
): string[] {
  const availableDates: string[] = []
  let currentDate = startOfDay(startDate)
  const today = startOfDay(new Date())

  while (currentDate <= endDate) {
    if (currentDate < today) {
      currentDate = addDays(currentDate, 1)
      continue
    }

    const dayStart = startOfDay(currentDate)
    const dayEnd = endOfDay(currentDate)

    const availabilityForDate = availability.filter(slot => {
      const slotStart = parseISO(slot.startDateTime)
      const slotEnd = parseISO(slot.endDateTime)

      return (
        isWithinInterval(slotStart, { start: dayStart, end: dayEnd }) ||
        isWithinInterval(slotEnd, { start: dayStart, end: dayEnd }) ||
        (slotStart <= dayStart && slotEnd >=  dayEnd)
      )
    })

    if (availabilityForDate.length > 0) {
      const hasAvailableSlot = checkDayHasAvailableSlot(
        availabilityForDate,
        bookings,
        dayStart,
        dayEnd,
        slotDurationMinutes,
        busyTimes
      )

      if (hasAvailableSlot) {
        availableDates.push(format(currentDate, "yyyy-MM-dd"))
      }
    }

    currentDate = addDays(currentDate, 1)
  }

  return availableDates
}

export function computeAvailableSlots(
  availability: AvailabilitySlot[],
  bookings: BookingSlot[],
  date: Date,
  slotDurationMinutes = 30,
  busyTimes: BusyTime[] = []
): Array<{ 
  start: Date
  end: Date
}> {
  const dayStart = startOfDay(date)
  const dayEnd = endOfDay(date)
  const now = new Date()
  const slots: Array<{ 
    start: Date
    end: Date
  }> = []

  const availabilityForDate = availability.filter(slot => {
    const slotStart = parseISO(slot.startDateTime)
    const slotEnd = parseISO(slot.endDateTime)

    return (
      isWithinInterval(slotStart, { start: dayStart, end: dayEnd }) ||
      isWithinInterval(slotEnd, { start: dayStart, end: dayEnd }) ||
      (slotStart <= dayStart && slotEnd >= dayEnd)
    )
  })

  for (const availSlot of availabilityForDate) {
    const availStart = parseISO(availSlot.startDateTime)
    const availEnd = parseISO(availSlot.endDateTime)

    const slotStart = availStart < dayStart ? dayStart : availStart
    const slotEnd = availEnd > dayEnd ? dayEnd : availEnd

    let currentStart = slotStart
    while (addMinutes(currentStart, slotDurationMinutes) <= slotEnd) {
      const currentEnd = addMinutes(currentStart, slotDurationMinutes)

      if (currentStart < now) {
        currentStart = currentEnd
        continue
      }

      const hasBookingConflict = bookings.some(booking => {
        const bookingStart = parseISO(booking.startTime)
        const bookingEnd = parseISO(booking.endTime)
        return currentStart < bookingEnd && currentEnd > bookingStart
      })

      const hasBusyConflict = busyTimes.some(busy => {
        return currentStart < busy.end && currentEnd > busy.start
      })

      if (!hasBookingConflict && !hasBusyConflict) {
        slots.push({
          start: new Date(currentStart),
          end: new Date(currentEnd)
        })
      }

      currentStart = currentEnd
    }
  }

  return slots
}

function checkDayHasAvailableSlot(
  availabilityForDate: AvailabilitySlot[],
  bookings: BookingSlot[],
  dayStart: Date,
  dayEnd: Date,
  slotDurationMinutes: number,
  busyTimes: BusyTime[]
): boolean {
  for (const availSlot of availabilityForDate) {
    const availStart = parseISO(availSlot.startDateTime)
    const availEnd = parseISO(availSlot.endDateTime)

    const slotStart = availStart < dayStart ? dayStart : availStart
    const slotEnd = availEnd > dayEnd ? dayEnd : availEnd

    let currentStart = slotStart
    while (addMinutes(currentStart, slotDurationMinutes) <= slotEnd) {
      const currentEnd = addMinutes(currentStart, slotDurationMinutes)

      const hasBookingConflict = bookings.some(booking => {
        const bookingStart = parseISO(booking.startTime)
        const bookingEnd = parseISO(booking.endTime)
        return currentStart < bookingEnd && currentEnd > bookingStart
      })

      const hasBusyConflict = busyTimes.some(busy => {
        return currentStart < busy.end && currentEnd > busy.start
      })

      if (!hasBookingConflict && !hasBusyConflict) {
        return true
      }

      currentStart = currentEnd
    }
  }

  return false
}