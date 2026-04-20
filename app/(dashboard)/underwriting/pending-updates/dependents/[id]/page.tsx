"use client"

export const dynamic = 'force-dynamic'

import { useState } from "react"
import { useParams, useRouter } from "next/navigation"
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import {
    AlertDialog,
    AlertDialogAction,
    AlertDialogCancel,
    AlertDialogContent,
    AlertDialogDescription,
    AlertDialogFooter,
    AlertDialogHeader,
    AlertDialogTitle,
} from "@/components/ui/alert-dialog"
import { ArrowLeft, CheckCircle, XCircle, Loader2, User, Users, AlertCircle } from "lucide-react"
import { toast } from "sonner"
import Image from "next/image"



export default function DependentDetailPage() {
    const params = useParams()
    const router = useRouter()
    const queryClient = useQueryClient()
    const dependentId = params.id as string

    const [isEditMode, setIsEditMode] = useState(false)
    const [showApproveDialog, setShowApproveDialog] = useState(false)
    const [showRejectDialog, setShowRejectDialog] = useState(false)
    const [rejectionReason, setRejectionReason] = useState("")
    const [editedData, setEditedData] = useState<any>({})

    // Fetch dependent details
    const { data: dependent, isLoading } = useQuery({
        queryKey: ["pending-dependent", dependentId],
        queryFn: async () => {
            const res = await fetch(`/api/underwriting/pending-dependents/${dependentId}`)
            if (!res.ok) throw new Error("Failed to fetch dependent details")
            return res.json()
        },
    })

    // Update dependent mutation
    const updateMutation = useMutation({
        mutationFn: async (data: any) => {
            const res = await fetch(`/api/underwriting/pending-dependents/${dependentId}`, {
                method: "PATCH",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify(data),
            })
            if (!res.ok) throw new Error("Failed to update dependent")
            return res.json()
        },
        onSuccess: () => {
            toast.success("Dependent details updated successfully")
            queryClient.invalidateQueries({ queryKey: ["pending-dependent", dependentId] })
            setIsEditMode(false)
            setEditedData({})
        },
        onError: (error: any) => {
            toast.error(error.message || "Failed to update dependent")
        },
    })

    // Approve mutation
    const approveMutation = useMutation({
        mutationFn: async () => {
            const res = await fetch(`/api/underwriting/pending-dependents/${dependentId}/approve`, {
                method: "POST",
            })
            if (!res.ok) {
                const error = await res.json()
                throw new Error(error.error || "Failed to approve dependent")
            }
            return res.json()
        },
        onSuccess: () => {
            toast.success("Dependent approved successfully!")
            router.push("/underwriting/pending-updates")
        },
        onError: (error: any) => {
            toast.error(error.message || "Failed to approve dependent")
        },
    })

    // Reject mutation
    const rejectMutation = useMutation({
        mutationFn: async (reason: string) => {
            const res = await fetch(`/api/underwriting/pending-dependents/${dependentId}/reject`, {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ reason }),
            })
            if (!res.ok) throw new Error("Failed to reject dependent")
            return res.json()
        },
        onSuccess: () => {
            toast.success("Dependent rejected")
            router.push("/underwriting/pending-updates")
        },
        onError: (error: any) => {
            toast.error(error.message || "Failed to reject dependent")
        },
    })

    const handleSaveChanges = () => {
        updateMutation.mutate(editedData)
    }

    const handleApprove = () => {
        setShowApproveDialog(false)
        approveMutation.mutate()
    }

    const handleReject = () => {
        if (!rejectionReason.trim()) {
            toast.error("Please provide a rejection reason")
            return
        }
        setShowRejectDialog(false)
        rejectMutation.mutate(rejectionReason)
    }

    if (isLoading) {
        return (
            <div className="flex items-center justify-center min-h-screen">
                <Loader2 className="h-8 w-8 animate-spin text-blue-600" />
            </div>
        )
    }

    if (!dependent) {
        return (
            <div className="flex items-center justify-center min-h-screen">
                <p className="text-gray-500">Dependent not found</p>
            </div>
        )
    }

    const isPending = dependent.status === "PENDING"
    const currentData = isEditMode ? { ...dependent, ...editedData } : dependent

    return (
        <div className="container mx-auto p-6 max-w-5xl">
            {/* Header */}
            <div className="flex items-center justify-between mb-6">
                <div className="flex items-center gap-4">
                    <Button variant="ghost" size="sm" onClick={() => router.back()}>
                        <ArrowLeft className="h-4 w-4 mr-2" />
                        Back
                    </Button>
                    <div>
                        <h1 className="text-2xl font-bold">Dependent Registration Details</h1>
                        <p className="text-sm text-gray-500">Review and manage dependent registration</p>
                    </div>
                </div>
                <div className="flex items-center gap-2">
                    <Badge variant={dependent.status === "PENDING" ? "secondary" : "default"}>
                        {dependent.status}
                    </Badge>
                    <Badge variant="outline">{dependent.source || "PUBLIC_LINK"}</Badge>
                </div>
            </div>

            {/* Principal Info Alert */}
            {dependent.principal && (
                <Card className="mb-6 border-blue-200 bg-blue-50">
                    <CardContent className="pt-6">
                        <div className="flex items-start gap-3">
                            <User className="h-5 w-5 text-blue-600 mt-0.5" />
                            <div className="flex-1">
                                <h3 className="font-semibold text-blue-900 mb-2">Associated Principal</h3>
                                <div className="grid grid-cols-2 gap-2 text-sm">
                                    <div>
                                        <span className="text-blue-700">Name:</span>
                                        <span className="ml-2 font-medium">
                                            {dependent.principal.first_name} {dependent.principal.last_name}
                                        </span>
                                    </div>
                                    <div>
                                        <span className="text-blue-700">Status:</span>
                                        <Badge className="ml-2" variant={dependent.principal.status === "APPROVED" ? "default" : "secondary"}>
                                            {dependent.principal.status}
                                        </Badge>
                                    </div>
                                    {dependent.principal.enrollee_id && (
                                        <div>
                                            <span className="text-blue-700">Enrollee ID:</span>
                                            <span className="ml-2 font-medium">{dependent.principal.enrollee_id}</span>
                                        </div>
                                    )}
                                </div>
                                {dependent.principal.status !== "APPROVED" && (
                                    <div className="mt-3 flex items-start gap-2 p-3 bg-yellow-50 border border-yellow-200 rounded">
                                        <AlertCircle className="h-4 w-4 text-yellow-600 mt-0.5" />
                                        <p className="text-sm text-yellow-800">
                                            <strong>Note:</strong> The principal must be approved before this dependent can be approved.
                                        </p>
                                    </div>
                                )}
                            </div>
                        </div>
                    </CardContent>
                </Card>
            )}

            {/* Profile Picture */}
            {dependent.profile_picture && (
                <Card className="mb-6">
                    <CardHeader>
                        <CardTitle className="text-lg">Profile Picture</CardTitle>
                    </CardHeader>
                    <CardContent>
                        <div className="relative w-32 h-32 rounded-lg overflow-hidden border-2 border-gray-200">
                            <Image
                                src={dependent.profile_picture}
                                alt="Dependent profile"
                                fill
                                className="object-cover"
                            />
                        </div>
                    </CardContent>
                </Card>
            )}

            {/* Personal Information */}
            <Card className="mb-6">
                <CardHeader className="flex flex-row items-center justify-between">
                    <CardTitle className="text-lg">Personal Information</CardTitle>
                    {isPending && !isEditMode && (
                        <Button size="sm" variant="outline" onClick={() => setIsEditMode(true)}>
                            Edit
                        </Button>
                    )}
                    {isEditMode && (
                        <div className="flex gap-2">
                            <Button
                                size="sm"
                                variant="outline"
                                onClick={() => {
                                    setIsEditMode(false)
                                    setEditedData({})
                                }}
                            >
                                Cancel
                            </Button>
                            <Button
                                size="sm"
                                onClick={handleSaveChanges}
                                disabled={updateMutation.isPending}
                            >
                                {updateMutation.isPending ? "Saving..." : "Save Changes"}
                            </Button>
                        </div>
                    )}
                </CardHeader>
                <CardContent className="space-y-4">
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        <div className="space-y-2">
                            <Label>First Name</Label>
                            {isEditMode ? (
                                <Input
                                    value={currentData.first_name}
                                    onChange={(e) => setEditedData({ ...editedData, first_name: e.target.value })}
                                />
                            ) : (
                                <p className="text-sm font-medium">{dependent.first_name}</p>
                            )}
                        </div>
                        <div className="space-y-2">
                            <Label>Last Name</Label>
                            {isEditMode ? (
                                <Input
                                    value={currentData.last_name}
                                    onChange={(e) => setEditedData({ ...editedData, last_name: e.target.value })}
                                />
                            ) : (
                                <p className="text-sm font-medium">{dependent.last_name}</p>
                            )}
                        </div>
                        <div className="space-y-2">
                            <Label>Middle Name</Label>
                            {isEditMode ? (
                                <Input
                                    value={currentData.middle_name || ""}
                                    onChange={(e) => setEditedData({ ...editedData, middle_name: e.target.value })}
                                />
                            ) : (
                                <p className="text-sm font-medium">{dependent.middle_name || "N/A"}</p>
                            )}
                        </div>
                        <div className="space-y-2">
                            <Label>Date of Birth</Label>
                            {isEditMode ? (
                                <Input
                                    type="date"
                                    value={currentData.date_of_birth}
                                    onChange={(e) => setEditedData({ ...editedData, date_of_birth: e.target.value })}
                                />
                            ) : (
                                <p className="text-sm font-medium">{dependent.date_of_birth}</p>
                            )}
                        </div>
                        <div className="space-y-2">
                            <Label>Gender</Label>
                            {isEditMode ? (
                                <Select
                                    value={currentData.gender}
                                    onValueChange={(value) => setEditedData({ ...editedData, gender: value })}
                                >
                                    <SelectTrigger>
                                        <SelectValue />
                                    </SelectTrigger>
                                    <SelectContent>
                                        <SelectItem value="male">Male</SelectItem>
                                        <SelectItem value="female">Female</SelectItem>
                                    </SelectContent>
                                </Select>
                            ) : (
                                <p className="text-sm font-medium capitalize">{dependent.gender}</p>
                            )}
                        </div>
                        <div className="space-y-2">
                            <Label>Relationship to Principal</Label>
                            {isEditMode ? (
                                <Select
                                    value={currentData.relationship}
                                    onValueChange={(value) => setEditedData({ ...editedData, relationship: value })}
                                >
                                    <SelectTrigger>
                                        <SelectValue />
                                    </SelectTrigger>
                                    <SelectContent>
                                        <SelectItem value="SPOUSE">Spouse</SelectItem>
                                        <SelectItem value="CHILD">Child</SelectItem>
                                        <SelectItem value="PARENT">Parent</SelectItem>
                                        <SelectItem value="SIBLING">Sibling</SelectItem>
                                        <SelectItem value="OTHER">Other</SelectItem>
                                    </SelectContent>
                                </Select>
                            ) : (
                                <p className="text-sm font-medium">{dependent.relationship}</p>
                            )}
                        </div>
                    </div>
                </CardContent>
            </Card>

            {/* Action Buttons */}
            {isPending && (
                <div className="flex gap-4">
                    <Button
                        variant="outline"
                        className="flex-1 border-red-500 text-red-600 hover:bg-red-50"
                        onClick={() => setShowRejectDialog(true)}
                        disabled={approveMutation.isPending || rejectMutation.isPending || isEditMode}
                    >
                        <XCircle className="h-4 w-4 mr-2" />
                        Reject Registration
                    </Button>
                    <Button
                        className="flex-1 bg-green-600 hover:bg-green-700"
                        onClick={() => setShowApproveDialog(true)}
                        disabled={approveMutation.isPending || rejectMutation.isPending || isEditMode || dependent.principal?.status !== "APPROVED"}
                    >
                        <CheckCircle className="h-4 w-4 mr-2" />
                        Approve Registration
                    </Button>
                </div>
            )}

            {/* Approve Dialog */}
            <AlertDialog open={showApproveDialog} onOpenChange={setShowApproveDialog}>
                <AlertDialogContent>
                    <AlertDialogHeader>
                        <AlertDialogTitle>Approve Dependent Registration?</AlertDialogTitle>
                        <AlertDialogDescription>
                            This will create a dependent account for {dependent.first_name} {dependent.last_name} and
                            generate their dependent ID. An email notification will be sent to the principal.
                        </AlertDialogDescription>
                    </AlertDialogHeader>
                    <AlertDialogFooter>
                        <AlertDialogCancel>Cancel</AlertDialogCancel>
                        <AlertDialogAction onClick={handleApprove} className="bg-green-600 hover:bg-green-700">
                            {approveMutation.isPending ? "Approving..." : "Approve"}
                        </AlertDialogAction>
                    </AlertDialogFooter>
                </AlertDialogContent>
            </AlertDialog>

            {/* Reject Dialog */}
            <AlertDialog open={showRejectDialog} onOpenChange={setShowRejectDialog}>
                <AlertDialogContent>
                    <AlertDialogHeader>
                        <AlertDialogTitle>Reject Dependent Registration?</AlertDialogTitle>
                        <AlertDialogDescription>
                            Please provide a reason for rejecting this dependent registration.
                        </AlertDialogDescription>
                    </AlertDialogHeader>
                    <div className="my-4">
                        <Textarea
                            placeholder="Enter rejection reason..."
                            value={rejectionReason}
                            onChange={(e) => setRejectionReason(e.target.value)}
                            rows={4}
                        />
                    </div>
                    <AlertDialogFooter>
                        <AlertDialogCancel onClick={() => setRejectionReason("")}>Cancel</AlertDialogCancel>
                        <AlertDialogAction onClick={handleReject} className="bg-red-600 hover:bg-red-700">
                            {rejectMutation.isPending ? "Rejecting..." : "Reject"}
                        </AlertDialogAction>
                    </AlertDialogFooter>
                </AlertDialogContent>
            </AlertDialog>
        </div>
    )
}
