"use client"

import { useState } from "react"
import { useMutation, useQuery } from "@tanstack/react-query"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import { Save, X } from "lucide-react"
import { useToast } from "@/hooks/use-toast"

interface AddPlanModalProps {
  isOpen: boolean
  onClose: () => void
  onCreated: () => void
}

export function AddPlanModal({ isOpen, onClose, onCreated }: AddPlanModalProps) {
  const { toast } = useToast()
  const [formData, setFormData] = useState({
    name: "",
    description: "",
    plan_type: "INDIVIDUAL",
    premium_amount: "",
    annual_limit: "",
    organization_id: "",
    coverage_details: ""
  })

  // Fetch organizations for dropdown
  const { data: organizationsData } = useQuery({
    queryKey: ["organizations"],
    queryFn: async () => {
      const res = await fetch("/api/organizations")
      if (!res.ok) throw new Error("Failed to fetch organizations")
      return res.json()
    }
  })

  const organizations = organizationsData?.organizations || []

  const createPlanMutation = useMutation({
    mutationFn: async (data: any) => {
      const res = await fetch("/api/underwriting/plans", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(data)
      })
      if (!res.ok) {
        const error = await res.json()
        throw new Error(error.error || "Failed to create plan")
      }
      return res.json()
    },
    onSuccess: () => {
      toast({
        title: "Plan created successfully",
        description: "The new plan has been added to the system."
      })
      onCreated()
      onClose()
      // Reset form
      setFormData({
        name: "",
        description: "",
        plan_type: "INDIVIDUAL",
        premium_amount: "",
        annual_limit: "",
        organization_id: "",
        coverage_details: ""
      })
    },
    onError: (error: Error) => {
      toast({
        title: "Error creating plan",
        description: error.message,
        variant: "destructive"
      })
    }
  })

  const handleInputChange = (field: string, value: string) => {
    setFormData(prev => ({ ...prev, [field]: value }))
  }

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    
    if (!formData.name || !formData.premium_amount || !formData.annual_limit) {
      toast({
        title: "Validation Error",
        description: "Please fill in all required fields.",
        variant: "destructive"
      })
      return
    }

    createPlanMutation.mutate({
      ...formData,
      organization_id: formData.organization_id || null,
      coverage_details: formData.coverage_details ? JSON.parse(formData.coverage_details) : null
    })
  }

  const handleClose = () => {
    onClose()
    // Reset form
    setFormData({
      name: "",
      description: "",
      plan_type: "INDIVIDUAL",
      premium_amount: "",
      annual_limit: "",
      organization_id: "",
      coverage_details: ""
    })
  }

  return (
    <Dialog open={isOpen} onOpenChange={handleClose}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="text-blue-600">Add New Plan</DialogTitle>
          <DialogDescription>Create a new insurance plan with coverage details</DialogDescription>
        </DialogHeader>
        
        <form onSubmit={handleSubmit} className="space-y-6">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            {/* Plan Name */}
            <div className="space-y-2">
              <Label htmlFor="name">Plan Name *</Label>
              <Input
                id="name"
                placeholder="e.g., Gold Individual Plan"
                value={formData.name}
                onChange={(e) => handleInputChange("name", e.target.value)}
                required
              />
            </div>

            {/* Plan Type */}
            <div className="space-y-2">
              <Label htmlFor="plan_type">Plan Type *</Label>
              <Select value={formData.plan_type} onValueChange={(value) => handleInputChange("plan_type", value)}>
                <SelectTrigger>
                  <SelectValue placeholder="Select plan type" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="INDIVIDUAL">Individual</SelectItem>
                  <SelectItem value="FAMILY">Family</SelectItem>
                  <SelectItem value="CORPORATE">Corporate</SelectItem>
                </SelectContent>
              </Select>
            </div>

            {/* Premium Amount */}
            <div className="space-y-2">
              <Label htmlFor="premium_amount">Premium Amount (₦) *</Label>
              <Input
                id="premium_amount"
                type="number"
                placeholder="50000"
                value={formData.premium_amount}
                onChange={(e) => handleInputChange("premium_amount", e.target.value)}
                required
              />
            </div>

            {/* Annual Limit */}
            <div className="space-y-2">
              <Label htmlFor="annual_limit">Annual Limit (₦) *</Label>
              <Input
                id="annual_limit"
                type="number"
                placeholder="1000000"
                value={formData.annual_limit}
                onChange={(e) => handleInputChange("annual_limit", e.target.value)}
                required
              />
            </div>

            {/* Organization */}
            <div className="space-y-2">
              <Label htmlFor="organization_id">Organization</Label>
              <Select value={formData.organization_id || "none"} onValueChange={(value) => handleInputChange("organization_id", value === "none" ? "" : value)}>
                <SelectTrigger>
                  <SelectValue placeholder="Select organization (optional)" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="none">No Organization</SelectItem>
                  {organizations.map((org: any) => (
                    <SelectItem key={org.id} value={org.id}>
                      {org.name} ({org.code})
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>

          {/* Description */}
          <div className="space-y-2">
            <Label htmlFor="description">Description</Label>
            <Textarea
              id="description"
              placeholder="Enter plan description..."
              value={formData.description}
              onChange={(e) => handleInputChange("description", e.target.value)}
              rows={3}
            />
          </div>

          {/* Coverage Details */}
          <div className="space-y-2">
            <Label htmlFor="coverage_details">Coverage Details (JSON)</Label>
            <Textarea
              id="coverage_details"
              placeholder='{"inpatient": 100, "outpatient": 80, "pharmacy": 70}'
              value={formData.coverage_details}
              onChange={(e) => handleInputChange("coverage_details", e.target.value)}
              rows={4}
            />
            <p className="text-sm text-gray-500">
              Enter coverage details as JSON format (optional)
            </p>
          </div>

          {/* Action Buttons */}
          <div className="flex items-center gap-4 pt-6">
            <Button
              type="submit"
              disabled={createPlanMutation.isPending}
              className="bg-[#BE1522] hover:bg-[#9B1219] text-white"
            >
              <Save className="h-4 w-4 mr-2" />
              {createPlanMutation.isPending ? "Creating..." : "Create Plan"}
            </Button>
            <Button type="button" variant="outline" onClick={handleClose}>
              <X className="h-4 w-4 mr-2" />
              Cancel
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  )
}
