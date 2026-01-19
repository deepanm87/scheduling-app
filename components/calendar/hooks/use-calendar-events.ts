"use client"

import { useState } from "react"
import { startOfDay, endOfDay, startOfWeek, addDays, set } from "date-fns"
import type { TimeBlock, TimeBlockInteraction, SlotInfo } from "../types"

const blocksOverlapOrTouch = (a: TimeBlock, b: TimeBlock): boolean => 
  a.start <= b.end && b.start <= a.end

const mergeOverlappingBlocks = (blocks: TimeBlock[]): TimeBlock[] => {
  if (blocks.length < 2) {
    return blocks
  }

  const sorted = [...blocks].sort(
    (a, b) => a.start.getTime() - b.start.getTime()
  )
  const merged: TimeBlock[] = [{ ...sorted[0] }]

  for (let i = 1; i < sorted.length; i++) {
    const current = sorted[i]
    const last = merged[merged.length - 1]

    if (blocksOverlapOrTouch(last, current)) {
      last.end = new Date(Math.max(last.end.getTime(), current.end.getTime()))
      last.start = new Date(
        Math.min(last.start.getTime(), current.start.getTime())
      )
    } else {
      merged.push({ ...current })
    }
  }

  return merged
}

const copyTimeToDate = (source: Date, target: Date): Date => 
  set(target, {
    hours: source.getHours(),
    minutes: source.getMinutes(),
    seconds: source.getSeconds()
  })

const blocksAreEqual = (a: TimeBlock[], b: TimeBlock[]): boolean => {
  if (a.length !== b.length) {
    return false
  }
  const sortedA = [...a].sort((x, y) => x.start.getTime() - y.start.getTime())
  const sortedB = [...b].sort((x, y) => x.start.getTime() - y.start.getTime())
  return sortedA.every(
    (block,  i) => 
      block.start.getTime() === sortedB[i].start.getTime() &&
      block.end.getTime() === sortedB[i].end.getTime()
  )
}

export function useCalendarEvents(initialBlocks: TimeBlock[] = []) {
  const [events, setEvents] = useState<TimeBlock[]>(initialBlocks)
  const [savedBlocks, setSavedBlocks] = useState<TimeBlock[]>(initialBlocks)
  const [prevInitial, setPrevInitial] = useState<TimeBlock[]>(initialBlocks)

  if (!blocksAreEqual(initialBlocks, prevInitial)) {
    setPrevInitial(initialBlocks)
    setSavedBlocks(initialBlocks)
    if (blocksAreEqual(events, savedBlocks)) {
      setEvents(initialBlocks)
    }
  }

  const hasChanges = !blocksAreEqual(events, savedBlocks)

  const addBlock = (start: Date, end: Date) => {
    const id = `local-${crypto.randomUUID()}`
    const block: TimeBlock = { id, start, end }
    setEvents(prev => mergeOverlappingBlocks([...prev, block]))
  }

  const updateBlock = (id: string, start: Date, end: Date) => {
    setEvents(prev => 
      mergeOverlappingBlocks(
        prev.map(b => (b.id === id ? { ...b, start, end } : b))
      )
    )
  }

  const removeBlock = (id: string) => {
    setEvents(prev => prev.filter(b => b.id !== id))
  }

  const handleSelectSlot = ({ start, end }: SlotInfo) => {
    addBlock(start, end)
  }

  const handleEventDrop = ({ event, start, end }: TimeBlockInteraction) => {
    updateBlock(event.id, start, end)
  }

  const handleEventResize = ({ event, start, end }: TimeBlockInteraction) => {
    updateBlock(event.id, start, end)
  }

  const copyDayToWeek = (
    dayIndex: number,
    referenceDate: Date,
    includeWeekends = true
  ) => {
    const weekStart = startOfWeek(referenceDate, { weekStartsOn: 1 })
    const sourceDay = addDays(weekStart, dayIndex)
    const dayStart = startOfDay(sourceDay)
    const dayEnd = endOfDay(sourceDay)

    const dayBlocks = events.filter(
      b => b.start >= dayStart && b.start <= dayEnd
    )

    if (dayBlocks.length === 0) {
      return
    }

    const newBlocks: TimeBlock[] = []

    for (let i = 0; i < 7; i++) {
      if (i === dayIndex) {
        continue
      }
      if (!includeWeekends && (i === 5 || i === 6)) {
        continue
      }

      const targetDay = addDays(weekStart, i)

      for (const block of dayBlocks) {
        const id = `local-${crypto.randomUUID()}`
        const start = copyTimeToDate(block.start, targetDay)
        const end = copyTimeToDate(block.end, targetDay)
        newBlocks.push({ id, start, end })
      }
    }

    setEvents(prev => mergeOverlappingBlocks([...prev, ...newBlocks]))
  }

  const clearWeek = (referenceDate: Date) => {
    const weekStart = startOfWeek(referenceDate, { weekStartsOn: 1 })
    const weekEnd = addDays(weekStart, 7)

    setEvents(prev => 
      prev.filter(b => b.start < weekStart || b.start >= weekEnd)
    )
  }

  const discardChanges = () => {
    setEvents(savedBlocks)
  }

  const markAsSaved = (newBlocks: TimeBlock[]) => {
    setEvents(newBlocks)
    setSavedBlocks(newBlocks)
  }

  const getEventsForSave = () => events

  return {
    events,
    hasChanges,
    addBlock,
    updateBlock,
    removeBlock,
    handleSelectSlot,
    handleEventDrop,
    handleEventResize,
    copyDayToWeek,
    clearWeek,
    discardChanges,
    markAsSaved,
    getEventsForSave
  }
}