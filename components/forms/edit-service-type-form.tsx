"use client"

import { useState, useEffect } from "react"
import { useMutation, useQueryClient } from "@tanstack/react-query"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { useToast } from "@/hooks/use-toast"

interface EditServiceTypeFormProps {
  service: {
    id: string
    service_name: string
    service_category: string
  }
  onClose: () => void
  onUpdated: () => void
  categories: string[]
}

export function EditServiceTypeForm({ service, onClose, onUpdated, categories }: EditServiceTypeFormProps) {
  const { toast } = useToast()
  const queryClient = useQueryClient()
  
  const [formData, setFormData] = useState({
    service_name: "",
    service_category: ""
  })

  useEffect(() => {
    setFormData({
      service_name: service.service_name,
      service_category: service.service_category
    })
  }, [service])

  const updateMutation = useMutation({
    mutationFn: async ({ id, data }: { id: string, data: any }) => {
      const res = await fetch(`/api/settings/service-types/${id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(data)
      })
      if (!res.ok) throw new Error('Failed to update service type')
      return res.json()
    },
    onSuccess: () => {
      toast({
        title: "Success",
        description: "Service type updated successfully",
      })
      queryClient.invalidateQueries({ queryKey: ["service-types"] })
      onUpdated()
    },
    onError: (error: any) => {
      toast({
        title: "Error",
        description: error.message || "Failed to update service type",
        variant: "destructive",
      })
    },
  })

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    
    if (!formData.service_name || !formData.service_category) {
      toast({
        title: "Validation Error",
        description: "Please fill in all required fields.",
        variant: "destructive",
      })
      return
    }

    updateMutation.mutate({ id: service.id, data: formData })
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <div className="space-y-2">
        <Label htmlFor="edit_service_name">Service Name</Label>
        <Input
          id="edit_service_name"
          placeholder="Enter service name"
          value={formData.service_name}
          onChange={(e) => setFormData(prev => ({ ...prev, service_name: e.target.value }))}
          required
        />
      </div>
      
      <div className="space-y-2">
        <Label htmlFor="edit_service_category">Service Category</Label>
        <Select 
          value={formData.service_category} 
          onValueChange={(value) => setFormData(prev => ({ ...prev, service_category: value }))}
        >
          <SelectTrigger>
            <SelectValue placeholder="Select category" />
          </SelectTrigger>
          <SelectContent>
            {categories.map((category) => (
              <SelectItem key={category} value={category}>
                {category}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      <div className="flex justify-end gap-2 pt-4">
        <Button type="button" variant="outline" onClick={onClose}>
          Cancel
        </Button>
        <Button type="submit" disabled={updateMutation.isPending}>
          {updateMutation.isPending ? "Updating..." : "Update"}
        </Button>
      </div>
    </form>
  )
}
