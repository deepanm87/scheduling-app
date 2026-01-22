import { Clock } from "lucide-react"

interface HostHeaderProps {
  hostName: string | null
  meetingType?: {
    name: string | null
    duration: number
    description?: string | null
  }
  subtitle?: string
}

export function HostHeader({
  hostName,
  meetingType,
  subtitle
}: HostHeaderProps) {
  const displayName = hostName ?? "Host"
  const initial = displayName.charAt(0).toUpperCase() || "?"

  return (
    <div className="mb-8 text-center">
      <div className="inline-flex size-16 items-center justify-center rounded-full bg-linear-to-br from-blue-500 to-purple-600 text-2xl font-bold text-white mb-4">
        {initial}
      </div>

      <h1 className="text-2xl font-bold text-slate-900 dark:text-white">
        {meetingType ? meetingType.name : displayName}
      </h1>

      {(subtitle || meetingType) && (
        <p className="mt-1 text-slate-600 dark:text-slate-400">
          {subtitle ?? `with ${displayName}`}
        </p>
      )}

      {meetingType && (
        <div className="mt-3 inline-flex items-center gap-1.5 rounded-full bg-blue-100 dark:bg-blue-900/30 px-3 py-1 text-sm font-medium text-blue-700 dark:text-blue-300">
          <Clock className="size-3.5" />
          {meetingType.duration} minutes
        </div>
      )}

      {meetingType?.description && (
        <p className="mt-4 text-slate-600 dark:text-slate-400 max-w-lg mx-auto">
          {meetingType.description}
        </p>
      )}
    </div>
  )
}