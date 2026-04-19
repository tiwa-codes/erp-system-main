"use client"

import { Button } from "@/components/ui/button"
import { Label } from "@/components/ui/label"
import { Badge } from "@/components/ui/badge"

interface ViewServiceTypeProps {
  service: {
    id: string
    service_name: string
    service_category: string
    status: string
    created_at: string
    updated_at: string
  }
  onClose: () => void
}

export function ViewServiceType({ service, onClose }: ViewServiceTypeProps) {
  const getStatusBadgeColor = (status: string) => {
    switch (status) {
      case "ACTIVE":
        return "bg-green-100 text-green-800"
      case "INACTIVE":
        return "bg-gray-100 text-gray-800"
      default:
        return "bg-gray-100 text-gray-800"
    }
  }

  return (
    <div className="space-y-4">
      <div className="grid gap-4">
        <div>
          <Label className="text-sm font-medium text-gray-500">Service Name</Label>
          <p className="text-sm font-medium">{service.service_name}</p>
        </div>
        <div>
          <Label className="text-sm font-medium text-gray-500">Service Category</Label>
          <Badge variant="secondary" className="mt-1">
            {service.service_category}
          </Badge>
        </div>
        <div>
          <Label className="text-sm font-medium text-gray-500">Status</Label>
          <Badge className={getStatusBadgeColor(service.status)}>
            {service.status}
          </Badge>
        </div>
        <div>
          <Label className="text-sm font-medium text-gray-500">Created At</Label>
          <p className="text-sm font-medium">{new Date(service.created_at).toLocaleDateString()}</p>
        </div>
        <div>
          <Label className="text-sm font-medium text-gray-500">Last Updated</Label>
          <p className="text-sm font-medium">{new Date(service.updated_at).toLocaleDateString()}</p>
        </div>
      </div>

      <div className="flex justify-end pt-4">
        <Button variant="outline" onClick={onClose}>
          Close
        </Button>
      </div>
    </div>
  )
}
