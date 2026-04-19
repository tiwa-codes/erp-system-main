"use client"

import { Check, User, Monitor, RefreshCw } from "lucide-react"
import { cn } from "@/lib/utils"

export type VettingStage = 'vetter1' | 'vetter2' | 'audit' | 'approval'

interface VettingProgressTrackerProps {
  currentStage: VettingStage
  completedStages?: VettingStage[]
  className?: string
}

const stages: Array<{
  key: VettingStage
  label: string
  description: string
  icon: React.ComponentType<{ className?: string }>
  color: string
  bgColor: string
}> = [
  {
    key: 'vetter1',
    label: 'Vetted',
    description: 'Initial vetting complete',
    icon: User,
    color: 'text-green-600',
    bgColor: 'bg-green-50'
  },
  {
    key: 'vetter2',
    label: 'Vetter 2 Review',
    description: 'Vetter 2 Process',
    icon: User,
    color: 'text-purple-600',
    bgColor: 'bg-purple-50'
  },
  {
    key: 'audit',
    label: 'Audit Review',
    description: 'Quality assurance check',
    icon: Monitor,
    color: 'text-orange-600',
    bgColor: 'bg-orange-50'
  },
  {
    key: 'approval',
    label: 'MD',
    description: 'Final Approval',
    icon: RefreshCw,
    color: 'text-blue-600',
    bgColor: 'bg-blue-50'
  }
]

export function VettingProgressTracker({
  currentStage,
  completedStages = [],
  className
}: VettingProgressTrackerProps) {
  const currentIndex = stages.findIndex(s => s.key === currentStage)

  return (
    <div className={cn("w-full", className)}>
      <div className="flex items-center justify-between relative">
        {/* Progress line */}
        <div className="absolute top-5 left-0 right-0 h-0.5 bg-gray-200 z-0" />
        <div
          className="absolute top-5 left-0 h-0.5 bg-green-500 z-0 transition-all duration-300"
          style={{
            width: `${(currentIndex / (stages.length - 1)) * 100}%`
          }}
        />

        {/* Stage indicators */}
        {stages.map((stage, index) => {
          const isCompleted = completedStages.includes(stage.key) || index < currentIndex
          const isCurrent = stage.key === currentStage
          const Icon = stage.icon

          return (
            <div key={stage.key} className="relative z-10 flex flex-col items-center">
              {/* Stage circle */}
              <div
                className={cn(
                  "w-10 h-10 rounded-full flex items-center justify-center border-2 transition-all",
                  isCompleted
                    ? "bg-green-500 border-green-500 text-white"
                    : isCurrent
                    ? `${stage.bgColor} ${stage.color} border-2 border-current`
                    : "bg-white border-gray-300 text-gray-400"
                )}
              >
                {isCompleted ? (
                  <Check className="w-5 h-5" />
                ) : (
                  <Icon className={cn("w-5 h-5", isCurrent ? "text-current" : "")} />
                )}
              </div>

              {/* Stage label */}
              <div className="mt-2 text-center max-w-[120px]">
                <div
                  className={cn(
                    "text-xs font-medium",
                    isCurrent || isCompleted
                      ? "text-gray-900"
                      : "text-gray-500"
                  )}
                >
                  {stage.label}
                </div>
                <div
                  className={cn(
                    "text-xs mt-0.5",
                    isCurrent || isCompleted
                      ? "text-gray-600"
                      : "text-gray-400"
                  )}
                >
                  {stage.description}
                </div>
              </div>
            </div>
          )
        })}
      </div>
    </div>
  )
}

