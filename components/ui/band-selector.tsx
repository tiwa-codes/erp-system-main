"use client"

import { useState, useEffect } from "react"
import { Checkbox } from "@/components/ui/checkbox"
import { Label } from "@/components/ui/label"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { useQuery } from "@tanstack/react-query"

interface BandLabel {
  id: string
  label: string
  description?: string
  status: string
}

interface BandSelectorProps {
  selectedBands: string[]
  onBandsChange: (bands: string[]) => void
  disabled?: boolean
  className?: string
}

export function BandSelector({ selectedBands, onBandsChange, disabled = false, className = "" }: BandSelectorProps) {
  // Fetch band labels
  const { data: bandLabelsData, isLoading, error } = useQuery({
    queryKey: ["band-labels"],
    queryFn: async () => {
      const res = await fetch("/api/underwriting/band-labels?status=ACTIVE")
      if (!res.ok) throw new Error("Failed to fetch band labels")
      return res.json()
    }
  })


  const bandLabels = bandLabelsData?.band_labels || []

  const handleBandToggle = (bandLabel: string) => {
    if (disabled) return
    
    const newSelectedBands = selectedBands.includes(bandLabel)
      ? selectedBands.filter(band => band !== bandLabel)
      : [...selectedBands, bandLabel]
    
    onBandsChange(newSelectedBands)
  }

  const handleSelectAll = () => {
    if (disabled) return
    onBandsChange(bandLabels.map((band: BandLabel) => band.label))
  }

  const handleSelectNone = () => {
    if (disabled) return
    onBandsChange([])
  }

  if (isLoading) {
    return (
      <Card className={className}>
        <CardHeader>
          <CardTitle>Band Selection</CardTitle>
          <CardDescription>Loading available bands...</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="space-y-2">
            {[1, 2, 3].map((i) => (
              <div key={i} className="flex items-center space-x-2">
                <div className="h-4 w-4 bg-gray-200 rounded animate-pulse" />
                <div className="h-4 w-32 bg-gray-200 rounded animate-pulse" />
              </div>
            ))}
          </div>
        </CardContent>
      </Card>
    )
  }

  if (error) {
    return (
      <Card className={className}>
        <CardHeader>
          <CardTitle>Band Selection</CardTitle>
          <CardDescription>Error loading bands</CardDescription>
        </CardHeader>
        <CardContent>
          <p className="text-red-600">Error: {error.message}</p>
        </CardContent>
      </Card>
    )
  }

  return (
    <Card className={className}>
      <CardHeader>
        <CardTitle>Band Selection</CardTitle>
        <CardDescription>
          Select the bands this provider will be associated with. Multiple bands can be selected.
        </CardDescription>
        {!disabled && (
          <div className="flex gap-2 mt-2">
            <button
              type="button"
              onClick={handleSelectAll}
              className="text-sm text-blue-600 hover:text-blue-800 underline"
            >
              Select All
            </button>
            <button
              type="button"
              onClick={handleSelectNone}
              className="text-sm text-gray-600 hover:text-gray-800 underline"
            >
              Select None
            </button>
          </div>
        )}
      </CardHeader>
      <CardContent>
        <div className="space-y-3">
          {bandLabels.length === 0 ? (
            <p className="text-sm text-gray-500">No active band labels found.</p>
          ) : (
            bandLabels.map((band: BandLabel) => (
              <div key={band.id} className="flex items-center space-x-3">
                <Checkbox
                  id={`band-${band.id}`}
                  checked={selectedBands.includes(band.label)}
                  onCheckedChange={() => handleBandToggle(band.label)}
                  disabled={disabled}
                />
                <Label 
                  htmlFor={`band-${band.id}`} 
                  className="flex-1 cursor-pointer"
                >
                  <div className="flex items-center justify-between">
                    <span className="font-medium">{band.label}</span>
                    {band.description && (
                      <span className="text-sm text-gray-500 ml-2">
                        {band.description}
                      </span>
                    )}
                  </div>
                </Label>
              </div>
            ))
          )}
        </div>
        
        {selectedBands.length > 0 && (
          <div className="mt-4 pt-3 border-t">
            <div className="flex flex-wrap gap-2">
              <span className="text-sm font-medium text-gray-700">Selected bands:</span>
              {selectedBands.map((band) => (
                <Badge key={band} variant="secondary" className="text-xs">
                  {band}
                </Badge>
              ))}
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  )
}
