"use client"

import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Separator } from "@/components/ui/separator"
import { 
  Settings,
  CheckCircle,
  XCircle,
  Calendar,
  User,
  ArrowLeft,
  AlertTriangle,
  Code
} from "lucide-react"

export function ViewHRRule({ hrRule, onClose }: { hrRule: any, onClose: () => void }) {
  const getRuleTypeColor = (ruleType: string) => {
    switch (ruleType) {
      case 'ATTENDANCE': return 'default'
      case 'LEAVE_APPROVAL': return 'secondary'
      case 'PAYROLL': return 'default'
      case 'CLAIMS_VALIDATION': return 'destructive'
      case 'EMPLOYEE_ONBOARDING': return 'default'
      case 'PERFORMANCE': return 'secondary'
      case 'COMPLIANCE': return 'destructive'
      default: return 'default'
    }
  }

  const getStatusIcon = (isActive: boolean) => {
    return isActive ? (
      <CheckCircle className="h-4 w-4 text-green-600" />
    ) : (
      <XCircle className="h-4 w-4 text-red-600" />
    )
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Settings className="h-5 w-5 text-gray-600" />
          <h2 className="text-xl font-semibold">HR Rule Details</h2>
        </div>
        <Button variant="outline" onClick={onClose}>
          <ArrowLeft className="h-4 w-4 mr-2" />
          Back
        </Button>
      </div>

      {/* HR Rule Information */}
      <Card>
        <CardHeader>
          <div className="flex items-start justify-between">
            <div>
              <CardTitle className="text-lg">{hrRule.name}</CardTitle>
              {hrRule.description && (
                <p className="text-gray-600 mt-1">{hrRule.description}</p>
              )}
              <div className="flex items-center gap-2 mt-2">
                <Badge variant={getRuleTypeColor(hrRule.rule_type)}>
                  {hrRule.rule_type.replace('_', ' ')}
                </Badge>
                <div className="flex items-center gap-1">
                  {getStatusIcon(hrRule.is_active)}
                  <Badge variant={hrRule.is_active ? 'default' : 'secondary'}>
                    {hrRule.is_active ? 'Active' : 'Inactive'}
                  </Badge>
                </div>
                <div className="flex items-center gap-1">
                  <AlertTriangle className="h-4 w-4 text-gray-400" />
                  <Badge variant="outline">Priority: {hrRule.priority}</Badge>
                </div>
              </div>
            </div>
          </div>
        </CardHeader>
        <CardContent className="space-y-4">
          {/* Created By Information */}
          {hrRule.created_by && (
            <div className="flex items-center gap-3 p-3 bg-gray-50 rounded-lg">
              <User className="h-5 w-5 text-gray-600" />
              <div>
                <div className="font-medium">
                  {hrRule.created_by.first_name} {hrRule.created_by.last_name}
                </div>
                <div className="text-sm text-gray-600">
                  {hrRule.created_by.email}
                </div>
              </div>
            </div>
          )}

          <Separator />

          {/* Conditions */}
          <div>
            <h3 className="font-medium text-gray-900 mb-2 flex items-center gap-2">
              <Code className="h-4 w-4" />
              Conditions
            </h3>
            <Card className="bg-gray-50">
              <CardContent className="p-4">
                <pre className="text-sm text-gray-700 whitespace-pre-wrap overflow-x-auto">
                  {JSON.stringify(hrRule.conditions, null, 2)}
                </pre>
              </CardContent>
            </Card>
          </div>

          <Separator />

          {/* Actions */}
          <div>
            <h3 className="font-medium text-gray-900 mb-2 flex items-center gap-2">
              <Settings className="h-4 w-4" />
              Actions
            </h3>
            <Card className="bg-gray-50">
              <CardContent className="p-4">
                <pre className="text-sm text-gray-700 whitespace-pre-wrap overflow-x-auto">
                  {JSON.stringify(hrRule.actions, null, 2)}
                </pre>
              </CardContent>
            </Card>
          </div>

          <Separator />

          {/* Timestamps */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-sm">
            <div className="flex items-center gap-2">
              <Calendar className="h-4 w-4 text-gray-500" />
              <div>
                <div className="font-medium">Created</div>
                <div className="text-gray-600">
                  {new Date(hrRule.created_at).toLocaleString()}
                </div>
              </div>
            </div>
            {hrRule.updated_at && hrRule.updated_at !== hrRule.created_at && (
              <div className="flex items-center gap-2">
                <Calendar className="h-4 w-4 text-gray-500" />
                <div>
                  <div className="font-medium">Last Updated</div>
                  <div className="text-gray-600">
                    {new Date(hrRule.updated_at).toLocaleString()}
                  </div>
                </div>
              </div>
            )}
          </div>
        </CardContent>
      </Card>
    </div>
  )
}
