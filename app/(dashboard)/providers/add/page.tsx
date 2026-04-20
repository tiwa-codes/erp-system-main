"use client"

export const dynamic = 'force-dynamic'

import { useState } from "react"
import { useRouter } from "next/navigation"
import { useMutation } from "@tanstack/react-query"
import { useToast } from "@/hooks/use-toast"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Textarea } from "@/components/ui/textarea"
import { Badge } from "@/components/ui/badge"
import { ArrowLeft, Building2, User, Loader2 } from "lucide-react"
import { PermissionGate } from "@/components/ui/permission-gate"



export default function ProviderPage() {
  const router = useRouter()
  const { toast } = useToast()
  
  const [accountType, setAccountType] = useState<"USER" | "PROVIDER" | "">("")
  const [formData, setFormData] = useState({
    // USER fields
    hospitalName: "",
    personInCharge: "",
    contactNumber: "",
    email: "",
    
    // PROVIDER fields
    facilityName: "",
    facilityType: "",
    address: "",
    phoneWhatsapp: "",
    medicalDirectorName: "",
    hmoCoordinatorName: "",
    hmoCoordinatorPhone: "",
    hmoCoordinatorEmail: "",
    yearOfIncorporation: "",
    facilityRegNumber: "",
    practice: "",
    proprietorPartners: "",
    hcpCode: "",
  })

  const createProviderMutation = useMutation({
    mutationFn: async (data: any) => {
      const res = await fetch("/api/providers", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify(data),
      })

      if (!res.ok) {
        const error = await res.json()
        throw new Error(error.error || "Failed to create provider")
      }

      return res.json()
    },
    onSuccess: () => {
      toast({
        title: "Provider created successfully",
        description: "The provider has been added to the system.",
      })
      router.push("/providers")
    },
    onError: (error: Error) => {
      toast({
        title: "Error",
        description: error.message,
        variant: "destructive",
      })
    },
  })

  const handleInputChange = (field: string, value: string) => {
    setFormData(prev => ({ ...prev, [field]: value }))
  }

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    
    // All fields are optional — no required-field validation
    const payload = {
      account_type: accountType,
      ...formData,
      status: "PENDING_APPROVAL"
    }

    createProviderMutation.mutate(payload)
  }

  return (
    <PermissionGate module="provider" action="create">
      <div className="space-y-6">
        {/* Header */}
        <div className="flex items-center gap-4">
          <Button
            variant="outline"
            onClick={() => router.push("/providers")}
          >
            <ArrowLeft className="h-4 w-4 mr-2" />
            Back
          </Button>
          <div>
            <h1 className="text-3xl font-bold">Add Provider</h1>
            <p className="text-muted-foreground">
              Create a new provider account
            </p>
          </div>
        </div>

        <form onSubmit={handleSubmit} className="space-y-6">
          {/* Account Type Selection */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Building2 className="h-5 w-5" />
                Account Type
              </CardTitle>
              <CardDescription>
                Select the type of provider account you want to create
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                <div className="space-y-2">
                  <Label htmlFor="account_type">Account Type</Label>
                  <Select
                    value={accountType}
                    onValueChange={(value: "USER" | "PROVIDER") => setAccountType(value)}
                  >
                    <SelectTrigger>
                      <SelectValue placeholder="Select account type" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="USER">
                        <div className="flex items-center gap-2">
                          <User className="h-4 w-4" />
                          <div>
                            <div className="font-medium">User</div>
                            <div className="text-xs text-gray-500">Hospital Name & Person in Charge</div>
                          </div>
                        </div>
                      </SelectItem>
                      <SelectItem value="PROVIDER">
                        <div className="flex items-center gap-2">
                          <Building2 className="h-4 w-4" />
                          <div>
                            <div className="font-medium">Provider</div>
                            <div className="text-xs text-gray-500">Full Provider Details</div>
                          </div>
                        </div>
                      </SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                
                {accountType && (
                  <div className="p-4 bg-blue-50 rounded-lg">
                    <div className="flex items-center gap-2 mb-2">
                      {accountType === "USER" ? (
                        <User className="h-5 w-5 text-blue-600" />
                      ) : (
                        <Building2 className="h-5 w-5 text-blue-600" />
                      )}
                      <Badge className="bg-blue-100 text-blue-800">
                        {accountType} Account
                      </Badge>
                    </div>
                    <p className="text-sm text-gray-600">
                      {accountType === "USER" 
                        ? "This account type is for users who need to specify hospital name and person in charge for requests."
                        : "This account type is for full provider registration with complete facility details."
                      }
                    </p>
                  </div>
                )}
              </div>
            </CardContent>
          </Card>

          {/* USER Form */}
          {accountType === "USER" && (
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <User className="h-5 w-5" />
                  User Information
                </CardTitle>
                <CardDescription>
                  Provide basic hospital and contact information
                </CardDescription>
              </CardHeader>
              <CardContent>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label htmlFor="hospitalName">Hospital Name</Label>
                    <Input
                      id="hospitalName"
                      value={formData.hospitalName}
                      onChange={(e) => handleInputChange("hospitalName", e.target.value)}
                      placeholder="Enter hospital name"
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="personInCharge">Person in Charge</Label>
                    <Input
                      id="personInCharge"
                      value={formData.personInCharge}
                      onChange={(e) => handleInputChange("personInCharge", e.target.value)}
                      placeholder="Enter person in charge name"
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="contactNumber">Contact Number</Label>
                    <Input
                      id="contactNumber"
                      value={formData.contactNumber}
                      onChange={(e) => handleInputChange("contactNumber", e.target.value)}
                      placeholder="+234..."
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="email">Email Address</Label>
                    <Input
                      id="email"
                      type="email"
                      value={formData.email}
                      onChange={(e) => handleInputChange("email", e.target.value)}
                      placeholder="email@example.com"
                    />
                  </div>
                </div>
              </CardContent>
            </Card>
          )}

          {/* PROVIDER Form */}
          {accountType === "PROVIDER" && (
            <>
              {/* Basic Information */}
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <Building2 className="h-5 w-5" />
                    Basic Information
                  </CardTitle>
                  <CardDescription>
                    Provide basic facility information
                  </CardDescription>
                </CardHeader>
                <CardContent>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div className="space-y-2">
                      <Label htmlFor="facilityName">Facility Name</Label>
                      <Input
                        id="facilityName"
                        value={formData.facilityName}
                        onChange={(e) => handleInputChange("facilityName", e.target.value)}
                        placeholder="Enter facility name"
                      />
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="facilityType">Facility Type</Label>
                      <Select
                        value={formData.facilityType}
                        onValueChange={(value) => handleInputChange("facilityType", value)}
                      >
                        <SelectTrigger>
                          <SelectValue placeholder="Select facility type" />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="HOSPITAL">Hospital</SelectItem>
                          <SelectItem value="CLINIC">Clinic</SelectItem>
                          <SelectItem value="PHARMACY">Pharmacy</SelectItem>
                          <SelectItem value="LABORATORY">Laboratory</SelectItem>
                          <SelectItem value="SPECIALIST">Specialist Center</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                    <div className="space-y-2 md:col-span-2">
                      <Label htmlFor="address">Address</Label>
                      <Textarea
                        id="address"
                        value={formData.address}
                        onChange={(e) => handleInputChange("address", e.target.value)}
                        placeholder="Enter complete address"
                        rows={3}
                      />
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="phoneWhatsapp">Phone/WhatsApp</Label>
                      <Input
                        id="phoneWhatsapp"
                        value={formData.phoneWhatsapp}
                        onChange={(e) => handleInputChange("phoneWhatsapp", e.target.value)}
                        placeholder="+234..."
                      />
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="email">Email Address</Label>
                      <Input
                        id="email"
                        type="email"
                        value={formData.email}
                        onChange={(e) => handleInputChange("email", e.target.value)}
                        placeholder="email@example.com"
                      />
                    </div>
                  </div>
                </CardContent>
              </Card>

              {/* Medical Personnel */}
              <Card>
                <CardHeader>
                  <CardTitle>Medical Personnel</CardTitle>
                  <CardDescription>
                    Provide information about key medical personnel
                  </CardDescription>
                </CardHeader>
                <CardContent>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div className="space-y-2">
                      <Label htmlFor="medicalDirectorName">Medical Director Name</Label>
                      <Input
                        id="medicalDirectorName"
                        value={formData.medicalDirectorName}
                        onChange={(e) => handleInputChange("medicalDirectorName", e.target.value)}
                        placeholder="Enter medical director name"
                      />
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="hmoCoordinatorName">HMO Coordinator Name</Label>
                      <Input
                        id="hmoCoordinatorName"
                        value={formData.hmoCoordinatorName}
                        onChange={(e) => handleInputChange("hmoCoordinatorName", e.target.value)}
                        placeholder="Enter HMO coordinator name"
                      />
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="hmoCoordinatorPhone">HMO Coordinator Phone</Label>
                      <Input
                        id="hmoCoordinatorPhone"
                        value={formData.hmoCoordinatorPhone}
                        onChange={(e) => handleInputChange("hmoCoordinatorPhone", e.target.value)}
                        placeholder="+234..."
                      />
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="hmoCoordinatorEmail">HMO Coordinator Email</Label>
                      <Input
                        id="hmoCoordinatorEmail"
                        type="email"
                        value={formData.hmoCoordinatorEmail}
                        onChange={(e) => handleInputChange("hmoCoordinatorEmail", e.target.value)}
                        placeholder="email@example.com"
                      />
                    </div>
                  </div>
                </CardContent>
              </Card>

              {/* Additional Information */}
              <Card>
                <CardHeader>
                  <CardTitle>Additional Information</CardTitle>
                  <CardDescription>
                    Provide additional facility details
                  </CardDescription>
                </CardHeader>
                <CardContent>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div className="space-y-2">
                      <Label htmlFor="yearOfIncorporation">Year of Incorporation</Label>
                      <Input
                        id="yearOfIncorporation"
                        value={formData.yearOfIncorporation}
                        onChange={(e) => handleInputChange("yearOfIncorporation", e.target.value)}
                        placeholder="YYYY"
                      />
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="facilityRegNumber">Facility Registration Number</Label>
                      <Input
                        id="facilityRegNumber"
                        value={formData.facilityRegNumber}
                        onChange={(e) => handleInputChange("facilityRegNumber", e.target.value)}
                        placeholder="Enter registration number"
                      />
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="practice">Practice Type</Label>
                      <Input
                        id="practice"
                        value={formData.practice}
                        onChange={(e) => handleInputChange("practice", e.target.value)}
                        placeholder="e.g., General Practice, Specialist"
                      />
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="proprietorPartners">Proprietor/Partners</Label>
                      <Input
                        id="proprietorPartners"
                        value={formData.proprietorPartners}
                        onChange={(e) => handleInputChange("proprietorPartners", e.target.value)}
                        placeholder="Enter proprietor/partners names"
                      />
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="hcpCode">HCP Code</Label>
                      <Input
                        id="hcpCode"
                        value={formData.hcpCode}
                        onChange={(e) => handleInputChange("hcpCode", e.target.value)}
                        placeholder="Enter HCP code"
                      />
                    </div>
                  </div>
                </CardContent>
              </Card>

            </>
          )}

          {/* Form Actions */}
          {accountType && (
            <div className="flex justify-end gap-4 pt-6">
              <Button 
                type="button" 
                variant="outline" 
                onClick={() => router.push("/providers")}
              >
                Cancel
              </Button>
              <Button 
                type="submit" 
                disabled={createProviderMutation.isPending}
                className="bg-[#0891B2] hover:bg-[#9B1219]"
              >
                {createProviderMutation.isPending && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
                Create {accountType} Account
              </Button>
            </div>
          )}
        </form>
      </div>
    </PermissionGate>
  )
}
