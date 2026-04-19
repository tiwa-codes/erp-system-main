"use client"

import { useState, useEffect } from "react"
import { useRouter } from "next/navigation"
import { useQuery } from "@tanstack/react-query"
import { useToast } from "@/hooks/use-toast"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Badge } from "@/components/ui/badge"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { 
  Search, 
  Filter, 
  Eye, 
  CheckCircle, 
  XCircle, 
  Clock, 
  AlertTriangle,
  FileText,
  TrendingUp,
  Users,
  DollarSign,
  Shield,
  Download,
  BarChart3,
  PieChart,
  Calendar,
  User,
  Activity
} from "lucide-react"
import { PermissionGate } from "@/components/ui/permission-gate"

interface InvestigationRecord {
  id: string
  date: string
  claim_id: string
  provider: string
  user_role: string
  action_taken: string
  comment: string
  status: 'approved' | 'rejected' | 'investigating' | 'escalated'
}

export default function InvestigationHistoryPage() {
  const router = useRouter()
  const { toast } = useToast()
  
  // State for filters
  const [startDate, setStartDate] = useState("")
  const [endDate, setEndDate] = useState("")
  const [selectedUser, setSelectedUser] = useState("all")
  const [selectedAction, setSelectedAction] = useState("all")
  const [currentPage, setCurrentPage] = useState(1)
  const [limit] = useState(10)

  // Fetch investigation history
  const { data: historyData, isLoading } = useQuery({
    queryKey: ["investigation-history", currentPage, limit, startDate, endDate, selectedUser, selectedAction],
    queryFn: async () => {
      const params = new URLSearchParams({
        page: currentPage.toString(),
        limit: limit.toString(),
        ...(startDate && { start_date: startDate }),
        ...(endDate && { end_date: endDate }),
        ...(selectedUser !== "all" && { user: selectedUser }),
        ...(selectedAction !== "all" && { action: selectedAction }),
      })
      
      const res = await fetch(`/api/claims/investigation/history?${params}`)
      if (!res.ok) {
        throw new Error("Failed to fetch investigation history")
      }
      return res.json()
    },
  })

  // Fetch users for filter
  const { data: usersData } = useQuery({
    queryKey: ["users"],
    queryFn: async () => {
      const res = await fetch("/api/users")
      if (!res.ok) {
        throw new Error("Failed to fetch users")
      }
      return res.json()
    },
  })

  const history = historyData?.records || []
  const pagination = historyData?.pagination

  // Mock data for demonstration
  const mockHistory: InvestigationRecord[] = [
    {
      id: "1",
      date: "09-07-2025",
      claim_id: "CLM/LH/009",
      provider: "LIMI Hospital",
      user_role: "System (AI Model)",
      action_taken: "Rejected",
      comment: "Risk score 92%. Triggered 3 rules.",
      status: "rejected"
    },
    {
      id: "2",
      date: "09-07-2025",
      claim_id: "CLM/LH/009",
      provider: "LIMI Hospital",
      user_role: "Fraud Analyst",
      action_taken: "Sent to Investigation",
      comment: "Recommended escalation.",
      status: "investigating"
    },
    {
      id: "3",
      date: "08-07-2025",
      claim_id: "CLM/LH/009",
      provider: "LIMI Hospital",
      user_role: "Investigation Lead",
      action_taken: "Investigation Lead",
      comment: "Asked provider for surgery records & patient chart.",
      status: "investigating"
    },
    {
      id: "4",
      date: "10-07-2025",
      claim_id: "CLM/LH/009",
      provider: "LIMI Hospital",
      user_role: "Investigator",
      action_taken: "Submitted requested documents",
      comment: "Uploaded files via portal.",
      status: "investigating"
    },
    {
      id: "5",
      date: "10-07-2025",
      claim_id: "CLM/LH/009",
      provider: "LIMI Hospital",
      user_role: "Compliance Officer",
      action_taken: "Approved",
      comment: "",
      status: "approved"
    }
  ]

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
        format
      })
      
      const res = await fetch(`/api/claims/investigation/history/export?${params}`)
      if (!res.ok) {
        throw new Error(`Failed to export ${format}`)
      }
      
      const blob = await res.blob()
      const url = window.URL.createObjectURL(blob)
      const a = document.createElement('a')
      a.href = url
      a.download = `investigation-history-${new Date().toISOString().split('T')[0]}.${format === 'excel' ? 'xlsx' : 'pdf'}`
      document.body.appendChild(a)
      a.click()
      window.URL.revokeObjectURL(url)
      document.body.removeChild(a)
      
      toast({
        title: "Success",
        description: `${format.toUpperCase()} report exported successfully`,
      })
    } catch (error) {
      toast({
        title: "Error",
        description: `Failed to export ${format}`,
        variant: "destructive",
      })
    }
  }

  // Get status badge color
  const getStatusBadgeColor = (status: string) => {
    switch (status.toLowerCase()) {
      case 'approved':
        return 'bg-green-100 text-green-800'
      case 'rejected':
        return 'bg-red-100 text-red-800'
      case 'investigating':
        return 'bg-yellow-100 text-yellow-800'
      case 'escalated':
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
            <h1 className="text-3xl font-bold text-gray-900">Investigation History</h1>
            <p className="text-gray-600">Track and monitor investigation activities</p>
          </div>
        </div>

        {/* Filters */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Filter className="h-5 w-5 text-blue-600" />
              Investigation Filters
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-1 md:grid-cols-5 gap-4">
              <div>
                <label className="text-sm font-medium">Start Date</label>
                <Input
                  type="date"
                  placeholder="Select"
                  value={startDate}
                  onChange={(e) => {
                    setStartDate(e.target.value)
                    handleFilterChange()
                  }}
                />
              </div>
              <div>
                <label className="text-sm font-medium">End Date</label>
                <Input
                  type="date"
                  placeholder="Select"
                  value={endDate}
                  onChange={(e) => {
                    setEndDate(e.target.value)
                    handleFilterChange()
                  }}
                />
              </div>
              <div>
                <label className="text-sm font-medium">User</label>
                <Select value={selectedUser} onValueChange={(value) => {
                  setSelectedUser(value)
                  handleFilterChange()
                }}>
                  <SelectTrigger>
                    <SelectValue placeholder="User" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">All Users</SelectItem>
                    {usersData?.users?.map((user: any) => (
                      <SelectItem key={user.id} value={user.id}>
                        {user.first_name} {user.last_name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
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
                    <SelectItem value="approved">Approved</SelectItem>
                    <SelectItem value="rejected">Rejected</SelectItem>
                    <SelectItem value="investigating">Investigating</SelectItem>
                    <SelectItem value="escalated">Escalated</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="flex items-end">
                <Button onClick={handleFilterChange} className="bg-green-600 hover:bg-green-700">
                  <Filter className="h-4 w-4 mr-2" />
                  Apply Filters
                </Button>
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
                <CardDescription>Investigation activity timeline</CardDescription>
              </div>
              <div className="flex gap-2">
                <Button onClick={() => handleExport('excel')} size="sm" className="bg-green-600 hover:bg-green-700">
                  <Download className="h-4 w-4 mr-2" />
                  Export Excel
                </Button>
                <Button onClick={() => handleExport('pdf')} size="sm" className="bg-red-600 hover:bg-red-700">
                  <Download className="h-4 w-4 mr-2" />
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
                    {mockHistory.map((record) => (
                      <TableRow key={record.id}>
                        <TableCell>{record.date}</TableCell>
                        <TableCell className="font-medium">{record.claim_id}</TableCell>
                        <TableCell>{record.provider}</TableCell>
                        <TableCell>{record.user_role}</TableCell>
                        <TableCell>
                          <Badge className={getStatusBadgeColor(record.status)}>
                            {record.action_taken}
                          </Badge>
                        </TableCell>
                        <TableCell>
                          <span className="text-sm text-gray-600">
                            {record.comment || "---"}
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
