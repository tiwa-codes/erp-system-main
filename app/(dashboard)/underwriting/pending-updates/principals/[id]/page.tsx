"use client"

import { useState, useEffect } from "react"
import { useRouter } from "next/navigation"
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Label } from "@/components/ui/label"
import { Input } from "@/components/ui/input"
import { Textarea } from "@/components/ui/textarea"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import {
    User,
    Mail,
    Phone,
    MapPin,
    Building2,
    FileText,
    CheckCircle,
    XCircle,
    ArrowLeft,
    Calendar,
    Image as ImageIcon,
    Save,
    Edit
} from "lucide-react"
import { toast } from "sonner"
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

interface PageProps {
    params: {
        id: string
    }
}

export default function PendingPrincipalDetailPage({ params }: PageProps) {
    const router = useRouter()
    const queryClient = useQueryClient()
    const [isEditing, setIsEditing] = useState(false)
    const [showApproveDialog, setShowApproveDialog] = useState(false)
    const [showRejectDialog, setShowRejectDialog] = useState(false)
    const [rejectionReason, setRejectionReason] = useState("")
    const [formData, setFormData] = useState<any>({
        first_name: "",
        last_name: "",
        middle_name: "",
        gender: "",
        date_of_birth: "",
        phone_number: "",
        email: "",
        residential_address: "",
        organization_id: "",
        plan_id: "",
        primary_hospital: "",
        hospital_address: "",
        remarks: "",
    })

    // Fetch registration details
    const { data: registration, isLoading } = useQuery({
        queryKey: ["pending-principal", params.id],
        queryFn: async () => {
            const res = await fetch(`/api/underwriting/pending-principals/${params.id}`)
            if (!res.ok) throw new Error("Failed to fetch registration")
            return res.json()
        },
    })

    // Fetch organizations for edit mode
    const { data: organizations = [] } = useQuery({
        queryKey: ["organizations"],
        queryFn: async () => {
            const res = await fetch("/api/organizations?limit=1000")
            if (!res.ok) throw new Error("Failed to fetch organizations")
            const data = await res.json()
            return data.organizations || []
        },
        enabled: isEditing,
    })

    // Fetch plans based on selected organization
    const { data: plans = [] } = useQuery({
        queryKey: ["plans", formData.organization_id],
        queryFn: async () => {
            if (!formData.organization_id) return []
            const res = await fetch(`/api/public/plans?organizationId=${formData.organization_id}`)
            if (!res.ok) throw new Error("Failed to fetch plans")
            const data = await res.json()
            return data.plans || []
        },
        enabled: isEditing && !!formData.organization_id,
    })

    // Initialize form data when registration loads
    useEffect(() => {
        if (registration) {
            let formattedDob = ""
            if (registration.date_of_birth) {
                try {
                    formattedDob = new Date(registration.date_of_birth).toISOString().split('T')[0]
                } catch (e) {
                    console.error("Invalid date of birth:", registration.date_of_birth)
                }
            }

            setFormData({
                first_name: registration.first_name || "",
                last_name: registration.last_name || "",
                middle_name: registration.middle_name || "",
                gender: registration.gender || "",
                date_of_birth: formattedDob,
                phone_number: registration.phone_number || "",
                email: registration.email || "",
                residential_address: registration.residential_address || "",
                organization_id: registration.organization_id || "",
                plan_id: registration.plan_id || "",
                primary_hospital: registration.primary_hospital || "",
                hospital_address: registration.hospital_address || "",
                remarks: registration.remarks || "",
            })
        }
    }, [registration])

    // Save changes mutation
    const saveMutation = useMutation({
        mutationFn: async (data: any) => {
            const res = await fetch(`/api/underwriting/pending-principals/${params.id}`, {
                method: "PATCH",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify(data),
            })
            if (!res.ok) {
                const error = await res.json()
                throw new Error(error.error || "Failed to save changes")
            }
            return res.json()
        },
        onSuccess: () => {
            toast.success("Changes saved successfully")
            setIsEditing(false)
            queryClient.invalidateQueries({ queryKey: ["pending-principal", params.id] })
        },
        onError: (error: Error) => {
            toast.error(error.message)
        },
    })

    // Approve mutation
    const approveMutation = useMutation({
        mutationFn: async () => {
            const res = await fetch(`/api/underwriting/pending-principals/${params.id}/approve`, {
                method: "POST",
            })
            if (!res.ok) {
                const error = await res.json()
                throw new Error(error.error || "Failed to approve registration")
            }
            return res.json()
        },
        onSuccess: (data) => {
            toast.success(`Principal approved! Enrollee ID: ${data.principal.enrollee_id}`)
            queryClient.invalidateQueries({ queryKey: ["pending-principals"] })
            queryClient.invalidateQueries({ queryKey: ["underwriting-mobile-updates"] })
            router.push("/underwriting/mobile")
        },
        onError: (error: Error) => {
            toast.error(error.message)
        },
    })

    // Reject mutation
    const rejectMutation = useMutation({
        mutationFn: async (reason: string) => {
            const res = await fetch(`/api/underwriting/pending-principals/${params.id}/reject`, {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ reason }),
            })
            if (!res.ok) {
                const error = await res.json()
                throw new Error(error.error || "Failed to reject registration")
            }
            return res.json()
        },
        onSuccess: () => {
            toast.success("Registration rejected")
            queryClient.invalidateQueries({ queryKey: ["pending-principals"] })
            queryClient.invalidateQueries({ queryKey: ["underwriting-mobile-updates"] })
            router.push("/underwriting/mobile")
        },
        onError: (error: Error) => {
            toast.error(error.message)
        },
    })

    const handleSave = () => {
        saveMutation.mutate(formData)
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
            <div className="flex items-center justify-center h-64">
                <div className="animate-spin rounded-full h-8 w-8 border-t-2 border-b-2 border-blue-600"></div>
            </div>
        )
    }

    if (!registration) {
        return (
            <div className="text-center py-8">
                <p className="text-red-600 mb-4">Registration not found</p>
                <Button onClick={() => router.push("/underwriting/mobile")}>
                    Back to Pending Updates
                </Button>
            </div>
        )
    }

    const isProcessed = registration.status !== "PENDING"

    return (
        <div className="space-y-6">
            {/* Header */}
            <div className="flex items-center justify-between">
                <div className="flex items-center gap-4">
                    <Button variant="ghost" size="sm" onClick={() => router.push("/underwriting/mobile")}>
                        <ArrowLeft className="h-4 w-4 mr-2" />
                        Back
                    </Button>
                    <div>
                        <h1 className="text-3xl font-bold text-gray-900">Review Principal Registration</h1>
                        <p className="text-gray-600">
                            Submitted on {new Date(registration.submitted_at).toLocaleDateString()}
                        </p>
                    </div>
                </div>
                <div className="flex items-center gap-2">
                    {registration.source && (
                        <Badge variant="outline" className={
                            registration.source === "PUBLIC_LINK"
                                ? "bg-blue-50 text-blue-700 border-blue-200"
                                : "bg-purple-50 text-purple-700 border-purple-200"
                        }>
                            {registration.source === "PUBLIC_LINK" ? "Public Link" : "Mobile App"}
                        </Badge>
                    )}
                    <Badge variant={
                        registration.status === "APPROVED" ? "default" :
                            registration.status === "REJECTED" ? "destructive" :
                                "secondary"
                    }>
                        {registration.status}
                    </Badge>
                </div>
            </div>

            <div className="grid gap-6 lg:grid-cols-3">
                {/* Main Content */}
                <div className="lg:col-span-2 space-y-6">
                    {/* Personal Information */}
                    <Card>
                        <CardHeader>
                            <div className="flex items-center justify-between">
                                <CardTitle className="flex items-center gap-2">
                                    <User className="h-5 w-5" />
                                    Personal Information
                                </CardTitle>
                                {!isProcessed && !isEditing && (
                                    <Button variant="outline" size="sm" onClick={() => setIsEditing(true)}>
                                        <Edit className="h-4 w-4 mr-2" />
                                        Edit
                                    </Button>
                                )}
                            </div>
                        </CardHeader>
                        <CardContent className="grid gap-4 md:grid-cols-2">
                            <div>
                                <Label>First Name</Label>
                                {isEditing ? (
                                    <Input
                                        value={formData.first_name}
                                        onChange={(e) => setFormData({ ...formData, first_name: e.target.value })}
                                    />
                                ) : (
                                    <p className="font-medium mt-1">{registration.first_name}</p>
                                )}
                            </div>
                            <div>
                                <Label>Last Name</Label>
                                {isEditing ? (
                                    <Input
                                        value={formData.last_name}
                                        onChange={(e) => setFormData({ ...formData, last_name: e.target.value })}
                                    />
                                ) : (
                                    <p className="font-medium mt-1">{registration.last_name}</p>
                                )}
                            </div>
                            <div>
                                <Label>Middle Name</Label>
                                {isEditing ? (
                                    <Input
                                        value={formData.middle_name}
                                        onChange={(e) => setFormData({ ...formData, middle_name: e.target.value })}
                                    />
                                ) : (
                                    <p className="font-medium mt-1">{registration.middle_name || "—"}</p>
                                )}
                            </div>
                            <div>
                                <Label>Gender</Label>
                                {isEditing ? (
                                    <Select value={formData.gender} onValueChange={(value) => setFormData({ ...formData, gender: value })}>
                                        <SelectTrigger>
                                            <SelectValue />
                                        </SelectTrigger>
                                        <SelectContent>
                                            <SelectItem value="male">Male</SelectItem>
                                            <SelectItem value="female">Female</SelectItem>
                                        </SelectContent>
                                    </Select>
                                ) : (
                                    <p className="font-medium mt-1 capitalize">{registration.gender}</p>
                                )}
                            </div>
                            <div>
                                <Label>Date of Birth</Label>
                                {isEditing ? (
                                    <Input
                                        type="date"
                                        value={formData.date_of_birth}
                                        onChange={(e) => setFormData({ ...formData, date_of_birth: e.target.value })}
                                    />
                                ) : (
                                    <p className="font-medium mt-1 flex items-center gap-2">
                                        <Calendar className="h-4 w-4 text-gray-400" />
                                        {new Date(registration.date_of_birth).toLocaleDateString()}
                                    </p>
                                )}
                            </div>
                        </CardContent>
                    </Card>

                    {/* Contact Information */}
                    <Card>
                        <CardHeader>
                            <CardTitle className="flex items-center gap-2">
                                <Mail className="h-5 w-5" />
                                Contact Information
                            </CardTitle>
                        </CardHeader>
                        <CardContent className="grid gap-4">
                            <div>
                                <Label>Email</Label>
                                {isEditing ? (
                                    <Input
                                        type="email"
                                        value={formData.email}
                                        onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                                    />
                                ) : (
                                    <p className="font-medium mt-1 flex items-center gap-2">
                                        <Mail className="h-4 w-4 text-gray-400" />
                                        {registration.email}
                                    </p>
                                )}
                            </div>
                            <div>
                                <Label>Phone Number</Label>
                                {isEditing ? (
                                    <Input
                                        value={formData.phone_number}
                                        onChange={(e) => setFormData({ ...formData, phone_number: e.target.value })}
                                    />
                                ) : (
                                    <p className="font-medium mt-1 flex items-center gap-2">
                                        <Phone className="h-4 w-4 text-gray-400" />
                                        {registration.phone_number}
                                    </p>
                                )}
                            </div>
                            <div>
                                <Label>Residential Address</Label>
                                {isEditing ? (
                                    <Textarea
                                        value={formData.residential_address}
                                        onChange={(e) => setFormData({ ...formData, residential_address: e.target.value })}
                                        rows={3}
                                    />
                                ) : (
                                    <p className="font-medium mt-1 flex items-center gap-2">
                                        <MapPin className="h-4 w-4 text-gray-400" />
                                        {registration.residential_address}
                                    </p>
                                )}
                            </div>
                        </CardContent>
                    </Card>

                    {/* Organization & Plan */}
                    <Card>
                        <CardHeader>
                            <CardTitle className="flex items-center gap-2">
                                <Building2 className="h-5 w-5" />
                                Organization & Plan Details
                            </CardTitle>
                        </CardHeader>
                        <CardContent className="grid gap-4 md:grid-cols-2">
                            <div>
                                <Label>Organization</Label>
                                {isEditing ? (
                                    <Select
                                        value={formData.organization_id}
                                        onValueChange={(value) => {
                                            setFormData({ ...formData, organization_id: value, plan_id: "" })
                                        }}
                                    >
                                        <SelectTrigger>
                                            <SelectValue placeholder="Select organization" />
                                        </SelectTrigger>
                                        <SelectContent>
                                            {(Array.isArray(organizations) ? organizations : []).map((org: any) => (
                                                <SelectItem key={org.id} value={org.id}>
                                                    {org.name} ({org.code})
                                                </SelectItem>
                                            ))}
                                        </SelectContent>
                                    </Select>
                                ) : (
                                    <>
                                        <p className="font-medium mt-1">{registration.organization?.name || registration.organization_name}</p>
                                        {registration.organization?.code && (
                                            <p className="text-sm text-gray-500">Code: {registration.organization.code}</p>
                                        )}
                                    </>
                                )}
                            </div>
                            <div>
                                <Label>Plan</Label>
                                {isEditing ? (
                                    <Select
                                        value={formData.plan_id}
                                        onValueChange={(value) => setFormData({ ...formData, plan_id: value })}
                                        disabled={!formData.organization_id}
                                    >
                                        <SelectTrigger>
                                            <SelectValue placeholder={formData.organization_id ? "Select plan" : "Select organization first"} />
                                        </SelectTrigger>
                                        <SelectContent>
                                            {(Array.isArray(plans) ? plans : []).map((plan: any) => (
                                                <SelectItem key={plan.id} value={plan.id}>
                                                    {plan.name}
                                                </SelectItem>
                                            ))}
                                        </SelectContent>
                                    </Select>
                                ) : (
                                    <>
                                        <p className="font-medium mt-1">{registration.plan?.name || registration.plan_name}</p>
                                        {registration.plan_type && (
                                            <p className="text-sm text-gray-500 capitalize">{registration.plan_type}</p>
                                        )}
                                    </>
                                )}
                            </div>
                        </CardContent>
                    </Card>

                    {/* Additional Information */}
                    <Card>
                        <CardHeader>
                            <CardTitle className="flex items-center gap-2">
                                <FileText className="h-5 w-5" />
                                Additional Information
                            </CardTitle>
                        </CardHeader>
                        <CardContent className="grid gap-4">
                            <div>
                                <Label>Primary Hospital</Label>
                                {isEditing ? (
                                    <Input
                                        value={formData.primary_hospital}
                                        onChange={(e) => setFormData({ ...formData, primary_hospital: e.target.value })}
                                    />
                                ) : (
                                    <p className="font-medium mt-1">{registration.primary_hospital || "—"}</p>
                                )}
                            </div>
                            <div>
                                <Label>Hospital Address</Label>
                                {isEditing ? (
                                    <Input
                                        value={formData.hospital_address}
                                        onChange={(e) => setFormData({ ...formData, hospital_address: e.target.value })}
                                    />
                                ) : (
                                    <p className="font-medium mt-1">{registration.hospital_address || "—"}</p>
                                )}
                            </div>
                            <div>
                                <Label>Remarks</Label>
                                {isEditing ? (
                                    <Textarea
                                        value={formData.remarks}
                                        onChange={(e) => setFormData({ ...formData, remarks: e.target.value })}
                                        rows={3}
                                    />
                                ) : (
                                    <p className="font-medium mt-1">{registration.remarks || "—"}</p>
                                )}
                            </div>
                        </CardContent>
                    </Card>

                    {/* Save/Cancel Buttons */}
                    {isEditing && (
                        <div className="flex gap-3">
                            <Button onClick={handleSave} disabled={saveMutation.isPending}>
                                <Save className="h-4 w-4 mr-2" />
                                Save Changes
                            </Button>
                            <Button variant="outline" onClick={() => {
                                setIsEditing(false)
                                // Reset form data
                                setFormData({
                                    first_name: registration.first_name || "",
                                    last_name: registration.last_name || "",
                                    middle_name: registration.middle_name || "",
                                    gender: registration.gender || "",
                                    date_of_birth: registration.date_of_birth ? new Date(registration.date_of_birth).toISOString().split('T')[0] : "",
                                    phone_number: registration.phone_number || "",
                                    email: registration.email || "",
                                    residential_address: registration.residential_address || "",
                                    primary_hospital: registration.primary_hospital || "",
                                    hospital_address: registration.hospital_address || "",
                                    remarks: registration.remarks || "",
                                })
                            }}>
                                Cancel
                            </Button>
                        </div>
                    )}

                    {/* Dependents */}
                    {registration.dependents && registration.dependents.length > 0 && (
                        <Card>
                            <CardHeader>
                                <CardTitle>Dependents ({registration.dependents.length})</CardTitle>
                                <CardDescription>Dependents registered with this principal</CardDescription>
                            </CardHeader>
                            <CardContent>
                                <div className="space-y-4">
                                    {registration.dependents.map((dependent: any) => (
                                        <div key={dependent.id} className="border rounded-lg p-4">
                                            <div className="flex items-center justify-between mb-2">
                                                <h4 className="font-semibold">
                                                    {dependent.first_name} {dependent.last_name}
                                                </h4>
                                                <Badge variant="outline">{dependent.relationship}</Badge>
                                            </div>
                                            <div className="grid gap-2 text-sm">
                                                <p className="text-gray-600">
                                                    DOB: {new Date(dependent.date_of_birth).toLocaleDateString()}
                                                </p>
                                                {dependent.gender && (
                                                    <p className="text-gray-600 capitalize">Gender: {dependent.gender}</p>
                                                )}
                                            </div>
                                        </div>
                                    ))}
                                </div>
                            </CardContent>
                        </Card>
                    )}
                </div>

                {/* Sidebar */}
                <div className="space-y-6">
                    {/* Profile Picture */}
                    {registration.profile_picture && (
                        <Card>
                            <CardHeader>
                                <CardTitle className="flex items-center gap-2">
                                    <ImageIcon className="h-5 w-5" />
                                    Profile Picture
                                </CardTitle>
                            </CardHeader>
                            <CardContent>
                                <img
                                    src={registration.profile_picture}
                                    alt="Profile"
                                    className="w-full rounded-lg border"
                                />
                            </CardContent>
                        </Card>
                    )}

                    {/* Actions */}
                    {!isProcessed && (
                        <Card>
                            <CardHeader>
                                <CardTitle>Actions</CardTitle>
                                <CardDescription>Review and approve or reject this registration</CardDescription>
                            </CardHeader>
                            <CardContent className="space-y-3">
                                <Button
                                    className="w-full"
                                    onClick={() => setShowApproveDialog(true)}
                                    disabled={approveMutation.isPending || rejectMutation.isPending || isEditing}
                                >
                                    <CheckCircle className="h-4 w-4 mr-2" />
                                    Approve Registration
                                </Button>
                                <Button
                                    variant="destructive"
                                    className="w-full"
                                    onClick={() => setShowRejectDialog(true)}
                                    disabled={approveMutation.isPending || rejectMutation.isPending || isEditing}
                                >
                                    <XCircle className="h-4 w-4 mr-2" />
                                    Reject Registration
                                </Button>
                            </CardContent>
                        </Card>
                    )}

                    {/* Processing Info */}
                    {isProcessed && (
                        <Card>
                            <CardHeader>
                                <CardTitle>Processing Information</CardTitle>
                            </CardHeader>
                            <CardContent className="space-y-3">
                                {registration.approved_at && (
                                    <div>
                                        <Label className="text-gray-500">Approved At</Label>
                                        <p className="text-sm">{new Date(registration.approved_at).toLocaleString()}</p>
                                    </div>
                                )}
                                {registration.rejected_at && (
                                    <div>
                                        <Label className="text-gray-500">Rejected At</Label>
                                        <p className="text-sm">{new Date(registration.rejected_at).toLocaleString()}</p>
                                    </div>
                                )}
                                {registration.rejection_reason && (
                                    <div>
                                        <Label className="text-gray-500">Rejection Reason</Label>
                                        <p className="text-sm">{registration.rejection_reason}</p>
                                    </div>
                                )}
                            </CardContent>
                        </Card>
                    )}
                </div>
            </div>

            {/* Approve Dialog */}
            <AlertDialog open={showApproveDialog} onOpenChange={setShowApproveDialog}>
                <AlertDialogContent>
                    <AlertDialogHeader>
                        <AlertDialogTitle>Approve Registration</AlertDialogTitle>
                        <AlertDialogDescription>
                            This will create a principal account and generate an enrollee ID. The applicant will be notified via email.
                            Are you sure you want to approve this registration?
                        </AlertDialogDescription>
                    </AlertDialogHeader>
                    <AlertDialogFooter>
                        <AlertDialogCancel>Cancel</AlertDialogCancel>
                        <AlertDialogAction onClick={handleApprove}>
                            Approve
                        </AlertDialogAction>
                    </AlertDialogFooter>
                </AlertDialogContent>
            </AlertDialog>

            {/* Reject Dialog */}
            <AlertDialog open={showRejectDialog} onOpenChange={setShowRejectDialog}>
                <AlertDialogContent>
                    <AlertDialogHeader>
                        <AlertDialogTitle>Reject Registration</AlertDialogTitle>
                        <AlertDialogDescription>
                            Please provide a reason for rejecting this registration. The applicant will be notified via email.
                        </AlertDialogDescription>
                    </AlertDialogHeader>
                    <div className="py-4">
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
                            Reject
                        </AlertDialogAction>
                    </AlertDialogFooter>
                </AlertDialogContent>
            </AlertDialog>
        </div>
    )
}
