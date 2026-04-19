"use client"

import { useState } from "react"
import { useMutation, useQuery } from "@tanstack/react-query"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Checkbox } from "@/components/ui/checkbox"
import { StateLGASelect, useStateLGASelection } from "@/components/ui/state-lga-select"
import { FileUpload } from "@/components/ui/file-upload"
import { useToast } from "@/hooks/use-toast"
interface AddOrganizationFormProps {
  onClose: () => void
  onCreated?: () => void
}

export function AddOrganizationForm({ onClose, onCreated }: AddOrganizationFormProps) {
  const { toast } = useToast()
  const { state, lga, setState, setLGA } = useStateLGASelection()
  
  const [form, setForm] = useState({
    name: "",
    organizationCode: "",
    contactPerson: "",
    contactNumber: "",
    email: "",
    accountType: "",
    headOfficeAddress: "",
    startDate: "",
    endDate: "",
    autoRenewal: false,
    planIds: [] as string[],
    uploadedFiles: [] as File[],
    region: "",
    businessType: "",
    premiumPaid: ""
  })
  const [planSearch, setPlanSearch] = useState("")

  // Fetch plans for selection - fetch all plans without pagination
  const { data: plansData } = useQuery({
    queryKey: ["plans", "all"],
    queryFn: async () => {
      const res = await fetch('/api/underwriting/plans?limit=1000')
      if (!res.ok) throw new Error('Failed to fetch plans')
      return res.json()
    },
    refetchOnMount: true,
    refetchOnWindowFocus: false,
    staleTime: 0
  })

  const plans = plansData?.plans || []

  const createMutation = useMutation({
    mutationFn: async () => {
      const premiumPaidValue = form.premiumPaid.trim()
        ? Number(form.premiumPaid)
        : null

      const payload = {
        ...form,
        state,
        lga,
        region: form.region,
        business_type: form.businessType,
        premiumPaid: Number.isFinite(premiumPaidValue) ? premiumPaidValue : null,
        uploadedFiles: form.uploadedFiles.map(file => ({
          name: file.name,
          size: file.size,
          type: file.type
        }))
      }
      
      
      // First upload files to Cloudinary if any
      let uploadedFileUrls: string[] = []
      if (form.uploadedFiles.length > 0) {
        try {
          const uploadFormData = new FormData()
          form.uploadedFiles.forEach(file => {
            uploadFormData.append('files', file)
          })
          uploadFormData.append('folder', 'organizations')
          
          const uploadRes = await fetch('/api/upload', {
            method: 'POST',
            body: uploadFormData
          })
          
          if (uploadRes.ok) {
            const uploadResult = await uploadRes.json()
            uploadedFileUrls = uploadResult.data.map((file: any) => file.secure_url)
          } else {
          }
        } catch (error) {
        }
      }
      
      // Add uploaded URLs to payload
      const finalPayload = {
        ...payload,
        uploadedFileUrls
      }
      
      const res = await fetch('/api/organizations', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(finalPayload)
      })
      
      if (!res.ok) {
        const err = await res.json().catch(() => ({}))
        throw new Error(err.error || `Failed to create organization (${res.status})`)
      }
      
      const result = await res.json()
      
      if (result.success === false) {
        throw new Error(result.error || result.message || 'Failed to create organization')
      }
      
      return result
    },
    onSuccess: (data) => {
      toast({ title: data.message || 'Organization created successfully' })
      onCreated?.()
      onClose()
    },
    onError: (e: Error) => {
      toast({ title: 'Error', description: e.message, variant: 'destructive' })
    }
  })

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    createMutation.mutate()
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
            <Label htmlFor="businessType">Business Type</Label>
            <Input
              id="businessType"
              value={form.businessType}
              onChange={(e) => setForm(prev => ({ ...prev, businessType: e.target.value }))}
              placeholder="Enter business type"
            />
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

        {/* Assigned Plans – full width with search */}
        <div>
          <Label htmlFor="planIds">Assigned Plans *</Label>
          <div className="relative mb-2 mt-1">
            <svg
              className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 w-4 h-4 pointer-events-none"
              fill="none" viewBox="0 0 24 24" stroke="currentColor"
            >
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-4.35-4.35M17 11A6 6 0 1 1 5 11a6 6 0 0 1 12 0z" />
            </svg>
            <Input
              id="planSearch"
              value={planSearch}
              onChange={(e) => setPlanSearch(e.target.value)}
              placeholder="Search plans..."
              className="pl-9"
            />
          </div>
          <div className="space-y-1 max-h-60 overflow-y-auto border rounded-md p-3">
            {plans.length === 0 ? (
              <p className="text-sm text-gray-500">Loading plans...</p>
            ) : (() => {
              const filtered = plans.filter((plan: any) =>
                `${plan.name} ${plan.plan_type}`.toLowerCase().includes(planSearch.toLowerCase())
              )
              return filtered.length === 0 ? (
                <p className="text-sm text-gray-400 py-2 text-center">No plans match your search</p>
              ) : filtered.map((plan: any) => (
                <div key={plan.id} className="flex items-center justify-between py-1.5 border-b last:border-b-0">
                  <button
                    type="button"
                    onClick={() => {
                      if (form.planIds.includes(plan.id)) {
                        setForm(prev => ({ ...prev, planIds: prev.planIds.filter(id => id !== plan.id) }))
                      } else {
                        setForm(prev => ({ ...prev, planIds: [...prev.planIds, plan.id] }))
                      }
                    }}
                    className={`flex items-center space-x-2 flex-1 text-left hover:bg-gray-50 px-2 py-1 rounded transition-colors ${
                      form.planIds.includes(plan.id) ? 'bg-blue-50' : ''
                    }`}
                  >
                    <div className={`w-4 h-4 shrink-0 rounded border-2 flex items-center justify-center ${
                      form.planIds.includes(plan.id)
                        ? 'bg-[#BE1522] border-blue-600'
                        : 'border-gray-300'
                    }`}>
                      {form.planIds.includes(plan.id) && (
                        <svg className="w-3 h-3 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M5 13l4 4L19 7" />
                        </svg>
                      )}
                    </div>
                    <span className="text-sm font-medium">
                      {plan.name} — <span className="text-gray-500">{plan.plan_type}</span>
                    </span>
                  </button>
                  <span className="ml-2 shrink-0 text-xs font-semibold uppercase tracking-wide text-gray-500 border border-gray-300 rounded px-1.5 py-0.5">
                    {plan.status || "Active"}
                  </span>
                </div>
              ))
            })()}
          </div>
          {form.planIds.length > 0 && (
            <p className="text-xs text-blue-600 mt-1">{form.planIds.length} plan{form.planIds.length > 1 ? 's' : ''} selected</p>
          )}
          {form.planIds.length === 0 && (
            <p className="text-sm text-red-600 mt-1">Please select at least one plan</p>
          )}
        </div>

        <div>
          <Label htmlFor="headOfficeAddress">Head Office Address</Label>
          <Input
            id="headOfficeAddress"
            value={form.headOfficeAddress}
            onChange={(e) => setForm(prev => ({ ...prev, headOfficeAddress: e.target.value }))}
            placeholder="Enter head office address"
          />
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
          required={false}
        />
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div>
            <Label htmlFor="region">Region</Label>
            <Input
              id="region"
              value={form.region}
              onChange={(e) => setForm(prev => ({ ...prev, region: e.target.value }))}
              placeholder="Enter region"
            />
          </div>
        </div>
      </div>

      {/* Contract Information */}
      <div className="space-y-4">
        <h3 className="text-lg font-medium">Contract Information</h3>
        
        <div className="grid grid-cols-2 gap-4">
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
        </div>

        <div className="flex items-center space-x-2">
          <Checkbox
            id="autoRenewal"
            checked={form.autoRenewal}
            onCheckedChange={(checked) => setForm(prev => ({ ...prev, autoRenewal: checked as boolean }))}
          />
          <Label htmlFor="autoRenewal">Auto Renewal</Label>
        </div>
      </div>

      {/* File Upload */}
      <div className="space-y-4">
        <h3 className="text-lg font-medium">Organization Documents</h3>
        
        <FileUpload
          onUpload={(files) => setForm(prev => ({ ...prev, uploadedFiles: files }))}
          onRemove={(file) => {
            setForm(prev => ({
              ...prev,
              uploadedFiles: prev.uploadedFiles.filter(f => f !== file)
            }))
          }}
          acceptedTypes={['image/*', 'application/pdf']}
          maxFiles={5}
          maxSize={10 * 1024 * 1024} // 10MB
          folder="organizations"
          resourceType="auto"
        />
      </div>

      {/* Form Actions */}
      <div className="flex justify-end gap-4 pt-4">
        <Button type="button" variant="outline" onClick={onClose}>
          Cancel
        </Button>
        <Button 
          type="submit" 
          disabled={createMutation.isPending || form.planIds.length === 0}
          className="bg-[#BE1522] hover:bg-[#9B1219] text-white"
        >
          {createMutation.isPending ? "Creating..." : "Create Organization"}
        </Button>
      </div>
    </form>
  )
}
