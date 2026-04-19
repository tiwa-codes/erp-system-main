"use client"

import { useState, useEffect } from "react"
import { useParams } from "next/navigation"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { 
  Scan, 
  User, 
  Building2, 
  Calendar, 
  Phone, 
  FileText, 
  Download,
  Upload,
  CheckCircle,
  Clock,
  AlertCircle
} from "lucide-react"
import { toast } from "sonner"

interface RadiologyOrder {
  id: string
  test_name: string
  status: string
  results?: string
  notes?: string
  amount: number
  created_at: string
  completed_at?: string
  appointment: {
    enrollee: {
      first_name: string
      last_name: string
      enrollee_id: string
      phone_number?: string
    }
  }
  facility: {
    facility_name: string
  }
}

export default function PublicRadiologyResultsPage() {
  const params = useParams()
  const orderId = params.id as string
  const [radiologyOrder, setRadiologyOrder] = useState<RadiologyOrder | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [submitting, setSubmitting] = useState(false)
  const [results, setResults] = useState("")
  const [notes, setNotes] = useState("")
  const [files, setFiles] = useState<FileList | null>(null)

  useEffect(() => {
    fetchRadiologyOrder()
  }, [orderId])

  const fetchRadiologyOrder = async () => {
    try {
      const response = await fetch(`/api/public/radiology-orders/${orderId}`)
      if (!response.ok) {
        throw new Error('Radiology order not found')
      }
      const data = await response.json()
      setRadiologyOrder(data.radiologyOrder)
      setResults(data.radiologyOrder.results || "")
      setNotes(data.radiologyOrder.notes || "")
    } catch (error) {
      console.error('Error fetching radiology order:', error)
      setError(error instanceof Error ? error.message : 'Failed to fetch radiology order')
    } finally {
      setLoading(false)
    }
  }

  const handleSubmitResults = async () => {
    if (!results.trim()) {
      toast.error("Please enter radiology results")
      return
    }

    setSubmitting(true)
    try {
      const formData = new FormData()
      formData.append('results', results)
      formData.append('notes', notes)
      
      if (files) {
        for (let i = 0; i < files.length; i++) {
          formData.append('files', files[i])
        }
      }

      const response = await fetch(`/api/public/radiology-orders/${orderId}/submit-results`, {
        method: 'POST',
        body: formData
      })

      if (!response.ok) {
        throw new Error('Failed to submit results')
      }

      toast.success("Results submitted successfully")
      fetchRadiologyOrder() // Refresh data
    } catch (error) {
      console.error('Error submitting results:', error)
      toast.error("Failed to submit results")
    } finally {
      setSubmitting(false)
    }
  }

  const getStatusBadgeColor = (status: string) => {
    switch (status) {
      case 'PENDING':
        return 'bg-yellow-100 text-yellow-800'
      case 'COMPLETED':
        return 'bg-green-100 text-green-800'
      case 'REJECTED':
        return 'bg-red-100 text-red-800'
      default:
        return 'bg-gray-100 text-gray-800'
    }
  }

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-green-600 mx-auto mb-4"></div>
          <p className="text-gray-600">Loading radiology order...</p>
        </div>
      </div>
    )
  }

  if (error || !radiologyOrder) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <Card className="w-full max-w-md">
          <CardContent className="p-6 text-center">
            <AlertCircle className="h-12 w-12 text-red-500 mx-auto mb-4" />
            <h2 className="text-xl font-semibold text-red-600 mb-2">Radiology Order Not Found</h2>
            <p className="text-gray-600 mb-4">
              {error || "The radiology order you're looking for doesn't exist or has been removed."}
            </p>
            <Button onClick={() => window.location.reload()}>
              Try Again
            </Button>
          </CardContent>
        </Card>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-gray-50 py-8">
      <div className="max-w-4xl mx-auto px-4">
        {/* Header */}
        <div className="text-center mb-8">
          <div className="flex items-center justify-center gap-3 mb-4">
            <Scan className="h-8 w-8 text-green-600" />
            <h1 className="text-3xl font-bold text-gray-900">Radiology Results</h1>
          </div>
          <p className="text-gray-600">Submit radiology results for imaging order</p>
        </div>

        {/* Radiology Order Information */}
        <Card className="mb-6">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Scan className="h-5 w-5 text-green-600" />
              Radiology Order Details
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              {/* Test Information */}
              <div className="space-y-4">
                <div>
                  <label className="text-sm font-medium text-gray-500">Test Name</label>
                  <p className="font-semibold">{radiologyOrder.test_name}</p>
                </div>
                <div>
                  <label className="text-sm font-medium text-gray-500">Status</label>
                  <div className="mt-1">
                    <Badge className={getStatusBadgeColor(radiologyOrder.status)}>
                      {radiologyOrder.status}
                    </Badge>
                  </div>
                </div>
                <div>
                  <label className="text-sm font-medium text-gray-500">Amount</label>
                  <p className="font-semibold">₦{(radiologyOrder.amount || 0).toLocaleString()}</p>
                </div>
                <div>
                  <label className="text-sm font-medium text-gray-500">Order Date</label>
                  <p className="text-sm">{new Date(radiologyOrder.created_at).toLocaleDateString('en-GB')}</p>
                </div>
              </div>

              {/* Patient Information */}
              <div className="space-y-4">
                <div>
                  <label className="text-sm font-medium text-gray-500">Patient Name</label>
                  <p className="font-semibold">
                    {radiologyOrder.appointment?.enrollee?.first_name || 'N/A'} {radiologyOrder.appointment?.enrollee?.last_name || 'N/A'}
                  </p>
                </div>
                <div>
                  <label className="text-sm font-medium text-gray-500">Patient ID</label>
                  <p className="font-mono text-sm">{radiologyOrder.appointment?.enrollee?.enrollee_id || 'N/A'}</p>
                </div>
                <div>
                  <label className="text-sm font-medium text-gray-500">Phone Number</label>
                  <p className="text-sm">{radiologyOrder.appointment?.enrollee?.phone_number || 'N/A'}</p>
                </div>
                <div>
                  <label className="text-sm font-medium text-gray-500">Facility</label>
                  <p className="font-semibold">{radiologyOrder.facility?.facility_name || 'N/A'}</p>
                </div>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Results Submission Form */}
        {radiologyOrder.status === 'PENDING' && (
          <Card className="mb-6">
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Upload className="h-5 w-5 text-green-600" />
                Submit Radiology Results
              </CardTitle>
              <CardDescription>
                Enter the radiology findings and upload any supporting images or reports
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-6">
              {/* Radiology Results */}
              <div>
                <label className="text-sm font-medium text-gray-700 mb-2 block">
                  Radiology Findings *
                </label>
                <textarea
                  value={results}
                  onChange={(e) => setResults(e.target.value)}
                  placeholder="Enter detailed radiology findings..."
                  className="w-full p-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-green-500 focus:border-green-500"
                  rows={6}
                  required
                />
              </div>

              {/* Additional Notes */}
              <div>
                <label className="text-sm font-medium text-gray-700 mb-2 block">
                  Additional Notes
                </label>
                <textarea
                  value={notes}
                  onChange={(e) => setNotes(e.target.value)}
                  placeholder="Any additional notes or recommendations..."
                  className="w-full p-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-green-500 focus:border-green-500"
                  rows={3}
                />
              </div>

              {/* File Upload */}
              <div>
                <label className="text-sm font-medium text-gray-700 mb-2 block">
                  Upload Images/Reports
                </label>
                <input
                  type="file"
                  multiple
                  accept=".pdf,.jpg,.jpeg,.png,.dcm,.dicom"
                  onChange={(e) => setFiles(e.target.files)}
                  className="w-full p-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-green-500 focus:border-green-500"
                />
                <p className="text-xs text-gray-500 mt-1">
                  Supported formats: PDF, JPG, PNG, DICOM (Max 10MB each)
                </p>
              </div>

              {/* Submit Button */}
              <div className="flex justify-end">
                <Button
                  onClick={handleSubmitResults}
                  disabled={submitting || !results.trim()}
                  className="bg-green-600 hover:bg-green-700"
                >
                  {submitting ? (
                    <>
                      <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white mr-2"></div>
                      Submitting...
                    </>
                  ) : (
                    <>
                      <CheckCircle className="h-4 w-4 mr-2" />
                      Submit Results
                    </>
                  )}
                </Button>
              </div>
            </CardContent>
          </Card>
        )}

        {/* Display Results if Completed */}
        {radiologyOrder.status === 'COMPLETED' && radiologyOrder.results && (
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <FileText className="h-5 w-5 text-green-600" />
                Radiology Results
              </CardTitle>
              <CardDescription>
                Results submitted on {radiologyOrder.completed_at ? new Date(radiologyOrder.completed_at).toLocaleDateString('en-GB') : 'N/A'}
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                <div>
                  <label className="text-sm font-medium text-gray-500">Findings</label>
                  <div className="mt-2 p-4 bg-gray-50 rounded-lg">
                    <p className="whitespace-pre-wrap">{radiologyOrder.results}</p>
                  </div>
                </div>
                {radiologyOrder.notes && (
                  <div>
                    <label className="text-sm font-medium text-gray-500">Notes</label>
                    <div className="mt-2 p-4 bg-green-50 rounded-lg">
                      <p className="whitespace-pre-wrap">{radiologyOrder.notes}</p>
                    </div>
                  </div>
                )}
              </div>
            </CardContent>
          </Card>
        )}

        {/* Footer */}
        <div className="text-center mt-8 text-gray-500 text-sm">
          <p>This is a secure portal for submitting radiology results.</p>
          <p>All data is encrypted and transmitted securely.</p>
        </div>
      </div>
    </div>
  )
}