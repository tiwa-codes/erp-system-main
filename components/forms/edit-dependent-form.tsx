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

interface EditDependentFormProps {
  dependent: any
  onSuccess: () => void
  onCancel: () => void
}

export function EditDependentForm({ dependent, onSuccess, onCancel }: EditDependentFormProps) {
  const { toast } = useToast()
  
  // Search functionality for providers
  const [providerSearchTerm, setProviderSearchTerm] = useState("")
  const [debouncedProviderSearch, setDebouncedProviderSearch] = useState("")
  const [selectedProvider, setSelectedProvider] = useState<any>(null)
  const [showProviderResults, setShowProviderResults] = useState(false)

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
    preferred_provider_id: "",
    uploadedFiles: [] as File[],
    status: "",
  })

  // Debounce provider search
  useEffect(() => {
    const timer = setTimeout(() => {
      setDebouncedProviderSearch(providerSearchTerm)
    }, 300)
    return () => clearTimeout(timer)
  }, [providerSearchTerm])

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

  useEffect(() => {
    if (dependent) {
      // Helper function to format date for input field
      const formatDateForInput = (date: any): string => {
        if (!date) return ""
        // If it's already a string in YYYY-MM-DD format, return it
        if (typeof date === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(date)) {
          return date
        }
        // If it's a Date object or ISO string, convert it
        try {
          const dateObj = date instanceof Date ? date : new Date(date)
          if (!isNaN(dateObj.getTime())) {
            return dateObj.toISOString().split('T')[0]
          }
        } catch (e) {
          console.error('Error formatting date:', e)
        }
        return ""
      }

        setFormData({
        first_name: dependent.first_name || "",
        last_name: dependent.last_name || "",
        middle_name: dependent.middle_name || "",
        date_of_birth: formatDateForInput(dependent.date_of_birth),
        relationship: dependent.relationship || "",
        gender: dependent.gender || "",
        phone_number: dependent.phone_number || "",
        email: dependent.email || "",
        residential_address: dependent.residential_address || "",
        state: dependent.state || "",
        lga: dependent.lga || "",
          region: dependent.region || "",
        preferred_provider_id: dependent.preferred_provider_id || "",
        uploadedFiles: [] as File[],
        status: dependent.status || "",
      })

      // Set provider search term if preferred provider exists
      if (dependent.preferred_provider) {
        setSelectedProvider(dependent.preferred_provider)
        setProviderSearchTerm(dependent.preferred_provider.facility_name || "")
      }
    }
  }, [dependent])

  // Click outside handler to close provider search results
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      const target = event.target as HTMLElement
      if (!target.closest('.provider-search-container')) {
        setShowProviderResults(false)
      }
    }

    document.addEventListener('mousedown', handleClickOutside)
    return () => document.removeEventListener('mousedown', handleClickOutside)
  }, [])

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

  const updateMutation = useMutation({
    mutationFn: async () => {
      // First upload files to Cloudinary if any
      let profilePictureUrl = dependent.profile_picture || "" // Keep existing if no new file
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
          }
        } catch (error) {
          console.error('Error uploading files:', error)
          throw new Error('Failed to upload profile picture')
        }
      }

      const payload = {
        ...formData,
        profile_picture: profilePictureUrl,
        uploadedFiles: undefined // Remove from payload
      }

      const res = await fetch(`/api/underwriting/dependents/${dependent.id}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload)
      })
      
      if (!res.ok) {
        const error = await res.json()
        throw new Error(error.error || "Failed to update dependent")
      }
      
      return res.json()
    },
    onSuccess: () => {
      toast({
        title: "Dependent updated successfully",
        description: "The dependent information has been updated."
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
    updateMutation.mutate()
  }

  const handleInputChange = (field: string, value: string) => {
    setFormData(prev => ({ ...prev, [field]: value }))
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-6">
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

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
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
        </div>

        <div className="space-y-2">
          <Label htmlFor="status">Status</Label>
          <Select
            value={formData.status}
            onValueChange={(value) => handleInputChange("status", value)}
          >
            <SelectTrigger>
              <SelectValue placeholder="Select Status" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="ACTIVE">Active</SelectItem>
              <SelectItem value="INACTIVE">Inactive</SelectItem>
              <SelectItem value="SUSPENDED">Suspended</SelectItem>
            </SelectContent>
          </Select>
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
      </div>

      {/* Address Details */}
      <div className="space-y-4">
        <h3 className="text-lg text-blue-600">Address Details</h3>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
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
        </div>
        <div className="space-y-2">
          <Label htmlFor="region">Region</Label>
          <Input
            id="region"
            value={formData.region}
            onChange={(e) => handleInputChange("region", e.target.value)}
            placeholder="Enter region"
          />
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
          {dependent.profile_picture && (
            <div className="mt-2">
              <p className="text-sm text-muted-foreground mb-2">Current profile picture:</p>
              <img
                src={dependent.profile_picture}
                alt="Current profile"
                className="w-20 h-20 object-cover rounded-lg"
              />
            </div>
          )}
          {formData.uploadedFiles.length > 0 && (
            <div className="mt-2">
              <p className="text-sm text-muted-foreground">
                {formData.uploadedFiles.length} new file(s) selected
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
        <Button type="submit" disabled={updateMutation.isPending}>
          {updateMutation.isPending && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
          Update
        </Button>
      </div>
    </form>
  )
}
