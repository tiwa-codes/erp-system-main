"use client"

import { useState } from "react"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Separator } from "@/components/ui/separator"
import { 
  User, 
  Mail, 
  Phone, 
  MapPin, 
  Building, 
  Calendar, 
  DollarSign,
  FileText,
  Download,
  Eye
} from "lucide-react"

interface ViewEmployeeProps {
  employee: any
  onClose: () => void
}

export function ViewEmployee({ employee, onClose }: ViewEmployeeProps) {
  const [activeTab, setActiveTab] = useState("personal")

  const getStatusColor = (status: string) => {
    switch (status) {
      case "ACTIVE":
        return "bg-green-100 text-green-800"
      case "INACTIVE":
        return "bg-yellow-100 text-yellow-800"
      case "TERMINATED":
        return "bg-red-100 text-red-800"
      default:
        return "bg-gray-100 text-gray-800"
    }
  }

  const getEmploymentTypeColor = (type: string) => {
    switch (type) {
      case "FULL_TIME":
        return "bg-blue-100 text-blue-800"
      case "PART_TIME":
        return "bg-purple-100 text-purple-800"
      case "CONTRACT":
        return "bg-orange-100 text-orange-800"
      case "INTERN":
        return "bg-pink-100 text-pink-800"
      default:
        return "bg-gray-100 text-gray-800"
    }
  }

  const formatDate = (dateString: string) => {
    if (!dateString) return "N/A"
    return new Date(dateString).toLocaleDateString()
  }

  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat("en-NG", {
      style: "currency",
      currency: "NGN",
    }).format(amount)
  }

  const normalizeDocuments = (uploadedFileUrls: any) => {
    if (!uploadedFileUrls) return []
    if (Array.isArray(uploadedFileUrls)) {
      return uploadedFileUrls.map((url: string, index: number) => ({
        label: `Document ${index + 1}`,
        url
      }))
    }

    const sections = [
      { label: "Resume", urls: uploadedFileUrls.resume || [] },
      { label: "Certificates", urls: uploadedFileUrls.certificates || [] },
      { label: "Others", urls: uploadedFileUrls.others || [] },
    ]

    return sections.flatMap(section =>
      (section.urls as string[]).map((url, index) => ({
        label: section.urls.length > 1 ? `${section.label} ${index + 1}` : section.label,
        url
      }))
    )
  }

  const documents = normalizeDocuments(employee?.uploadedFileUrls)

  return (
    <div className="max-h-[90vh] overflow-y-auto">
      <div className="p-6">
        {/* Header */}
        <div className="flex items-center justify-between mb-6">
          <div className="flex items-center space-x-4">
            <div className="h-16 w-16 rounded-full bg-emerald-100 flex items-center justify-center">
              <User className="h-8 w-8 text-blue-600" />
            </div>
            <div>
              <h2 className="text-2xl font-bold">
                {employee?.first_name} {employee?.last_name}
              </h2>
              <p className="text-gray-600">{employee?.position}</p>
              <div className="flex items-center space-x-2 mt-1">
                <Badge className={getStatusColor(employee?.status)}>
                  {employee?.status}
                </Badge>
                <Badge className={getEmploymentTypeColor(employee?.employment_type)}>
                  {employee?.employment_type?.replace("_", " ")}
                </Badge>
              </div>
            </div>
          </div>
          <Button variant="outline" onClick={onClose}>
            Close
          </Button>
        </div>

        {/* Tabs */}
        <div className="flex space-x-1 mb-6">
          {[
            { id: "personal", label: "Personal Info" },
            { id: "employment", label: "Employment" },
            { id: "contact", label: "Contact & Emergency" },
            { id: "documents", label: "Documents" },
          ].map((tab) => (
            <Button
              key={tab.id}
              variant={activeTab === tab.id ? "default" : "outline"}
              onClick={() => setActiveTab(tab.id)}
              className="flex-1"
            >
              {tab.label}
            </Button>
          ))}
        </div>

        {/* Personal Information Tab */}
        {activeTab === "personal" && (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center">
                  <User className="h-5 w-5 mr-2" />
                  Basic Information
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div>
                  <label className="text-sm font-medium text-gray-500">Employee ID</label>
                  <p className="text-lg">{employee?.employee_id}</p>
                </div>
                <div>
                  <label className="text-sm font-medium text-gray-500">Full Name</label>
                  <p className="text-lg">{employee?.first_name} {employee?.last_name}</p>
                </div>
                <div>
                  <label className="text-sm font-medium text-gray-500">Email</label>
                  <p className="text-lg flex items-center">
                    <Mail className="h-4 w-4 mr-2" />
                    {employee?.email}
                  </p>
                </div>
                <div>
                  <label className="text-sm font-medium text-gray-500">Phone</label>
                  <p className="text-lg flex items-center">
                    <Phone className="h-4 w-4 mr-2" />
                    {employee?.phone_number || employee?.phone}
                  </p>
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle className="flex items-center">
                  <MapPin className="h-5 w-5 mr-2" />
                  Address Information
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div>
                  <label className="text-sm font-medium text-gray-500">Address</label>
                  <p className="text-lg">{employee?.address}</p>
                </div>
                <div>
                  <label className="text-sm font-medium text-gray-500">City</label>
                  <p className="text-lg">{employee?.city}</p>
                </div>
                <div>
                  <label className="text-sm font-medium text-gray-500">State</label>
                  <p className="text-lg">{employee?.state}</p>
                </div>
                <div>
                  <label className="text-sm font-medium text-gray-500">ZIP Code</label>
                  <p className="text-lg">{employee?.zip_code}</p>
                </div>
              </CardContent>
            </Card>
          </div>
        )}

        {/* Employment Information Tab */}
        {activeTab === "employment" && (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center">
                  <Building className="h-5 w-5 mr-2" />
                  Employment Details
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div>
                  <label className="text-sm font-medium text-gray-500">Department</label>
                  <p className="text-lg">{employee?.department?.name || "N/A"}</p>
                </div>
                <div>
                  <label className="text-sm font-medium text-gray-500">Position</label>
                  <p className="text-lg">{employee?.position}</p>
                </div>
                <div>
                  <label className="text-sm font-medium text-gray-500">Employment Type</label>
                  <p className="text-lg">{employee?.employment_type?.replace("_", " ")}</p>
                </div>
                <div>
                  <label className="text-sm font-medium text-gray-500">Status</label>
                  <p className="text-lg">{employee?.status}</p>
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle className="flex items-center">
                  <Calendar className="h-5 w-5 mr-2" />
                  Dates & Compensation
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div>
                  <label className="text-sm font-medium text-gray-500">Hire Date</label>
                  <p className="text-lg">{formatDate(employee?.hire_date)}</p>
                </div>
                <div>
                  <label className="text-sm font-medium text-gray-500">Salary</label>
                  <p className="text-lg flex items-center">
                    <DollarSign className="h-4 w-4 mr-2" />
                    {formatCurrency(employee?.salary || 0)}
                  </p>
                </div>
                <div>
                  <label className="text-sm font-medium text-gray-500">Created At</label>
                  <p className="text-lg">{formatDate(employee?.created_at)}</p>
                </div>
                <div>
                  <label className="text-sm font-medium text-gray-500">Last Updated</label>
                  <p className="text-lg">{formatDate(employee?.updated_at)}</p>
                </div>
              </CardContent>
            </Card>
          </div>
        )}

        {/* Contact & Emergency Tab */}
        {activeTab === "contact" && (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center">
                  <Phone className="h-5 w-5 mr-2" />
                  Contact Information
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div>
                  <label className="text-sm font-medium text-gray-500">Email</label>
                  <p className="text-lg">{employee?.email}</p>
                </div>
                <div>
                  <label className="text-sm font-medium text-gray-500">Phone</label>
                  <p className="text-lg">{employee?.phone_number || employee?.phone}</p>
                </div>
                <div>
                  <label className="text-sm font-medium text-gray-500">Address</label>
                  <p className="text-lg">
                    {employee?.address}, {employee?.city}, {employee?.state} {employee?.zip_code}
                  </p>
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle className="flex items-center">
                  <User className="h-5 w-5 mr-2" />
                  Emergency Contact
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div>
                  <label className="text-sm font-medium text-gray-500">Emergency Contact Name</label>
                  <p className="text-lg">{employee?.emergency_contact_name || "N/A"}</p>
                </div>
                <div>
                  <label className="text-sm font-medium text-gray-500">Emergency Contact Phone</label>
                  <p className="text-lg">{employee?.emergency_contact_phone || "N/A"}</p>
                </div>
                <div>
                  <label className="text-sm font-medium text-gray-500">Relationship</label>
                  <p className="text-lg">{employee?.emergency_contact_relationship || "N/A"}</p>
                </div>
              </CardContent>
            </Card>

            {employee?.notes && (
              <Card className="md:col-span-2">
                <CardHeader>
                  <CardTitle className="flex items-center">
                    <FileText className="h-5 w-5 mr-2" />
                    Notes
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <p className="text-lg">{employee.notes}</p>
                </CardContent>
              </Card>
            )}
          </div>
        )}

        {/* Documents Tab */}
        {activeTab === "documents" && (
          <div className="space-y-6">
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center">
                  <FileText className="h-5 w-5 mr-2" />
                  Employee Documents
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  {documents.map((doc) => (
                    <div key={doc.url} className="flex items-center justify-between p-4 border rounded-lg">
                      <div className="flex items-center space-x-3">
                        <FileText className="h-8 w-8 text-blue-500" />
                        <div>
                          <p className="font-medium">{doc.label}</p>
                          <p className="text-sm text-gray-500">Document</p>
                        </div>
                      </div>
                      <div className="flex space-x-2">
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => window.open(doc.url, "_blank")}
                        >
                          <Eye className="h-4 w-4 mr-2" />
                          View
                        </Button>
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => {
                            const link = document.createElement("a")
                            link.href = doc.url
                            link.download = doc.label.replace(/\s+/g, "_").toLowerCase()
                            link.click()
                          }}
                        >
                          <Download className="h-4 w-4 mr-2" />
                          Download
                        </Button>
                      </div>
                    </div>
                  ))}

                  {documents.length === 0 && (
                    <div className="col-span-2 text-center py-8 text-gray-500">
                      <FileText className="h-12 w-12 mx-auto mb-4 text-gray-300" />
                      <p>No documents uploaded</p>
                    </div>
                  )}
                </div>
              </CardContent>
            </Card>
          </div>
        )}
      </div>
    </div>
  )
}
