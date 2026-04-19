"use client"

import { ReactNode } from "react"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { Card, CardContent } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { ChevronDown, ChevronUp } from "lucide-react"
import { useState } from "react"

interface Column {
  key: string
  label: string
  render?: (value: any, row: any) => ReactNode
  className?: string
  mobileHidden?: boolean
}

interface ResponsiveTableProps {
  columns: Column[]
  data: any[]
  mobileCard?: (row: any) => ReactNode
  className?: string
}

export function ResponsiveTable({ columns, data, mobileCard, className = "" }: ResponsiveTableProps) {
  const [expandedRows, setExpandedRows] = useState<Set<string>>(new Set())

  const toggleRow = (id: string) => {
    const newExpanded = new Set(expandedRows)
    if (newExpanded.has(id)) {
      newExpanded.delete(id)
    } else {
      newExpanded.add(id)
    }
    setExpandedRows(newExpanded)
  }

  const desktopColumns = columns.filter(col => !col.mobileHidden)
  const mobileColumns = columns.filter(col => !col.mobileHidden).slice(0, 3) // Show only first 3 columns on mobile

  return (
    <>
      {/* Desktop Table */}
      <div className="hidden lg:block">
        <Table className={className}>
          <TableHeader>
            <TableRow>
              {desktopColumns.map((column) => (
                <TableHead key={column.key} className={column.className}>
                  {column.label}
                </TableHead>
              ))}
            </TableRow>
          </TableHeader>
          <TableBody>
            {data.map((row, index) => (
              <TableRow key={row.id || index}>
                {desktopColumns.map((column) => (
                  <TableCell key={column.key} className={column.className}>
                    {column.render ? column.render(row[column.key], row) : row[column.key]}
                  </TableCell>
                ))}
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>

      {/* Mobile Cards */}
      <div className="lg:hidden space-y-3">
        {data.map((row, index) => {
          const isExpanded = expandedRows.has(row.id || index.toString())
          const hasMoreColumns = mobileColumns.length < columns.length

          return (
            <Card key={row.id || index} className="overflow-hidden">
              <CardContent className="p-4">
                {/* Primary Info */}
                <div className="flex items-center justify-between mb-3">
                  <div className="flex-1 min-w-0">
                    {mobileColumns.map((column, colIndex) => {
                      const value = row[column.key]
                      return (
                        <div key={column.key} className={`${colIndex > 0 ? 'mt-1' : ''}`}>
                          <span className="text-xs text-gray-500 font-medium">{column.label}:</span>
                          <div className="text-sm font-medium truncate">
                            {column.render ? column.render(value, row) : value}
                          </div>
                        </div>
                      )
                    })}
                  </div>
                  
                  {/* Expand/Collapse Button */}
                  {hasMoreColumns && (
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => toggleRow(row.id || index.toString())}
                      className="ml-2 flex-shrink-0"
                    >
                      {isExpanded ? (
                        <ChevronUp className="h-4 w-4" />
                      ) : (
                        <ChevronDown className="h-4 w-4" />
                      )}
                    </Button>
                  )}
                </div>

                {/* Expanded Content */}
                {isExpanded && hasMoreColumns && (
                  <div className="border-t pt-3 mt-3 space-y-2">
                    {columns.slice(mobileColumns.length).map((column) => {
                      const value = row[column.key]
                      return (
                        <div key={column.key} className="flex justify-between items-start">
                          <span className="text-xs text-gray-500 font-medium flex-shrink-0 mr-2">
                            {column.label}:
                          </span>
                          <div className="text-sm text-right min-w-0 flex-1">
                            {column.render ? column.render(value, row) : value}
                          </div>
                        </div>
                      )
                    })}
                  </div>
                )}

                {/* Custom Mobile Card Content */}
                {mobileCard && mobileCard(row)}
              </CardContent>
            </Card>
          )
        })}
      </div>
    </>
  )
}

// Utility function to create common column configurations
export function createColumn(
  key: string,
  label: string,
  options: {
    render?: (value: any, row: any) => ReactNode
    className?: string
    mobileHidden?: boolean
  } = {}
): Column {
  return {
    key,
    label,
    ...options
  }
}

// Common render functions
export const renderBadge = (status: string, colorMap: Record<string, string> = {}) => {
  const defaultColors = {
    active: 'bg-green-100 text-green-800',
    inactive: 'bg-red-100 text-red-800',
    pending: 'bg-yellow-100 text-yellow-800',
    completed: 'bg-green-100 text-green-800',
    processing: 'bg-yellow-100 text-yellow-800',
    failed: 'bg-red-100 text-red-800',
    approved: 'bg-green-100 text-green-800',
    rejected: 'bg-red-100 text-red-800',
  }
  
  const colorClass = colorMap[status.toLowerCase()] || defaultColors[status.toLowerCase()] || 'bg-gray-100 text-gray-800'
  
  return <Badge className={colorClass}>{status}</Badge>
}

export const renderCurrency = (amount: number) => {
  return <span className="font-semibold text-green-600">₦{amount.toLocaleString()}</span>
}

export const renderDate = (date: string | Date) => {
  return new Date(date).toLocaleDateString('en-GB')
}

export const renderActions = (actions: ReactNode) => {
  return <div className="flex items-center justify-end">{actions}</div>
}
