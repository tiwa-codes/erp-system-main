"use client"

import { useState, useEffect } from "react"
import { useQuery } from "@tanstack/react-query"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import { 
  Calendar, 
  User, 
  Building2, 
  Clock, 
  FileText,
  Edit,
  Trash2
} from "lucide-react"

interface ViewInPatientModalProps {
  isOpen: boolean
  onClose: () => void
  inpatientId: string | null
  onEdit: (id: string) => void
  onDelete: (id: string) => void
}

interface InPatient {
  id: string
  patient_id: string
  provider_id: string
  provider: {
    id: string
    facility_name: string
    facility_type: string[]
  }
  admission_date: string
  discharge_date?: string
  diagnosis?: string
  treatment?: string
  status: string
  created_at: string
}

export function ViewInPatientModal({ isOpen, onClose, inpatientId, onEdit, onDelete }: ViewInPatientModalProps) {
  const [inpatient, setInpatient] = useState<InPatient | null>(null)

  // Fetch inpatient details
  const { data: inpatientData, isLoading } = useQuery({
    queryKey: ["inpatient", inpatientId],
    queryFn: async () => {
      if (!inpatientId) return null
      const res = await fetch(`/api/providers/in-patients/${inpatientId}`)
      if (!res.ok) {
        throw new Error("Failed to fetch inpatient details")
      }
      return res.json()
    },
    enabled: !!inpatientId && isOpen,
  })

  useEffect(() => {
    if (inpatientData) {
      setInpatient(inpatientData)
    }
  }, [inpatientData])

  const getStatusBadgeColor = (status: string) => {
    switch (status) {
      case 'ADMITTED':
        return 'bg-blue-100 text-blue-800'
      case 'DISCHARGED':
        return 'bg-green-100 text-green-800'
      case 'TRANSFERRED':
        return 'bg-yellow-100 text-yellow-800'
      default:
        return 'bg-gray-100 text-gray-800'
    }
  }

  const getStatusText = (status: string) => {
    switch (status) {
      case 'ADMITTED':
        return 'Admitted'
      case 'DISCHARGED':
        return 'Discharged'
      case 'TRANSFERRED':
        return 'Transferred'
      default:
        return status
    }
  }

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'long',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    })
  }

  const calculateLengthOfStay = (admissionDate: string, dischargeDate?: string) => {
    const admission = new Date(admissionDate)
    const discharge = dischargeDate ? new Date(dischargeDate) : new Date()
    const diffTime = Math.abs(discharge.getTime() - admission.getTime())
    const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24))
    return diffDays
  }

  if (!isOpen || !inpatientId) return null

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Calendar className="h-5 w-5 text-blue-600" />
            In-Patient Details
          </DialogTitle>
          <DialogDescription>
            View detailed information about the in-patient record
          </DialogDescription>
        </DialogHeader>

        {isLoading ? (
          <div className="flex items-center justify-center py-8">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
          </div>
        ) : inpatient ? (
          <div className="space-y-6">
            {/* Header with Status */}
            <div className="flex items-center justify-between">
              <div>
                <h3 className="text-lg font-semibold">Patient ID: {inpatient.patient_id}</h3>
                <p className="text-sm text-gray-600">Admitted on {formatDate(inpatient.admission_date)}</p>
              </div>
              <div className="flex items-center gap-2">
                <Badge className={getStatusBadgeColor(inpatient.status)}>
                  {getStatusText(inpatient.status)}
                </Badge>
                <div className="flex gap-2">
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => onEdit(inpatient.id)}
                  >
                    <Edit className="h-4 w-4 mr-1" />
                    Edit
                  </Button>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => onDelete(inpatient.id)}
                    className="text-red-600 hover:text-red-700"
                  >
                    <Trash2 className="h-4 w-4 mr-1" />
                    Delete
                  </Button>
                </div>
              </div>
            </div>

            {/* Basic Information */}
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <User className="h-5 w-5 text-blue-600" />
                  Basic Information
                </CardTitle>
              </CardHeader>
              <CardContent className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className="text-sm font-medium text-gray-600">Patient ID</label>
                  <p className="text-sm font-semibold">{inpatient.patient_id}</p>
                </div>
                <div>
                  <label className="text-sm font-medium text-gray-600">Status</label>
                  <div className="mt-1">
                    <Badge className={getStatusBadgeColor(inpatient.status)}>
                      {getStatusText(inpatient.status)}
                    </Badge>
                  </div>
                </div>
                <div>
                  <label className="text-sm font-medium text-gray-600">Admission Date</label>
                  <p className="text-sm">{formatDate(inpatient.admission_date)}</p>
                </div>
                <div>
                  <label className="text-sm font-medium text-gray-600">Discharge Date</label>
                  <p className="text-sm">
                    {inpatient.discharge_date ? formatDate(inpatient.discharge_date) : 'Not discharged'}
                  </p>
                </div>
                <div>
                  <label className="text-sm font-medium text-gray-600">Length of Stay</label>
                  <p className="text-sm font-semibold">
                    {calculateLengthOfStay(inpatient.admission_date, inpatient.discharge_date)} days
                  </p>
                </div>
              </CardContent>
            </Card>

            {/* Provider Information */}
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Building2 className="h-5 w-5 text-blue-600" />
                  Provider Information
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div>
                  <label className="text-sm font-medium text-gray-600">Facility Name</label>
                  <p className="text-sm font-semibold">{inpatient.provider.facility_name}</p>
                </div>
                <div className="mt-2">
                  <label className="text-sm font-medium text-gray-600">Facility Type</label>
                  <div className="flex flex-wrap gap-1 mt-1">
                    {inpatient.provider.facility_type.map((type, index) => (
                      <Badge key={index} variant="outline" className="text-xs">
                        {type.replace('_', ' ')}
                      </Badge>
                    ))}
                  </div>
                </div>
              </CardContent>
            </Card>

            {/* Medical Information */}
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <FileText className="h-5 w-5 text-blue-600" />
                  Medical Information
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div>
                  <label className="text-sm font-medium text-gray-600">Diagnosis</label>
                  <p className="text-sm mt-1 p-3 bg-gray-50 rounded-md">
                    {inpatient.diagnosis || 'No diagnosis recorded'}
                  </p>
                </div>
                <div>
                  <label className="text-sm font-medium text-gray-600">Treatment</label>
                  <p className="text-sm mt-1 p-3 bg-gray-50 rounded-md">
                    {inpatient.treatment || 'No treatment recorded'}
                  </p>
                </div>
              </CardContent>
            </Card>

            {/* Timeline */}
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Clock className="h-5 w-5 text-blue-600" />
                  Timeline
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-3">
                  <div className="flex items-center gap-3">
                    <div className="w-2 h-2 bg-[#BE1522] rounded-full"></div>
                    <div>
                      <p className="text-sm font-medium">Admitted</p>
                      <p className="text-xs text-gray-600">{formatDate(inpatient.admission_date)}</p>
                    </div>
                  </div>
                  {inpatient.discharge_date && (
                    <div className="flex items-center gap-3">
                      <div className="w-2 h-2 bg-green-600 rounded-full"></div>
                      <div>
                        <p className="text-sm font-medium">Discharged</p>
                        <p className="text-xs text-gray-600">{formatDate(inpatient.discharge_date)}</p>
                      </div>
                    </div>
                  )}
                  <div className="flex items-center gap-3">
                    <div className="w-2 h-2 bg-gray-400 rounded-full"></div>
                    <div>
                      <p className="text-sm font-medium">Record Created</p>
                      <p className="text-xs text-gray-600">{formatDate(inpatient.created_at)}</p>
                    </div>
                  </div>
                </div>
              </CardContent>
            </Card>
          </div>
        ) : (
          <div className="text-center py-8">
            <p className="text-gray-500">No inpatient data found</p>
          </div>
        )}
      </DialogContent>
    </Dialog>
  )
}
