"use client"

import { useState, useEffect } from "react"
import { useMutation, useQuery } from "@tanstack/react-query"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { StateLGASelect, useStateLGASelection } from "@/components/ui/state-lga-select"
import { useToast } from "@/hooks/use-toast"
import { 
  Badge,
} from "lucide-react"
interface EditOrganizationFormProps {
  organization: any
  onClose: () => void
  onUpdated?: () => void
}

export function EditOrganizationForm({ organization, onClose, onUpdated }: EditOrganizationFormProps) {
  const { toast } = useToast()
  
  const [state, setState] = useState(organization?.contact_info?.state || "")
  const [lga, setLGA] = useState(organization?.contact_info?.lga || "")
  const [region, setRegion] = useState(organization?.region || "")
  const [businessType, setBusinessType] = useState(organization?.business_type || "")
  
  const [form, setForm] = useState({
    name: organization?.name || "",
    organizationCode: organization?.code || organization?.organization_code || "",
    contactPerson: organization?.contact_info?.contact_person || "",
    contactNumber: organization?.contact_info?.phone_number || "",
    email: organization?.contact_info?.email || "",
    accountType: organization?.type || "",
    headOfficeAddress: organization?.contact_info?.headOfficeAddress || "",
    startDate: organization?.contact_info?.startDate || "",
    endDate: organization?.contact_info?.endDate || "",
    autoRenewal: organization?.contact_info?.autoRenewal || false,
    planIds: organization?.plans?.map((p: any) => p.plan?.id || p.id) ||
             organization?.organization_plans?.map((op: any) => op.plan?.id || op.plan_id) || [],
    region: organization?.region || "",
    businessType: organization?.business_type || "",
    premiumPaid: organization?.premium_paid?.toString() || ""
  })

  useEffect(() => {
    if (!organization) return

    setState(organization?.contact_info?.state || "")
    setLGA(organization?.contact_info?.lga || "")
    setRegion(organization?.region || "")
    setBusinessType(organization?.business_type || "")

    setForm(prev => ({
      ...prev,
      name: organization.name || "",
      organizationCode: organization.code || organization.organization_code || "",
      contactPerson: organization?.contact_info?.contact_person || "",
      contactNumber: organization?.contact_info?.phone_number || "",
      email: organization?.contact_info?.email || "",
      accountType: organization?.type || "",
      headOfficeAddress: organization?.contact_info?.headOfficeAddress || "",
      startDate: organization?.contact_info?.startDate || "",
      endDate: organization?.contact_info?.endDate || "",
      autoRenewal: organization?.contact_info?.autoRenewal || false,
      planIds: organization?.organization_plans?.map((op: any) => op.plan?.id || op.plan_id) || [],
      region: organization?.region || "",
      businessType: organization?.business_type || "",
      premiumPaid: organization?.premium_paid?.toString() || ""
    }))
  }, [organization])

  // Fetch plans for selection - fetch all plans without pagination
  const { data: plansData } = useQuery({
    queryKey: ["plans", "all"],
    queryFn: async () => {
      const res = await fetch('/api/underwriting/plans?limit=10000')
      if (!res.ok) throw new Error('Failed to fetch plans')
      return res.json()
    },
    refetchOnMount: true,
    refetchOnWindowFocus: false,
    staleTime: 0
  })

  const plans = plansData?.plans || []

  const updateMutation = useMutation({
    mutationFn: async () => {
      const premiumPaidValue = form.premiumPaid.trim()
        ? Number(form.premiumPaid)
        : null

      const payload = {
        ...form,
        state,
        lga,
        region,
        business_type: businessType,
        premiumPaid: Number.isFinite(premiumPaidValue) ? premiumPaidValue : null
      }
      
      
      const res = await fetch(`/api/organizations/${organization.id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
      })
      
      
      if (!res.ok) {
        const err = await res.json().catch(() => ({}))
        throw new Error(err.error || `Failed to update organization (${res.status})`)
      }
      
      const result = await res.json()
      return result
    },
    onSuccess: () => {
      toast({ title: 'Organization updated successfully' })
      onUpdated?.()
    },
    onError: (e: Error) => {
      toast({ title: 'Error', description: e.message, variant: 'destructive' })
    }
  })

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    
    // Basic validation
    if (!form.name.trim() || !form.organizationCode.trim() || !form.accountType || !state || !lga || form.planIds.length === 0) {
      toast({ title: 'Error', description: 'Please fill in all required fields including at least one plan', variant: 'destructive' })
      return
    }
    
    updateMutation.mutate()
  }

  // Guard clause - if no organization data, don't render
  if (!organization || !organization.id) {
    return (
      <div className="p-4 text-center text-gray-500">
        No organization selected
      </div>
    )
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-6">
      {/* Organization Information */}
      <div className="space-y-4">
        <h3 className="text-lg font-medium">Organization Information</h3>
        
        <div className="grid grid-cols-2 gap-4">
          <div>
            <Label htmlFor="name">Organization Name *</Label>
            <Input
              id="name"
              value={form.name}
              onChange={(e) => setForm(prev => ({ ...prev, name: e.target.value }))}
              required
              placeholder="Enter organization name"
            />
          </div>
          <div>
            <Label htmlFor="organizationCode">Organization Code *</Label>
            <Input
              id="organizationCode"
              value={form.organizationCode}
              onChange={(e) => {
                // Convert to uppercase and allow alphanumeric characters
                const value = e.target.value.replace(/[^A-Z0-9]/g, '').toUpperCase()
                setForm(prev => ({ ...prev, organizationCode: value }))
              }}
              required
              placeholder="e.g., AB, TB123, COMPANY01"
            />
            <p className="text-sm text-gray-500 mt-1">
              Enter organization code (alphanumeric, minimum 2 characters)
            </p>
          </div>
        </div>

        <div className="grid grid-cols-2 gap-4">
          <div>
            <Label htmlFor="contactPerson">Contact Person *</Label>
            <Input
              id="contactPerson"
              value={form.contactPerson}
              onChange={(e) => setForm(prev => ({ ...prev, contactPerson: e.target.value }))}
              required
              placeholder="Enter contact person name"
            />
          </div>
          <div>
            <Label htmlFor="contactNumber">Contact Number</Label>
            <Input
              id="contactNumber"
              value={form.contactNumber}
              onChange={(e) => setForm(prev => ({ ...prev, contactNumber: e.target.value }))}
              placeholder="Enter contact number"
            />
          </div>
        </div>

        <div className="grid grid-cols-2 gap-4">
          <div>
            <Label htmlFor="email">Email Address *</Label>
            <Input
              id="email"
              type="email"
              value={form.email}
              onChange={(e) => setForm(prev => ({ ...prev, email: e.target.value }))}
              required
              placeholder="Enter email address"
            />
          </div>
          <div>
            <Label htmlFor="accountType">Account Type *</Label>
            <Select value={form.accountType} onValueChange={(value) => setForm(prev => ({ ...prev, accountType: value }))}>
              <SelectTrigger>
                <SelectValue placeholder="Select account type" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="CORPORATE">Corporate</SelectItem>
                <SelectItem value="INDIVIDUAL">Individual</SelectItem>
                <SelectItem value="GOVERNMENT">Government</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div>
            <Label htmlFor="premiumPaid">Premium Paid (₦)</Label>
            <Input
              id="premiumPaid"
              type="number"
              min="0"
              step="0.01"
              value={form.premiumPaid}
              onChange={(e) => setForm(prev => ({ ...prev, premiumPaid: e.target.value }))}
              placeholder="Enter premium paid"
            />
          </div>
        </div>

      </div>

      {/* Location Information */}
      <div className="space-y-4">
        <h3 className="text-lg font-medium">Location Information</h3>
        <StateLGASelect
          state={state}
          lga={lga}
          onStateChange={setState}
          onLGAChange={setLGA}
          required={true}
        />
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div>
            <Label htmlFor="startDate">Start Date</Label>
            <Input
              id="startDate"
              type="date"
              value={form.startDate}
              onChange={(e) => setForm(prev => ({ ...prev, startDate: e.target.value }))}
            />
          </div>
          <div>
            <Label htmlFor="endDate">End Date</Label>
            <Input
              id="endDate"
              type="date"
              value={form.endDate}
              onChange={(e) => setForm(prev => ({ ...prev, endDate: e.target.value }))}
            />
          </div>
          <div>
            <Label htmlFor="region">Region</Label>
            <Input
              id="region"
              value={region}
              onChange={(e) => setRegion(e.target.value)}
              placeholder="Enter region"
            />
          </div>
          <div>
            <Label htmlFor="businessType">Business Type</Label>
            <Input
              id="businessType"
              value={businessType}
              onChange={(e) => setBusinessType(e.target.value)}
              placeholder="Enter business type"
            />
          </div>
          <div className="flex items-center gap-2 pt-6">
            <input
              id="autoRenewal"
              type="checkbox"
              checked={!!form.autoRenewal}
              onChange={(e) => setForm(prev => ({ ...prev, autoRenewal: e.target.checked }))}
              className="h-4 w-4"
            />
            <Label htmlFor="autoRenewal">Auto Renewal</Label>
          </div>
        </div>
      </div>

      {/* Plan Selection */}
      <div className="space-y-4">
        <h3 className="text-lg font-medium">Plan Selection</h3>
        <div>
          <Label htmlFor="planIds">Assigned Plans *</Label>
          <div className="space-y-2 max-h-60 overflow-y-auto border rounded-md p-4">
            {plans.length === 0 ? (
              <p className="text-sm text-gray-500">Loading plans...</p>
            ) : (
              plans.map((plan: any) => (
                <div key={plan.id} className="flex items-center justify-between space-x-2 py-2 border-b last:border-b-0">
                  <button
                    type="button"
                    onClick={() => {
                      if (form.planIds.includes(plan.id)) {
                        setForm(prev => ({ ...prev, planIds: prev.planIds.filter(id => id !== plan.id) }))
                      } else {
                        setForm(prev => ({ ...prev, planIds: [...prev.planIds, plan.id] }))
                      }
                    }}
                    className={`flex items-center space-x-2 flex-1 text-left hover:bg-gray-50 p-2 rounded transition-colors ${
                      form.planIds.includes(plan.id) ? 'bg-blue-50' : ''
                    }`}
                  >
                    <div className={`w-4 h-4 rounded border-2 flex items-center justify-center ${
                      form.planIds.includes(plan.id) 
                        ? 'bg-[#0891B2] border-blue-600' 
                        : 'border-gray-300'
                    }`}>
                      {form.planIds.includes(plan.id) && (
                        <svg className="w-3 h-3 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M5 13l4 4L19 7" />
                        </svg>
                      )}
                    </div>
                    <span className="text-sm font-medium">
                      {plan.name} - {plan.plan_type}
                    </span>
                  </button>
                  <Badge className="text-xs uppercase">
                    {plan.status || "Active"}
                  </Badge>
                </div>
              ))
            )}
          </div>
          {form.planIds.length === 0 && (
            <p className="text-sm text-red-600 mt-1">Please select at least one plan</p>
          )}
        </div>
      </div>

      {/* Form Actions */}
      <div className="flex justify-end gap-4 pt-4">
        <Button type="button" variant="outline" onClick={onClose}>
          Cancel
        </Button>
        <Button 
          type="submit" 
          disabled={updateMutation.isPending || form.planIds.length === 0}
          className="bg-[#0891B2] hover:bg-[#9B1219] text-white"
        >
          {updateMutation.isPending ? "Updating..." : "Update Organization"}
        </Button>
      </div>
    </form>
  )
}
