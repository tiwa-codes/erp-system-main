"use client"

import { useState, useEffect } from "react"
import { useMutation, useQuery } from "@tanstack/react-query"
import { useToast } from "@/hooks/use-toast"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Textarea } from "@/components/ui/textarea"
import { StateSelect, LGASelect } from "@/components/ui/state-lga-select"
import { CompactFileUpload } from "@/components/ui/compact-file-upload"
import { Loader2, Search, X } from "lucide-react"

interface AddDependentFormProps {
  onSuccess: () => void
  onCancel: () => void
}

export function AddDependentForm({ onSuccess, onCancel }: AddDependentFormProps) {
  const { toast } = useToast()
  const [formData, setFormData] = useState({
    first_name: "",
    last_name: "",
    middle_name: "",
    date_of_birth: "",
    relationship: "",
    gender: "",
    phone_number: "",
    email: "",
    residential_address: "",
    state: "",
    lga: "",
    region: "",
    preferred_provider_id: "",
    uploadedFiles: [] as File[],
    principal_id: "",
  })

  // Search functionality for principals
  const [principalSearchTerm, setPrincipalSearchTerm] = useState("")
  const [debouncedPrincipalSearch, setDebouncedPrincipalSearch] = useState("")
  const [selectedPrincipal, setSelectedPrincipal] = useState<any>(null)
  const [showPrincipalResults, setShowPrincipalResults] = useState(false)

  // Search functionality for providers
  const [providerSearchTerm, setProviderSearchTerm] = useState("")
  const [debouncedProviderSearch, setDebouncedProviderSearch] = useState("")
  const [selectedProvider, setSelectedProvider] = useState<any>(null)
  const [showProviderResults, setShowProviderResults] = useState(false)

  // Debounce principal search
  useEffect(() => {
    const timer = setTimeout(() => {
      setDebouncedPrincipalSearch(principalSearchTerm)
    }, 300)
    return () => clearTimeout(timer)
  }, [principalSearchTerm])

  // Debounce provider search
  useEffect(() => {
    const timer = setTimeout(() => {
      setDebouncedProviderSearch(providerSearchTerm)
    }, 300)
    return () => clearTimeout(timer)
  }, [providerSearchTerm])

  // Fetch principal accounts for selection
  const { data: principalsData } = useQuery({
    queryKey: ["principal-accounts", debouncedPrincipalSearch],
    queryFn: async () => {
      const params = new URLSearchParams()
      if (debouncedPrincipalSearch) {
        params.append("search", debouncedPrincipalSearch)
      }
      const res = await fetch(`/api/underwriting/principals?${params}`)
      if (!res.ok) throw new Error("Failed to fetch principal accounts")
      return res.json()
    }
  })

  // Fetch providers for selection
  const { data: providersData } = useQuery({
    queryKey: ["providers", debouncedProviderSearch],
    queryFn: async () => {
      const params = new URLSearchParams()
      if (debouncedProviderSearch) {
        params.append("search", debouncedProviderSearch)
      }
      params.append("status", "ACTIVE")
      const res = await fetch(`/api/providers?${params}`)
      if (!res.ok) throw new Error("Failed to fetch providers")
      return res.json()
    },
    enabled: debouncedProviderSearch.length > 0
  })

  const createMutation = useMutation({
    mutationFn: async () => {
      // First upload files to Cloudinary if any
      let profilePictureUrl = ""
      if (formData.uploadedFiles.length > 0) {
        try {
          const uploadFormData = new FormData()
          formData.uploadedFiles.forEach(file => {
            uploadFormData.append('files', file)
          })
          uploadFormData.append('folder', 'dependents')
          
          const uploadRes = await fetch('/api/upload', {
            method: 'POST',
            body: uploadFormData
          })
          
          
          if (uploadRes.ok) {
            const uploadResult = await uploadRes.json()
            profilePictureUrl = uploadResult.data[0].secure_url // Take the first uploaded file URL
          } else {
            const errorText = await uploadRes.text()
            throw new Error(`Upload failed with status ${uploadRes.status}`)
          }
        } catch (error) {
          throw new Error(`Failed to upload profile picture: ${error instanceof Error ? error.message : 'Unknown error'}`)
        }
      }

      const payload = {
        ...formData,
        profile_picture: profilePictureUrl,
        uploadedFiles: undefined // Remove from payload
      }


      const res = await fetch("/api/underwriting/dependents", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload)
      })
      
      
      if (!res.ok) {
        const error = await res.json()
        throw new Error(error.error || "Failed to create dependent")
      }
      
      const result = await res.json()
      return result
    },
    onSuccess: () => {
      toast({
        title: "Dependent created successfully",
        description: "The dependent has been added to the system."
      })
      onSuccess()
    },
    onError: (error: Error) => {
      toast({
        title: "Error",
        description: error.message,
        variant: "destructive"
      })
    }
  })

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    
    createMutation.mutate()
  }

  const handleInputChange = (field: string, value: string) => {
    setFormData(prev => ({ ...prev, [field]: value }))
  }

  const handlePrincipalSearch = (value: string) => {
    setPrincipalSearchTerm(value)
    setShowPrincipalResults(value.length > 0)
  }

  const handleSelectPrincipal = (principal: any) => {
    setSelectedPrincipal(principal)
    setFormData(prev => ({ ...prev, principal_id: principal.id }))
    setPrincipalSearchTerm(`${principal.first_name} ${principal.last_name} (${principal.enrollee_id})`)
    setShowPrincipalResults(false)
  }

  const handleClearPrincipal = () => {
    setSelectedPrincipal(null)
    setFormData(prev => ({ ...prev, principal_id: "" }))
    setPrincipalSearchTerm("")
    setShowPrincipalResults(false)
  }

  const handleProviderSearch = (value: string) => {
    setProviderSearchTerm(value)
    setShowProviderResults(value.length > 0)
  }

  const handleSelectProvider = (provider: any) => {
    setSelectedProvider(provider)
    setFormData(prev => ({ ...prev, preferred_provider_id: provider.id }))
    setProviderSearchTerm(provider.facility_name)
    setShowProviderResults(false)
  }

  const handleClearProvider = () => {
    setSelectedProvider(null)
    setFormData(prev => ({ ...prev, preferred_provider_id: "" }))
    setProviderSearchTerm("")
    setShowProviderResults(false)
  }

  // Click outside handler to close search results
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      const target = event.target as HTMLElement
      if (!target.closest('.principal-search-container')) {
        setShowPrincipalResults(false)
      }
      if (!target.closest('.provider-search-container')) {
        setShowProviderResults(false)
      }
    }

    document.addEventListener('mousedown', handleClickOutside)
    return () => document.removeEventListener('mousedown', handleClickOutside)
  }, [])

  return (
    <form onSubmit={handleSubmit} className="space-y-6">
      {/* Principal and Organization Selection */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <div className="space-y-2 principal-search-container">
          <Label htmlFor="principal_search">Search Principal *</Label>
          <div className="relative">
            <Input
              id="principal_search"
              placeholder="Search by Enrollee ID or name..."
              value={principalSearchTerm}
              onChange={(e) => handlePrincipalSearch(e.target.value)}
              className="pr-10"
              required
            />
            <Search className="absolute right-3 top-1/2 transform -translate-y-1/2 text-gray-400 h-4 w-4" />
            {selectedPrincipal && (
              <button
                type="button"
                onClick={handleClearPrincipal}
                className="absolute right-8 top-1/2 transform -translate-y-1/2 text-gray-400 hover:text-gray-600"
              >
                <X className="h-4 w-4" />
              </button>
            )}
          </div>
          {/* Principal suggestions dropdown */}
          {showPrincipalResults && principalsData?.principals && (
            <div className="mt-2 max-h-48 overflow-y-auto border rounded-md bg-white shadow-lg z-10">
              {principalsData.principals.slice(0, 10).map((principal: any) => (
                <div
                  key={principal.id}
                  className="px-3 py-2 hover:bg-gray-100 cursor-pointer text-sm"
                  onClick={() => handleSelectPrincipal(principal)}
                >
                  <div className="font-medium">
                    {principal.first_name} {principal.last_name}
                  </div>
                  <div className="text-gray-500 text-xs">
                    ID: {principal.enrollee_id} | Org: {principal.organization?.name}
                  </div>
                </div>
              ))}
              {principalsData.principals.length === 0 && (
                <div className="px-3 py-2 text-gray-500 text-sm">
                  No principals found
                </div>
              )}
            </div>
          )}
        </div>

        <div className="space-y-2">
          <Label htmlFor="relationship">Relationship *</Label>
          <Select
            value={formData.relationship}
            onValueChange={(value) => handleInputChange("relationship", value)}
            required
          >
            <SelectTrigger>
              <SelectValue placeholder="Select Relationship" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="SPOUSE">Spouse</SelectItem>
              <SelectItem value="SON">Son</SelectItem>
              <SelectItem value="DAUGHTER">Daughter</SelectItem>
              <SelectItem value="PARENT">Parent</SelectItem>
              <SelectItem value="SIBLING">Sibling</SelectItem>
              <SelectItem value="OTHER">Other</SelectItem>
              <SelectItem value="EXTRA_DEPENDENT">Extra Dependent</SelectItem>
            </SelectContent>
          </Select>
        </div>

        <div className="space-y-2">
          <Label htmlFor="dependent_id">Dependent ID</Label>
          <Input
            id="dependent_id"
            value={formData.dependent_id}
            onChange={(e) => handleInputChange("dependent_id", e.target.value)}
            placeholder="Auto-generated if empty"
          />
        </div>
      </div>

      {/* Preferred Provider/Hospital */}
      <div className="space-y-2 provider-search-container">
        <Label htmlFor="preferred_provider">Preferred Provider/Hospital</Label>
        <div className="relative">
          <Input
            id="preferred_provider"
            placeholder="Search for provider/hospital..."
            value={providerSearchTerm}
            onChange={(e) => handleProviderSearch(e.target.value)}
            className="pr-10"
          />
          <Search className="absolute right-3 top-1/2 transform -translate-y-1/2 text-gray-400 h-4 w-4" />
          {selectedProvider && (
            <button
              type="button"
              onClick={handleClearProvider}
              className="absolute right-8 top-1/2 transform -translate-y-1/2 text-gray-400 hover:text-gray-600"
            >
              <X className="h-4 w-4" />
            </button>
          )}
        </div>
        {/* Provider suggestions dropdown */}
        {showProviderResults && providersData?.providers && (
          <div className="mt-2 max-h-48 overflow-y-auto border rounded-md bg-white shadow-lg z-10">
            {providersData.providers.slice(0, 10).map((provider: any) => (
              <div
                key={provider.id}
                className="px-3 py-2 hover:bg-gray-100 cursor-pointer text-sm"
                onClick={() => handleSelectProvider(provider)}
              >
                <div className="font-medium">
                  {provider.facility_name}
                </div>
                <div className="text-gray-500 text-xs">
                  {provider.facility_type && typeof provider.facility_type === 'object' 
                    ? Object.values(provider.facility_type).join(', ')
                    : provider.facility_type || 'N/A'}
                </div>
              </div>
            ))}
            {providersData.providers.length === 0 && (
              <div className="px-3 py-2 text-gray-500 text-sm">
                No providers found
              </div>
            )}
          </div>
        )}
      </div>

      {/* Personal Details */}
      <div className="space-y-4">
        <h3 className="text-lg text-blue-600">Personal Details</h3>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <div className="space-y-2">
            <Label htmlFor="first_name">First Name *</Label>
            <Input
              id="first_name"
              value={formData.first_name}
              onChange={(e) => handleInputChange("first_name", e.target.value)}
              required
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="last_name">Last Name *</Label>
            <Input
              id="last_name"
              value={formData.last_name}
              onChange={(e) => handleInputChange("last_name", e.target.value)}
              required
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="middle_name">Middle Name</Label>
            <Input
              id="middle_name"
              value={formData.middle_name}
              onChange={(e) => handleInputChange("middle_name", e.target.value)}
            />
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <div className="space-y-2">
            <Label htmlFor="date_of_birth">Date of Birth *</Label>
            <Input
              id="date_of_birth"
              type="date"
              value={formData.date_of_birth}
              onChange={(e) => handleInputChange("date_of_birth", e.target.value)}
              required
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="phone_number">Phone Number</Label>
            <Input
              id="phone_number"
              value={formData.phone_number}
              onChange={(e) => handleInputChange("phone_number", e.target.value)}
              placeholder="+234..."
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="gender">Gender</Label>
            <Select
              value={formData.gender}
              onValueChange={(value) => handleInputChange("gender", value)}
            >
              <SelectTrigger>
                <SelectValue placeholder="Select Gender" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="MALE">Male</SelectItem>
                <SelectItem value="FEMALE">Female</SelectItem>
                <SelectItem value="OTHER">Other</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </div>

        <div className="space-y-2">
          <Label htmlFor="email">Email Address</Label>
          <Input
            id="email"
            type="email"
            value={formData.email}
            onChange={(e) => handleInputChange("email", e.target.value)}
            placeholder="email@example.com"
          />
        </div>
      </div>

      {/* Address Details */}
      <div className="space-y-4">
        <h3 className="text-lg text-blue-600">Address Details</h3>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <StateSelect
            value={formData.state}
            onValueChange={(value) => handleInputChange("state", value)}
            placeholder="Select State"
            label="State"
          />
          <LGASelect
            state={formData.state}
            value={formData.lga}
            onValueChange={(value) => handleInputChange("lga", value)}
            placeholder="Select LGA"
            label="LGA"
          />
          <div className="space-y-2">
            <Label htmlFor="region">Region</Label>
            <Input
              id="region"
              value={formData.region}
              onChange={(e) => handleInputChange("region", e.target.value)}
              placeholder="Enter region"
            />
          </div>
        </div>
        <div className="space-y-2">
          <Label htmlFor="residential_address">Address</Label>
          <Textarea
            id="residential_address"
            value={formData.residential_address}
            onChange={(e) => handleInputChange("residential_address", e.target.value)}
            placeholder="Enter residential address"
            rows={3}
          />
        </div>
      </div>

      {/* Dependent Picture */}
      <div className="space-y-4">
        <h3 className="text-lg text-blue-600">Dependent Picture</h3>
        <div className="space-y-2">
          <CompactFileUpload
            onUpload={(files) => setFormData(prev => ({ ...prev, uploadedFiles: files }))}
            onRemove={(file) => {
              setFormData(prev => ({
                ...prev,
                uploadedFiles: prev.uploadedFiles.filter(f => f !== file)
              }))
            }}
            acceptedTypes={['image/*']}
            maxFiles={1}
            maxSize={5 * 1024 * 1024} // 5MB
            folder="dependents"
            resourceType="image"
            label="Profile Picture"
          />
          {formData.uploadedFiles.length > 0 && (
            <div className="mt-2">
              <p className="text-sm text-muted-foreground">
                {formData.uploadedFiles.length} file(s) selected
              </p>
            </div>
          )}
        </div>
      </div>

      {/* Form Actions */}
      <div className="flex justify-end gap-4 pt-6">
        <Button type="button" variant="outline" onClick={onCancel}>
          Cancel
        </Button>
        <Button type="submit" disabled={createMutation.isPending}>
          {createMutation.isPending && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
          Save
        </Button>
      </div>
    </form>
  )
}
