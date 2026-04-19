"use client"

import { useState } from "react"
import { useMutation, useQuery } from "@tanstack/react-query"
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
import { useToast } from "@/hooks/use-toast"

interface AddLeaveFormProps {
  onClose: () => void
  onCreated?: () => void
}

export function AddLeaveForm({ onClose, onCreated }: AddLeaveFormProps) {
  const { toast } = useToast()
  const [form, setForm] = useState({
    employeeId: "",
    leaveDate: "",
    returnDate: "",
    leaveType: "",
    reason: "",
  })

  // Fetch employees
  const { data: employees = [] } = useQuery({
    queryKey: ["employees-for-leave-form"],
    queryFn: async () => {
      const res = await fetch("/api/hr/employees?limit=1000")
      if (!res.ok) throw new Error("Failed to fetch employees")
      return res.json()
    }
  })

  const createMutation = useMutation({
    mutationFn: async () => {
      const payload = {
        employee_id: form.employeeId,
        leave_type: form.leaveType,
        start_date: form.leaveDate,
        end_date: form.returnDate,
        reason: form.reason || "Leave request"
      }

      const res = await fetch("/api/hr/leave", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload)
      })
      
      if (!res.ok) {
        const err = await res.json().catch(() => ({}))
        throw new Error(err.error || `Failed to create leave request (${res.status})`)
      }
      
      return res.json()
    },
    onSuccess: (data) => {
      toast({ 
        title: "Leave request created successfully",
        description: data.message || "Leave request has been submitted"
      })
      onCreated?.()
      onClose()
    },
    onError: (e: Error) => {
      toast({ 
        title: "Error", 
        description: e.message, 
        variant: "destructive" 
      })
    }
  })

  const handleEmployeeChange = (employeeId: string) => {
    setForm(prev => ({
      ...prev,
      employeeId
    }))
  }

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    
    if (!form.employeeId || !form.leaveType || !form.leaveDate || !form.returnDate) {
      toast({
        title: "Validation Error",
        description: "Please fill in all required fields",
        variant: "destructive"
      })
      return
    }

    createMutation.mutate()
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-6">
      {/* Employee Selection */}
      <div className="space-y-4">
        <h3 className="text-lg font-medium">Employee Information</h3>
        <div>
          <Label htmlFor="employee">Select Employee *</Label>
          <Select value={form.employeeId} onValueChange={handleEmployeeChange}>
            <SelectTrigger>
              <SelectValue placeholder="Select an employee" />
            </SelectTrigger>
            <SelectContent>
              {employees.employees?.map((employee: any) => (
                <SelectItem key={employee.id} value={employee.id}>
                  {employee.first_name} {employee.last_name} ({employee.employee_id})
                  {employee.department && ` - ${employee.department.name}`}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      </div>

      {/* Leave Information */}
      <div className="space-y-4">
        <h3 className="text-lg font-medium">Leave Information</h3>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div>
            <Label htmlFor="leaveDate">Start Date *</Label>
            <Input
              id="leaveDate"
              type="date"
              value={form.leaveDate}
              onChange={(e) => setForm(prev => ({ ...prev, leaveDate: e.target.value }))}
              required
            />
          </div>
          <div>
            <Label htmlFor="returnDate">End Date *</Label>
            <Input
              id="returnDate"
              type="date"
              value={form.returnDate}
              onChange={(e) => setForm(prev => ({ ...prev, returnDate: e.target.value }))}
              required
            />
          </div>
          <div>
            <Label htmlFor="leaveType">Leave Type *</Label>
            <Select value={form.leaveType} onValueChange={(value) => setForm(prev => ({ ...prev, leaveType: value }))}>
              <SelectTrigger>
                <SelectValue placeholder="Select Leave Type" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="SICK_LEAVE">Sick Leave</SelectItem>
                <SelectItem value="VACATION">Vacation Leave</SelectItem>
                <SelectItem value="PERSONAL_LEAVE">Personal Leave</SelectItem>
                <SelectItem value="MATERNITY_LEAVE">Maternity Leave</SelectItem>
                <SelectItem value="PATERNITY_LEAVE">Paternity Leave</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div className="md:col-span-2">
            <Label htmlFor="reason">Reason</Label>
            <Textarea
              id="reason"
              value={form.reason}
              onChange={(e) => setForm(prev => ({ ...prev, reason: e.target.value }))}
              placeholder="Enter reason for leave (optional)"
              rows={3}
            />
          </div>
        </div>
      </div>

      {/* Form Actions */}
      <div className="flex justify-end gap-4 pt-4">
        <Button type="button" variant="outline" onClick={onClose}>
          Cancel
        </Button>
        <Button 
          type="submit" 
          disabled={createMutation.isPending}
          className="bg-[#BE1522] hover:bg-[#9B1219] text-white"
        >
          {createMutation.isPending ? "Creating..." : "Submit Leave Request"}
        </Button>
      </div>
    </form>
  )
}
