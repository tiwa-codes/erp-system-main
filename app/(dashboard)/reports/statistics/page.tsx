"use client"

export const dynamic = 'force-dynamic'

import { useState } from "react"
import { useQuery } from "@tanstack/react-query"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Label } from "@/components/ui/label"
import { Calendar } from "@/components/ui/calendar"
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover"
import { Calendar as CalendarIcon, Filter, Users, Building, MapPin, TrendingUp } from "lucide-react"
import { format } from "date-fns"
import { PermissionGate } from "@/components/ui/permission-gate"
import { Badge } from "@/components/ui/badge"



export default function StatisticsPage() {
  const [startDate, setStartDate] = useState<Date | undefined>(undefined)
  const [endDate, setEndDate] = useState<Date | undefined>(undefined)
  const [hasFiltered, setHasFiltered] = useState(false)

  // Fetch statistics data
  const { data: statisticsData, isLoading } = useQuery({
    queryKey: ["telemedicine-statistics", startDate, endDate],
    queryFn: async () => {
      const params = new URLSearchParams()
      if (startDate) {
        params.append("from", startDate.toISOString())
      }
      if (endDate) {
        params.append("to", endDate.toISOString())
      }

      const res = await fetch(`/api/reports/telemedicine-statistics?${params}`)
      if (!res.ok) {
        throw new Error("Failed to fetch statistics")
      }
      return res.json()
    },
    enabled: hasFiltered || (!startDate && !endDate) // Fetch on load or when filtered
  })

  const handleFilter = () => {
    setHasFiltered(true)
  }

  const handleClearFilter = () => {
    setStartDate(undefined)
    setEndDate(undefined)
    setHasFiltered(false)
  }

  const totalPatients = statisticsData?.totalPatients || 0
  const patientsByOrganization = statisticsData?.patientsByOrganization || []
  const patientsByState = statisticsData?.patientsByState || []

  return (
    <PermissionGate module="reports" action="view">
      <div className="space-y-6">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-3xl font-bold text-gray-900">Telemedicine Statistics</h1>
            <p className="text-gray-600">View unique patients from telemedicine appointments by organization and state (includes both principals and dependents)</p>
          </div>
        </div>

        {/* Date Filter */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Filter className="h-5 w-5" />
              Date Filter
            </CardTitle>
            <CardDescription>
              Filter statistics by appointment date range
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="flex flex-col gap-4">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label>Start Date (From)</Label>
                  <Popover>
                    <PopoverTrigger asChild>
                      <Button
                        variant="outline"
                        className="w-full justify-start text-left font-normal"
                      >
                        <CalendarIcon className="mr-2 h-4 w-4" />
                        {startDate ? format(startDate, "PPP") : <span>Pick a date</span>}
                      </Button>
                    </PopoverTrigger>
                    <PopoverContent className="w-auto p-0" align="start">
                      <Calendar
                        mode="single"
                        selected={startDate}
                        onSelect={setStartDate}
                        initialFocus
                      />
                    </PopoverContent>
                  </Popover>
                </div>

                <div className="space-y-2">
                  <Label>End Date (To)</Label>
                  <Popover>
                    <PopoverTrigger asChild>
                      <Button
                        variant="outline"
                        className="w-full justify-start text-left font-normal"
                      >
                        <CalendarIcon className="mr-2 h-4 w-4" />
                        {endDate ? format(endDate, "PPP") : <span>Pick a date</span>}
                      </Button>
                    </PopoverTrigger>
                    <PopoverContent className="w-auto p-0" align="start">
                      <Calendar
                        mode="single"
                        selected={endDate}
                        onSelect={setEndDate}
                        initialFocus
                      />
                    </PopoverContent>
                  </Popover>
                </div>
              </div>

              <div className="flex gap-2">
                <Button onClick={handleFilter} className="flex-1 bg-[#0891B2] hover:bg-[#9B1219] text-white">
                  <Filter className="h-4 w-4 mr-2" />
                  Apply Filter
                </Button>
                <Button onClick={handleClearFilter} variant="outline" className="flex-1">
                  Clear Filter
                </Button>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Statistics Cards */}
        {isLoading ? (
          <div className="flex items-center justify-center py-12">
            <div className="text-center">
              <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600 mx-auto"></div>
              <p className="mt-2 text-gray-600">Loading statistics...</p>
            </div>
          </div>
        ) : (
          <>
            {/* Total Enrollees Card */}
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Users className="h-5 w-5 text-[#0891B2]" />
                  Total Enrollees
                </CardTitle>
                <CardDescription>
                  Total number of enrollees (principals + dependents)
                </CardDescription>
              </CardHeader>
              <CardContent>
                <div className="text-center py-8">
                  <div className="text-5xl font-bold text-[#0891B2] mb-2">
                    {totalPatients.toLocaleString()}
                  </div>
                  <p className="text-gray-600">Enrollees</p>
                </div>
              </CardContent>
            </Card>

            {/* Enrollees by Organization */}
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Building className="h-5 w-5 text-green-600" />
                  Enrollees by Organization
                </CardTitle>
                <CardDescription>
                  Number of enrollees grouped by organization (principals + dependents)
                </CardDescription>
              </CardHeader>
              <CardContent>
                {patientsByOrganization.length === 0 ? (
                  <div className="text-center py-8 text-gray-500">
                    No data available for the selected date range
                  </div>
                ) : (
                  <div className="space-y-4">
                    {patientsByOrganization.map((item: any, index: number) => (
                      <div
                        key={index}
                        className="flex items-center justify-between p-4 border rounded-lg hover:bg-gray-50 transition-colors"
                      >
                        <div className="flex items-center gap-3">
                          <div className="w-10 h-10 rounded-full bg-green-100 flex items-center justify-center">
                            <Building className="h-5 w-5 text-green-600" />
                          </div>
                          <div>
                            <p className="font-semibold text-gray-900">{item.organization_name || 'Unknown Organization'}</p>
                            <p className="text-sm text-gray-500">Organization</p>
                          </div>
                        </div>
                        <div className="text-right">
                          <Badge variant="secondary" className="text-lg px-3 py-1">
                            {item.patient_count.toLocaleString()} {item.patient_count === 1 ? 'enrollee' : 'enrollees'}
                          </Badge>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </CardContent>
            </Card>

            {/* Enrollees by State */}
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <MapPin className="h-5 w-5 text-purple-600" />
                  Enrollees by State
                </CardTitle>
                <CardDescription>
                  Number of enrollees grouped by state (principals + dependents)
                </CardDescription>
              </CardHeader>
              <CardContent>
                {patientsByState.length === 0 ? (
                  <div className="text-center py-8 text-gray-500">
                    No data available for the selected date range
                  </div>
                ) : (
                  <div className="space-y-4">
                    {patientsByState.map((item: any, index: number) => (
                      <div
                        key={index}
                        className="flex items-center justify-between p-4 border rounded-lg hover:bg-gray-50 transition-colors"
                      >
                        <div className="flex items-center gap-3">
                          <div className="w-10 h-10 rounded-full bg-purple-100 flex items-center justify-center">
                            <MapPin className="h-5 w-5 text-purple-600" />
                          </div>
                          <div>
                            <p className="font-semibold text-gray-900">{item.state || 'Unknown State'}</p>
                            <p className="text-sm text-gray-500">State</p>
                          </div>
                        </div>
                        <div className="text-right">
                          <Badge variant="secondary" className="text-lg px-3 py-1">
                            {item.patient_count.toLocaleString()} {item.patient_count === 1 ? 'enrollee' : 'enrollees'}
                          </Badge>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </CardContent>
            </Card>
          </>
        )}
      </div>
    </PermissionGate>
  )
}
