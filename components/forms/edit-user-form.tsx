"use client"

import { useState, useEffect } from "react"
import { useMutation, useQuery } from "@tanstack/react-query"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { useToast } from "@/hooks/use-toast"
import { Search, X } from "lucide-react"

interface EditUserFormProps {
  user: any
  onClose: () => void
  onUpdated?: () => void
}

export function EditUserForm({ user, onClose, onUpdated }: EditUserFormProps) {
  const { toast } = useToast()
  const [form, setForm] = useState({
    firstName: user.first_name || "",
    lastName: user.last_name || "",
    email: user.email || "",
    phoneNumber: user.phone_number || "",
    title: user.title || "",
    dateOfBirth: user.date_of_birth ? new Date(user.date_of_birth).toISOString().split('T')[0] : "",
    gender: user.gender || "",
    contactAddress: user.contact_address || "",
    role: user.role || "HR_OFFICER",
    departmentId: user.department_id || "",
    providerId: user.provider_id || "",
    status: user.status || "ACTIVE",
  })

  // Provider search functionality
  const [providerSearchTerm, setProviderSearchTerm] = useState("")
  const [debouncedProviderSearch, setDebouncedProviderSearch] = useState("")
  const [selectedProvider, setSelectedProvider] = useState<any>(null)
  const [showProviderResults, setShowProviderResults] = useState(false)

  // Debounce provider search
  useEffect(() => {
    const timer = setTimeout(() => {
      setDebouncedProviderSearch(providerSearchTerm)
    }, 300)
    return () => clearTimeout(timer)
  }, [providerSearchTerm])

  // Update form when user prop changes
  useEffect(() => {
    setForm({
      firstName: user.first_name || "",
      lastName: user.last_name || "",
      email: user.email || "",
      phoneNumber: user.phone_number || "",
      title: user.title || "",
      dateOfBirth: user.date_of_birth ? new Date(user.date_of_birth).toISOString().split('T')[0] : "",
      gender: user.gender || "",
      contactAddress: user.contact_address || "",
      role: user.role || "HR_OFFICER",
      departmentId: user.department_id || "",
      providerId: user.provider_id || "",
      status: user.status || "ACTIVE",
    })

    // Set provider search term if user has a provider
    if (user.provider_id) {
      // If provider is an object with facility_name
      if (user.provider && typeof user.provider === 'object' && user.provider.facility_name) {
        setSelectedProvider(user.provider)
        setProviderSearchTerm(user.provider.facility_name)
      } 
      // If provider is a string (from users list API)
      else if (user.provider && typeof user.provider === 'string' && user.provider !== 'N/A') {
        setProviderSearchTerm(user.provider)
        // Create a minimal provider object for selectedProvider
        setSelectedProvider({ id: user.provider_id, facility_name: user.provider })
      }
      // If we only have provider_id, leave empty and let user search
      else {
        setProviderSearchTerm("")
        setSelectedProvider({ id: user.provider_id, facility_name: "" })
      }
    } else {
      setSelectedProvider(null)
      setProviderSearchTerm("")
    }
  }, [user])

  // Fetch departments
  const { data: departments = [] } = useQuery({
    queryKey: ["departments"],
    queryFn: async () => {
      const res = await fetch("/api/departments")
      if (!res.ok) throw new Error("Failed to fetch departments")
      return res.json()
    }
  })

  // Fetch providers with search
  const { data: providersData } = useQuery({
    queryKey: ["providers", debouncedProviderSearch, form.role],
    queryFn: async () => {
      const params = new URLSearchParams()
      if (debouncedProviderSearch) {
        params.append("search", debouncedProviderSearch)
      }
      params.append("status", "ACTIVE")
      params.append("limit", "50")
      const res = await fetch(`/api/providers?${params}`)
      if (!res.ok) throw new Error("Failed to fetch providers")
      return res.json()
    },
    enabled: form.role === "PROVIDER"
  })

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
    setShowProviderResults(true)
  }

  const handleSelectProvider = (provider: any) => {
    setSelectedProvider(provider)
    setForm(prev => ({ ...prev, providerId: provider.id }))
    setProviderSearchTerm(provider.facility_name)
    setShowProviderResults(false)
  }

  const handleClearProvider = () => {
    setSelectedProvider(null)
    setForm(prev => ({ ...prev, providerId: "" }))
    setProviderSearchTerm("")
    setShowProviderResults(false)
  }

  // Fetch roles
  const { data: rolesData } = useQuery({
    queryKey: ["roles"],
    queryFn: async () => {
      const res = await fetch("/api/users/roles")
      if (!res.ok) throw new Error("Failed to fetch roles")
      return res.json()
    }
  })

  const updateMutation = useMutation({
    mutationFn: async () => {
      const res = await fetch(`/api/users/${user.id}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(form)
      })
      if (!res.ok) {
        const err = await res.json().catch(() => ({}))
        throw new Error(err.error || `Failed to update user (${res.status})`)
      }
      return res.json()
    },
    onSuccess: () => {
      toast({ title: "User updated successfully" })
      onUpdated?.()
      onClose()
    },
    onError: (e: Error) => {
      toast({ title: "Error", description: e.message, variant: "destructive" })
    }
  })

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    updateMutation.mutate()
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      {/* Personal Information */}
      <div className="space-y-4">
        <h3 className="text-lg font-medium">Personal Information</h3>
        
        <div className="grid grid-cols-2 gap-4">
          <div>
            <Label htmlFor="firstName">First Name *</Label>
            <Input
              id="firstName"
              value={form.firstName}
              onChange={(e) => setForm(prev => ({ ...prev, firstName: e.target.value }))}
              required
            />
          </div>
          <div>
            <Label htmlFor="lastName">Last Name *</Label>
            <Input
              id="lastName"
              value={form.lastName}
              onChange={(e) => setForm(prev => ({ ...prev, lastName: e.target.value }))}
              required
            />
          </div>
        </div>

        <div className="grid grid-cols-2 gap-4">
          <div>
            <Label htmlFor="email">Email *</Label>
            <Input
              id="email"
              type="email"
              value={form.email}
              onChange={(e) => setForm(prev => ({ ...prev, email: e.target.value }))}
              required
            />
          </div>
          <div>
            <Label htmlFor="phoneNumber">Phone Number</Label>
            <Input
              id="phoneNumber"
              value={form.phoneNumber}
              onChange={(e) => setForm(prev => ({ ...prev, phoneNumber: e.target.value }))}
            />
          </div>
        </div>

        <div className="grid grid-cols-3 gap-4">
          <div>
            <Label htmlFor="title">Title</Label>
            <Select value={form.title} onValueChange={(value) => setForm(prev => ({ ...prev, title: value }))}>
              <SelectTrigger>
                <SelectValue placeholder="Select title" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="Mr">Mr</SelectItem>
                <SelectItem value="Mrs">Mrs</SelectItem>
                <SelectItem value="Miss">Miss</SelectItem>
                <SelectItem value="Dr">Dr</SelectItem>
                <SelectItem value="Prof">Prof</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div>
            <Label htmlFor="gender">Gender</Label>
            <Select value={form.gender} onValueChange={(value) => setForm(prev => ({ ...prev, gender: value }))}>
              <SelectTrigger>
                <SelectValue placeholder="Select gender" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="Male">Male</SelectItem>
                <SelectItem value="Female">Female</SelectItem>
                <SelectItem value="Other">Other</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div>
            <Label htmlFor="dateOfBirth">Date of Birth</Label>
            <Input
              id="dateOfBirth"
              type="date"
              value={form.dateOfBirth}
              onChange={(e) => setForm(prev => ({ ...prev, dateOfBirth: e.target.value }))}
            />
          </div>
        </div>

        <div>
          <Label htmlFor="contactAddress">Contact Address</Label>
          <Input
            id="contactAddress"
            value={form.contactAddress}
            onChange={(e) => setForm(prev => ({ ...prev, contactAddress: e.target.value }))}
          />
        </div>
      </div>

      {/* Work Information */}
      <div className="space-y-4">
        <h3 className="text-lg font-medium">Work Information</h3>
        
        <div className="grid grid-cols-2 gap-4">
          <div>
            <Label htmlFor="role">Role *</Label>
            <Select 
              value={form.role} 
              onValueChange={(value) => {
                setForm(prev => ({ 
                  ...prev, 
                  role: value, 
                  providerId: value === "PROVIDER" ? prev.providerId : "" 
                }))
                if (value !== "PROVIDER") {
                  handleClearProvider()
                }
              }}
            >
              <SelectTrigger>
                <SelectValue placeholder="Select role" />
              </SelectTrigger>
              <SelectContent>
                {rolesData?.roles?.map((role: any) => (
                  <SelectItem key={role.name} value={role.name}>
                    {role.name.replace(/_/g, ' ').replace(/\b\w/g, (l: string) => l.toUpperCase())}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div>
            <Label htmlFor="department">Department</Label>
            <Select 
              value={form.departmentId} 
              onValueChange={(value) => setForm(prev => ({ ...prev, departmentId: value }))}
              disabled={form.role === "PROVIDER"}
            >
              <SelectTrigger>
                <SelectValue placeholder="Select department" />
              </SelectTrigger>
              <SelectContent>
                {departments.map((dept: any) => (
                  <SelectItem key={dept.id} value={dept.id}>
                    {dept.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </div>

        {/* Provider selection for PROVIDER role */}
        {form.role === "PROVIDER" && (
          <div className="provider-search-container">
            <Label htmlFor="provider">Provider/Hospital *</Label>
            <div className="relative">
              <Input
                id="provider"
                placeholder="Search for provider/hospital..."
                value={providerSearchTerm}
                onChange={(e) => handleProviderSearch(e.target.value)}
                onFocus={() => {
                  setShowProviderResults(true)
                }}
                className="pr-10"
                required={form.role === "PROVIDER"}
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
            {showProviderResults && providersData?.providers && providersData.providers.length > 0 && (
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
                    {provider.facility_type && (
                      <div className="text-gray-500 text-xs">
                        {typeof provider.facility_type === 'object' 
                          ? Object.values(provider.facility_type).join(', ')
                          : provider.facility_type}
                      </div>
                    )}
                  </div>
                ))}
              </div>
            )}
            {showProviderResults && providersData?.providers && providersData.providers.length === 0 && (
              <div className="mt-2 max-h-48 overflow-y-auto border rounded-md bg-white shadow-lg z-10">
                <div className="px-3 py-2 text-gray-500 text-sm">
                  No providers found
                </div>
              </div>
            )}
          </div>
        )}

        <div>
          <Label htmlFor="status">Status</Label>
          <Select value={form.status} onValueChange={(value) => setForm(prev => ({ ...prev, status: value }))}>
            <SelectTrigger>
              <SelectValue placeholder="Select status" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="ACTIVE">Active</SelectItem>
              <SelectItem value="INACTIVE">Inactive</SelectItem>
              <SelectItem value="SUSPENDED">Suspended</SelectItem>
            </SelectContent>
          </Select>
        </div>
      </div>

      {/* Form Actions */}
      <div className="flex justify-end gap-4 pt-4">
        <Button type="button" variant="outline" onClick={onClose}>
          Cancel
        </Button>
        <Button 
          type="submit" 
          disabled={updateMutation.isPending}
          className="bg-green-600 hover:bg-green-700 text-white"
        >
          {updateMutation.isPending ? "Updating..." : "Update User"}
        </Button>
      </div>
    </form>
  )
}
