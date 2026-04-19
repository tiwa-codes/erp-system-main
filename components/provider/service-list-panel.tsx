"use client"

import { useState } from "react"
import { Card, CardContent } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import {
    Table,
    TableBody,
    TableCell,
    TableHead,
    TableHeader,
    TableRow,
} from "@/components/ui/table"
import {
    DropdownMenu,
    DropdownMenuContent,
    DropdownMenuItem,
    DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import {
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue,
} from "@/components/ui/select"
import { Search, MoreHorizontal, CheckCircle, XCircle, Edit, DollarSign } from "lucide-react"

interface TariffPlanService {
    id: string
    service_id: string
    service_name: string
    category_id: string
    category_name: string
    price: number
    service_type: number // 1 = Primary, 2 = Secondary
    status: string // ACTIVE, INACTIVE, PENDING
    created_at: string
    updated_at: string
}

interface ServiceListPanelProps {
    services: TariffPlanService[]
    selectedCategory: string | null
    currentUserRole: string
    onUpdatePrice: (serviceId: string, newPrice: number) => void
    onUpdateServiceType: (serviceId: string, serviceType: 1 | 2) => void
    onToggleStatus: (serviceId: string) => void
    onApproveService: (serviceId: string) => void
    onRejectService: (serviceId: string) => void
    onApproveAll: (categoryId?: string) => void
    onRejectAll: (categoryId?: string) => void
    filterStatus: string
    onFilterChange: (status: string) => void
    isLoading?: boolean
}

export function ServiceListPanel({
    services,
    selectedCategory,
    currentUserRole,
    onUpdatePrice,
    onUpdateServiceType,
    onToggleStatus,
    onApproveService,
    onRejectService,
    onApproveAll,
    onRejectAll,
    filterStatus,
    onFilterChange,
    isLoading = false
}: ServiceListPanelProps) {
    const [searchTerm, setSearchTerm] = useState("")
    const [currentPage, setCurrentPage] = useState(1)
    const itemsPerPage = 10
    const normalizedServices = Array.isArray(services)
        ? services.filter((service): service is TariffPlanService => Boolean(service?.id))
        : []

    const isProviderManagement = currentUserRole === "PROVIDER_MANAGER" ||
        currentUserRole === "SUPER_ADMIN" ||
        currentUserRole === "ADMIN"

    // Filter services by search term
    const filteredServices = normalizedServices.filter(service =>
        (service.service_name || "").toLowerCase().includes(searchTerm.toLowerCase()) ||
        (service.service_id || "").toLowerCase().includes(searchTerm.toLowerCase())
    )

    // Pagination
    const totalPages = Math.ceil(filteredServices.length / itemsPerPage)
    const startIndex = (currentPage - 1) * itemsPerPage
    const endIndex = startIndex + itemsPerPage
    const paginatedServices = filteredServices.slice(startIndex, endIndex)

    const getStatusBadge = (status: string) => {
        const statusUpper = status.toUpperCase()
        if (statusUpper === "PENDING") {
            return <Badge variant="destructive" className="text-xs">Pending</Badge>
        }
        if (statusUpper === "ACTIVE") {
            return <Badge variant="default" className="text-xs bg-green-600">Active</Badge>
        }
        return <Badge variant="secondary" className="text-xs">Inactive</Badge>
    }

    const getServiceTypeBadge = (type: number) => {
        if (type === 1) {
            return <Badge variant="default" className="text-xs bg-purple-600">1</Badge>
        }
        return <Badge variant="secondary" className="text-xs">2</Badge>
    }

    const hasPendingServices = normalizedServices.some(s => (s.status || "").toUpperCase() === "PENDING")

    return (
        <Card className="h-full">
            <CardContent className="p-4">
                {/* Search and Filter */}
                <div className="flex items-center gap-4 mb-4">
                    <div className="relative flex-1">
                        <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 h-4 w-4" />
                        <Input
                            placeholder="Search Services"
                            value={searchTerm}
                            onChange={(e) => setSearchTerm(e.target.value)}
                            className="pl-10"
                        />
                    </div>
                    <Select value={filterStatus} onValueChange={onFilterChange}>
                        <SelectTrigger className="w-[200px]">
                            <SelectValue placeholder="Filter By" />
                        </SelectTrigger>
                        <SelectContent>
                            <SelectItem value="all">All Services</SelectItem>
                            <SelectItem value="ACTIVE">Active Services</SelectItem>
                            <SelectItem value="INACTIVE">Inactive Services</SelectItem>
                            <SelectItem value="PENDING">Pending Services</SelectItem>
                        </SelectContent>
                    </Select>
                </div>

                {/* Bulk Actions - Only for Provider Management */}
                {isProviderManagement && hasPendingServices && (
                    <div className="flex items-center gap-2 mb-4">
                        <Button
                            size="sm"
                            variant="default"
                            onClick={() => onApproveAll(selectedCategory || undefined)}
                            className="bg-green-600 hover:bg-green-700"
                        >
                            <CheckCircle className="h-4 w-4 mr-2" />
                            Approve All {selectedCategory ? "(Category)" : ""}
                        </Button>
                        <Button
                            size="sm"
                            variant="destructive"
                            onClick={() => onRejectAll(selectedCategory || undefined)}
                        >
                            <XCircle className="h-4 w-4 mr-2" />
                            Reject All {selectedCategory ? "(Category)" : ""}
                        </Button>
                    </div>
                )}

                {/* Services Table */}
                <div className="border rounded-lg overflow-hidden">
                    <Table>
                        <TableHeader>
                            <TableRow className="bg-gray-50">
                                <TableHead className="font-semibold text-xs">SERVICE NAME</TableHead>
                                <TableHead className="font-semibold text-xs text-center">CATEGORY ID</TableHead>
                                <TableHead className="font-semibold text-xs text-center">TYPE</TableHead>
                                <TableHead className="font-semibold text-xs text-right">PRICE</TableHead>
                                <TableHead className="font-semibold text-xs text-center">STATUS</TableHead>
                                <TableHead className="font-semibold text-xs text-center">ACTIONS</TableHead>
                            </TableRow>
                        </TableHeader>
                        <TableBody>
                            {isLoading ? (
                                <TableRow>
                                    <TableCell colSpan={6} className="text-center py-8">
                                        <div className="flex items-center justify-center">
                                            <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-blue-600"></div>
                                            <span className="ml-2 text-gray-600">Loading services...</span>
                                        </div>
                                    </TableCell>
                                </TableRow>
                            ) : paginatedServices.length === 0 ? (
                                <TableRow>
                                    <TableCell colSpan={6} className="text-center py-8 text-gray-500">
                                        {selectedCategory
                                            ? "No services found for this category"
                                            : "No services found"}
                                    </TableCell>
                                </TableRow>
                            ) : (
                                paginatedServices.map((service) => (
                                    <TableRow key={service.id} className="hover:bg-gray-50">
                                        <TableCell className="font-medium">{service.service_name}</TableCell>
                                        <TableCell className="text-center">
                                            <Badge variant="outline" className="text-xs">{service.category_id}</Badge>
                                        </TableCell>
                                        <TableCell className="text-center">
                                            {getServiceTypeBadge(service.service_type)}
                                        </TableCell>
                                        <TableCell className="text-right font-semibold">
                                            ₦{service.price.toLocaleString()}
                                        </TableCell>
                                        <TableCell className="text-center">
                                            {getStatusBadge(service.status)}
                                        </TableCell>
                                        <TableCell className="text-center">
                                            <DropdownMenu>
                                                <DropdownMenuTrigger asChild>
                                                    <Button variant="ghost" size="sm" className="h-8 w-8 p-0">
                                                        <MoreHorizontal className="h-4 w-4" />
                                                    </Button>
                                                </DropdownMenuTrigger>
                                                <DropdownMenuContent align="end">
                                                    <DropdownMenuItem
                                                        onClick={() => {
                                                            const newPrice = prompt("Enter new price:", service.price.toString())
                                                            if (newPrice && !isNaN(Number(newPrice))) {
                                                                onUpdatePrice(service.id, Number(newPrice))
                                                            }
                                                        }}
                                                    >
                                                        <DollarSign className="h-4 w-4 mr-2" />
                                                        Update Price
                                                    </DropdownMenuItem>
                                                    <DropdownMenuItem
                                                        onClick={() => {
                                                            const newType: 1 | 2 = service.service_type === 1 ? 2 : 1
                                                            onUpdateServiceType(service.id, newType)
                                                        }}
                                                    >
                                                        <Edit className="h-4 w-4 mr-2" />
                                                        Change to Type {service.service_type === 1 ? "2" : "1"}
                                                    </DropdownMenuItem>
                                                    <DropdownMenuItem onClick={() => onToggleStatus(service.id)}>
                                                        {(service.status || "").toUpperCase() === "ACTIVE" ? (
                                                            <>
                                                                <XCircle className="h-4 w-4 mr-2" />
                                                                Deactivate
                                                            </>
                                                        ) : (
                                                            <>
                                                                <CheckCircle className="h-4 w-4 mr-2" />
                                                                Activate
                                                            </>
                                                        )}
                                                    </DropdownMenuItem>
                                                    {isProviderManagement && (service.status || "").toUpperCase() === "PENDING" && (
                                                        <>
                                                            <DropdownMenuItem
                                                                onClick={() => onApproveService(service.id)}
                                                                className="text-green-600"
                                                            >
                                                                <CheckCircle className="h-4 w-4 mr-2" />
                                                                Approve
                                                            </DropdownMenuItem>
                                                            <DropdownMenuItem
                                                                onClick={() => onRejectService(service.id)}
                                                                className="text-red-600"
                                                            >
                                                                <XCircle className="h-4 w-4 mr-2" />
                                                                Reject
                                                            </DropdownMenuItem>
                                                        </>
                                                    )}
                                                </DropdownMenuContent>
                                            </DropdownMenu>
                                        </TableCell>
                                    </TableRow>
                                ))
                            )}
                        </TableBody>
                    </Table>
                </div>

                {/* Pagination */}
                {filteredServices.length > 0 && (
                    <div className="flex items-center justify-between mt-4">
                        <div className="text-sm text-gray-600">
                            Showing {startIndex + 1} to {Math.min(endIndex, filteredServices.length)} of {filteredServices.length} result{filteredServices.length !== 1 ? 's' : ''}
                        </div>
                        <div className="flex items-center gap-2">
                            <Button
                                size="sm"
                                variant="outline"
                                onClick={() => setCurrentPage(p => Math.max(1, p - 1))}
                                disabled={currentPage === 1}
                            >
                                Previous
                            </Button>
                            {Array.from({ length: totalPages }, (_, i) => i + 1).map(page => (
                                <Button
                                    key={page}
                                    size="sm"
                                    variant={currentPage === page ? "default" : "outline"}
                                    onClick={() => setCurrentPage(page)}
                                    className="w-8"
                                >
                                    {page}
                                </Button>
                            ))}
                            <Button
                                size="sm"
                                variant="outline"
                                onClick={() => setCurrentPage(p => Math.min(totalPages, p + 1))}
                                disabled={currentPage === totalPages}
                            >
                                Next
                            </Button>
                        </div>
                    </div>
                )}
            </CardContent>
        </Card>
    )
}
