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
import { AlertTriangle } from "lucide-react"

interface EditRiskProfileModalProps {
  isOpen: boolean
  onClose: () => void
  riskProfileId: string | null
}

interface Provider {
  id: string
  facility_name: string
}

interface RiskProfile {
  id: string
  provider_id: string
  provider: {
    id: string
    facility_name: string
    facility_type: string[]
  }
  risk_score: number
  risk_level: string
  assessment_date: string
  factors?: any
  recommendations?: string
  created_at: string
}

export function EditRiskProfileModal({ isOpen, onClose, riskProfileId }: EditRiskProfileModalProps) {
  const { toast } = useToast()
  const queryClient = useQueryClient()

  const [form, setForm] = useState({
    provider_id: "",
    risk_score: "",
    risk_level: "",
    assessment_date: "",
    factors: "",
    recommendations: ""
  })

  const [providers, setProviders] = useState<Provider[]>([])

  // Fetch risk profile details
  const { data: riskProfileData, isLoading: isLoadingRiskProfile } = useQuery({
    queryKey: ["risk-profile", riskProfileId],
    queryFn: async () => {
      if (!riskProfileId) return null
      const res = await fetch(`/api/providers/risk-profiles/${riskProfileId}`)
      if (!res.ok) {
        throw new Error("Failed to fetch risk profile details")
      }
      return res.json()
    },
    enabled: !!riskProfileId && isOpen,
  })

  // Fetch providers for the dropdown
  useEffect(() => {
    if (isOpen) {
      fetch("/api/providers")
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

  // Update form when risk profile data is loaded
  useEffect(() => {
    if (riskProfileData) {
      const riskProfile = riskProfileData as RiskProfile
      setForm({
        provider_id: riskProfile.provider_id,
        risk_score: riskProfile.risk_score.toString(),
        risk_level: riskProfile.risk_level,
        assessment_date: new Date(riskProfile.assessment_date).toISOString().split('T')[0],
        factors: riskProfile.factors ? JSON.stringify(riskProfile.factors, null, 2) : "",
        recommendations: riskProfile.recommendations || ""
      })
    }
  }, [riskProfileData])

  const updateRiskProfileMutation = useMutation({
    mutationFn: async (data: any) => {
      const res = await fetch(`/api/providers/risk-profiles/${riskProfileId}`, {
        method: "PUT",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify(data),
      })

      if (!res.ok) {
        let errorMessage = "Failed to update risk profile"
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
        description: "Risk profile updated successfully",
      })
      queryClient.invalidateQueries({ queryKey: ["risk-profiles"] })
      queryClient.invalidateQueries({ queryKey: ["risk-profile-metrics"] })
      queryClient.invalidateQueries({ queryKey: ["risk-profile", riskProfileId] })
      onClose()
    },
    onError: (error: any) => {
      toast({
        title: "Error",
        description: error.message || "Failed to update risk profile",
        variant: "destructive",
      })
    },
  })

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    
    // Validation
    const missingFields = []
    if (!form.provider_id) missingFields.push("Provider")
    if (!form.risk_score) missingFields.push("Risk Score")
    if (!form.risk_level) missingFields.push("Risk Level")
    if (!form.assessment_date) missingFields.push("Assessment Date")
    
    if (missingFields.length > 0) {
      toast({
        title: "Validation Error",
        description: `Please fill in the following required fields: ${missingFields.join(", ")}`,
        variant: "destructive",
      })
      return
    }

    // Parse factors JSON safely
    let parsedFactors = null
    if (form.factors && form.factors.trim()) {
      try {
        parsedFactors = JSON.parse(form.factors)
      } catch (error) {
        toast({
          title: "Invalid JSON",
          description: "Please enter valid JSON format for risk factors or leave it empty",
          variant: "destructive",
        })
        return
      }
    }

    const submitData = {
      ...form,
      risk_score: parseFloat(form.risk_score),
      assessment_date: new Date(form.assessment_date).toISOString(),
      factors: parsedFactors,
    }

    updateRiskProfileMutation.mutate(submitData)
  }

  const handleInputChange = (field: string, value: string) => {
    setForm(prev => ({ ...prev, [field]: value }))
  }

  if (!isOpen || !riskProfileId) return null

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <AlertTriangle className="h-5 w-5 text-blue-600" />
            Edit Tariff Plan Assessment
          </DialogTitle>
          <DialogDescription>
            Update the tariff plan assessment for a provider
          </DialogDescription>
        </DialogHeader>

        {isLoadingRiskProfile ? (
          <div className="flex items-center justify-center py-8">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
          </div>
        ) : (
          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
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
                <Label htmlFor="risk_score">Risk Score *</Label>
                <Input
                  id="risk_score"
                  type="number"
                  min="0"
                  max="100"
                  step="0.1"
                  value={form.risk_score}
                  onChange={(e) => handleInputChange("risk_score", e.target.value)}
                  placeholder="Enter risk score (0-100)"
                  required
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="risk_level">Risk Level *</Label>
                <Select
                  value={form.risk_level}
                  onValueChange={(value) => handleInputChange("risk_level", value)}
                  required
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Select risk level" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="LOW">Low</SelectItem>
                    <SelectItem value="MEDIUM">Medium</SelectItem>
                    <SelectItem value="HIGH">High</SelectItem>
                    <SelectItem value="CRITICAL">Critical</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-2">
                <Label htmlFor="assessment_date">Assessment Date *</Label>
                <Input
                  id="assessment_date"
                  type="date"
                  value={form.assessment_date}
                  onChange={(e) => handleInputChange("assessment_date", e.target.value)}
                  required
                />
              </div>
            </div>

            <div className="space-y-2">
              <Label htmlFor="factors">Risk Factors (Optional)</Label>
              <Textarea
                id="factors"
                value={form.factors}
                onChange={(e) => handleInputChange("factors", e.target.value)}
                placeholder='Enter risk factors as JSON (optional), e.g., {"financial_stability": "good", "compliance_history": "excellent"}'
                rows={3}
              />
              <p className="text-xs text-gray-500">
                Leave empty if no specific factors to record. If entering JSON, ensure it's valid format.
              </p>
            </div>

            <div className="space-y-2">
              <Label htmlFor="recommendations">Recommendations</Label>
              <Textarea
                id="recommendations"
                value={form.recommendations}
                onChange={(e) => handleInputChange("recommendations", e.target.value)}
                placeholder="Enter recommendations for risk mitigation"
                rows={3}
              />
            </div>

            <DialogFooter>
              <Button type="button" variant="outline" onClick={onClose}>
                Cancel
              </Button>
              <Button 
                type="submit" 
                className="bg-[#BE1522] hover:bg-[#9B1219]"
                disabled={updateRiskProfileMutation.isPending}
              >
                {updateRiskProfileMutation.isPending ? "Updating..." : "Update Assessment"}
              </Button>
            </DialogFooter>
          </form>
        )}
      </DialogContent>
    </Dialog>
  )
}
