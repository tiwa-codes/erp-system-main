"use client"

import { useState, useEffect } from "react"
import { useQuery } from "@tanstack/react-query"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Badge } from "@/components/ui/badge"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { 
  Download, 
  FileSpreadsheet,
  FileText,
  Calendar,
  User,
  Settings
} from "lucide-react"
import { PermissionGate } from "@/components/ui/permission-gate"

interface HistoryRecord {
  id: string
  date: string
  claim_id: string
  provider: string
  user_role: string
  action_taken: string
  comment: string
  status: string
}

export default function HistoryReportPage() {
  // State for filters
  const [startDate, setStartDate] = useState("")
  const [endDate, setEndDate] = useState("")
  const [selectedUser, setSelectedUser] = useState("all")
  const [selectedAction, setSelectedAction] = useState("all")
  const [currentPage, setCurrentPage] = useState(1)
  const [limit] = useState(10)

  // Fetch history records
  const { data: historyData, isLoading } = useQuery({
    queryKey: ["fraud-history", currentPage, limit, startDate, endDate, selectedUser, selectedAction],
    queryFn: async () => {
      const params = new URLSearchParams({
        page: currentPage.toString(),
        limit: limit.toString(),
        ...(startDate && { start_date: startDate }),
        ...(endDate && { end_date: endDate }),
        ...(selectedUser !== "all" && { user: selectedUser }),
        ...(selectedAction !== "all" && { action: selectedAction }),
      })
      
      const res = await fetch(`/api/claims/fraud/history?${params}`)
      if (!res.ok) {
        throw new Error("Failed to fetch history records")
      }
      return res.json()
    },
  })

  // Fetch users for filter
  const { data: usersData } = useQuery({
    queryKey: ["fraud-users"],
    queryFn: async () => {
      const res = await fetch("/api/claims/fraud/users")
      if (!res.ok) {
        throw new Error("Failed to fetch users")
      }
      return res.json()
    },
  })

  const historyRecords = historyData?.records || []
  const pagination = historyData?.pagination

  // Handle filter changes
  const handleFilterChange = () => {
    setCurrentPage(1)
  }

  // Handle export
  const handleExport = async (format: 'excel' | 'pdf') => {
    try {
      const params = new URLSearchParams({
        ...(startDate && { start_date: startDate }),
        ...(endDate && { end_date: endDate }),
        ...(selectedUser !== "all" && { user: selectedUser }),
        ...(selectedAction !== "all" && { action: selectedAction }),
        format: format
      })
      
      const res = await fetch(`/api/claims/fraud/history/export?${params}`)
      if (!res.ok) {
        throw new Error("Failed to export history")
      }
      
      const blob = await res.blob()
      const url = window.URL.createObjectURL(blob)
      const a = document.createElement('a')
      a.href = url
      a.download = `fraud-history-${new Date().toISOString().split('T')[0]}.${format === 'excel' ? 'xlsx' : 'pdf'}`
      document.body.appendChild(a)
      a.click()
      window.URL.revokeObjectURL(url)
      document.body.removeChild(a)
    } catch (error) {
      console.error('Export error:', error)
    }
  }

  // Get status badge color
  const getStatusBadgeColor = (status: string) => {
    if (!status) return 'bg-gray-100 text-gray-800'
    
    switch (status.toLowerCase()) {
      case 'rejected':
        return 'bg-red-100 text-red-800'
      case 'approved':
        return 'bg-green-100 text-green-800'
      case 'investigation':
        return 'bg-yellow-100 text-yellow-800'
      case 'flagged':
        return 'bg-orange-100 text-orange-800'
      default:
        return 'bg-gray-100 text-gray-800'
    }
  }

  return (
    <PermissionGate module="claims" action="fraud_detection">
      <div className="space-y-6">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-3xl font-bold text-gray-900">History Report</h1>
            <p className="text-gray-600">Track fraud detection and investigation actions</p>
          </div>
        </div>

        {/* Filters */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Settings className="h-5 w-5 text-blue-600" />
              Filter History
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
              <div>
                <label className="text-sm font-medium">Start Date</label>
                <div className="relative">
                  <Calendar className="absolute left-3 top-3 h-4 w-4 text-gray-400" />
                  <Input
                    type="date"
                    placeholder="Select"
                    value={startDate}
                    onChange={(e) => {
                      setStartDate(e.target.value)
                      handleFilterChange()
                    }}
                    className="pl-10"
                  />
                </div>
              </div>
              <div>
                <label className="text-sm font-medium">End Date</label>
                <div className="relative">
                  <Calendar className="absolute left-3 top-3 h-4 w-4 text-gray-400" />
                  <Input
                    type="date"
                    placeholder="Select"
                    value={endDate}
                    onChange={(e) => {
                      setEndDate(e.target.value)
                      handleFilterChange()
                    }}
                    className="pl-10"
                  />
                </div>
              </div>
              <div>
                <label className="text-sm font-medium">User</label>
                <div className="relative">
                  <User className="absolute left-3 top-3 h-4 w-4 text-gray-400" />
                  <Select value={selectedUser} onValueChange={(value) => {
                    setSelectedUser(value)
                    handleFilterChange()
                  }}>
                    <SelectTrigger className="pl-10">
                      <SelectValue placeholder="User" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all">All Users</SelectItem>
                      {usersData?.users?.map((user: any) => (
                        <SelectItem key={user.id} value={user.id}>
                          {user.first_name} {user.last_name} ({user.role})
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              </div>
              <div>
                <label className="text-sm font-medium">Action Type</label>
                <Select value={selectedAction} onValueChange={(value) => {
                  setSelectedAction(value)
                  handleFilterChange()
                }}>
                  <SelectTrigger>
                    <SelectValue placeholder="Action" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">All Actions</SelectItem>
                    <SelectItem value="rejected">Rejected</SelectItem>
                    <SelectItem value="approved">Approved</SelectItem>
                    <SelectItem value="investigation">Sent to Investigation</SelectItem>
                    <SelectItem value="flagged">Flagged</SelectItem>
                    <SelectItem value="investigated">Investigated</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* History Report */}
        <Card>
          <CardHeader>
            <div className="flex items-center justify-between">
              <div>
                <CardTitle>History Report</CardTitle>
                <CardDescription>Chronological log of fraud-related actions</CardDescription>
              </div>
              <div className="flex gap-2">
                <Button 
                  onClick={() => handleExport('excel')}
                  className="bg-green-600 hover:bg-green-700"
                >
                  <FileSpreadsheet className="h-4 w-4 mr-2" />
                  Export Excel
                </Button>
                <Button 
                  onClick={() => handleExport('pdf')}
                  className="bg-red-600 hover:bg-red-700"
                >
                  <FileText className="h-4 w-4 mr-2" />
                  Export PDF
                </Button>
              </div>
            </div>
          </CardHeader>
          <CardContent>
            {isLoading ? (
              <div className="flex items-center justify-center py-8">
                <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
              </div>
            ) : (
              <>
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead className="text-xs font-medium text-gray-600">DATE</TableHead>
                      <TableHead className="text-xs font-medium text-gray-600">CLAIM ID</TableHead>
                      <TableHead className="text-xs font-medium text-gray-600">PROVIDER</TableHead>
                      <TableHead className="text-xs font-medium text-gray-600">USER/ROLE</TableHead>
                      <TableHead className="text-xs font-medium text-gray-600">ACTION TAKEN</TableHead>
                      <TableHead className="text-xs font-medium text-gray-600">COMMENT</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {historyRecords.map((record: HistoryRecord) => (
                      <TableRow key={record.id}>
                        <TableCell>
                          {new Date(record.date).toLocaleDateString('en-GB')}
                        </TableCell>
                        <TableCell className="font-medium">
                          {record.claim_id}
                        </TableCell>
                        <TableCell>
                          {record.provider}
                        </TableCell>
                        <TableCell>
                          {record.user_role}
                        </TableCell>
                        <TableCell>
                          <Badge className={getStatusBadgeColor(record.action_taken)}>
                            {record.action_taken}
                          </Badge>
                        </TableCell>
                        <TableCell>
                          <span className="text-sm text-gray-600">
                            {record.comment || '...'}
                          </span>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>

                {/* Pagination */}
                {pagination && (
                  <div className="flex items-center justify-between mt-4">
                    <p className="text-sm text-gray-600">
                      Showing {((pagination.page - 1) * pagination.limit) + 1} to {Math.min(pagination.page * pagination.limit, pagination.total)} of {pagination.total} results
                    </p>
                    <div className="flex items-center gap-2">
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => setCurrentPage(prev => Math.max(prev - 1, 1))}
                        disabled={pagination.page === 1}
                      >
                        Previous
                      </Button>
                      <span className="text-sm">
                        Page {pagination.page} of {pagination.pages}
                      </span>
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => setCurrentPage(prev => Math.min(prev + 1, pagination.pages))}
                        disabled={pagination.page === pagination.pages}
                      >
                        Next
                      </Button>
                    </div>
                  </div>
                )}
              </>
            )}
          </CardContent>
        </Card>
      </div>
    </PermissionGate>
  )
}
