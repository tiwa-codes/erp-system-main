"use client"

import { useState } from "react"
import { useMutation } from "@tanstack/react-query"
import { useToast } from "@/hooks/use-toast"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"
import { Switch } from "@/components/ui/switch"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"

export function AddHRRuleForm({ onSuccess, onCancel }: { onSuccess: () => void, onCancel: () => void }) {
  const { toast } = useToast()
  const [form, setForm] = useState({
    name: "",
    description: "",
    rule_type: "",
    conditions: "",
    actions: "",
    is_active: true,
    priority: 0
  })

  const createMutation = useMutation({
    mutationFn: async (data: any) => {
      // Parse JSON fields
      const parsedData = {
        ...data,
        conditions: JSON.parse(data.conditions),
        actions: JSON.parse(data.actions)
      }

      const res = await fetch('/api/hr/rules', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(parsedData)
      })
      if (!res.ok) {
        const error = await res.json()
        throw new Error(error.message || 'Failed to create HR rule')
      }
      return res.json()
    },
    onSuccess: () => {
      toast({
        title: "Success",
        description: "HR Rule created successfully",
      })
      onSuccess()
    },
    onError: (error: any) => {
      toast({
        title: "Error",
        description: error.message || "Failed to create HR rule",
        variant: "destructive"
      })
    }
  })

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    
    // Validation
    const missingFields = []
    if (!form.name) missingFields.push("Name")
    if (!form.rule_type) missingFields.push("Rule Type")
    if (!form.conditions) missingFields.push("Conditions")
    if (!form.actions) missingFields.push("Actions")
    
    if (missingFields.length > 0) {
      toast({
        title: "Validation Error",
        description: `Please fill in the following required fields: ${missingFields.join(", ")}`,
        variant: "destructive"
      })
      return
    }

    // Validate JSON format
    try {
      JSON.parse(form.conditions)
      JSON.parse(form.actions)
    } catch (error) {
      toast({
        title: "Validation Error",
        description: "Conditions and Actions must be valid JSON format",
        variant: "destructive"
      })
      return
    }

    createMutation.mutate(form)
  }

  const exampleConditions = {
    "employee_status": "ACTIVE",
    "department": "HR",
    "leave_days": { "gte": 5 },
    "salary_range": { "min": 50000, "max": 100000 }
  }

  const exampleActions = {
    "auto_approve": true,
    "notify_manager": true,
    "require_documentation": false,
    "escalate_to": "HR_MANAGER"
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-6">
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <div className="md:col-span-2">
          <Label htmlFor="name">Rule Name *</Label>
          <Input
            id="name"
            value={form.name}
            onChange={(e) => setForm(prev => ({ ...prev, name: e.target.value }))}
            placeholder="Enter rule name"
            required
          />
        </div>
        
        <div className="md:col-span-2">
          <Label htmlFor="description">Description</Label>
          <Textarea
            id="description"
            value={form.description}
            onChange={(e) => setForm(prev => ({ ...prev, description: e.target.value }))}
            placeholder="Enter rule description"
            rows={3}
          />
        </div>

        <div>
          <Label htmlFor="rule_type">Rule Type *</Label>
          <Select value={form.rule_type} onValueChange={(value) => setForm(prev => ({ ...prev, rule_type: value }))}>
            <SelectTrigger>
              <SelectValue placeholder="Select Rule Type" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="ATTENDANCE">Attendance</SelectItem>
              <SelectItem value="LEAVE_APPROVAL">Leave Approval</SelectItem>
              <SelectItem value="PAYROLL">Payroll</SelectItem>
              <SelectItem value="CLAIMS_VALIDATION">Claims Validation</SelectItem>
              <SelectItem value="EMPLOYEE_ONBOARDING">Employee Onboarding</SelectItem>
              <SelectItem value="PERFORMANCE">Performance</SelectItem>
              <SelectItem value="COMPLIANCE">Compliance</SelectItem>
            </SelectContent>
          </Select>
        </div>

        <div>
          <Label htmlFor="priority">Priority</Label>
          <Input
            id="priority"
            type="number"
            value={form.priority}
            onChange={(e) => setForm(prev => ({ ...prev, priority: parseInt(e.target.value) || 0 }))}
            placeholder="Priority (0-100)"
            min="0"
            max="100"
          />
        </div>

        <div className="md:col-span-2">
          <div className="flex items-center space-x-2">
            <Switch
              id="is_active"
              checked={form.is_active}
              onCheckedChange={(checked) => setForm(prev => ({ ...prev, is_active: checked }))}
            />
            <Label htmlFor="is_active">Active Rule</Label>
          </div>
        </div>
      </div>

      {/* Conditions */}
      <Card>
        <CardHeader>
          <CardTitle>Conditions *</CardTitle>
          <p className="text-sm text-gray-600">Define the conditions that trigger this rule (JSON format)</p>
        </CardHeader>
        <CardContent>
          <Textarea
            value={form.conditions}
            onChange={(e) => setForm(prev => ({ ...prev, conditions: e.target.value }))}
            placeholder="Enter conditions as JSON"
            rows={8}
            className="font-mono text-sm"
          />
          <div className="mt-2">
            <p className="text-xs text-gray-500 mb-1">Example:</p>
            <pre className="text-xs bg-gray-100 p-2 rounded overflow-x-auto">
              {JSON.stringify(exampleConditions, null, 2)}
            </pre>
          </div>
        </CardContent>
      </Card>

      {/* Actions */}
      <Card>
        <CardHeader>
          <CardTitle>Actions *</CardTitle>
          <p className="text-sm text-gray-600">Define the actions to take when conditions are met (JSON format)</p>
        </CardHeader>
        <CardContent>
          <Textarea
            value={form.actions}
            onChange={(e) => setForm(prev => ({ ...prev, actions: e.target.value }))}
            placeholder="Enter actions as JSON"
            rows={8}
            className="font-mono text-sm"
          />
          <div className="mt-2">
            <p className="text-xs text-gray-500 mb-1">Example:</p>
            <pre className="text-xs bg-gray-100 p-2 rounded overflow-x-auto">
              {JSON.stringify(exampleActions, null, 2)}
            </pre>
          </div>
        </CardContent>
      </Card>

      <div className="flex justify-end gap-2">
        <Button type="button" variant="outline" onClick={onCancel}>
          Cancel
        </Button>
        <Button type="submit" disabled={createMutation.isPending}>
          {createMutation.isPending ? "Creating..." : "Create HR Rule"}
        </Button>
      </div>
    </form>
  )
}
