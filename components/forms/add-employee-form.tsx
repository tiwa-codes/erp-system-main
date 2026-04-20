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
import { FileUpload } from "@/components/ui/file-upload"
import { useToast } from "@/hooks/use-toast"

interface AddEmployeeFormProps {
  onClose: () => void
  onCreated?: () => void
}

export function AddEmployeeForm({ onClose, onCreated }: AddEmployeeFormProps) {
  const { toast } = useToast()
  const [form, setForm] = useState({
    employeeId: "",
    firstName: "",
    lastName: "",
    email: "",
    phoneNumber: "",
    address: "",
    title: "",
    position: "",
    departmentId: "",
    hireDate: "",
    dateOfBirth: "",
    salary: "",
    gender: "",
    employmentType: "",
    role: "",
    emergencyContactName: "",
    emergencyContactPhone: "",
    emergencyContactRelationship: "",
    uploadedFiles: [] as File[]
  })

  // Fetch departments
  const { data: departments = [] } = useQuery({
    queryKey: ["departments"],
    queryFn: async () => {
      const res = await fetch("/api/departments")
      if (!res.ok) throw new Error("Failed to fetch departments")
      return res.json()
    }
  })

  // Fetch roles from roles management API
  const { data: rolesResponse } = useQuery({
    queryKey: ["roles"],
    queryFn: async () => {
      const res = await fetch("/api/users/roles")
      if (!res.ok) throw new Error("Failed to fetch roles")
      return res.json()
    }
  })

  const rolesData = rolesResponse?.roles || []

  const createMutation = useMutation({
    mutationFn: async () => {
      // First upload files if any
      let uploadedFileUrls: string[] = []
      if (form.uploadedFiles.length > 0) {
        const formData = new FormData()
        form.uploadedFiles.forEach(file => {
          formData.append('files', file)
        })
        formData.append('folder', 'employees')
        formData.append('resourceType', 'auto')

        const uploadRes = await fetch('/api/upload', {
          method: 'POST',
          body: formData
        })

        if (!uploadRes.ok) {
          throw new Error('Failed to upload files')
        }

        const uploadData = await uploadRes.json()
        uploadedFileUrls = (uploadData.data || []).map((file: any) => file.secure_url)
      }

      const payload = {
        employee_id: form.employeeId,
        first_name: form.firstName,
        last_name: form.lastName,
        email: form.email,
        phone: form.phoneNumber,
        address: form.address,
        title: form.title,
        emergency_contact_name: form.emergencyContactName,
        emergency_contact_phone: form.emergencyContactPhone,
        emergency_contact_relationship: form.emergencyContactRelationship,
        position: form.position,
        department_id: form.departmentId,
        hire_date: form.hireDate,
        date_of_birth: form.dateOfBirth,
        salary: form.salary ? parseFloat(form.salary) : null,
        gender: form.gender,
        employment_type: form.employmentType,
        status: "ACTIVE",
        role: form.role,
        uploadedFileUrls: uploadedFileUrls
      }

      const res = await fetch("/api/hr/employees", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload)
      })
      
      if (!res.ok) {
        const err = await res.json().catch(() => ({}))
        throw new Error(err.error || `Failed to create employee (${res.status})`)
      }
      
      return res.json()
    },
    onSuccess: (data) => {
      toast({ 
        title: "Employee created successfully",
        description: data.message || "Employee has been added to the system"
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

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    
    // Check for missing required fields and create specific error message
    const missingFields = []
    if (!form.firstName) missingFields.push("First Name")
    if (!form.lastName) missingFields.push("Last Name")
    if (!form.email) missingFields.push("Email")
    if (!form.position) missingFields.push("Position")
    if (!form.departmentId) missingFields.push("Department")
    if (!form.role) missingFields.push("Role")
    
    if (missingFields.length > 0) {
      toast({
        title: "Validation Error",
        description: `Please fill in the following required fields: ${missingFields.join(", ")}`,
        variant: "destructive"
      })
      return
    }

    createMutation.mutate()
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-6">
      {/* Personal Information */}
      <div className="space-y-4">
        <h3 className="text-lg font-medium">Personal Information</h3>
        <div className="grid grid-cols-2 gap-4">
          <div>
            <Label htmlFor="title">Title</Label>
            <Select value={form.title} onValueChange={(value) => setForm(prev => ({ ...prev, title: value }))}>
              <SelectTrigger>
                <SelectValue placeholder="Select Title" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="Mr">Mr</SelectItem>
                <SelectItem value="Mrs">Mrs</SelectItem>
                <SelectItem value="Miss">Miss</SelectItem>
                <SelectItem value="Dr">Dr</SelectItem>
                <SelectItem value="Prof">Prof</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div>
            <Label htmlFor="firstName">First Name *</Label>
            <Input
              id="firstName"
              value={form.firstName}
              onChange={(e) => setForm(prev => ({ ...prev, firstName: e.target.value }))}
              placeholder="Enter First name"
              required
            />
          </div>
          <div>
            <Label htmlFor="lastName">Last Name *</Label>
            <Input
              id="lastName"
              value={form.lastName}
              onChange={(e) => setForm(prev => ({ ...prev, lastName: e.target.value }))}
              placeholder="Enter Last name"
              required
            />
          </div>
          <div>
            <Label htmlFor="dateOfBirth">Date of Birth</Label>
            <Input
              id="dateOfBirth"
              type="date"
              value={form.dateOfBirth}
              onChange={(e) => setForm(prev => ({ ...prev, dateOfBirth: e.target.value }))}
            />
          </div>
          <div>
            <Label htmlFor="gender">Gender</Label>
            <Select value={form.gender} onValueChange={(value) => setForm(prev => ({ ...prev, gender: value }))}>
              <SelectTrigger>
                <SelectValue placeholder="Select Gender" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="MALE">Male</SelectItem>
                <SelectItem value="FEMALE">Female</SelectItem>
                <SelectItem value="OTHER">Other</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div>
            <Label htmlFor="employeeId">ID</Label>
            <Input
              id="employeeId"
              value={form.employeeId}
              onChange={(e) => setForm(prev => ({ ...prev, employeeId: e.target.value }))}
              placeholder="Enter ID"
            />
          </div>
        </div>
      </div>

      {/* Contact Information */}
      <div className="space-y-4">
        <h3 className="text-lg font-medium">Contact Information</h3>
        <div className="grid grid-cols-2 gap-4">
          <div>
            <Label htmlFor="phoneNumber">Phone Number</Label>
            <Input
              id="phoneNumber"
              value={form.phoneNumber}
              onChange={(e) => setForm(prev => ({ ...prev, phoneNumber: e.target.value }))}
              placeholder="Enter Phone number"
            />
          </div>
          <div>
            <Label htmlFor="email">Email Address *</Label>
            <Input
              id="email"
              type="email"
              value={form.email}
              onChange={(e) => setForm(prev => ({ ...prev, email: e.target.value }))}
              placeholder="Enter Address"
              required
            />
          </div>
          <div className="col-span-2">
            <Label htmlFor="address">Address</Label>
            <Textarea
              id="address"
              value={form.address}
              onChange={(e) => setForm(prev => ({ ...prev, address: e.target.value }))}
              placeholder="Enter contact address"
              rows={3}
            />
          </div>
          <div>
            <Label htmlFor="emergencyContactName">Emergency Contact Name</Label>
            <Input
              id="emergencyContactName"
              value={form.emergencyContactName}
              onChange={(e) => setForm(prev => ({ ...prev, emergencyContactName: e.target.value }))}
              placeholder="Enter emergency contact name"
            />
          </div>
          <div>
            <Label htmlFor="emergencyContactPhone">Emergency Contact Phone</Label>
            <Input
              id="emergencyContactPhone"
              value={form.emergencyContactPhone}
              onChange={(e) => setForm(prev => ({ ...prev, emergencyContactPhone: e.target.value }))}
              placeholder="Enter emergency contact phone"
            />
          </div>
          <div>
            <Label htmlFor="emergencyContactRelationship">Relationship</Label>
            <Input
              id="emergencyContactRelationship"
              value={form.emergencyContactRelationship}
              onChange={(e) => setForm(prev => ({ ...prev, emergencyContactRelationship: e.target.value }))}
              placeholder="Enter relationship"
            />
          </div>
        </div>
      </div>

      {/* Employment Details */}
      <div className="space-y-4">
        <h3 className="text-lg font-medium">Employment Details</h3>
        <div className="grid grid-cols-2 gap-4">
          <div>
            <Label htmlFor="employeeType">Employee type</Label>
            <Select value={form.employmentType} onValueChange={(value) => setForm(prev => ({ ...prev, employmentType: value }))}>
              <SelectTrigger>
                <SelectValue placeholder="Select Type" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="FULL_TIME">Full Time</SelectItem>
                <SelectItem value="PART_TIME">Part Time</SelectItem>
                <SelectItem value="CONTRACT">Contract</SelectItem>
                <SelectItem value="INTERN">Intern</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div>
            <Label htmlFor="department">Department *</Label>
            <Select value={form.departmentId} onValueChange={(value) => setForm(prev => ({ ...prev, departmentId: value }))}>
              <SelectTrigger>
                <SelectValue placeholder="Select Department" />
              </SelectTrigger>
              <SelectContent>
                {departments.map((dept: any) => (
                  <SelectItem key={dept.id} value={dept.id}>
                    {dept.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div>
            <Label htmlFor="position">Position *</Label>
            <Input
              id="position"
              value={form.position}
              onChange={(e) => setForm(prev => ({ ...prev, position: e.target.value }))}
              placeholder="Enter Position"
              required
            />
          </div>
          <div>
            <Label htmlFor="role">Role *</Label>
            <Select value={form.role} onValueChange={(value) => setForm(prev => ({ ...prev, role: value }))}>
              <SelectTrigger>
                <SelectValue placeholder="Select Role" />
              </SelectTrigger>
              <SelectContent>
                {rolesData.map((role: any) => (
                  <SelectItem key={role.id} value={role.name}>
                    {role.name.replace(/_/g, ' ').replace(/\b\w/g, (l: string) => l.toUpperCase())}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div>
            <Label htmlFor="joiningDate">Joining Date</Label>
            <Input
              id="joiningDate"
              type="date"
              value={form.hireDate}
              onChange={(e) => setForm(prev => ({ ...prev, hireDate: e.target.value }))}
            />
          </div>
          <div>
            <Label htmlFor="salary">Basic Salary</Label>
            <Input
              id="salary"
              type="number"
              value={form.salary}
              onChange={(e) => setForm(prev => ({ ...prev, salary: e.target.value }))}
              placeholder="Enter salary amount"
            />
          </div>
        </div>
      </div>

      {/* Documents Section */}
      <div className="space-y-3">
        <h3 className="text-sm font-medium text-blue-600">Documents</h3>
        <div className="grid grid-cols-1 gap-3">
          <div>
            <Label className="text-xs">Resume *</Label>
            <FileUpload
              onUpload={(files) => setForm(prev => ({ ...prev, uploadedFiles: files }))}
              onRemove={(file) => {
                setForm(prev => ({
                  ...prev,
                  uploadedFiles: prev.uploadedFiles.filter(f => f !== file)
                }))
              }}
              acceptedTypes={['application/pdf', 'application/msword', 'application/vnd.openxmlformats-officedocument.wordprocessingml.document']}
              maxFiles={3}
              maxSize={10 * 1024 * 1024} // 10MB
              folder="employees"
              resourceType="auto"
            />
          </div>
          <div>
            <Label className="text-xs">Professional Certificate</Label>
            <FileUpload
              onUpload={(files) => setForm(prev => ({ ...prev, uploadedFiles: [...prev.uploadedFiles, ...files] }))}
              onRemove={(file) => {
                setForm(prev => ({
                  ...prev,
                  uploadedFiles: prev.uploadedFiles.filter(f => f !== file)
                }))
              }}
              acceptedTypes={['application/pdf', 'image/*']}
              maxFiles={2}
              maxSize={5 * 1024 * 1024} // 5MB
              folder="employees"
              resourceType="auto"
            />
          </div>
          <div>
            <Label className="text-xs">Others</Label>
            <FileUpload
              onUpload={(files) => setForm(prev => ({ ...prev, uploadedFiles: [...prev.uploadedFiles, ...files] }))}
              onRemove={(file) => {
                setForm(prev => ({
                  ...prev,
                  uploadedFiles: prev.uploadedFiles.filter(f => f !== file)
                }))
              }}
              acceptedTypes={['application/pdf', 'image/*', 'application/msword']}
              maxFiles={2}
              maxSize={5 * 1024 * 1024} // 5MB
              folder="employees"
              resourceType="auto"
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
          {createMutation.isPending ? "Creating..." : "Save"}
        </Button>
      </div>
    </form>
  )
}
