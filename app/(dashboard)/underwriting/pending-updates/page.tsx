"use client"

import { useState } from "react"
import { useQuery } from "@tanstack/react-query"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import {
    Table,
    TableBody,
    TableCell,
    TableHead,
    TableHeader,
    TableRow,
} from "@/components/ui/table"
import { Badge } from "@/components/ui/badge"
import { Search, Filter, Eye, CheckCircle, XCircle, Clock } from "lucide-react"
import { useRouter } from "next/navigation"
import { StatusText } from "@/components/ui/status-text"

export default function PendingUpdatesPage() {
    const router = useRouter()
    const [activeTab, setActiveTab] = useState("principals")
    const [search, setSearch] = useState("")
    const [sourceFilter, setSourceFilter] = useState("all")
    const [page, setPage] = useState(1)

    // Fetch pending principals
    const { data: principalsData, isLoading: principalsLoading } = useQuery({
        queryKey: ["pending-principals", search, sourceFilter, page],
        queryFn: async () => {
            const params = new URLSearchParams({
                search,
                source: sourceFilter,
                page: page.toString(),
                limit: "10",
            })
            const res = await fetch(`/api/underwriting/pending-principals?${params}`)
            if (!res.ok) throw new Error("Failed to fetch pending principals")
            return res.json()
        },
        enabled: activeTab === "principals",
    })

    // Fetch pending dependents
    const { data: dependentsData, isLoading: dependentsLoading } = useQuery({
        queryKey: ["pending-dependents", search, page],
        queryFn: async () => {
            const params = new URLSearchParams({
                search,
                page: page.toString(),
                limit: "10",
            })
            const res = await fetch(`/api/underwriting/pending-dependents?${params}`)
            if (!res.ok) throw new Error("Failed to fetch pending dependents")
            return res.json()
        },
        enabled: activeTab === "dependents",
    })

    const principals = principalsData?.registrations || []
    const dependents = dependentsData?.registrations || []
    const pagination = activeTab === "principals" ? principalsData?.pagination : dependentsData?.pagination

    const getSourceBadge = (source: string) => {
        return source === "PUBLIC_LINK" ? (
            <Badge variant="outline" className="bg-blue-50 text-blue-700 border-blue-200">
                Public Link
            </Badge>
        ) : (
            <Badge variant="outline" className="bg-purple-50 text-purple-700 border-purple-200">
                Mobile App
            </Badge>
        )
    }

    return (
        <div className="space-y-6">
            {/* Header */}
            <div>
                <h1 className="text-3xl font-bold text-gray-900">Pending Updates</h1>
                <p className="text-gray-600">Review and approve principal and dependent registrations</p>
            </div>

            {/* Tabs */}
            <Tabs value={activeTab} onValueChange={setActiveTab}>
                <TabsList className="grid w-full max-w-md grid-cols-2">
                    <TabsTrigger value="principals">
                        <Clock className="h-4 w-4 mr-2" />
                        Pending Principals
                    </TabsTrigger>
                    <TabsTrigger value="dependents">
                        <Clock className="h-4 w-4 mr-2" />
                        Pending Dependents
                    </TabsTrigger>
                </TabsList>

                {/* Principals Tab */}
                <TabsContent value="principals" className="space-y-4">
                    <Card>
                        <CardHeader>
                            <CardTitle>Pending Principal Registrations</CardTitle>
                            <CardDescription>
                                Review and approve principal registrations from public link and mobile app
                            </CardDescription>
                        </CardHeader>
                        <CardContent>
                            {/* Filters */}
                            <div className="flex gap-4 mb-6">
                                <div className="flex-1">
                                    <div className="relative">
                                        <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 h-4 w-4" />
                                        <Input
                                            placeholder="Search by name or email..."
                                            value={search}
                                            onChange={(e) => setSearch(e.target.value)}
                                            className="pl-10"
                                        />
                                    </div>
                                </div>
                                <Select value={sourceFilter} onValueChange={setSourceFilter}>
                                    <SelectTrigger className="w-[200px]">
                                        <SelectValue placeholder="Filter by source" />
                                    </SelectTrigger>
                                    <SelectContent>
                                        <SelectItem value="all">All Sources</SelectItem>
                                        <SelectItem value="PUBLIC_LINK">Public Link</SelectItem>
                                        <SelectItem value="MOBILE_APP">Mobile App</SelectItem>
                                    </SelectContent>
                                </Select>
                            </div>

                            {/* Table */}
                            <div className="overflow-x-auto">
                                <Table>
                                    <TableHeader>
                                        <TableRow>
                                            <TableHead>Name</TableHead>
                                            <TableHead>Email</TableHead>
                                            <TableHead>Phone</TableHead>
                                            <TableHead>Organization</TableHead>
                                            <TableHead>Plan</TableHead>
                                            <TableHead>Source</TableHead>
                                            <TableHead>Submitted</TableHead>
                                            <TableHead className="text-right">Actions</TableHead>
                                        </TableRow>
                                    </TableHeader>
                                    <TableBody>
                                        {principalsLoading ? (
                                            <TableRow>
                                                <TableCell colSpan={8} className="text-center py-8">
                                                    <div className="flex items-center justify-center">
                                                        <div className="animate-spin rounded-full h-8 w-8 border-t-2 border-b-2 border-blue-600"></div>
                                                    </div>
                                                </TableCell>
                                            </TableRow>
                                        ) : principals.length === 0 ? (
                                            <TableRow>
                                                <TableCell colSpan={8} className="text-center py-8 text-gray-500">
                                                    No pending principal registrations found
                                                </TableCell>
                                            </TableRow>
                                        ) : (
                                            principals.map((principal: any) => (
                                                <TableRow key={principal.id}>
                                                    <TableCell className="font-medium">
                                                        {principal.first_name} {principal.last_name}
                                                    </TableCell>
                                                    <TableCell>{principal.email}</TableCell>
                                                    <TableCell>{principal.phone_number}</TableCell>
                                                    <TableCell>{principal.organization_name || "N/A"}</TableCell>
                                                    <TableCell>{principal.plan_name || "N/A"}</TableCell>
                                                    <TableCell>{getSourceBadge(principal.source || "PUBLIC_LINK")}</TableCell>
                                                    <TableCell>
                                                        {new Date(principal.submitted_at).toLocaleDateString()}
                                                    </TableCell>
                                                    <TableCell className="text-right">
                                                        <Button
                                                            variant="ghost"
                                                            size="sm"
                                                            onClick={() => router.push(`/underwriting/pending-updates/principals/${principal.id}`)}
                                                        >
                                                            <Eye className="h-4 w-4 mr-2" />
                                                            Review
                                                        </Button>
                                                    </TableCell>
                                                </TableRow>
                                            ))
                                        )}
                                    </TableBody>
                                </Table>
                            </div>

                            {/* Pagination */}
                            {pagination && pagination.pages > 1 && (
                                <div className="flex justify-between items-center mt-4">
                                    <div className="text-sm text-gray-500">
                                        Showing {((pagination.page - 1) * pagination.limit) + 1} to{" "}
                                        {Math.min(pagination.page * pagination.limit, pagination.total)} of{" "}
                                        {pagination.total} entries
                                    </div>
                                    <div className="flex gap-2">
                                        <Button
                                            variant="outline"
                                            size="sm"
                                            onClick={() => setPage(page - 1)}
                                            disabled={page === 1}
                                        >
                                            Previous
                                        </Button>
                                        <span className="px-3 py-1 text-sm">
                                            Page {page} of {pagination.pages}
                                        </span>
                                        <Button
                                            variant="outline"
                                            size="sm"
                                            onClick={() => setPage(page + 1)}
                                            disabled={page === pagination.pages}
                                        >
                                            Next
                                        </Button>
                                    </div>
                                </div>
                            )}
                        </CardContent>
                    </Card>
                </TabsContent>

                {/* Dependents Tab */}
                <TabsContent value="dependents" className="space-y-4">
                    <Card>
                        <CardHeader>
                            <CardTitle>Pending Dependent Registrations</CardTitle>
                            <CardDescription>
                                Review and approve dependent registrations (principal must be approved first)
                            </CardDescription>
                        </CardHeader>
                        <CardContent>
                            {/* Search */}
                            <div className="mb-6">
                                <div className="relative">
                                    <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 h-4 w-4" />
                                    <Input
                                        placeholder="Search by name..."
                                        value={search}
                                        onChange={(e) => setSearch(e.target.value)}
                                        className="pl-10"
                                    />
                                </div>
                            </div>

                            {/* Table */}
                            <div className="overflow-x-auto">
                                <Table>
                                    <TableHeader>
                                        <TableRow>
                                            <TableHead>Name</TableHead>
                                            <TableHead>Relationship</TableHead>
                                            <TableHead>Date of Birth</TableHead>
                                            <TableHead>Principal</TableHead>
                                            <TableHead>Submitted</TableHead>
                                            <TableHead className="text-right">Actions</TableHead>
                                        </TableRow>
                                    </TableHeader>
                                    <TableBody>
                                        {dependentsLoading ? (
                                            <TableRow>
                                                <TableCell colSpan={6} className="text-center py-8">
                                                    <div className="flex items-center justify-center">
                                                        <div className="animate-spin rounded-full h-8 w-8 border-t-2 border-b-2 border-blue-600"></div>
                                                    </div>
                                                </TableCell>
                                            </TableRow>
                                        ) : dependents.length === 0 ? (
                                            <TableRow>
                                                <TableCell colSpan={6} className="text-center py-8 text-gray-500">
                                                    No pending dependent registrations found
                                                </TableCell>
                                            </TableRow>
                                        ) : (
                                            dependents.map((dependent: any) => (
                                                <TableRow key={dependent.id}>
                                                    <TableCell className="font-medium">
                                                        {dependent.first_name} {dependent.last_name}
                                                    </TableCell>
                                                    <TableCell>{dependent.relationship}</TableCell>
                                                    <TableCell>
                                                        {new Date(dependent.date_of_birth).toLocaleDateString()}
                                                    </TableCell>
                                                    <TableCell>
                                                        {dependent.principal_registration?.first_name}{" "}
                                                        {dependent.principal_registration?.last_name}
                                                    </TableCell>
                                                    <TableCell>
                                                        {new Date(dependent.submitted_at).toLocaleDateString()}
                                                    </TableCell>
                                                    <TableCell className="text-right">
                                                        <Button
                                                            variant="ghost"
                                                            size="sm"
                                                            onClick={() => router.push(`/underwriting/pending-updates/dependents/${dependent.id}`)}
                                                        >
                                                            <Eye className="h-4 w-4 mr-2" />
                                                            Review
                                                        </Button>
                                                    </TableCell>
                                                </TableRow>
                                            ))
                                        )}
                                    </TableBody>
                                </Table>
                            </div>

                            {/* Pagination */}
                            {pagination && pagination.pages > 1 && (
                                <div className="flex justify-between items-center mt-4">
                                    <div className="text-sm text-gray-500">
                                        Showing {((pagination.page - 1) * pagination.limit) + 1} to{" "}
                                        {Math.min(pagination.page * pagination.limit, pagination.total)} of{" "}
                                        {pagination.total} entries
                                    </div>
                                    <div className="flex gap-2">
                                        <Button
                                            variant="outline"
                                            size="sm"
                                            onClick={() => setPage(page - 1)}
                                            disabled={page === 1}
                                        >
                                            Previous
                                        </Button>
                                        <span className="px-3 py-1 text-sm">
                                            Page {page} of {pagination.pages}
                                        </span>
                                        <Button
                                            variant="outline"
                                            size="sm"
                                            onClick={() => setPage(page + 1)}
                                            disabled={page === pagination.pages}
                                        >
                                            Next
                                        </Button>
                                    </div>
                                </div>
                            )}
                        </CardContent>
                    </Card>
                </TabsContent>
            </Tabs>
        </div>
    )
}
