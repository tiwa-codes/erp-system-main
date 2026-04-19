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
  AlertTriangle, 
  Building2, 
  Calendar, 
  TrendingUp,
  Edit,
  Trash2,
  FileText
} from "lucide-react"

interface ViewRiskProfileModalProps {
  isOpen: boolean
  onClose: () => void
  riskProfileId: string | null
  onEdit: (id: string) => void
  onDelete: (id: string) => void
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

export function ViewRiskProfileModal({ isOpen, onClose, riskProfileId, onEdit, onDelete }: ViewRiskProfileModalProps) {
  const [riskProfile, setRiskProfile] = useState<RiskProfile | null>(null)

  // Fetch risk profile details
  const { data: riskProfileData, isLoading } = useQuery({
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

  useEffect(() => {
    if (riskProfileData) {
      setRiskProfile(riskProfileData)
    }
  }, [riskProfileData])

  const getRiskLevelBadgeColor = (level: string) => {
    switch (level) {
      case 'LOW':
        return 'bg-green-100 text-green-800'
      case 'MEDIUM':
        return 'bg-yellow-100 text-yellow-800'
      case 'HIGH':
        return 'bg-orange-100 text-orange-800'
      case 'CRITICAL':
        return 'bg-red-100 text-red-800'
      default:
        return 'bg-gray-100 text-gray-800'
    }
  }

  const getRiskScoreColor = (score: number) => {
    if (score <= 25) return 'text-green-600'
    if (score <= 50) return 'text-yellow-600'
    if (score <= 75) return 'text-orange-600'
    return 'text-red-600'
  }

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'long',
      day: 'numeric'
    })
  }

  if (!isOpen || !riskProfileId) return null

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <AlertTriangle className="h-5 w-5 text-blue-600" />
            Tariff Plan Assessment Details
          </DialogTitle>
          <DialogDescription>
            View detailed information about the tariff plan assessment
          </DialogDescription>
        </DialogHeader>

        {isLoading ? (
          <div className="flex items-center justify-center py-8">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
          </div>
        ) : riskProfile ? (
          <div className="space-y-6">
            {/* Header with Risk Level */}
            <div className="flex items-center justify-between">
              <div>
                <h3 className="text-lg font-semibold">Risk Assessment</h3>
                <p className="text-sm text-gray-600">Assessed on {formatDate(riskProfile.assessment_date)}</p>
              </div>
              <div className="flex items-center gap-2">
                <Badge className={getRiskLevelBadgeColor(riskProfile.risk_level)}>
                  {riskProfile.risk_level}
                </Badge>
                <div className="flex gap-2">
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => onEdit(riskProfile.id)}
                  >
                    <Edit className="h-4 w-4 mr-1" />
                    Edit
                  </Button>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => onDelete(riskProfile.id)}
                    className="text-red-600 hover:text-red-700"
                  >
                    <Trash2 className="h-4 w-4 mr-1" />
                    Delete
                  </Button>
                </div>
              </div>
            </div>

            {/* Risk Score */}
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <TrendingUp className="h-5 w-5 text-blue-600" />
                  Risk Score
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="text-center">
                  <div className={`text-4xl font-bold ${getRiskScoreColor(riskProfile.risk_score)}`}>
                    {riskProfile.risk_score}
                  </div>
                  <p className="text-sm text-gray-600 mt-2">Out of 100</p>
                  <div className="w-full bg-gray-200 rounded-full h-2 mt-4">
                    <div 
                      className={`h-2 rounded-full ${getRiskScoreColor(riskProfile.risk_score).replace('text-', 'bg-')}`}
                      style={{ width: `${riskProfile.risk_score}%` }}
                    ></div>
                  </div>
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
                  <p className="text-sm font-semibold">{riskProfile.provider.facility_name}</p>
                </div>
                <div className="mt-2">
                  <label className="text-sm font-medium text-gray-600">Facility Type</label>
                  <div className="flex flex-wrap gap-1 mt-1">
                    {riskProfile.provider.facility_type.map((type, index) => (
                      <Badge key={index} variant="outline" className="text-xs">
                        {type.replace('_', ' ')}
                      </Badge>
                    ))}
                  </div>
                </div>
              </CardContent>
            </Card>

            {/* Assessment Details */}
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Calendar className="h-5 w-5 text-blue-600" />
                  Assessment Details
                </CardTitle>
              </CardHeader>
              <CardContent className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className="text-sm font-medium text-gray-600">Assessment Date</label>
                  <p className="text-sm">{formatDate(riskProfile.assessment_date)}</p>
                </div>
                <div>
                  <label className="text-sm font-medium text-gray-600">Risk Level</label>
                  <div className="mt-1">
                    <Badge className={getRiskLevelBadgeColor(riskProfile.risk_level)}>
                      {riskProfile.risk_level}
                    </Badge>
                  </div>
                </div>
                <div>
                  <label className="text-sm font-medium text-gray-600">Created</label>
                  <p className="text-sm">{formatDate(riskProfile.created_at)}</p>
                </div>
              </CardContent>
            </Card>

            {/* Risk Factors */}
            {riskProfile.factors && (
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <FileText className="h-5 w-5 text-blue-600" />
                    Risk Factors
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="bg-gray-50 rounded-md p-4">
                    <pre className="text-sm whitespace-pre-wrap">
                      {typeof riskProfile.factors === 'string' 
                        ? riskProfile.factors 
                        : JSON.stringify(riskProfile.factors, null, 2)
                      }
                    </pre>
                  </div>
                </CardContent>
              </Card>
            )}

            {/* Recommendations */}
            {riskProfile.recommendations && (
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <FileText className="h-5 w-5 text-blue-600" />
                    Recommendations
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="bg-gray-50 rounded-md p-4">
                    <p className="text-sm whitespace-pre-wrap">
                      {riskProfile.recommendations}
                    </p>
                  </div>
                </CardContent>
              </Card>
            )}
          </div>
        ) : (
          <div className="text-center py-8">
            <p className="text-gray-500">No risk profile data found</p>
          </div>
        )}
      </DialogContent>
    </Dialog>
  )
}
