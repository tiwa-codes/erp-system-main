"use client"

import { useState } from "react"
import { useRouter } from "next/navigation"
import { useMutation, useQueryClient } from "@tanstack/react-query"
import { useToast } from "@/hooks/use-toast"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { ArrowLeft, Shield, Loader2 } from "lucide-react"
import { PermissionGate } from "@/components/ui/permission-gate"

const AVAILABLE_ROLES = [
  'SUPER_ADMIN',
  'ADMIN', 
  'HR_MANAGER',
  'HR_OFFICER',
  'CLAIMS_PROCESSOR',
  'CLAIMS_MANAGER',
  'FINANCE_OFFICER',
  'PROVIDER_MANAGER',
  'PROVIDER',
  'UNDERWRITER'
]

export default function AddRolePage() {
  const router = useRouter()
  const { toast } = useToast()
  const queryClient = useQueryClient()
  
  const [formData, setFormData] = useState({
    name: "",
    description: ""
  })

  const createRoleMutation = useMutation({
    mutationFn: async (data: any) => {
      const response = await fetch('/api/users/roles', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(data),
      })
      
      if (!response.ok) {
        const error = await response.json()
        throw new Error(error.error || 'Failed to create role')
      }
      
      return response.json()
    },
    onSuccess: () => {
      toast({
        title: "Success",
        description: "Role created successfully",
      })
      // Invalidate roles query to refresh the data
      queryClient.invalidateQueries({ queryKey: ['roles'] })
      router.push('/users/permissions')
    },
    onError: (error: any) => {
      toast({
        title: "Error",
        description: error.message || "Failed to create role",
        variant: "destructive",
      })
    }
  })

  const handleInputChange = (field: string, value: string) => {
    setFormData(prev => ({ ...prev, [field]: value }))
  }

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    
    if (!formData.name.trim()) {
      toast({
        title: "Error",
        description: "Role name is required",
        variant: "destructive",
      })
      return
    }

    const payload = {
      name: formData.name.trim(),
      description: formData.description.trim() || null
    }

    createRoleMutation.mutate(payload)
  }


  return (
    <PermissionGate module="users" action="manage_permissions">
      <div className="space-y-6 p-6 bg-gray-50 min-h-screen">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-4">
            <Button
              variant="outline"
              size="sm"
              onClick={() => router.back()}
              className="flex items-center gap-2"
            >
              <ArrowLeft className="h-4 w-4" />
              Back
            </Button>
            <div>
              <h1 className="text-3xl font-bold text-gray-900">Add New Role</h1>
              <p className="text-gray-600">Create a new role with specific permissions</p>
            </div>
          </div>
        </div>

        <Card className="bg-white">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Shield className="h-5 w-5" />
              Role Information
            </CardTitle>
            <CardDescription>
              Define the role name and description. Permissions will be managed in the permission matrix.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <form onSubmit={handleSubmit} className="space-y-6">
              {/* Basic Information */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div className="space-y-2">
                  <Label htmlFor="name">Role Name *</Label>
                  <Input
                    id="name"
                    value={formData.name}
                    onChange={(e) => handleInputChange('name', e.target.value)}
                    placeholder="e.g., HR_MANAGER"
                    required
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="description">Description (Optional)</Label>
                  <Textarea
                    id="description"
                    value={formData.description}
                    onChange={(e) => handleInputChange('description', e.target.value)}
                    placeholder="Brief description of the role"
                    rows={3}
                  />
                </div>
              </div>


              {/* Submit Button */}
              <div className="flex justify-end gap-4">
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => router.back()}
                >
                  Cancel
                </Button>
                <Button
                  type="submit"
                  disabled={createRoleMutation.isPending}
                  className="bg-[#BE1522] hover:bg-[#9B1219]"
                >
                  {createRoleMutation.isPending ? (
                    <>
                      <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                      Creating...
                    </>
                  ) : (
                    'Create Role'
                  )}
                </Button>
              </div>
            </form>
          </CardContent>
        </Card>
      </div>
    </PermissionGate>
  )
}
