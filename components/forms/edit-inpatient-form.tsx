"use client"

import { useState, useEffect } from "react"
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query"
import { useToast } from "@/hooks/use-toast"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import { Calendar } from "lucide-react"

interface EditInPatientModalProps {
  isOpen: boolean
  onClose: () => void
  inpatientId: string | null
}

interface Provider {
  id: string
  facility_name: string
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

export function EditInPatientModal({ isOpen, onClose, inpatientId }: EditInPatientModalProps) {
  const { toast } = useToast()
  const queryClient = useQueryClient()

  const [form, setForm] = useState({
    patient_id: "",
    provider_id: "",
    admission_date: "",
    discharge_date: "",
    diagnosis: "",
    treatment: "",
    status: "ADMITTED"
  })

  const [providers, setProviders] = useState<Provider[]>([])

  // Fetch inpatient details
  const { data: inpatientData, isLoading: isLoadingInpatient } = useQuery({
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

  // Fetch providers for the dropdown
  useEffect(() => {
    if (isOpen) {
      fetch("/api/providers/active")
        .then(res => res.json())
        .then(data => {
          if (data.providers) {
            setProviders(data.providers)
          }
        })
        .catch(error => {
          console.error("Error fetching providers:", error)
        })
    }
  }, [isOpen])

  // Update form when inpatient data is loaded
  useEffect(() => {
    if (inpatientData) {
      const inpatient = inpatientData as InPatient
      setForm({
        patient_id: inpatient.patient_id,
        provider_id: inpatient.provider_id,
        admission_date: new Date(inpatient.admission_date).toISOString().slice(0, 16),
        discharge_date: inpatient.discharge_date ? new Date(inpatient.discharge_date).toISOString().slice(0, 16) : "",
        diagnosis: inpatient.diagnosis || "",
        treatment: inpatient.treatment || "",
        status: inpatient.status
      })
    }
  }, [inpatientData])

  const updateInPatientMutation = useMutation({
    mutationFn: async (data: any) => {
      const res = await fetch(`/api/providers/in-patients/${inpatientId}`, {
        method: "PUT",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify(data),
      })

      if (!res.ok) {
        let errorMessage = "Failed to update in-patient record"
        try {
          const errorData = await res.json()
          errorMessage = errorData.error || errorMessage
        } catch {
          errorMessage = res.statusText || errorMessage
        }
        throw new Error(errorMessage)
      }

      return res.json()
    },
    onSuccess: () => {
      toast({
        title: "Success",
        description: "In-patient record updated successfully",
      })
      queryClient.invalidateQueries({ queryKey: ["in-patients"] })
      queryClient.invalidateQueries({ queryKey: ["in-patient-metrics"] })
      queryClient.invalidateQueries({ queryKey: ["inpatient", inpatientId] })
      onClose()
    },
    onError: (error: any) => {
      toast({
        title: "Error",
        description: error.message || "Failed to update in-patient record",
        variant: "destructive",
      })
    },
  })

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    
    // Validation
    const missingFields = []
    if (!form.patient_id) missingFields.push("Patient ID")
    if (!form.provider_id) missingFields.push("Provider")
    if (!form.admission_date) missingFields.push("Admission Date")
    
    if (missingFields.length > 0) {
      toast({
        title: "Validation Error",
        description: `Please fill in the following required fields: ${missingFields.join(", ")}`,
        variant: "destructive",
      })
      return
    }

    const submitData = {
      ...form,
      admission_date: new Date(form.admission_date).toISOString(),
      discharge_date: form.discharge_date ? new Date(form.discharge_date).toISOString() : null,
    }

    updateInPatientMutation.mutate(submitData)
  }

  const handleInputChange = (field: string, value: string) => {
    setForm(prev => ({ ...prev, [field]: value }))
  }

  if (!isOpen || !inpatientId) return null

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Calendar className="h-5 w-5 text-blue-600" />
            Edit In-Patient Record
          </DialogTitle>
          <DialogDescription>
            Update the in-patient admission record
          </DialogDescription>
        </DialogHeader>

        {isLoadingInpatient ? (
          <div className="flex items-center justify-center py-8">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
          </div>
        ) : (
          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="patient_id">Patient ID *</Label>
                <Input
                  id="patient_id"
                  value={form.patient_id}
                  onChange={(e) => handleInputChange("patient_id", e.target.value)}
                  placeholder="Enter patient ID"
                  required
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="provider_id">Provider *</Label>
                <Select
                  value={form.provider_id}
                  onValueChange={(value) => handleInputChange("provider_id", value)}
                  required
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Select provider" />
                  </SelectTrigger>
                  <SelectContent>
                    {providers.map((provider) => (
                      <SelectItem key={provider.id} value={provider.id}>
                        {provider.facility_name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-2">
                <Label htmlFor="admission_date">Admission Date *</Label>
                <Input
                  id="admission_date"
                  type="datetime-local"
                  value={form.admission_date}
                  onChange={(e) => handleInputChange("admission_date", e.target.value)}
                  required
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="discharge_date">Discharge Date</Label>
                <Input
                  id="discharge_date"
                  type="datetime-local"
                  value={form.discharge_date}
                  onChange={(e) => handleInputChange("discharge_date", e.target.value)}
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="status">Status</Label>
                <Select
                  value={form.status}
                  onValueChange={(value) => handleInputChange("status", value)}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Select status" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="ADMITTED">Admitted</SelectItem>
                    <SelectItem value="DISCHARGED">Discharged</SelectItem>
                    <SelectItem value="TRANSFERRED">Transferred</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>

            <div className="space-y-2">
              <Label htmlFor="diagnosis">Diagnosis</Label>
              <Textarea
                id="diagnosis"
                value={form.diagnosis}
                onChange={(e) => handleInputChange("diagnosis", e.target.value)}
                placeholder="Enter diagnosis details"
                rows={3}
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="treatment">Treatment</Label>
              <Textarea
                id="treatment"
                value={form.treatment}
                onChange={(e) => handleInputChange("treatment", e.target.value)}
                placeholder="Enter treatment details"
                rows={3}
              />
            </div>

            <DialogFooter>
              <Button type="button" variant="outline" onClick={onClose}>
                Cancel
              </Button>
              <Button 
                type="submit" 
                className="bg-[#0891B2] hover:bg-[#9B1219]"
                disabled={updateInPatientMutation.isPending}
              >
                {updateInPatientMutation.isPending ? "Updating..." : "Update Record"}
              </Button>
            </DialogFooter>
          </form>
        )}
      </DialogContent>
    </Dialog>
  )
}
