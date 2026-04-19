"use client"

import { useState, useEffect } from "react"
import { useForm } from "react-hook-form"
import { zodResolver } from "@hookform/resolvers/zod"
import { z } from "zod"
import { useMutation, useQuery } from "@tanstack/react-query"
import { Button } from "@/components/ui/button"
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/components/ui/form"
import { Input } from "@/components/ui/input"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { Textarea } from "@/components/ui/textarea"
import { useToast } from "@/hooks/use-toast"
import { FileUpload } from "@/components/ui/file-upload"
import { ScrollArea } from "@/components/ui/scroll-area"

const editEmployeeSchema = z.object({
  employee_id: z.string().optional(),
  first_name: z.string().min(1, "First name is required"),
  last_name: z.string().min(1, "Last name is required"),
  email: z.string().email("Invalid email address"),
  phone: z.string().optional(),
  address: z.string().optional(),
  title: z.string().optional(),
  emergency_contact_name: z.string().optional(),
  emergency_contact_phone: z.string().optional(),
  emergency_contact_relationship: z.string().optional(),
  department_id: z.string().min(1, "Department is required"),
  position: z.string().optional(),
  hire_date: z.string().optional(),
  date_of_birth: z.string().optional(),
  salary: z.string().optional(),
  gender: z.string().optional(),
  employment_type: z.string().optional(),
  status: z.string().optional(),
  role: z.string().optional(),
})

type EditEmployeeFormData = z.infer<typeof editEmployeeSchema>

interface EditEmployeeFormProps {
  employee: any
  onSuccess: () => void
  onCancel: () => void
}

type UploadedDocument = {
  name: string
  url: string
}

type EmployeeDocuments = {
  resume: UploadedDocument[]
  certificates: UploadedDocument[]
  others: UploadedDocument[]
}

const normalizeDocumentUrls = (uploadedFileUrls: any): EmployeeDocuments => {
  if (!uploadedFileUrls) {
    return { resume: [], certificates: [], others: [] }
  }

  if (Array.isArray(uploadedFileUrls)) {
    return {
      resume: [],
      certificates: [],
      others: uploadedFileUrls.map((url: string) => ({
        name: url.split('/').pop() || 'Document',
        url
      }))
    }
  }

  const toDocs = (urls: any) => {
    if (!Array.isArray(urls)) return []
    return urls.map((url: string) => ({
      name: url.split('/').pop() || 'Document',
      url
    }))
  }

  return {
    resume: toDocs(uploadedFileUrls.resume),
    certificates: toDocs(uploadedFileUrls.certificates),
    others: toDocs(uploadedFileUrls.others)
  }
}

const buildUploadedFileUrls = (documents: EmployeeDocuments) => ({
  resume: documents.resume.map(doc => doc.url),
  certificates: documents.certificates.map(doc => doc.url),
  others: documents.others.map(doc => doc.url)
})

