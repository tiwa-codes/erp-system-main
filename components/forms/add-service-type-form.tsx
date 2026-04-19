"use client"

import { useState } from "react"
import { useMutation, useQueryClient } from "@tanstack/react-query"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { useToast } from "@/hooks/use-toast"

interface AddServiceTypeFormProps {
  onClose: () => void
  onCreated: () => void
  categories: string[]
}

export function AddServiceTypeForm({ onClose, onCreated, categories }: AddServiceTypeFormProps) {
  const { toast } = useToast()
  const queryClient = useQueryClient()
  
  const [formData, setFormData] = useState({
    service_name: "",
    service_category: ""
  })

  const createMutation = useMutation({
    mutationFn: async (data: any) => {
      const res = await fetch('/api/settings/service-types', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(data)
      })
      if (!res.ok) throw new Error('Failed to create service type')
      return res.json()
    },
    onSuccess: () => {
      toast({
        title: "Success",
        description: "Service type created successfully",
      })
      queryClient.invalidateQueries({ queryKey: ["service-types"] })
      onCreated()
    },
    onError: (error: any) => {
      toast({
        title: "Error",
        description: error.message || "Failed to create service type",
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

    createMutation.mutate(formData)
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <div className="space-y-2">
        <Label htmlFor="service_name">Service Name</Label>
        <Input
          id="service_name"
          placeholder="Enter service name"
          value={formData.service_name}
          onChange={(e) => setFormData(prev => ({ ...prev, service_name: e.target.value }))}
          required
        />
      </div>
      
      <div className="space-y-2">
        <Label htmlFor="service_category">Service Category</Label>
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
        <Button type="submit" disabled={createMutation.isPending}>
          {createMutation.isPending ? "Creating..." : "Save"}
        </Button>
      </div>
    </form>
  )
}
