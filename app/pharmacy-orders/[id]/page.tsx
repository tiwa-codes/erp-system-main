"use client"

export const dynamic = 'force-dynamic'

import { useState, useEffect } from "react"
import { useParams } from "next/navigation"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { 
  Pill, 
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



interface PharmacyOrder {
  id: string
  medication: string
  dose: string | null
  quantity: number | null
  duration: string | null
  frequency: string | null
  status: string
  notes?: string
  amount?: number | null
  delivery_address?: string | null
  created_at: string
  completed_at?: string | null
  appointment: {
    enrollee: {
      first_name: string
      last_name: string
      enrollee_id: string
      phone_number?: string
      email?: string
      residential_address?: string
    }
  }
  facility: {
    facility_name: string
    email?: string
    phone_number?: string
  }
}

export default function PharmacyOrdersPage() {
  const params = useParams()
  const orderId = params.id as string
  const [pharmacyOrder, setPharmacyOrder] = useState<PharmacyOrder | null>(null)
  const [allOrders, setAllOrders] = useState<PharmacyOrder[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [submitting, setSubmitting] = useState(false)
  const [notes, setNotes] = useState("")
  const [files, setFiles] = useState<FileList | null>(null)

  useEffect(() => {
    fetchPharmacyOrder()
  }, [orderId])

  const fetchPharmacyOrder = async () => {
    try {
      const response = await fetch(`/api/pharmacy-orders/${orderId}`)
      if (!response.ok) {
        throw new Error('Pharmacy order not found')
      }
      const data = await response.json()
      setPharmacyOrder(data.pharmacyOrder)
      setAllOrders(data.allOrders || [data.pharmacyOrder])
      setNotes(data.pharmacyOrder.notes || "")
    } catch (error) {
      console.error('Error fetching pharmacy order:', error)
      setError(error instanceof Error ? error.message : 'Failed to fetch pharmacy order')
    } finally {
      setLoading(false)
    }
  }

  const handleSubmitResults = async () => {
    setSubmitting(true)
    try {
      const formData = new FormData()
      formData.append('notes', notes)
      
      if (files) {
        for (let i = 0; i < files.length; i++) {
          formData.append('files', files[i])
        }
      }

      const response = await fetch(`/api/pharmacy-orders/${orderId}/submit-results`, {
        method: 'POST',
        body: formData
      })

      if (!response.ok) {
        throw new Error('Failed to submit results')
      }

      const result = await response.json()
      const message = result.completedOrdersCount > 1
        ? `${result.completedOrdersCount} pharmacy orders completed successfully`
        : "Pharmacy order completed successfully"
      toast.success(message)
      fetchPharmacyOrder() // Refresh data
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
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-purple-600 mx-auto mb-4"></div>
          <p className="text-gray-600">Loading pharmacy order...</p>
        </div>
      </div>
    )
  }

  if (error || !pharmacyOrder) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <Card className="w-full max-w-md">
          <CardContent className="p-6 text-center">
            <AlertCircle className="h-12 w-12 text-red-500 mx-auto mb-4" />
            <h2 className="text-xl font-semibold text-red-600 mb-2">Pharmacy Order Not Found</h2>
            <p className="text-gray-600 mb-4">
              {error || "The pharmacy order you're looking for doesn't exist or has been removed."}
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
            <Pill className="h-8 w-8 text-purple-600" />
            <h1 className="text-3xl font-bold text-gray-900">Pharmacy Order</h1>
          </div>
          <p className="text-gray-600">Complete pharmacy order and submit delivery confirmation</p>
        </div>

        {/* Patient Information */}
        <Card className="mb-6">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <User className="h-5 w-5 text-purple-600" />
              Patient Information
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <div className="space-y-4">
                <div>
                  <label className="text-sm font-medium text-gray-500">Patient Name</label>
                  <p className="font-semibold">
                    {pharmacyOrder.appointment.enrollee.first_name} {pharmacyOrder.appointment.enrollee.last_name}
                  </p>
                </div>
                <div>
                  <label className="text-sm font-medium text-gray-500">Patient ID</label>
                  <p className="font-mono text-sm">{pharmacyOrder.appointment.enrollee.enrollee_id}</p>
                </div>
                <div>
                  <label className="text-sm font-medium text-gray-500">Phone Number</label>
                  <p className="text-sm">{pharmacyOrder.appointment.enrollee.phone_number || 'N/A'}</p>
                </div>
                <div>
                  <label className="text-sm font-medium text-gray-500">Email</label>
                  <p className="text-sm">{pharmacyOrder.appointment.enrollee.email || 'N/A'}</p>
                </div>
              </div>
              <div className="space-y-4">
                <div>
                  <label className="text-sm font-medium text-gray-500">Pharmacy</label>
                  <p className="font-semibold">{pharmacyOrder.facility.facility_name}</p>
                </div>
                <div>
                  <label className="text-sm font-medium text-gray-500">Delivery Address</label>
                  <p className="text-sm">
                    {pharmacyOrder.delivery_address || pharmacyOrder.appointment.enrollee.residential_address || 'N/A'}
                  </p>
                </div>
                <div>
                  <label className="text-sm font-medium text-gray-500">Order Date</label>
                  <p className="text-sm">{new Date(pharmacyOrder.created_at).toLocaleDateString('en-GB')}</p>
                </div>
                <div>
                  <label className="text-sm font-medium text-gray-500">Total Medications</label>
                  <p className="font-semibold text-purple-600">{allOrders.length} medication{allOrders.length > 1 ? 's' : ''}</p>
                </div>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* All Medications */}
        <Card className="mb-6">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Pill className="h-5 w-5 text-purple-600" />
              Medications ({allOrders.length})
            </CardTitle>
            <CardDescription>
              All medications for this prescription order
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              {allOrders.map((order, index) => (
                <div key={order.id} className="border rounded-lg p-4 bg-gray-50">
                  <div className="flex items-start justify-between mb-3">
                    <div className="flex-1">
                      <div className="flex items-center gap-2 mb-2">
                        <span className="text-sm font-medium text-gray-500">#{index + 1}</span>
                        <h3 className="font-semibold text-lg">{order.medication}</h3>
                        <Badge className={getStatusBadgeColor(order.status)}>
                          {order.status}
                        </Badge>
                      </div>
                      <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-sm">
                        <div>
                          <label className="text-xs font-medium text-gray-500">Dose</label>
                          <p className="font-medium">{order.dose || 'N/A'}</p>
                        </div>
                        <div>
                          <label className="text-xs font-medium text-gray-500">Quantity</label>
                          <p className="font-medium">{order.quantity || 'N/A'}</p>
                        </div>
                        <div>
                          <label className="text-xs font-medium text-gray-500">Duration</label>
                          <p className="font-medium">{order.duration || 'N/A'}</p>
                        </div>
                        <div>
                          <label className="text-xs font-medium text-gray-500">Frequency</label>
                          <p className="font-medium">{order.frequency || 'N/A'}</p>
                        </div>
                      </div>
                      {order.amount && (
                        <div className="mt-2">
                          <label className="text-xs font-medium text-gray-500">Amount</label>
                          <p className="font-semibold text-purple-600">₦{order.amount.toLocaleString()}</p>
                        </div>
                      )}
                    </div>
                  </div>
                </div>
              ))}
              <div className="border-t pt-4 mt-4">
                <div className="flex justify-between items-center">
                  <span className="font-semibold text-gray-700">Total Amount:</span>
                  <span className="font-bold text-lg text-purple-600">
                    ₦{allOrders.reduce((sum, order) => sum + (order.amount || 0), 0).toLocaleString()}
                  </span>
                </div>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Completion Form - Show if any order is pending */}
        {allOrders.some(order => order.status === 'PENDING') && (
          <Card className="mb-6">
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Upload className="h-5 w-5 text-purple-600" />
                Complete Pharmacy Order
              </CardTitle>
              <CardDescription>
                {allOrders.filter(o => o.status === 'PENDING').length > 1 
                  ? `Completing this order will mark all ${allOrders.filter(o => o.status === 'PENDING').length} pending orders as completed.`
                  : 'Confirm medication dispensed and upload any supporting documents'
                }
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-6">
              {/* Delivery Notes */}
              <div>
                <label className="text-sm font-medium text-gray-700 mb-2 block">
                  Delivery/Completion Notes
                </label>
                <textarea
                  value={notes}
                  onChange={(e) => setNotes(e.target.value)}
                  placeholder="Enter delivery confirmation, special instructions, or any notes..."
                  className="w-full p-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-purple-500"
                  rows={4}
                />
              </div>

              {/* File Upload */}
              <div>
                <label className="text-sm font-medium text-gray-700 mb-2 block">
                  Upload Supporting Documents
                </label>
                <input
                  type="file"
                  multiple
                  accept=".pdf,.jpg,.jpeg,.png"
                  onChange={(e) => setFiles(e.target.files)}
                  className="w-full p-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-purple-500"
                />
                <p className="text-xs text-gray-500 mt-1">
                  Supported formats: PDF, JPG, PNG (Max 5MB each)
                </p>
              </div>

              {/* Submit Button */}
              <div className="flex justify-end">
                <Button
                  onClick={handleSubmitResults}
                  disabled={submitting}
                  className="bg-purple-600 hover:bg-purple-700"
                >
                  {submitting ? (
                    <>
                      <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white mr-2"></div>
                      Completing...
                    </>
                  ) : (
                    <>
                      <CheckCircle className="h-4 w-4 mr-2" />
                      Complete Order
                    </>
                  )}
                </Button>
              </div>
            </CardContent>
          </Card>
        )}

        {/* Display Completion Details if All Completed */}
        {allOrders.every(order => order.status === 'COMPLETED') && (
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <FileText className="h-5 w-5 text-purple-600" />
                Order Completion Details
              </CardTitle>
              <CardDescription>
                All orders completed on {pharmacyOrder.completed_at ? new Date(pharmacyOrder.completed_at).toLocaleDateString('en-GB') : 'N/A'}
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                {allOrders.map((order, index) => (
                  <div key={order.id} className="border rounded-lg p-4 bg-gray-50">
                    <div className="flex items-center gap-2 mb-2">
                      <span className="text-sm font-medium text-gray-500">#{index + 1}</span>
                      <p className="font-semibold">{order.medication}</p>
                    </div>
                    <p className="text-sm text-gray-600">Dosage: {order.dose || 'N/A'}</p>
                    {order.notes && (
                      <div className="mt-2 p-3 bg-purple-50 rounded">
                        <p className="text-xs font-medium text-gray-500 mb-1">Notes:</p>
                        <p className="text-sm whitespace-pre-wrap">{order.notes}</p>
                      </div>
                    )}
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        )}

        {/* Footer */}
        <div className="text-center mt-8 text-gray-500 text-sm">
          <p>This is a secure portal for completing pharmacy orders.</p>
          <p>All data is encrypted and transmitted securely.</p>
        </div>
      </div>
    </div>
  )
}
