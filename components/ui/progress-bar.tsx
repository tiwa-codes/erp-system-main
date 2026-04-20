"use client"

import { useEffect, useState } from "react"
import { Card, CardContent } from "@/components/ui/card"
import { Loader2, CheckCircle2, XCircle } from "lucide-react"

interface ProgressBarProps {
  progress: number
  stage: string
  message: string
  status?: "in_progress" | "completed" | "failed"
  className?: string
}

export function ProgressBar({ progress, stage, message, status = "in_progress", className }: ProgressBarProps) {
  const getStageLabel = (stage: string) => {
    const labels: Record<string, string> = {
      initializing: "Initializing",
      backing_up: "Backing Up",
      pre_backup: "Creating Pre-Restore Backup",
      restoring: "Restoring",
      completed: "Completed",
      failed: "Failed",
    }
    return labels[stage] || stage
  }

  const getStatusIcon = () => {
    if (status === "completed") {
      return <CheckCircle2 className="h-5 w-5 text-green-500" />
    }
    if (status === "failed") {
      return <XCircle className="h-5 w-5 text-red-500" />
    }
    return <Loader2 className="h-5 w-5 text-blue-500 animate-spin" />
  }

  const getProgressColor = () => {
    if (status === "failed") return "bg-red-500"
    if (status === "completed") return "bg-green-500"
    return "bg-[#0891B2]"
  }

  return (
    <Card className={className}>
      <CardContent className="p-4">
        <div className="space-y-3">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              {getStatusIcon()}
              <span className="font-medium text-sm">{getStageLabel(stage)}</span>
            </div>
            <span className="text-sm font-semibold text-gray-600">{Math.round(progress)}%</span>
          </div>
          
          <div className="relative h-2 w-full overflow-hidden rounded-full bg-gray-200">
            <div
              className={`h-full transition-all duration-300 ${
                status === "failed" 
                  ? "bg-red-500" 
                  : status === "completed" 
                  ? "bg-green-500" 
                  : "bg-[#0891B2]"
              }`}
              style={{ width: `${progress}%` }}
            />
          </div>
          
          <p className="text-xs text-gray-600">{message}</p>
        </div>
      </CardContent>
    </Card>
  )
}

interface BackupProgressTrackerProps {
  backupId: string
  onComplete?: () => void
  onError?: (error: string) => void
}

export function BackupProgressTracker({ backupId, onComplete, onError }: BackupProgressTrackerProps) {
  const [progress, setProgress] = useState(0)
  const [stage, setStage] = useState("initializing")
  const [message, setMessage] = useState("Starting backup...")
  const [status, setStatus] = useState<"in_progress" | "completed" | "failed">("in_progress")

  useEffect(() => {
    if (!backupId) return

    const eventSource = new EventSource(`/api/settings/backup-restore/backups/${backupId}/progress`)

    eventSource.onmessage = (event) => {
      try {
        const data = JSON.parse(event.data)

        if (data.error) {
          setStatus("failed")
          setMessage(data.error)
          setProgress(0)
          onError?.(data.error)
          eventSource.close()
          return
        }

        setProgress(data.progress || 0)
        setStage(data.stage || "initializing")
        setMessage(data.message || "")
        setStatus(data.status === "COMPLETED" ? "completed" : data.status === "FAILED" ? "failed" : "in_progress")

        if (data.status === "COMPLETED" || data.status === "FAILED") {
          eventSource.close()
          if (data.status === "COMPLETED") {
            onComplete?.()
          } else {
            onError?.(data.message || "Backup failed")
          }
        }
      } catch (error) {
        console.error("Error parsing progress data:", error)
      }
    }

    eventSource.onerror = (error) => {
      console.error("EventSource error:", error)
      eventSource.close()
      setStatus("failed")
      setMessage("Connection lost. Please refresh to check status.")
      onError?.("Connection lost")
    }

    return () => {
      eventSource.close()
    }
  }, [backupId, onComplete, onError])

  return <ProgressBar progress={progress} stage={stage} message={message} status={status} />
}

interface RestoreProgressTrackerProps {
  backupId: string
  onComplete?: () => void
  onError?: (error: string) => void
}

export function RestoreProgressTracker({ backupId, onComplete, onError }: RestoreProgressTrackerProps) {
  const [progress, setProgress] = useState(0)
  const [stage, setStage] = useState("initializing")
  const [message, setMessage] = useState("Starting restore...")
  const [status, setStatus] = useState<"in_progress" | "completed" | "failed">("in_progress")

  useEffect(() => {
    if (!backupId) return

    const eventSource = new EventSource(`/api/settings/backup-restore/backups/${backupId}/restore-progress`)

    eventSource.onmessage = (event) => {
      try {
        const data = JSON.parse(event.data)

        if (data.error) {
          setStatus("failed")
          setMessage(data.error)
          setProgress(0)
          onError?.(data.error)
          eventSource.close()
          return
        }

        setProgress(data.progress || 0)
        setStage(data.stage || "initializing")
        setMessage(data.message || "")
        setStatus(data.status === "completed" ? "completed" : data.status === "failed" ? "failed" : "in_progress")

        if (data.status === "completed" || data.status === "failed") {
          eventSource.close()
          if (data.status === "completed") {
            onComplete?.()
          } else {
            onError?.(data.message || "Restore failed")
          }
        }
      } catch (error) {
        console.error("Error parsing progress data:", error)
      }
    }

    eventSource.onerror = (error) => {
      console.error("EventSource error:", error)
      eventSource.close()
      setStatus("failed")
      setMessage("Connection lost. Please refresh to check status.")
      onError?.("Connection lost")
    }

    return () => {
      eventSource.close()
    }
  }, [backupId, onComplete, onError])

  return <ProgressBar progress={progress} stage={stage} message={message} status={status} />
}

