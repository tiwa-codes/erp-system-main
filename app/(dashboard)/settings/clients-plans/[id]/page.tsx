"use client"

import React, { useState } from "react"
import { useParams, useRouter } from "next/navigation"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { Input } from "@/components/ui/input"
import { Textarea } from "@/components/ui/textarea"
import { Label } from "@/components/ui/label"
import { useToast } from "@/hooks/use-toast"
import { useEffect } from "react"
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"

export default function ClientPlanDetailPage() {
  const params = useParams()
  const router = useRouter()
  const { toast } = useToast()
  const planId = params.id as string

  const [clientPlan, setClientPlan] = useState<any>(null)
  const [loading, setLoading] = useState(true)
  const [approving, setApproving] = useState(false)
  const [rejecting, setRejecting] = useState(false)
  const [reviewing, setReviewing] = useState(false)
  const [confirmingPayment, setConfirmingPayment] = useState(false)
  const [totalPrice, setTotalPrice] = useState<string>("")
  const [rejectionReason, setRejectionReason] = useState<string>("")

  useEffect(() => {
    fetchPlan()
  }, [])

  const fetchPlan = async () => {
    try {
      const response = await fetch(`/api/clients-plans/${planId}`)
      if (!response.ok) throw new Error("Failed to fetch plan")
      const data = await response.json()
      setClientPlan(data.data)
      setTotalPrice(data.data.total_price?.toString() || "")
    } catch (error) {
      console.error("Error fetching plan:", error)
      toast({
        title: "Error",
        description: "Failed to fetch plan details",
        variant: "destructive",
      })
    } finally {
      setLoading(false)
    }
  }

  const handleReview = async () => {
    try {
      setReviewing(true)
      const response = await fetch(`/api/clients-plans/${planId}/review`, {
        method: "PATCH",
      })
      if (!response.ok) throw new Error("Failed to move to review")
      const data = await response.json()
      setClientPlan(data.data)
      toast({
        title: "Success",
        description: "Plan moved to review status",
      })
    } catch (error) {
      console.error("Error:", error)
      toast({
        title: "Error",
        description: "Failed to move plan to review",
        variant: "destructive",
      })
    } finally {
      setReviewing(false)
    }
  }

  const handleApprove = async () => {
    if (!totalPrice || parseFloat(totalPrice) <= 0) {
      toast({
        title: "Error",
        description: "Please enter a valid total price",
        variant: "destructive",
      })
      return
    }

    try {
      setApproving(true)
      const response = await fetch(`/api/clients-plans/${planId}/approve`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          total_price: parseFloat(totalPrice),
        }),
      })
      if (!response.ok) throw new Error("Failed to approve plan")
      const data = await response.json()
      setClientPlan(data.data)
      toast({
        title: "Success",
        description: "Plan approved and invoice generated",
      })
      router.refresh()
    } catch (error) {
      console.error("Error:", error)
      toast({
        title: "Error",
        description: "Failed to approve plan",
        variant: "destructive",
      })
    } finally {
      setApproving(false)
    }
  }

  const handleReject = async () => {
    if (!rejectionReason.trim()) {
      toast({
        title: "Error",
        description: "Please provide a rejection reason",
        variant: "destructive",
      })
      return
    }

    try {
      setRejecting(true)
      const response = await fetch(`/api/clients-plans/${planId}/reject`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          rejection_reason: rejectionReason,
        }),
      })
      if (!response.ok) throw new Error("Failed to reject plan")
      const data = await response.json()
      setClientPlan(data.data)
      toast({
        title: "Success",
        description: "Plan rejected successfully",
      })
      router.refresh()
    } catch (error) {
      console.error("Error:", error)
      toast({
        title: "Error",
        description: "Failed to reject plan",
        variant: "destructive",
      })
    } finally {
      setRejecting(false)
    }
  }

  const handleConfirmPayment = async () => {
    try {
      setConfirmingPayment(true)
      const response = await fetch(`/api/clients-plans/${planId}/confirm-payment`, {
        method: "PATCH",
      })

      const data = await response.json()
      if (!response.ok) {
        throw new Error(data.error || "Failed to confirm payment")
      }

      toast({
        title: "Payment confirmed",
        description: data.message || "Client payment has been confirmed.",
      })
      await fetchPlan()
      router.refresh()
    } catch (error: any) {
      toast({
        title: "Error",
        description: error?.message || "Failed to confirm payment",
        variant: "destructive",
      })
    } finally {
      setConfirmingPayment(false)
    }
  }

  if (loading) {
    return <div className="flex items-center justify-center h-96">Loading...</div>
  }

  if (!clientPlan) {
    return <div className="flex items-center justify-center h-96">Plan not found</div>
  }

  const clientDisplayName = clientPlan.principal_account
    ? `${clientPlan.principal_account.first_name} ${clientPlan.principal_account.last_name}`
    : `${clientPlan.client_account?.user?.first_name || ""} ${clientPlan.client_account?.user?.last_name || ""}`.trim() || "N/A"
  const clientDisplayEmail =
    clientPlan.principal_account?.user?.email || clientPlan.client_account?.user?.email || "N/A"

  const getStatusColor = (status: string) => {
    const colors: Record<string, string> = {
      DRAFT: "secondary",
      PENDING: "default",
      REVIEW: "outline",
      APPROVED: "default",
      REJECTED: "destructive",
      INVOICED: "secondary",
      PAID: "outline",
    }
    return colors[status] || "secondary"
  }

  const calculateSubtotal = () => {
    return clientPlan.services?.reduce(
      (acc: number, service: any) => acc + (service.total_amount || 0),
      0
    ) || 0
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">{clientPlan.plan_name}</h1>
          <div className="flex items-center gap-3 mt-2">
            <Badge variant={getStatusColor(clientPlan.status) as any}>
              {clientPlan.status}
            </Badge>
            <span className="text-sm text-muted-foreground">
              ID: {clientPlan.client_plan_id}
            </span>
          </div>
        </div>
        <Button variant="outline" onClick={() => router.back()}>
          Back
        </Button>
      </div>

      <Tabs defaultValue="details" className="w-full">
        <TabsList>
          <TabsTrigger value="details">Plan Details</TabsTrigger>
          <TabsTrigger value="services">Services</TabsTrigger>
          <TabsTrigger value="pricing">Pricing & Approval</TabsTrigger>
          <TabsTrigger value="invoice">Invoice</TabsTrigger>
        </TabsList>

        {/* Details Tab */}
        <TabsContent value="details">
          <Card>
            <CardHeader>
              <CardTitle>Plan Information</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid gap-4 md:grid-cols-2">
                <div>
                  <Label>Client Name</Label>
                  <p className="font-medium">{clientDisplayName}</p>
                </div>
                <div>
                  <Label>Client Email</Label>
                  <p className="font-medium">{clientDisplayEmail}</p>
                </div>
                <div>
                  <Label>Organization</Label>
                  <p className="font-medium">{clientPlan.organization.name}</p>
                </div>
                <div>
                  <Label>Status</Label>
                  <Badge variant={getStatusColor(clientPlan.status) as any}>
                    {clientPlan.status}
                  </Badge>
                </div>
                <div>
                  <Label>Submitted</Label>
                  <p className="font-medium">
                    {clientPlan.submitted_at
                      ? new Date(clientPlan.submitted_at).toLocaleDateString()
                      : "Not submitted"}
                  </p>
                </div>
                <div>
                  <Label>Description</Label>
                  <p className="font-medium">
                    {clientPlan.plan_description || "No description"}
                  </p>
                </div>
                <div>
                  <Label>Client Preferred Premium</Label>
                  <p className="font-medium">
                    {clientPlan.requested_premium
                      ? `₦${clientPlan.requested_premium.toLocaleString()}`
                      : "Not specified"}
                  </p>
                </div>
                <div>
                  <Label>Client Preferred Annual Limit</Label>
                  <p className="font-medium">
                    {clientPlan.requested_annual_limit
                      ? `₦${clientPlan.requested_annual_limit.toLocaleString()}`
                      : "Not specified"}
                  </p>
                </div>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        {/* Services Tab */}
        <TabsContent value="services">
          <Card>
            <CardHeader>
              <CardTitle>Selected Services</CardTitle>
            </CardHeader>
            <CardContent>
              {clientPlan.services && clientPlan.services.length > 0 ? (
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Service Name</TableHead>
                      <TableHead>Category</TableHead>
                      <TableHead>Quantity</TableHead>
                      <TableHead>Unit Price</TableHead>
                      <TableHead>Total Amount</TableHead>
                      <TableHead>Category Price Limit</TableHead>
                      <TableHead>Frequency Limit</TableHead>
                      <TableHead>Price Limit</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {clientPlan.services.map((service: any) => (
                      <TableRow key={service.id}>
                        <TableCell className="font-medium">
                          {service.service_name}
                        </TableCell>
                        <TableCell>{service.category}</TableCell>
                        <TableCell>{service.quantity}</TableCell>
                        <TableCell>₦{service.unit_price.toLocaleString()}</TableCell>
                        <TableCell>₦{service.total_amount.toLocaleString()}</TableCell>
                        <TableCell>
                          {service.category_price_limit
                            ? `₦${service.category_price_limit.toLocaleString()}`
                            : "Unlimited"}
                        </TableCell>
                        <TableCell>
                          {service.frequency_limit || "Unlimited"}
                        </TableCell>
                        <TableCell>
                          {service.price_limit
                            ? `₦${service.price_limit.toLocaleString()}`
                            : "Unlimited"}
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              ) : (
                <p className="text-muted-foreground">No services selected</p>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        {/* Pricing & Approval Tab */}
        <TabsContent value="pricing">
          <Card>
            <CardHeader>
              <CardTitle>Pricing & Action</CardTitle>
            </CardHeader>
            <CardContent className="space-y-6">
              {/* Summary */}
              <div className="bg-muted p-4 rounded-lg space-y-2">
                <div className="flex justify-between">
                  <span className="font-medium">Subtotal (Services):</span>
                  <span className="font-medium">
                    ₦{calculateSubtotal().toLocaleString()}
                  </span>
                </div>
              </div>

              {/* Approval Section */}
              {(clientPlan.status === "PENDING" ||
                clientPlan.status === "REVIEW") && (
                <div className="space-y-4 border-t pt-6">
                  <div>
                    <Label htmlFor="totalPrice">
                      Set Total Plan Price *
                    </Label>
                    <Input
                      id="totalPrice"
                      type="number"
                      placeholder="Enter total plan price"
                      value={totalPrice}
                      onChange={(e) => setTotalPrice(e.target.value)}
                      className="mt-2"
                    />
                  </div>

                  <div className="flex gap-3">
                    {clientPlan.status === "PENDING" && (
                      <Button
                        onClick={handleReview}
                        disabled={reviewing}
                        variant="outline"
                      >
                        {reviewing ? "Moving to Review..." : "Move to Review"}
                      </Button>
                    )}
                    <Button
                      onClick={handleApprove}
                      disabled={approving || !totalPrice}
                      className="bg-green-600 hover:bg-green-700"
                    >
                      {approving ? "Approving..." : "Approve & Generate Invoice"}
                    </Button>
                  </div>
                </div>
              )}

              {/* Rejection Section */}
              {(clientPlan.status === "PENDING" ||
                clientPlan.status === "REVIEW") && (
                <div className="space-y-4 border-t pt-6">
                  <div>
                    <Label htmlFor="rejectionReason">
                      Rejection Reason (Optional)
                    </Label>
                    <Textarea
                      id="rejectionReason"
                      placeholder="Enter reason if you want to reject this plan"
                      value={rejectionReason}
                      onChange={(e) => setRejectionReason(e.target.value)}
                      className="mt-2"
                    />
                  </div>
                  <Button
                    onClick={handleReject}
                    disabled={rejecting}
                    variant="destructive"
                  >
                    {rejecting ? "Rejecting..." : "Reject Plan"}
                  </Button>
                </div>
              )}

              {/* Approved Info */}
              {clientPlan.status === "APPROVED" && (
                <div className="bg-green-50 p-4 rounded-lg border border-green-200">
                  <p className="text-sm text-green-800">
                    ✓ Plan approved on{" "}
                    {new Date(clientPlan.approved_at).toLocaleDateString()} by{" "}
                    {clientPlan.approved_by?.name}
                  </p>
                  <p className="text-lg font-bold text-green-900 mt-2">
                    Total Price: ₦{clientPlan.total_price?.toLocaleString()}
                  </p>
                </div>
              )}

              {/* Rejected Info */}
              {clientPlan.status === "REJECTED" && (
                <div className="bg-red-50 p-4 rounded-lg border border-red-200">
                  <p className="text-sm font-medium text-red-800">
                    Rejected on{" "}
                    {new Date(clientPlan.rejected_at).toLocaleDateString()} by{" "}
                    {clientPlan.rejected_by?.name}
                  </p>
                  <p className="text-sm text-red-700 mt-2">
                    <strong>Reason:</strong> {clientPlan.rejection_reason}
                  </p>
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        {/* Invoice Tab */}
        <TabsContent value="invoice">
          <Card>
            <CardHeader>
              <CardTitle>Invoice</CardTitle>
            </CardHeader>
            <CardContent>
              {clientPlan.invoice ? (
                <div className="space-y-4">
                  <div className="grid gap-4 md:grid-cols-2">
                    <div>
                      <Label>Invoice Number</Label>
                      <p className="font-medium">{clientPlan.invoice.invoice_number}</p>
                    </div>
                    <div>
                      <Label>Total Amount</Label>
                      <p className="font-bold text-lg">
                        ₦{clientPlan.invoice.total_amount.toLocaleString()}
                      </p>
                    </div>
                    <div>
                      <Label>Invoice Date</Label>
                      <p className="font-medium">
                        {new Date(clientPlan.invoice.invoice_date).toLocaleDateString()}
                      </p>
                    </div>
                    <div>
                      <Label>Due Date</Label>
                      <p className="font-medium">
                        {new Date(clientPlan.invoice.due_date).toLocaleDateString()}
                      </p>
                    </div>
                    <div>
                      <Label>Status</Label>
                      <Badge variant={clientPlan.invoice.status === "PAID" ? "outline" : "default"}>
                        {clientPlan.invoice.status === "PENDING" ? "PENDING PAYMENT" : clientPlan.invoice.status}
                      </Badge>
                    </div>
                  </div>

                  {clientPlan.invoice.invoice_data?.payment_evidence?.url && (
                    <div className="rounded-md border border-slate-200 bg-slate-50 p-4 space-y-2">
                      <Label>Payment Evidence</Label>
                      <a
                        href={clientPlan.invoice.invoice_data.payment_evidence.url}
                        target="_blank"
                        rel="noreferrer"
                        className="text-blue-700 underline break-all"
                      >
                        {clientPlan.invoice.invoice_data.payment_evidence.file_name || "View uploaded payment evidence"}
                      </a>
                      <p className="text-xs text-muted-foreground">
                        Uploaded:{" "}
                        {clientPlan.invoice.invoice_data.payment_evidence.submitted_at
                          ? new Date(clientPlan.invoice.invoice_data.payment_evidence.submitted_at).toLocaleString()
                          : "N/A"}
                      </p>
                    </div>
                  )}

                  {clientPlan.status === "INVOICED" && (
                    <div className="border-t pt-4">
                      <Button
                        onClick={handleConfirmPayment}
                        disabled={confirmingPayment || !clientPlan.invoice.invoice_data?.payment_evidence?.url}
                        className="bg-green-600 hover:bg-green-700"
                      >
                        {confirmingPayment ? "Confirming..." : "Confirm Payment"}
                      </Button>
                    </div>
                  )}
                </div>
              ) : (
                <p className="text-muted-foreground">
                  Invoice will be generated when plan is approved
                </p>
              )}
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  )
}
