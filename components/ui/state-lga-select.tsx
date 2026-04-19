"use client"

import * as React from "react"
import { getStates, getLGAsForState, isValidState, isValidLGA } from "@/lib/states"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { Label } from "@/components/ui/label"
import { cn } from "@/lib/utils"

interface StateSelectProps {
  value?: string
  onValueChange?: (value: string) => void
  placeholder?: string
  disabled?: boolean
  className?: string
  label?: string
  required?: boolean
}

export function StateSelect({
  value,
  onValueChange,
  placeholder = "Select a state",
  disabled = false,
  className,
  label,
  required = false,
}: StateSelectProps) {
  const states = getStates()

  return (
    <div className="space-y-2">
      {label && (
        <Label htmlFor="state-select" className={cn(required && "after:content-['*'] after:text-red-500")}>
          {label}
        </Label>
      )}
      <Select
        value={value}
        onValueChange={onValueChange}
        disabled={disabled}
      >
        <SelectTrigger className={cn("w-full", className)} id="state-select">
          <SelectValue placeholder={placeholder} />
        </SelectTrigger>
        <SelectContent>
          {states.map((state) => (
            <SelectItem key={state.name} value={state.name}>
              {state.name} ({state.lgas.length} LGAs)
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
    </div>
  )
}

interface LGASelectProps {
  state?: string
  value?: string
  onValueChange?: (value: string) => void
  placeholder?: string
  disabled?: boolean
  className?: string
  label?: string
  required?: boolean
}

export function LGASelect({
  state,
  value,
  onValueChange,
  placeholder = "Select an LGA",
  disabled = false,
  className,
  label,
  required = false,
}: LGASelectProps) {
  const lgas = state ? getLGAsForState(state) : []
  const isDisabled = disabled || !state || lgas.length === 0

  // Clear LGA value if state changes and current LGA is not valid for new state
  React.useEffect(() => {
    if (value && state && !isValidLGA(value, state)) {
      onValueChange?.("")
    }
  }, [state, value, onValueChange])

  return (
    <div className="space-y-2">
      {label && (
        <Label htmlFor="lga-select" className={cn(required && "after:content-['*'] after:text-red-500")}>
          {label}
        </Label>
      )}
      <Select
        value={value}
        onValueChange={onValueChange}
        disabled={isDisabled}
      >
        <SelectTrigger className={cn("w-full", className)} id="lga-select">
          <SelectValue 
            placeholder={
              !state 
                ? "Select a state first" 
                : lgas.length === 0 
                ? "No LGAs available" 
                : placeholder
            } 
          />
        </SelectTrigger>
        <SelectContent>
          {lgas.map((lga) => (
            <SelectItem key={lga} value={lga}>
              {lga}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
    </div>
  )
}

interface StateLGASelectProps {
  state?: string
  lga?: string
  onStateChange?: (value: string) => void
  onLGAChange?: (value: string) => void
  disabled?: boolean
  className?: string
  showLabels?: boolean
  required?: boolean
  statePlaceholder?: string
  lgaPlaceholder?: string
}

export function StateLGASelect({
  state,
  lga,
  onStateChange,
  onLGAChange,
  disabled = false,
  className,
  showLabels = true,
  required = false,
  statePlaceholder = "Select a state",
  lgaPlaceholder = "Select an LGA",
}: StateLGASelectProps) {
  return (
    <div className={cn("grid grid-cols-1 gap-4 md:grid-cols-2", className)}>
      <StateSelect
        value={state}
        onValueChange={onStateChange}
        placeholder={statePlaceholder}
        disabled={disabled}
        label={showLabels ? "State" : undefined}
        required={required}
      />
      <LGASelect
        state={state}
        value={lga}
        onValueChange={onLGAChange}
        placeholder={lgaPlaceholder}
        disabled={disabled}
        label={showLabels ? "LGA" : undefined}
        required={required}
      />
    </div>
  )
}

// Hook for managing state and LGA selection
export function useStateLGASelection(initialState?: string, initialLGA?: string) {
  const [state, setState] = React.useState<string>(initialState || "")
  const [lga, setLGA] = React.useState<string>(initialLGA || "")

  const handleStateChange = React.useCallback((newState: string) => {
    setState(newState)
    // Clear LGA if it's not valid for the new state
    if (lga && !isValidLGA(lga, newState)) {
      setLGA("")
    }
  }, [lga])

  const handleLGAChange = React.useCallback((newLGA: string) => {
    setLGA(newLGA)
  }, [])

  const isValid = React.useMemo(() => {
    if (!state) return false
    if (!lga) return false
    return isValidState(state) && isValidLGA(lga, state)
  }, [state, lga])

  const reset = React.useCallback(() => {
    setState("")
    setLGA("")
  }, [])

  return {
    state,
    lga,
    setState: handleStateChange,
    setLGA: handleLGAChange,
    isValid,
    reset,
    availableLGAs: state ? getLGAsForState(state) : [],
  }
}
