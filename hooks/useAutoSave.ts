"use client"

import { useEffect, useRef, useState } from "react"
import { useMutation } from "@tanstack/react-query"

interface UseAutoSaveOptions {
  claimId: string
  stage: 'vetter1' | 'vetter2' | 'audit' | 'approval'
  draftData: any
  enabled?: boolean
  interval?: number // milliseconds
}

export function useAutoSave({
  claimId,
  stage,
  draftData,
  enabled = true,
  interval = 30000 // 30 seconds
}: UseAutoSaveOptions) {
  const [lastSaved, setLastSaved] = useState<Date | undefined>()
  const [hasUnsavedChanges, setHasUnsavedChanges] = useState(false)
  const intervalRef = useRef<NodeJS.Timeout | null>(null)
  const lastDataRef = useRef<any>(null)

  const saveMutation = useMutation({
    mutationFn: async (data: any) => {
      const res = await fetch(`/api/claims/${claimId}/draft`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          stage,
          draftData: data
        })
      })
      if (!res.ok) throw new Error('Failed to save draft')
      return res.json()
    },
    onSuccess: () => {
      setLastSaved(new Date())
      setHasUnsavedChanges(false)
      lastDataRef.current = draftData
    },
    onError: (error) => {
      console.error('Auto-save failed:', error)
    }
  })

  // Check for changes
  useEffect(() => {
    if (JSON.stringify(draftData) !== JSON.stringify(lastDataRef.current)) {
      setHasUnsavedChanges(true)
    }
  }, [draftData])

  // Auto-save on interval
  useEffect(() => {
    if (!enabled || !draftData) return

    // Save immediately on mount if there's data
    if (lastDataRef.current === null && draftData) {
      saveMutation.mutate(draftData)
    }

    // Set up interval
    intervalRef.current = setInterval(() => {
      if (hasUnsavedChanges && draftData) {
        saveMutation.mutate(draftData)
      }
    }, interval)

    return () => {
      if (intervalRef.current) {
        clearInterval(intervalRef.current)
      }
    }
  }, [enabled, draftData, hasUnsavedChanges, interval])

  // Load draft on mount
  useEffect(() => {
    const loadDraft = async () => {
      try {
        const res = await fetch(`/api/claims/${claimId}/draft?stage=${stage}`)
        if (res.ok) {
          const data = await res.json()
          if (data.draft) {
            lastDataRef.current = data.draft.draft_data
            setLastSaved(new Date(data.draft.updated_at))
          }
        }
      } catch (error) {
        console.error('Failed to load draft:', error)
      }
    }

    loadDraft()
  }, [claimId, stage])

  const clearDraft = async () => {
    try {
      await fetch(`/api/claims/${claimId}/draft?stage=${stage}`, {
        method: 'DELETE'
      })
      setLastSaved(undefined)
      setHasUnsavedChanges(false)
      lastDataRef.current = null
    } catch (error) {
      console.error('Failed to clear draft:', error)
    }
  }

  return {
    isSaving: saveMutation.isPending,
    lastSaved,
    hasUnsavedChanges,
    clearDraft
  }
}


