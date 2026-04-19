"use client"

import { useState } from "react"
import { useQuery } from "@tanstack/react-query"
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Separator } from "@/components/ui/separator"
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog"
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
import { Edit, Trash2, Calendar, Building2, Users, DollarSign, X } from "lucide-react"
import { useToast } from "@/hooks/use-toast"
import { PermissionButton } from "@/components/ui/permission-button"

interface ViewPlanModalProps {
  isOpen: boolean
  onClose: () => void
  onEdit: () => void
  onDelete: () => void
  planId: string
}

export function ViewPlanModal({ isOpen, onClose, onEdit, onDelete, planId }: ViewPlanModalProps) {
  const { toast } = useToast()
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false)

  // Fetch plan data
  const { data: plan, isLoading } = useQuery({
    queryKey: ["plan", planId],
    queryFn: async () => {
      const res = await fetch(`/api/underwriting/plans/${planId}`)
      if (!res.ok) throw new Error("Failed to fetch plan")
      return res.json()
    },
    enabled: !!planId && isOpen
  })

  const handleDelete = () => {
    setDeleteDialogOpen(true)
  }

  const confirmDelete = async () => {
    try {
      const res = await fetch(`/api/underwriting/plans/${planId}`, {
        method: 'DELETE'
      })
      
      if (!res.ok) {
        const error = await res.json()
        throw new Error(error.error || 'Failed to delete plan')
      }

      toast({
        title: "Plan deleted successfully",
        description: `${plan?.name} has been deleted from the system.`
      })
      
      onDelete()
      onClose()
      setDeleteDialogOpen(false)
    } catch (error) {
      toast({
        title: "Error",
        description: error instanceof Error ? error.message : "Failed to delete plan",
        variant: "destructive"
      })
    }
  }

  const getStatusBadgeColor = (status: string) => {
    switch (status) {
      case "ACTIVE": return "bg-green-100 text-green-800"
      case "INACTIVE": return "bg-yellow-100 text-yellow-800"
      case "SUSPENDED": return "bg-red-100 text-red-800"
      default: return "bg-gray-100 text-gray-800"
    }
  }

  const getPlanTypeBadgeColor = (planType: string) => {
    switch (planType) {
      case "INDIVIDUAL": return "bg-blue-100 text-blue-800"
      case "FAMILY": return "bg-purple-100 text-purple-800"
      case "CORPORATE": return "bg-green-100 text-green-800"
      default: return "bg-gray-100 text-gray-800"
    }
  }

  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat('en-NG', {
      style: 'currency',
      currency: 'NGN',
      minimumFractionDigits: 0
    }).format(amount)
  }

  if (isLoading) {
    return (
      <Dialog open={isOpen} onOpenChange={onClose}>
        <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
          <div className="flex items-center justify-center h-64">
            <div className="animate-spin rounded-full h-8 w-8 border-t-2 border-b-2 border-blue-600"></div>
          </div>
        </DialogContent>
      </Dialog>
    )
  }

  if (!plan) {
    return (
      <Dialog open={isOpen} onOpenChange={onClose}>
        <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
          <div className="flex items-center justify-center h-64">
            <div className="text-center">
              <h2 className="text-2xl font-bold text-gray-900">Plan not found</h2>
              <p className="text-gray-600">The requested plan could not be found.</p>
              <Button onClick={onClose} className="mt-4">
                Close
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    )
  }

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <div className="flex items-center justify-between">
            <div>
              <DialogTitle className="text-blue-600">{plan.name}</DialogTitle>
              <DialogDescription>Plan Details</DialogDescription>
            </div>
            <div className="flex items-center gap-2">
              <PermissionButton 
                module="underwriting" 
                action="edit"
                onClick={onEdit}
                className="bg-[#BE1522] hover:bg-[#9B1219] text-white"
              >
                <Edit className="h-4 w-4 mr-2" />
                Edit Plan
              </PermissionButton>
              <PermissionButton 
                module="underwriting" 
                action="delete"
                variant="outline"
                className="text-red-600 hover:text-red-700 border-red-200"
                onClick={handleDelete}
              >
                <Trash2 className="h-4 w-4 mr-2" />
                Delete Plan
              </PermissionButton>
            </div>
          </div>
        </DialogHeader>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Plan Details */}
          <div className="lg:col-span-2">
            <Card className="bg-white">
              <CardHeader>
                <CardTitle className="text-blue-600">Plan Details</CardTitle>
              </CardHeader>
              <CardContent className="space-y-6">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  <div className="space-y-4">
                    <div>
                      <label className="text-sm font-medium text-gray-500">Plan Name</label>
                      <p className="text-lg font-semibold text-gray-900">{plan.name}</p>
                    </div>
                    <div>
                      <label className="text-sm font-medium text-gray-500">Plan Type</label>
                      <div className="mt-1">
                        <Badge className={getPlanTypeBadgeColor(plan.plan_type)}>
                          {plan.plan_type}
                        </Badge>
                      </div>
                    </div>
                    <div>
                      <label className="text-sm font-medium text-gray-500">Status</label>
                      <div className="mt-1">
                        <Badge className={getStatusBadgeColor(plan.status)}>
                          {plan.status}
                        </Badge>
                      </div>
                    </div>
                  </div>
                  <div className="space-y-4">
                    <div>
                      <label className="text-sm font-medium text-gray-500">Premium Amount</label>
                      <p className="text-lg font-semibold text-gray-900 flex items-center gap-2">
                        <DollarSign className="h-4 w-4" />
                        {formatCurrency(plan.premium_amount)}
                      </p>
                    </div>
                    <div>
                      <label className="text-sm font-medium text-gray-500">Annual Limit</label>
                      <p className="text-lg font-semibold text-gray-900 flex items-center gap-2">
                        <DollarSign className="h-4 w-4" />
                        {formatCurrency(plan.annual_limit)}
                      </p>
                    </div>
                    <div>
                      <label className="text-sm font-medium text-gray-500">Created</label>
                      <p className="text-sm text-gray-900 flex items-center gap-2">
                        <Calendar className="h-4 w-4" />
                        {new Date(plan.created_at).toLocaleDateString()}
                      </p>
                    </div>
                  </div>
                </div>

                {plan.description && (
                  <>
                    <Separator />
                    <div>
                      <label className="text-sm font-medium text-gray-500">Description</label>
                      <p className="text-sm text-gray-900 mt-1">{plan.description}</p>
                    </div>
                  </>
                )}

                {plan.coverage_details && (
                  <>
                    <Separator />
                    <div>
                      <label className="text-sm font-medium text-gray-500">Coverage Details</label>
                      <pre className="text-sm text-gray-900 mt-1 bg-gray-50 p-3 rounded-md overflow-x-auto">
                        {JSON.stringify(plan.coverage_details, null, 2)}
                      </pre>
                    </div>
                  </>
                )}
              </CardContent>
            </Card>
          </div>

          {/* Sidebar Information */}
          <div className="space-y-6">
            {/* Organization */}
            {plan.organization && (
              <Card className="bg-white">
                <CardHeader>
                  <CardTitle className="text-sm font-medium text-gray-500">Organization</CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 bg-gray-100 rounded-lg flex items-center justify-center">
                      <Building2 className="h-5 w-5 text-gray-600" />
                    </div>
                    <div>
                      <p className="font-medium text-gray-900">{plan.organization.name}</p>
                      <p className="text-sm text-gray-500">{plan.organization.code}</p>
                    </div>
                  </div>
                </CardContent>
              </Card>
            )}

            {/* Created By */}
            <Card className="bg-white">
              <CardHeader>
                <CardTitle className="text-sm font-medium text-gray-500">Created By</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 bg-gray-100 rounded-lg flex items-center justify-center">
                    <Users className="h-5 w-5 text-gray-600" />
                  </div>
                  <div>
                    <p className="font-medium text-gray-900">
                      {plan.created_by.first_name} {plan.created_by.last_name}
                    </p>
                    <p className="text-sm text-gray-500">
                      {new Date(plan.created_at).toLocaleDateString()}
                    </p>
                  </div>
                </div>
              </CardContent>
            </Card>

            {/* Principal Accounts */}
            <Card className="bg-white">
              <CardHeader>
                <CardTitle className="text-sm font-medium text-gray-500">Principal Accounts</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="text-center">
                  <p className="text-2xl font-bold text-gray-900">{plan.principal_accounts?.length || 0}</p>
                  <p className="text-sm text-gray-500">Associated Accounts</p>
                </div>
              </CardContent>
            </Card>
          </div>
        </div>
      </DialogContent>

      {/* Delete Confirmation Dialog */}
      <AlertDialog open={deleteDialogOpen} onOpenChange={(open) => {
        setDeleteDialogOpen(open)
      }}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete Plan</AlertDialogTitle>
            <AlertDialogDescription>
              Are you sure you want to delete{" "}
              <strong>{plan?.name}</strong>? This action cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={confirmDelete}
              className="bg-red-600 hover:bg-red-700"
            >
              Delete
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </Dialog>
  )
}
