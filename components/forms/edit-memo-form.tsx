"use client"

import { useState, useEffect } from "react"
import { useMutation, useQuery } from "@tanstack/react-query"
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

export function EditMemoForm({ 
  memo, 
  onSuccess, 
  onCancel 
}: { 
  memo: any, 
  onSuccess: () => void, 
  onCancel: () => void 
}) {
  const { toast } = useToast()
  const [form, setForm] = useState({
    title: "",
    content: "",
    employee_id: "",
    priority: "NORMAL",
    status: "UNREAD"
  })

  // Initialize form with memo data
  useEffect(() => {
    if (memo) {
      setForm({
        title: memo.title || "",
        content: memo.content || "",
        employee_id: memo.employee_id || "",
        priority: memo.priority || "NORMAL",
        status: memo.status || "UNREAD"
      })
    }
  }, [memo])

  // Fetch employees for selection
  const { data: employees = [] } = useQuery({
    queryKey: ["employees-for-memo"],
    queryFn: async () => {
      const res = await fetch("/api/hr/employees?limit=1000")
      if (!res.ok) throw new Error("Failed to fetch employees")
      return res.json()
    }
  })

  const updateMutation = useMutation({
    mutationFn: async (data: any) => {
      const res = await fetch(`/api/hr/memos/${memo.id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(data)
      })
      if (!res.ok) {
        const error = await res.json()
        throw new Error(error.message || 'Failed to update memo')
      }
      return res.json()
    },
    onSuccess: () => {
      toast({
        title: "Success",
        description: "Memo updated successfully",
      })
      onSuccess()
    },
    onError: (error: any) => {
      toast({
        title: "Error",
        description: error.message || "Failed to update memo",
        variant: "destructive"
      })
    }
  })

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    
    // Validation
    const missingFields = []
    if (!form.title) missingFields.push("Title")
    if (!form.content) missingFields.push("Content")
    if (!form.employee_id) missingFields.push("Employee")
    
    if (missingFields.length > 0) {
      toast({
        title: "Validation Error",
        description: `Please fill in the following required fields: ${missingFields.join(", ")}`,
        variant: "destructive"
      })
      return
    }

    updateMutation.mutate(form)
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-6">
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <div className="md:col-span-2">
          <Label htmlFor="title">Title *</Label>
          <Input
            id="title"
            value={form.title}
            onChange={(e) => setForm(prev => ({ ...prev, title: e.target.value }))}
            placeholder="Enter memo title"
            required
          />
        </div>
        
        <div>
          <Label htmlFor="employee">Employee *</Label>
          <Select value={form.employee_id} onValueChange={(value) => setForm(prev => ({ ...prev, employee_id: value }))}>
            <SelectTrigger>
              <SelectValue placeholder="Select Employee" />
            </SelectTrigger>
            <SelectContent>
              {employees.employees?.map((employee: any) => (
                <SelectItem key={employee.id} value={employee.id}>
                  {employee.first_name} {employee.last_name} ({employee.employee_id})
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        <div>
          <Label htmlFor="priority">Priority</Label>
          <Select value={form.priority} onValueChange={(value) => setForm(prev => ({ ...prev, priority: value }))}>
            <SelectTrigger>
              <SelectValue placeholder="Select Priority" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="LOW">Low</SelectItem>
              <SelectItem value="NORMAL">Normal</SelectItem>
              <SelectItem value="HIGH">High</SelectItem>
              <SelectItem value="URGENT">Urgent</SelectItem>
            </SelectContent>
          </Select>
        </div>

        <div>
          <Label htmlFor="status">Status</Label>
          <Select value={form.status} onValueChange={(value) => setForm(prev => ({ ...prev, status: value }))}>
            <SelectTrigger>
              <SelectValue placeholder="Select Status" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="UNREAD">Unread</SelectItem>
              <SelectItem value="READ">Read</SelectItem>
              <SelectItem value="ARCHIVED">Archived</SelectItem>
            </SelectContent>
          </Select>
        </div>

        <div className="md:col-span-2">
          <Label htmlFor="content">Content *</Label>
          <Textarea
            id="content"
            value={form.content}
            onChange={(e) => setForm(prev => ({ ...prev, content: e.target.value }))}
            placeholder="Enter memo content"
            rows={6}
            required
          />
        </div>
      </div>

      <div className="flex justify-end gap-2">
        <Button type="button" variant="outline" onClick={onCancel}>
          Cancel
        </Button>
        <Button type="submit" disabled={updateMutation.isPending}>
          {updateMutation.isPending ? "Updating..." : "Update Memo"}
        </Button>
      </div>
    </form>
  )
}
