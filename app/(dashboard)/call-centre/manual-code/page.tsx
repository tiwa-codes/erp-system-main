"use client"

export const dynamic = 'force-dynamic'

import { useQuery } from "@tanstack/react-query"
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { Badge } from "@/components/ui/badge"
import { Plus, Search, Loader2, Copy, Trash2, ChevronLeft, ChevronRight } from "lucide-react"
import Link from "next/link"
import { Input } from "@/components/ui/input"
import { useEffect, useState } from "react"
import { useToast } from "@/hooks/use-toast"
import { useMutation, useQueryClient } from "@tanstack/react-query"
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog"
import { Textarea } from "@/components/ui/textarea"



export default function ManualApprovalHistoryPage() {
    const { toast } = useToast()
    const queryClient = useQueryClient()
    const [search, setSearch] = useState("")
    const [debouncedSearch, setDebouncedSearch] = useState("")
    const [currentPage, setCurrentPage] = useState(1)
    const [pageSize] = useState(10)
    const [showDeleteModal, setShowDeleteModal] = useState(false)
    const [deleteReason, setDeleteReason] = useState("")
    const [deletingCode, setDeletingCode] = useState<any>(null)

    useEffect(() => {
        const timer = setTimeout(() => {
            setDebouncedSearch(search)
        }, 400)
        return () => clearTimeout(timer)
    }, [search])

    const { data, isLoading } = useQuery({
        queryKey: ["manual-codes", debouncedSearch, currentPage, pageSize],
        queryFn: async () => {
            const params = new URLSearchParams()
            params.append("page", currentPage.toString())
            params.append("limit", pageSize.toString())
            if (debouncedSearch.trim()) {
                params.append("search", debouncedSearch.trim())
            }
            const res = await fetch(`/api/call-centre/manual-codes?${params.toString()}`)
            if (!res.ok) throw new Error("Failed to fetch codes")
            return res.json()
        }
    })

    const manualCodes = data?.codes || []
    const pagination = data?.pagination

    // Delete approval code mutation
    const deleteApprovalCodeMutation = useMutation({
        mutationFn: async ({ id, reason }: { id: string; reason: string }) => {
            const res = await fetch(`/api/call-centre/approval-codes/${id}/delete`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ reason }),
            })
            if (!res.ok) {
                const error = await res.json()
                throw new Error(error.error || 'Failed to delete approval code')
            }
            return res.json()
        },
        onSuccess: () => {
            toast({
                title: "Approval Code Deleted",
                description: "The approval code has been successfully deleted.",
            })
            setShowDeleteModal(false)
            setDeleteReason("")
            setDeletingCode(null)
            queryClient.invalidateQueries({ queryKey: ["manual-codes"] })
        },
        onError: (error: Error) => {
            toast({
                title: "Error",
                description: error.message,
                variant: "destructive",
            })
        },
    })

    return (
        <>
            <div className="p-6 space-y-6">
                <div className="flex justify-between items-center">
                    <div>
                        <h1 className="text-3xl font-bold tracking-tight">Manual Approval Codes</h1>
                        <p className="text-muted-foreground">History of codes generated manually by the call centre.</p>
                    </div>
                    <Link href="/call-centre/manual-code/new">
                        <Button className="bg-[#0891B2] hover:bg-[#9B1219]">
                            <Plus className="h-4 w-4 mr-2" /> Generate New
                        </Button>
                    </Link>
                </div>

                <Card>
                    <CardHeader>
                        <div className="flex justify-between items-center">
                            <CardTitle>History</CardTitle>
                            <div className="w-[300px]">
                                <div className="relative">
                                    <Search className="absolute left-2 top-2.5 h-4 w-4 text-muted-foreground" />
                                    <Input
                                        placeholder="Search code, enrollee, provider..."
                                        className="pl-8"
                                        value={search}
                                        onChange={(e) => {
                                            setSearch(e.target.value)
                                            setCurrentPage(1)
                                        }}
                                    />
                                </div>
                            </div>
                        </div>
                    </CardHeader>
                    <CardContent>
                        {isLoading ? (
                            <div className="flex justify-center p-8">
                                <Loader2 className="h-8 w-8 animate-spin text-gray-400" />
                            </div>
                        ) : (
                            <Table>
                                <TableHeader>
                                    <TableRow>
                                        <TableHead>Date</TableHead>
                                        <TableHead>Approval Code</TableHead>
                                        <TableHead>Provider</TableHead>
                                        <TableHead>Enrollee</TableHead>
                                        <TableHead className="text-right">Amount</TableHead>
                                        <TableHead>Generated By</TableHead>
                                        <TableHead>Status</TableHead>
                                        <TableHead></TableHead>
                                    </TableRow>
                                </TableHeader>
                                <TableBody>
                                    {manualCodes.length === 0 ? (
                                        <TableRow>
                                            <TableCell colSpan={8} className="text-center py-8 text-muted-foreground">
                                                No manual codes found.
                                            </TableCell>
                                        </TableRow>
                                    ) : (
                                        manualCodes.map((code: any) => (
                                            <TableRow key={code.id}>
                                                <TableCell className="text-xs text-muted-foreground">
                                                    {new Date(code.created_at).toLocaleDateString()}
                                                    <br />
                                                    {new Date(code.created_at).toLocaleTimeString()}
                                                </TableCell>
                                                <TableCell className="font-mono font-medium">{code.approval_code}</TableCell>
                                                <TableCell className="max-w-[200px] truncate" title={code.hospital}>
                                                    {code.hospital}
                                                </TableCell>
                                                <TableCell>
                                                    <div className="flex flex-col">
                                                        <span className="font-medium">{code.enrollee_name}</span>
                                                        <span className="text-xs text-muted-foreground">{code.enrollee_id || "-"}</span>
                                                    </div>
                                                </TableCell>
                                                <TableCell className="text-right font-bold">
                                                    ₦{Number(code.amount).toLocaleString()}
                                                </TableCell>
                                                <TableCell>
                                                    {code.generated_by ? (
                                                        <div className="flex flex-col text-xs">
                                                            <span className="font-medium">{code.generated_by.first_name} {code.generated_by.last_name}</span>
                                                        </div>
                                                    ) : (
                                                        <span className="text-xs text-muted-foreground">-</span>
                                                    )}
                                                </TableCell>
                                                <TableCell>
                                                    <Badge variant={code.status === 'PENDING' ? 'outline' : 'secondary'}>
                                                        {code.status}
                                                    </Badge>
                                                </TableCell>
                                                <TableCell>
                                                    <div className="flex items-center gap-2">
                                                        <Button variant="ghost" size="icon" onClick={() => {
                                                            navigator.clipboard.writeText(code.approval_code)
                                                            toast({ title: "Copied!" })
                                                        }} title="Copy Code">
                                                            <Copy className="h-4 w-4" />
                                                        </Button>
                                                        <Link href={`/call-centre/manual-code/${code.id}`}>
                                                            <Button variant="outline" size="sm">
                                                                View / Edit
                                                            </Button>
                                                        </Link>
                                                        <Button
                                                            variant="ghost"
                                                            size="icon"
                                                            className="text-red-600 hover:text-red-700 hover:bg-red-50"
                                                            onClick={() => {
                                                                setDeletingCode(code)
                                                                setShowDeleteModal(true)
                                                            }}
                                                            title="Delete Code"
                                                        >
                                                            <Trash2 className="h-4 w-4" />
                                                        </Button>
                                                    </div>
                                                </TableCell>
                                            </TableRow>
                                        ))
                                    )}
                                </TableBody>
                            </Table>
                        )}

                        {!isLoading && pagination && pagination.pages > 1 && (
                            <div className="flex items-center justify-between mt-4">
                                <p className="text-sm text-muted-foreground">
                                    Page {pagination.page} of {pagination.pages} ({pagination.total} total)
                                </p>
                                <div className="flex items-center gap-2">
                                    <Button
                                        variant="outline"
                                        size="sm"
                                        onClick={() => setCurrentPage((p) => Math.max(1, p - 1))}
                                        disabled={pagination.page <= 1}
                                    >
                                        <ChevronLeft className="h-4 w-4 mr-1" />
                                        Previous
                                    </Button>
                                    <Button
                                        variant="outline"
                                        size="sm"
                                        onClick={() => setCurrentPage((p) => Math.min(pagination.pages, p + 1))}
                                        disabled={pagination.page >= pagination.pages}
                                    >
                                        Next
                                        <ChevronRight className="h-4 w-4 ml-1" />
                                    </Button>
                                </div>
                            </div>
                        )}
                    </CardContent>
                </Card>
            </div>

            {/* Delete Confirmation Modal */}
            <Dialog open={showDeleteModal} onOpenChange={setShowDeleteModal}>
                <DialogContent>
                    <DialogHeader>
                        <DialogTitle>Delete Approval Code</DialogTitle>
                        <DialogDescription>
                            Please provide a reason for deleting this approval code. This action is irreversible and will be audited.
                        </DialogDescription>
                    </DialogHeader>
                    <div className="py-4 space-y-4">
                        {deletingCode && (
                            <div className="bg-gray-50 p-3 rounded-lg space-y-1">
                                <p className="text-sm"><span className="font-medium">Approval Code:</span> {deletingCode.approval_code}</p>
                                <p className="text-sm"><span className="font-medium">Enrollee:</span> {deletingCode.enrollee_name}</p>
                                <p className="text-sm"><span className="font-medium">Hospital:</span> {deletingCode.hospital}</p>
                                <p className="text-sm"><span className="font-medium">Amount:</span> ₦{Number(deletingCode.amount).toLocaleString()}</p>
                            </div>
                        )}
                        <div className="space-y-2">
                            <label className="text-sm font-medium text-gray-700">Reason for Deletion <span className="text-red-500">*</span></label>
                            <Textarea
                                placeholder="Enter reason for deletion..."
                                value={deleteReason}
                                onChange={(e) => setDeleteReason(e.target.value)}
                                className="min-h-[100px]"
                            />
                        </div>
                    </div>
                    <DialogFooter>
                        <Button variant="outline" onClick={() => { setShowDeleteModal(false); setDeleteReason(""); setDeletingCode(null) }}>
                            Cancel
                        </Button>
                        <Button
                            onClick={() => {
                                if (!deleteReason.trim()) {
                                    toast({
                                        title: "Error",
                                        description: "Please provide a deletion reason",
                                        variant: "destructive",
                                    })
                                    return
                                }
                                if (deletingCode) {
                                    deleteApprovalCodeMutation.mutate({ id: deletingCode.id, reason: deleteReason })
                                }
                            }}
                            disabled={deleteApprovalCodeMutation.isPending || !deleteReason.trim()}
                            className="bg-red-600 hover:bg-red-700 text-white"
                        >
                            {deleteApprovalCodeMutation.isPending && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
                            Delete Approval Code
                        </Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>
        </>
    )
}
