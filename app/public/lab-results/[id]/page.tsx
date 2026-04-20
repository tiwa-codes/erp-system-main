"use client"

import { useState, useEffect } from "react"
import { useParams } from "next/navigation"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"
import { Badge } from "@/components/ui/badge"
import { 

export const dynamic = 'force-dynamic'
  User, 
  Phone, 
  Mail, 
  Calendar, 
  FileText, 
  Upload, 
  CheckCircle, 
  Clock,
  TestTube,
  Building2
} from "lucide-react"

interface LabOrderDetails {
  id: string
  test_name: string
  amount: number
  status: string
  created_at: string
  notes?: string
  results?: string
  appointment: {
    enrollee: {
      id: string
      enrollee_id: string
      first_name: string
      last_name: string
      phone_number: string
      email: string
      date_of_birth: string
      gender: string
    }
  }
  facility: {
    id: string
    facility_name: string
    email: string
    phone_number: string
  }
}

export default function PublicLabResultsPage() {
  const params = useParams()
  const orderId = params.id as string
  
  const [orderDetails, setOrderDetails] = useState<LabOrderDetails | null>(null)
  const [loading, setLoading] = useState(true)
  const [results, setResults] = useState("")
  const [notes, setNotes] = useState("")
  const [uploadedFiles, setUploadedFiles] = useState<FileList | null>(null)
  const [submitting, setSubmitting] = useState(false)
  const [submitted, setSubmitted] = useState(false)

  useEffect(() => {
    fetchOrderDetails()
  }, [orderId])

  const fetchOrderDetails = async () => {
    try {
      setLoading(true)
      const response = await fetch(`/api/public/lab-results/${orderId}`)
      
      if (!response.ok) {
        throw new Error(`Failed to fetch lab order details: ${response.status}`)
      }
      
      const data = await response.json()
      setOrderDetails(data.order)
      
      // Pre-fill existing data if available
      if (data.order.results) {
        setResults(data.order.results)
      }
      if (data.order.notes) {
        setNotes(data.order.notes)
      }
      
    } catch (error) {
      console.error('Error fetching lab order details:', error)
    } finally {
      setLoading(false)
    }
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    
    if (!results.trim()) {
      alert('Please provide test results before submitting')
      return
    }
    
    setSubmitting(true)
    
    try {
      const formData = new FormData()
      formData.append('results', results)
      formData.append('notes', notes)
      
      // Add files if uploaded
      if (uploadedFiles) {
        for (let i = 0; i < uploadedFiles.length; i++) {
          formData.append('files', uploadedFiles[i])
        }
      }
      
      const response = await fetch(`/api/public/lab-results/${orderId}/submit`, {
        method: 'POST',
        body: formData
      })
      
      if (!response.ok) {
        throw new Error('Failed to submit results')
      }
      
      setSubmitted(true)
      
    } catch (error) {
      console.error('Error submitting results:', error)
      alert('Failed to submit results. Please try again.')
    } finally {
      setSubmitting(false)
    }
  }

  const getStatusColor = (status: string) => {
    switch (status?.toUpperCase()) {
      case 'PENDING':
        return 'bg-yellow-100 text-yellow-800'
      case 'COMPLETED':
        return 'bg-green-100 text-green-800'
      case 'IN_PROGRESS':
        return 'bg-blue-100 text-blue-800'
      default:
        return 'bg-gray-100 text-gray-800'
    }
  }

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600 mx-auto mb-4"></div>
          <p className="text-gray-600">Loading lab order details...</p>
        </div>
      </div>
    )
  }

  if (!orderDetails) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <Card className="w-full max-w-md">
          <CardContent className="p-6 text-center">
            <TestTube className="h-12 w-12 text-gray-400 mx-auto mb-4" />
            <h2 className="text-xl font-semibold text-gray-900 mb-2">Lab Order Not Found</h2>
            <p className="text-gray-600">The requested lab order could not be found or may have expired.</p>
          </CardContent>
        </Card>
      </div>
    )
  }

  if (submitted) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <Card className="w-full max-w-md">
          <CardContent className="p-6 text-center">
            <CheckCircle className="h-12 w-12 text-green-600 mx-auto mb-4" />
            <h2 className="text-xl font-semibold text-gray-900 mb-2">Lab Results Submitted Successfully</h2>
            <p className="text-gray-600 mb-4">Thank you for submitting the lab results. The healthcare provider has been notified.</p>
            <Badge className="bg-green-100 text-green-800">
              Lab Order Completed
            </Badge>
          </CardContent>
        </Card>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-gray-50 p-4">
      <div className="max-w-4xl mx-auto space-y-6">
        {/* Header */}
        <Card>
          <CardHeader>
            <div className="flex items-center gap-3">
              <TestTube className="h-6 w-6 text-blue-600" />
              <div>
                <CardTitle className="text-2xl">Lab Results Portal</CardTitle>
                <CardDescription>Submit laboratory test results for patient</CardDescription>
              </div>
            </div>
          </CardHeader>
        </Card>

        {/* Lab Order Details */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <TestTube className="h-5 w-5" />
              Lab Order Details
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
              <div>
                <Label className="text-sm font-medium text-gray-500">Order ID</Label>
                <p className="font-mono text-sm">{orderDetails.id}</p>
              </div>
              <div>
                <Label className="text-sm font-medium text-gray-500">Test Name</Label>
                <p className="font-medium">{orderDetails.test_name}</p>
              </div>
              <div>
                <Label className="text-sm font-medium text-gray-500">Status</Label>
                <Badge className={getStatusColor(orderDetails.status)}>
                  {orderDetails.status}
                </Badge>
              </div>
              <div>
                <Label className="text-sm font-medium text-gray-500">Amount</Label>
                <p className="font-medium">₦{orderDetails.amount?.toLocaleString() || 'N/A'}</p>
              </div>
            </div>
            
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <Label className="text-sm font-medium text-gray-500">Order Date</Label>
                <p className="text-sm">{new Date(orderDetails.created_at).toLocaleDateString('en-GB')}</p>
              </div>
              <div>
                <Label className="text-sm font-medium text-gray-500">Lab Facility</Label>
                <p className="text-sm font-medium">{orderDetails.facility?.facility_name || 'N/A'}</p>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Patient Information */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <User className="h-5 w-5" />
              Patient Information
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <Label className="text-sm font-medium text-gray-500">Patient Name</Label>
                <p className="font-medium">{orderDetails.appointment.enrollee.first_name} {orderDetails.appointment.enrollee.last_name}</p>
              </div>
              <div>
                <Label className="text-sm font-medium text-gray-500">Patient ID</Label>
                <p className="font-mono text-sm">{orderDetails.appointment.enrollee.enrollee_id}</p>
              </div>
              <div className="flex items-center gap-2">
                <Phone className="h-4 w-4 text-gray-500" />
                <div>
                  <Label className="text-sm font-medium text-gray-500">Phone</Label>
                  <p className="text-sm">{orderDetails.appointment.enrollee.phone_number}</p>
                </div>
              </div>
              <div className="flex items-center gap-2">
                <Mail className="h-4 w-4 text-gray-500" />
                <div>
                  <Label className="text-sm font-medium text-gray-500">Email</Label>
                  <p className="text-sm">{orderDetails.appointment.enrollee.email}</p>
                </div>
              </div>
              <div className="flex items-center gap-2">
                <Calendar className="h-4 w-4 text-gray-500" />
                <div>
                  <Label className="text-sm font-medium text-gray-500">Date of Birth</Label>
                  <p className="text-sm">{new Date(orderDetails.appointment.enrollee.date_of_birth).toLocaleDateString('en-GB')}</p>
                </div>
              </div>
              <div>
                <Label className="text-sm font-medium text-gray-500">Gender</Label>
                <p className="text-sm">{orderDetails.appointment.enrollee.gender}</p>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Results Submission Form */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Upload className="h-5 w-5" />
              Submit Lab Results
            </CardTitle>
            <CardDescription>
              Please provide the laboratory test results and any additional notes
            </CardDescription>
          </CardHeader>
          <CardContent>
            <form onSubmit={handleSubmit} className="space-y-4">
              <div>
                <Label htmlFor="results">Lab Results *</Label>
                <Textarea
                  id="results"
                  value={results}
                  onChange={(e) => setResults(e.target.value)}
                  placeholder="Enter laboratory test results, values, findings, or report details..."
                  rows={6}
                  required
                />
              </div>
              
              <div>
                <Label htmlFor="notes">Additional Notes (Optional)</Label>
                <Textarea
                  id="notes"
                  value={notes}
                  onChange={(e) => setNotes(e.target.value)}
                  placeholder="Any additional notes, observations, or recommendations..."
                  rows={3}
                />
              </div>
              
              <div>
                <Label htmlFor="files">Attach Files (Optional)</Label>
                <Input
                  id="files"
                  type="file"
                  multiple
                  accept=".pdf,.jpg,.jpeg,.png,.doc,.docx"
                  onChange={(e) => setUploadedFiles(e.target.files)}
                />
                <p className="text-xs text-gray-500 mt-1">
                  Accepted formats: PDF, JPG, PNG, DOC, DOCX (Max 10MB per file)
                </p>
              </div>
              
              <Button 
                type="submit" 
                className="w-full" 
                disabled={submitting || !results.trim()}
              >
                {submitting ? (
                  <>
                    <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white mr-2"></div>
                    Submitting...
                  </>
                ) : (
                  <>
                    <CheckCircle className="h-4 w-4 mr-2" />
                    Submit Lab Results
                  </>
                )}
              </Button>
            </form>
          </CardContent>
        </Card>
      </div>
    </div>
  )
}