export function EditEmployeeForm({ employee, onSuccess, onCancel }: EditEmployeeFormProps) {
  const { toast } = useToast()
  const [documents, setDocuments] = useState<EmployeeDocuments>(() =>
    normalizeDocumentUrls(employee?.uploadedFileUrls)
  )

  const form = useForm<EditEmployeeFormData>({
    resolver: zodResolver(editEmployeeSchema),
    defaultValues: {
      employee_id: employee?.employee_id || "",
      first_name: employee?.first_name || "",
      last_name: employee?.last_name || "",
      email: employee?.email || "",
      phone: employee?.phone_number || employee?.phone || "",
      address: employee?.address || "",
      title: employee?.title || "",
      emergency_contact_name: employee?.emergency_contact_name || "",
      emergency_contact_phone: employee?.emergency_contact_phone || "",
      emergency_contact_relationship: employee?.emergency_contact_relationship || "",
      department_id: employee?.department_id || employee?.department?.id || "",
      position: employee?.position || "",
      hire_date: employee?.hire_date ? new Date(employee.hire_date).toISOString().split('T')[0] : "",
      date_of_birth: employee?.date_of_birth ? new Date(employee.date_of_birth).toISOString().split('T')[0] : "",
      salary: employee?.salary?.toString() || "",
      gender: employee?.gender || "",
      employment_type: employee?.employment_type || "",
      status: employee?.status || "",
      role: employee?.role || "",
    },
  })

  // Fetch departments for dropdown
  const { data: departments } = useQuery({
    queryKey: ["departments"],
    queryFn: async () => {
      const res = await fetch("/api/departments")
      if (!res.ok) throw new Error("Failed to fetch departments")
      return res.json()
    },
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

  const updateEmployeeMutation = useMutation({
    mutationFn: async (data: EditEmployeeFormData) => {
      const payload = {
        employee_id: data.employee_id,
        first_name: data.first_name,
        last_name: data.last_name,
        email: data.email,
        phone: data.phone,
        address: data.address,
        title: data.title,
        position: data.position,
        department_id: data.department_id,
        hire_date: data.hire_date,
        date_of_birth: data.date_of_birth,
        salary: data.salary ? parseFloat(data.salary) : undefined,
        gender: data.gender,
        employment_type: data.employment_type,
        status: data.status,
        role: data.role,
        uploadedFileUrls: buildUploadedFileUrls(documents),
      }

      const res = await fetch(`/api/hr/employees/${employee.id}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      })

      if (!res.ok) {
        const error = await res.json()
        throw new Error(error.message || "Failed to update employee")
      }

      return res.json()
    },
    onSuccess: (result) => {
      toast({
        title: "Success",
        description: result.message || "Employee updated successfully",
      })
      onSuccess()
    },
    onError: (error: any) => {
      toast({
        title: "Error",
        description: error.message || "Failed to update employee",
        variant: "destructive",
      })
    },
  })

  const onSubmit = (data: EditEmployeeFormData) => {
    updateEmployeeMutation.mutate(data)
  }

  const appendDocuments = (category: keyof EmployeeDocuments, files: UploadedDocument[]) => {
    setDocuments(prev => ({
      ...prev,
      [category]: [...prev[category], ...files]
    }))
  }

  const removeDocument = (category: keyof EmployeeDocuments, fileName: string) => {
    setDocuments(prev => ({
      ...prev,
      [category]: prev[category].filter(doc => doc.name !== fileName)
    }))
  }

  const handleDocumentUpload = (category: keyof EmployeeDocuments) => (results: any[], files: File[]) => {
    const uploadedDocs = results.map((result, index) => ({
      name: files[index]?.name || result.public_id || 'Document',
      url: result.secure_url
    }))
    appendDocuments(category, uploadedDocs)
  }

  return (
    <ScrollArea className="max-h-[90vh] overflow-y-auto">
      <div className="p-6">
        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6">
            {/* Personal Information */}
            <div className="space-y-4">
              <h3 className="text-lg font-semibold">Personal Information</h3>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <FormField
                  control={form.control}
                  name="title"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Title</FormLabel>
                      <Select onValueChange={field.onChange} defaultValue={field.value}>
                        <FormControl>
                          <SelectTrigger>
                            <SelectValue placeholder="Select Title" />
                          </SelectTrigger>
                        </FormControl>
                        <SelectContent>
                          <SelectItem value="Mr">Mr</SelectItem>
                          <SelectItem value="Mrs">Mrs</SelectItem>
                          <SelectItem value="Miss">Miss</SelectItem>
                          <SelectItem value="Dr">Dr</SelectItem>
                          <SelectItem value="Prof">Prof</SelectItem>
                        </SelectContent>
                      </Select>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                <FormField
                  control={form.control}
                  name="first_name"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>First Name *</FormLabel>
                      <FormControl>
                        <Input {...field} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                <FormField
                  control={form.control}
                  name="last_name"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Last Name *</FormLabel>
                      <FormControl>
                        <Input {...field} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                <FormField
                  control={form.control}
                  name="date_of_birth"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Date of Birth</FormLabel>
                      <FormControl>
                        <Input type="date" {...field} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                <FormField
                  control={form.control}
                  name="gender"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Gender</FormLabel>
                      <Select onValueChange={field.onChange} defaultValue={field.value}>
                        <FormControl>
                          <SelectTrigger>
                            <SelectValue placeholder="Select Gender" />
                          </SelectTrigger>
                        </FormControl>
                        <SelectContent>
                          <SelectItem value="MALE">Male</SelectItem>
                          <SelectItem value="FEMALE">Female</SelectItem>
                          <SelectItem value="OTHER">Other</SelectItem>
                        </SelectContent>
                      </Select>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                <FormField
                  control={form.control}
                  name="employee_id"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>ID</FormLabel>
                      <FormControl>
                        <Input {...field} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              </div>
            </div>

            {/* Contact Information */}
            <div className="space-y-4">
              <h3 className="text-lg font-semibold">Contact Information</h3>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <FormField
                  control={form.control}
                  name="phone"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Phone Number</FormLabel>
                      <FormControl>
                        <Input {...field} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                <FormField
                  control={form.control}
                  name="email"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Email Address *</FormLabel>
                      <FormControl>
                        <Input type="email" {...field} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                <div className="col-span-2">
                  <FormField
                    control={form.control}
                    name="address"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Address</FormLabel>
                        <FormControl>
                          <Textarea {...field} rows={3} />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                </div>
                <FormField
                  control={form.control}
                  name="emergency_contact_name"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Emergency Contact Name</FormLabel>
                      <FormControl>
                        <Input {...field} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                <FormField
                  control={form.control}
                  name="emergency_contact_phone"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Emergency Contact Phone</FormLabel>
                      <FormControl>
                        <Input {...field} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                <FormField
                  control={form.control}
                  name="emergency_contact_relationship"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Relationship</FormLabel>
                      <FormControl>
                        <Input {...field} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              </div>
            </div>

            {/* Employment Details */}
            <div className="space-y-4">
              <h3 className="text-lg font-semibold">Employment Details</h3>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <FormField
                  control={form.control}
                  name="employment_type"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Employee type</FormLabel>
                      <Select onValueChange={field.onChange} defaultValue={field.value}>
                        <FormControl>
                          <SelectTrigger>
                            <SelectValue placeholder="Select Type" />
                          </SelectTrigger>
                        </FormControl>
                        <SelectContent>
                          <SelectItem value="FULL_TIME">Full Time</SelectItem>
                          <SelectItem value="PART_TIME">Part Time</SelectItem>
                          <SelectItem value="CONTRACT">Contract</SelectItem>
                          <SelectItem value="INTERN">Intern</SelectItem>
                        </SelectContent>
                      </Select>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                <FormField
                  control={form.control}
                  name="department_id"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Department *</FormLabel>
                      <Select onValueChange={field.onChange} defaultValue={field.value}>
                        <FormControl>
                          <SelectTrigger>
                            <SelectValue placeholder="Select Department" />
                          </SelectTrigger>
                        </FormControl>
                        <SelectContent>
                          {departments?.map((dept: any) => (
                            <SelectItem key={dept.id} value={dept.id}>
                              {dept.name}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                <FormField
                  control={form.control}
                  name="role"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Role *</FormLabel>
                      <Select onValueChange={field.onChange} defaultValue={field.value}>
                        <FormControl>
                          <SelectTrigger>
                            <SelectValue placeholder="Select Role" />
                          </SelectTrigger>
                        </FormControl>
                        <SelectContent>
                          {rolesData.map((role: any) => (
                            <SelectItem key={role.id} value={role.name}>
                              {role.name.replace(/_/g, ' ').replace(/\b\w/g, (l: string) => l.toUpperCase())}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                <FormField
                  control={form.control}
                  name="hire_date"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Joining Date</FormLabel>
                      <FormControl>
                        <Input type="date" {...field} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                <FormField
                  control={form.control}
                  name="salary"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Basic Salary</FormLabel>
                      <FormControl>
                        <Input type="number" {...field} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              </div>
            </div>

            {/* Documents Section */}
            <div className="space-y-3">
              <h3 className="text-sm font-medium text-blue-600">Documents</h3>
              <div className="grid grid-cols-1 gap-3">
                <div>
                  <FormLabel className="text-xs">Resume *</FormLabel>
                  <FileUpload
                    onUpload={() => {}}
                    onUploaded={handleDocumentUpload("resume")}
                    onRemove={(file) => removeDocument("resume", file.name)}
                    autoUpload
                    acceptedTypes={['application/pdf', 'application/msword', 'application/vnd.openxmlformats-officedocument.wordprocessingml.document']}
                    maxFiles={3}
                    maxSize={10 * 1024 * 1024} // 10MB
                    folder="employees"
                    resourceType="auto"
                  />
                </div>
                <div>
                  <FormLabel className="text-xs">Professional Certificate</FormLabel>
                  <FileUpload
                    onUpload={() => {}}
                    onUploaded={handleDocumentUpload("certificates")}
                    onRemove={(file) => removeDocument("certificates", file.name)}
                    autoUpload
                    acceptedTypes={['application/pdf', 'image/*']}
                    maxFiles={2}
                    maxSize={5 * 1024 * 1024} // 5MB
                    folder="employees"
                    resourceType="auto"
                  />
                </div>
                <div>
                  <FormLabel className="text-xs">Others</FormLabel>
                  <FileUpload
                    onUpload={() => {}}
                    onUploaded={handleDocumentUpload("others")}
                    onRemove={(file) => removeDocument("others", file.name)}
                    autoUpload
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
              <Button type="button" variant="outline" onClick={onCancel}>
                Cancel
              </Button>
              <Button 
                type="submit" 
                disabled={updateEmployeeMutation.isPending}
                className="bg-[#BE1522] hover:bg-[#9B1219] text-white"
              >
                {updateEmployeeMutation.isPending ? "Updating..." : "Save"}
              </Button>
            </div>
          </form>
        </Form>
      </div>
    </ScrollArea>
  )
}
