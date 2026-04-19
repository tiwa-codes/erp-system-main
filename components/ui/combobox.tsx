"use client"

import * as React from "react"
import { Check, ChevronsUpDown, Search, X } from "lucide-react"
import { cn } from "@/lib/utils"
import { Button } from "@/components/ui/button"
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover"

export interface ComboboxOption {
  value: string
  label: string
  subtitle?: string
}

interface ComboboxProps {
  options: ComboboxOption[]
  value?: string
  onValueChange?: (value: string) => void
  placeholder?: string
  searchPlaceholder?: string
  emptyText?: string
  className?: string
  disabled?: boolean
  clearable?: boolean
  renderOption?: (option: ComboboxOption) => React.ReactNode
  renderSelected?: (option: ComboboxOption | undefined) => React.ReactNode
}

export function Combobox({
  options,
  value,
  onValueChange,
  placeholder = "Select option...",
  searchPlaceholder = "Search...",
  emptyText = "No results found.",
  className,
  disabled = false,
  clearable = false,
  renderOption,
  renderSelected,
}: ComboboxProps) {
  const [open, setOpen] = React.useState(false)
  const [searchQuery, setSearchQuery] = React.useState("")

  const selectedOption = React.useMemo(() => {
    if (!value) return undefined

    const directMatch = options.find((option) => option.value === value)
    if (directMatch) return directMatch

    const normalizedValue = value.toLowerCase()
    return options.find((option) => option.value.toLowerCase() === normalizedValue)
  }, [options, value])

  const handleSelect = (currentValue: string) => {
    const matchedOption =
      options.find((option) => option.value === currentValue) ||
      options.find((option) => option.value.toLowerCase() === currentValue.toLowerCase())

    const normalizedCurrentValue = matchedOption?.value ?? currentValue
    const isSameValue =
      !!value && normalizedCurrentValue.toLowerCase() === value.toLowerCase()

    const newValue = isSameValue ? "" : normalizedCurrentValue
    onValueChange?.(newValue)
    setOpen(false)
    setSearchQuery("")
  }

  const handleClear = (e: React.MouseEvent) => {
    e.stopPropagation()
    onValueChange?.("")
  }

  const filteredOptions = React.useMemo(() => {
    if (!searchQuery) return options

    const query = searchQuery.toLowerCase()
    const normalizedQuery = query.replace(/[^a-z0-9]/g, "")
    const queryVariants = new Set<string>([query, normalizedQuery])

    // Common minor variation support (e.g. ALMADINAH vs ALMADINA)
    if (query.endsWith("h")) {
      queryVariants.add(query.slice(0, -1))
    }
    if (normalizedQuery.endsWith("h")) {
      queryVariants.add(normalizedQuery.slice(0, -1))
    }

    return options.filter(
      (option) => {
        const label = option.label.toLowerCase()
        const subtitle = option.subtitle?.toLowerCase() || ""
        const value = option.value.toLowerCase()
        const normalizedLabel = label.replace(/[^a-z0-9]/g, "")
        const normalizedSubtitle = subtitle.replace(/[^a-z0-9]/g, "")
        const normalizedValue = value.replace(/[^a-z0-9]/g, "")

        for (const variant of queryVariants) {
          if (!variant) continue
          if (
            label.includes(variant) ||
            subtitle.includes(variant) ||
            value.includes(variant) ||
            normalizedLabel.includes(variant) ||
            normalizedSubtitle.includes(variant) ||
            normalizedValue.includes(variant)
          ) {
            return true
          }
        }

        return false
      }
    )
  }, [options, searchQuery])

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button
          variant="outline"
          role="combobox"
          aria-expanded={open}
          className={cn(
            "w-full justify-between",
            !value && "text-muted-foreground",
            className
          )}
          disabled={disabled}
        >
          <span className="truncate">
            {renderSelected && selectedOption
              ? renderSelected(selectedOption)
              : selectedOption
                ? selectedOption.label
                : placeholder}
          </span>
          <div className="flex items-center gap-1">
            {clearable && value && !disabled && (
              <X
                className="h-4 w-4 shrink-0 opacity-50 hover:opacity-100"
                onClick={handleClear}
              />
            )}
            <ChevronsUpDown className="h-4 w-4 shrink-0 opacity-50" />
          </div>
        </Button>
      </PopoverTrigger>
      <PopoverContent className="z-[220] w-[var(--radix-popover-trigger-width)] p-0" align="start">
        <div className="flex items-center border-b px-3">
          <Search className="mr-2 h-4 w-4 shrink-0 opacity-50" />
          <input
            value={searchQuery}
            onChange={(event) => setSearchQuery(event.target.value)}
            placeholder={searchPlaceholder}
            className="flex h-10 w-full bg-transparent py-2 text-sm outline-none placeholder:text-muted-foreground"
          />
        </div>
        <div className="max-h-[300px] overflow-y-auto p-1">
          {filteredOptions.length === 0 ? (
            <div className="py-6 text-center text-sm">{emptyText}</div>
          ) : (
            filteredOptions.map((option) => (
              <button
                type="button"
                key={option.value}
                onClick={() => handleSelect(option.value)}
                className={cn(
                  "relative flex w-full cursor-pointer items-center rounded-sm px-2 py-1.5 text-left text-sm hover:bg-accent hover:text-accent-foreground",
                  selectedOption?.value === option.value && "bg-accent text-accent-foreground"
                )}
              >
                {renderOption ? (
                  renderOption(option)
                ) : (
                  <div className="flex flex-col">
                    <span>{option.label}</span>
                    {option.subtitle && (
                      <span className="text-xs text-muted-foreground">
                        {option.subtitle}
                      </span>
                    )}
                  </div>
                )}
                <Check
                  className={cn(
                    "ml-auto h-4 w-4",
                    selectedOption?.value === option.value ? "opacity-100" : "opacity-0"
                  )}
                />
              </button>
            ))
          )}
        </div>
      </PopoverContent>
    </Popover >
  )
}
