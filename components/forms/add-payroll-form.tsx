"use client"

import { useState } from "react"
import { useMutation, useQuery } from "@tanstack/react-query"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { useToast } from "@/hooks/use-toast"

interface AddPayrollFormProps {
  onClose: () => void
  onCreated?: () => void
}

export function AddPayrollForm({ onClose, onCreated }: AddPayrollFormProps) {
  const { toast } = useToast()
  const [form, setForm] = useState({
    employeeId: "",
    paymentDate: "",
    basicSalary: "",
    allowances: "",
    deductions: "",
    overtimePay: "",
  })

  // Fetch employees
  const { data: employees = [] } = useQuery({
    queryKey: ["employees-for-payroll-form"],
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
        basic_salary: parseFloat(form.basicSalary),
        allowances: parseFloat(form.allowances) || 0,
        deductions: parseFloat(form.deductions) || 0,
        overtime_pay: parseFloat(form.overtimePay) || 0,
        payment_date: form.paymentDate,
        pay_period_start: new Date(new Date().getFullYear(), new Date().getMonth(), 1).toISOString(),
        pay_period_end: new Date(new Date().getFullYear(), new Date().getMonth() + 1, 0).toISOString()
      }

      const res = await fetch("/api/hr/payroll", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload)
      })
      
      if (!res.ok) {
        const err = await res.json().catch(() => ({}))
        throw new Error(err.error || `Failed to create payroll record (${res.status})`)
      }
      
      return res.json()
    },
    onSuccess: (data) => {
      toast({ 
        title: "Payroll record created successfully",
        description: data.message || "Payroll record has been added"
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
    const employee = employees.employees?.find((emp: any) => emp.id === employeeId)
    if (employee) {
      setForm(prev => ({
        ...prev,
        employeeId,
        basicSalary: employee.salary ? employee.salary.toString() : ''
      }))
    }
  }

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    
    if (!form.employeeId || !form.basicSalary || !form.paymentDate) {
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

      {/* Payroll Information */}
      <div className="space-y-4">
        <h3 className="text-lg font-medium">Payroll Information</h3>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div>
            <Label htmlFor="paymentDate">Payment Date *</Label>
            <Input
              id="paymentDate"
              type="date"
              value={form.paymentDate}
              onChange={(e) => setForm(prev => ({ ...prev, paymentDate: e.target.value }))}
              required
            />
          </div>
          <div>
            <Label htmlFor="basicSalary">Basic Salary *</Label>
            <Input
              id="basicSalary"
              type="number"
              step="0.01"
              value={form.basicSalary}
              onChange={(e) => setForm(prev => ({ ...prev, basicSalary: e.target.value }))}
              placeholder="Enter basic salary"
              required
            />
          </div>
          <div>
            <Label htmlFor="allowances">Allowances</Label>
            <Input
              id="allowances"
              type="number"
              step="0.01"
              value={form.allowances}
              onChange={(e) => setForm(prev => ({ ...prev, allowances: e.target.value }))}
              placeholder="Enter allowances"
            />
          </div>
          <div>
            <Label htmlFor="deductions">Deductions</Label>
            <Input
              id="deductions"
              type="number"
              step="0.01"
              value={form.deductions}
              onChange={(e) => setForm(prev => ({ ...prev, deductions: e.target.value }))}
              placeholder="Enter deductions"
            />
          </div>
          <div>
            <Label htmlFor="overtimePay">Overtime Pay</Label>
            <Input
              id="overtimePay"
              type="number"
              step="0.01"
              value={form.overtimePay}
              onChange={(e) => setForm(prev => ({ ...prev, overtimePay: e.target.value }))}
              placeholder="Enter overtime pay"
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
          className="bg-[#0891B2] hover:bg-[#9B1219] text-white"
        >
          {createMutation.isPending ? "Creating..." : "Create Payroll Record"}
        </Button>
      </div>
    </form>
  )
}
