"use client"

import { useEffect, useMemo, useState } from "react"
import { usePathname, useRouter, useSearchParams } from "next/navigation"
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Badge } from "@/components/ui/badge"
import { Textarea } from "@/components/ui/textarea"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import { useToast } from "@/hooks/use-toast"
import { Loader2, CheckCircle2, Clock3, XCircle } from "lucide-react"

export const dynamic = 'force-dynamic'

type PlanService = {
  id: string
  service_name: string
  amount: number
  category_price_limit?: number | null
}

type PlanRecord = {
  id: string
  plan_id: string
  name: string
  plan_tag?: string | null
  classification?: "SME" | "RETAIL" | "CORPORATE" | null
  description: string | null
  premium_amount: number
  annual_limit: number
  categories: Record<string, PlanService[]>
  category_limits?: Record<string, number | null>
}

type RequestService = {
  id?: string
  category: string
  service_name: string
  quantity: number
  amount: number
  total_amount?: number
  category_price_limit?: number | null
}

type ClientRequest = {
  id: string
  client_plan_id: string
  plan_name: string
  plan_description: string | null
  requested_premium?: number | null
  requested_annual_limit?: number | null
  status: string
  submitted_at: string | null
  created_at: string
  updated_at: string
  services: RequestService[]
  invoice?: {
    id: string
    invoice_number: string
    total_amount: number
    status: string
    due_date: string | null
    invoice_data?: {
      payment_evidence?: {
        url?: string
        file_name?: string
        file_size?: number
        submitted_at?: string
      }
      payment_confirmation?: {
        confirmed_at?: string
      }
    } | null
  } | null
}

type RegistrationStatus = {
  id: string
  first_name: string
  last_name: string
  email: string
  phone_number: string
  status: string
  organization_name: string
  plan_name: string
  submitted_at: string
  reviewed_at: string | null
}

const statusClassMap: Record<string, string> = {
  DRAFT: "bg-slate-100 text-slate-700",
  PENDING: "bg-amber-100 text-amber-700",
  PENDING_PAYMENT: "bg-orange-100 text-orange-700",
  REVIEW: "bg-blue-100 text-blue-700",
  APPROVED: "bg-emerald-100 text-emerald-700",
  REJECTED: "bg-rose-100 text-rose-700",
  INVOICED: "bg-violet-100 text-violet-700",
  PAID: "bg-emerald-100 text-emerald-700",
}

const statusLabelMap: Record<string, string> = {
  INVOICED: "PENDING PAYMENT",
  PENDING_PAYMENT: "PENDING PAYMENT",
}

function formatCurrency(value: number) {
  return new Intl.NumberFormat("en-NG", {
    style: "currency",
    currency: "NGN",
    maximumFractionDigits: 0,
  }).format(value || 0)
}

function flattenPlanServices(plan?: PlanRecord): RequestService[] {
  if (!plan) return []

  const items: RequestService[] = []

  Object.entries(plan.categories || {}).forEach(([category, services]) => {
    const categoryPriceLimit = plan.category_limits?.[category] ?? null
    services.forEach((service) => {
      items.push({
        id: service.id,
        category,
        service_name: service.service_name,
        quantity: 1,
        amount: Number(service.amount || 0),
        category_price_limit: service.category_price_limit ?? categoryPriceLimit,
      })
    })
  })

  return items
}

function dateLabel(value?: string | null) {
  if (!value) return "-"
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return "-"
  return date.toLocaleString()
}

function getPlanDisplayName(plan: PlanRecord) {
  const tag = (plan.plan_tag || plan.classification || "").toString().trim()
  return tag ? `${plan.name} [${tag}]` : plan.name
}

const CLIENT_TABS = ["benefit-package", "registration", "pending-requests"] as const
type ClientTab = (typeof CLIENT_TABS)[number]

type PlanPricingOverride = {
  premium_amount: number
  annual_limit: number
}

export default function ClientPortalPage() {
  const { toast } = useToast()
  const queryClient = useQueryClient()
  const router = useRouter()
  const pathname = usePathname()
  const searchParams = useSearchParams()

  const [activeTab, setActiveTab] = useState<ClientTab>("benefit-package")
  const [customPlanId, setCustomPlanId] = useState<string | null>(null)
  const [customServices, setCustomServices] = useState<RequestService[]>([])
  const [planPricingOverrides, setPlanPricingOverrides] = useState<Record<string, PlanPricingOverride>>({})
  const [customPremiumAmount, setCustomPremiumAmount] = useState<number>(0)
  const [customAnnualLimit, setCustomAnnualLimit] = useState<number>(0)
  const [isEditDialogOpen, setIsEditDialogOpen] = useState(false)
  const [editingRequestId, setEditingRequestId] = useState<string | null>(null)
  const [editingServices, setEditingServices] = useState<RequestService[]>([])
  const [editingPremiumAmount, setEditingPremiumAmount] = useState<number>(0)
  const [editingAnnualLimit, setEditingAnnualLimit] = useState<number>(0)
  const [isPaymentDialogOpen, setIsPaymentDialogOpen] = useState(false)
  const [selectedPaymentRequest, setSelectedPaymentRequest] = useState<ClientRequest | null>(null)
  const [paymentEvidenceFile, setPaymentEvidenceFile] = useState<File | null>(null)

  const [registrationForm, setRegistrationForm] = useState({
    register_for: "SELF",
    full_name: "",
    email: "",
    phone_number: "",
    gender: "",
    date_of_birth: "",
    residential_address: "",
    plan_id: "",
    remarks: "",
  })

  useEffect(() => {
    const tabParam = searchParams.get("tab")
    if (tabParam && CLIENT_TABS.includes(tabParam as ClientTab)) {
      if (tabParam !== activeTab) {
        setActiveTab(tabParam as ClientTab)
      }
      return
    }

    if (!tabParam && activeTab !== "benefit-package") {
      setActiveTab("benefit-package")
    }
  }, [searchParams, activeTab])

  const handleTabChange = (tab: string) => {
    if (!CLIENT_TABS.includes(tab as ClientTab)) return

    const nextTab = tab as ClientTab
    setActiveTab(nextTab)

    const params = new URLSearchParams(searchParams.toString())
    if (nextTab === "benefit-package") {
      params.delete("tab")
    } else {
      params.set("tab", nextTab)
    }

    const query = params.toString()
    router.replace(query ? `${pathname}?${query}` : pathname, { scroll: false })
  }

  const { data: plansData, isLoading: plansLoading } = useQuery({
    queryKey: ["client", "plans"],
    queryFn: async () => {
      const response = await fetch("/api/client/plans")
      const payload = await response.json()
      if (!response.ok) {
        throw new Error(payload.error || "Unable to fetch plans")
      }
      return payload.data as PlanRecord[]
    },
  })

  const { data: requestsData, isLoading: requestsLoading } = useQuery({
    queryKey: ["client", "requests"],
    queryFn: async () => {
      const response = await fetch("/api/client/requests")
      const payload = await response.json()
      if (!response.ok) {
        throw new Error(payload.error || "Unable to fetch requests")
      }
      return payload.data as ClientRequest[]
    },
  })

  const { data: registrationsData, isLoading: registrationsLoading } = useQuery({
    queryKey: ["client", "registrations"],
    queryFn: async () => {
      const response = await fetch("/api/client/registrations")
      const payload = await response.json()
      if (!response.ok) {
        throw new Error(payload.error || "Unable to fetch registrations")
      }
      return payload.data as RegistrationStatus[]
    },
  })

  const plans = plansData || []
  const requests = requestsData || []
  const registrations = registrationsData || []
  const registrationPlans = useMemo(
    () => requests.filter((request) => ["INVOICED", "PAID"].includes(request.status)),
    [requests]
  )

  const selectedCustomPlan = useMemo(
    () => plans.find((plan) => plan.id === customPlanId) || null,
    [plans, customPlanId]
  )

  const getPlanPricingValues = (plan: PlanRecord): PlanPricingOverride => {
    const override = planPricingOverrides[plan.id]
    return {
      premium_amount: override?.premium_amount ?? Number(plan.premium_amount || 0),
      annual_limit: override?.annual_limit ?? Number(plan.annual_limit || 0),
    }
  }

  const updatePlanPricingOverride = (
    planId: string,
    field: keyof PlanPricingOverride,
    value: number
  ) => {
    setPlanPricingOverrides((prev) => {
      const fallbackPlan = plans.find((plan) => plan.id === planId)
      const current = prev[planId] ?? {
        premium_amount: Number(fallbackPlan?.premium_amount || 0),
        annual_limit: Number(fallbackPlan?.annual_limit || 0),
      }
      return {
        ...prev,
        [planId]: {
          ...current,
          [field]: Math.max(0, Number.isFinite(value) ? value : 0),
        },
      }
    })
  }

  const createRequestMutation = useMutation({
    mutationFn: async (payload: {
      plan_id: string
      submit: boolean
      services?: RequestService[]
      premium_amount?: number
      annual_limit?: number
    }) => {
      const response = await fetch("/api/client/requests", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      })
      const body = await response.json()
      if (!response.ok) {
        throw new Error(body.error || "Unable to submit request")
      }
      return body
    },
    onSuccess: (result) => {
      toast({ title: "Success", description: result.message || "Request saved" })
      queryClient.invalidateQueries({ queryKey: ["client", "requests"] })
      handleTabChange("pending-requests")
      setCustomPlanId(null)
      setCustomServices([])
      setCustomPremiumAmount(0)
      setCustomAnnualLimit(0)
    },
    onError: (error: any) => {
      toast({
        variant: "destructive",
        title: "Submission failed",
        description: error?.message || "Unable to submit request",
      })
    },
  })

  const updateRequestMutation = useMutation({
    mutationFn: async (payload: {
      requestId: string
      services: RequestService[]
      submit: boolean
      premium_amount?: number
      annual_limit?: number
    }) => {
      const response = await fetch(`/api/client/requests/${payload.requestId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          services: payload.services,
          submit: payload.submit,
          premium_amount: payload.premium_amount,
          annual_limit: payload.annual_limit,
        }),
      })
      const body = await response.json()
      if (!response.ok) {
        throw new Error(body.error || "Unable to update request")
      }
      return body
    },
    onSuccess: (result) => {
      toast({ title: "Updated", description: result.message || "Request updated" })
      setIsEditDialogOpen(false)
      setEditingRequestId(null)
      setEditingServices([])
      setEditingPremiumAmount(0)
      setEditingAnnualLimit(0)
      queryClient.invalidateQueries({ queryKey: ["client", "requests"] })
    },
    onError: (error: any) => {
      toast({
        variant: "destructive",
        title: "Update failed",
        description: error?.message || "Unable to update request",
      })
    },
  })

  const createRegistrationMutation = useMutation({
    mutationFn: async (payload: typeof registrationForm) => {
      const response = await fetch("/api/client/registrations", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      })
      const body = await response.json()
      if (!response.ok) {
        throw new Error(body.error || "Unable to submit registration")
      }
      return body
    },
    onSuccess: (result) => {
      toast({ title: "Registration submitted", description: result.message || "Submitted successfully" })
      setRegistrationForm({
        register_for: "SELF",
        full_name: "",
        email: "",
        phone_number: "",
        gender: "",
        date_of_birth: "",
        residential_address: "",
        plan_id: "",
        remarks: "",
      })
      queryClient.invalidateQueries({ queryKey: ["client", "registrations"] })
    },
    onError: (error: any) => {
      toast({
        variant: "destructive",
        title: "Registration failed",
        description: error?.message || "Unable to submit registration",
      })
    },
  })

  const uploadPaymentEvidenceMutation = useMutation({
    mutationFn: async (payload: { requestId: string; file: File }) => {
      const formData = new FormData()
      formData.append("files", payload.file)
      formData.append("folder", "client-payment-evidence")

      const uploadResponse = await fetch("/api/upload", {
        method: "POST",
        body: formData,
      })

      const uploadBody = await uploadResponse.json()
      if (!uploadResponse.ok || !uploadBody?.success) {
        throw new Error(uploadBody?.error || "Failed to upload file")
      }

      const uploadedFile = uploadBody?.data?.[0]
      const evidenceUrl = uploadedFile?.secure_url
      if (!evidenceUrl) {
        throw new Error("Uploaded file URL not returned")
      }

      const response = await fetch(`/api/client/requests/${payload.requestId}/payment-evidence`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          evidence_url: evidenceUrl,
          evidence_name: payload.file.name,
          evidence_size: payload.file.size,
        }),
      })

      const body = await response.json()
      if (!response.ok) {
        throw new Error(body.error || "Failed to submit payment evidence")
      }
      return body
    },
    onSuccess: (result) => {
      toast({
        title: "Payment evidence uploaded",
        description: result.message || "Your payment proof has been submitted for review.",
      })
      setPaymentEvidenceFile(null)
      queryClient.invalidateQueries({ queryKey: ["client", "requests"] })
      setIsPaymentDialogOpen(false)
    },
    onError: (error: any) => {
      toast({
        variant: "destructive",
        title: "Upload failed",
        description: error?.message || "Unable to upload payment evidence",
      })
    },
  })

  const beginCustomizing = (plan: PlanRecord) => {
    const pricing = getPlanPricingValues(plan)
    setCustomPlanId(plan.id)
    setCustomServices(flattenPlanServices(plan))
    setCustomPremiumAmount(pricing.premium_amount)
    setCustomAnnualLimit(pricing.annual_limit)
    handleTabChange("benefit-package")
  }

  const updateCustomService = (index: number, field: "amount" | "quantity", value: number) => {
    setCustomServices((previous) =>
      previous.map((service, serviceIndex) => {
        if (serviceIndex !== index) return service
        return {
          ...service,
          [field]: value,
        }
      })
    )
  }

  const updateEditingService = (index: number, field: "amount" | "quantity", value: number) => {
    setEditingServices((previous) =>
      previous.map((service, serviceIndex) => {
        if (serviceIndex !== index) return service
        return {
          ...service,
          [field]: value,
        }
      })
    )
  }

  const openEditDialog = (request: ClientRequest) => {
    setEditingRequestId(request.id)
    setEditingPremiumAmount(Number(request.requested_premium || 0))
    setEditingAnnualLimit(Number(request.requested_annual_limit || 0))
    setEditingServices(
      request.services.map((service) => ({
        category: service.category,
        service_name: service.service_name,
        quantity: Number(service.quantity || 1),
        amount: Number(service.amount || 0),
        category_price_limit:
          service.category_price_limit === null || service.category_price_limit === undefined
            ? null
            : Number(service.category_price_limit),
      }))
    )
    setIsEditDialogOpen(true)
  }

  const openPaymentDialog = (request: ClientRequest) => {
    setSelectedPaymentRequest(request)
    setPaymentEvidenceFile(null)
    setIsPaymentDialogOpen(true)
  }

  return (
    <div className="space-y-6">
      <Card className="border-slate-200">
        <CardHeader>
          <CardTitle>Client Dashboard</CardTitle>
          <CardDescription>
            Explore benefit plans, register beneficiaries and track your submitted requests.
          </CardDescription>
        </CardHeader>
      </Card>

      <Tabs value={activeTab} onValueChange={handleTabChange}>
        <TabsList className="grid w-full grid-cols-3">
          <TabsTrigger value="benefit-package">Benefit Package</TabsTrigger>
          <TabsTrigger value="registration">Registration</TabsTrigger>
          <TabsTrigger value="pending-requests">Pending Requests</TabsTrigger>
        </TabsList>

        <TabsContent value="benefit-package" className="space-y-4 mt-4">
          {plansLoading ? (
            <Card>
              <CardContent className="py-8 flex items-center justify-center text-slate-600">
                <Loader2 className="h-4 w-4 mr-2 animate-spin" /> Loading plans...
              </CardContent>
            </Card>
          ) : plans.length === 0 ? (
            <Card>
              <CardContent className="py-8 text-center text-slate-600">No active plans available.</CardContent>
            </Card>
          ) : (
            plans.map((plan) => {
              const pricing = getPlanPricingValues(plan)
              return (
              <Card key={plan.id} className="border-slate-200">
                <CardHeader>
                  <div className="flex flex-col gap-3 md:flex-row md:items-start md:justify-between">
                    <div>
                      <CardTitle>{getPlanDisplayName(plan)}</CardTitle>
                      <CardDescription>{plan.description || "No description"}</CardDescription>
                    </div>
                    <div className="flex flex-wrap gap-2">
                      <Badge variant="outline">Premium: {formatCurrency(pricing.premium_amount)}</Badge>
                      <Badge variant="outline">Annual Limit: {formatCurrency(pricing.annual_limit)}</Badge>
                    </div>
                  </div>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="grid gap-3 md:grid-cols-2">
                    <div className="space-y-2">
                      <Label>Preferred Premium (NGN)</Label>
                      <Input
                        type="number"
                        min={0}
                        value={pricing.premium_amount}
                        onChange={(event) =>
                          updatePlanPricingOverride(plan.id, "premium_amount", Number(event.target.value || 0))
                        }
                      />
                    </div>
                    <div className="space-y-2">
                      <Label>Preferred Annual Limit (NGN)</Label>
                      <Input
                        type="number"
                        min={0}
                        value={pricing.annual_limit}
                        onChange={(event) =>
                          updatePlanPricingOverride(plan.id, "annual_limit", Number(event.target.value || 0))
                        }
                      />
                    </div>
                  </div>

                  <div className="grid gap-2">
                    {Object.entries(plan.categories).map(([category, services]) => (
                      <details key={category} className="rounded-md border border-slate-200 bg-white">
                        <summary className="cursor-pointer px-3 py-2 text-sm font-medium">
                          {category} ({services.length} services)
                          <span className="ml-2 text-xs font-normal text-slate-500">
                            Limit:{" "}
                            {plan.category_limits?.[category] != null
                              ? formatCurrency(Number(plan.category_limits?.[category] || 0))
                              : "Unlimited"}
                          </span>
                        </summary>
                        <div className="px-3 pb-3 space-y-1">
                          {services.map((service) => (
                            <div key={service.id} className="flex items-center justify-between text-sm text-slate-700">
                              <span>{service.service_name}</span>
                              <span>{formatCurrency(Number(service.amount || 0))}</span>
                            </div>
                          ))}
                        </div>
                      </details>
                    ))}
                  </div>

                  <div className="flex flex-wrap gap-2">
                    <Button
                      onClick={() =>
                        createRequestMutation.mutate({
                          plan_id: plan.id,
                          submit: true,
                          premium_amount: pricing.premium_amount,
                          annual_limit: pricing.annual_limit,
                        })
                      }
                      disabled={createRequestMutation.isPending}
                    >
                      Submit Selected Plan
                    </Button>
                    <Button
                      type="button"
                      variant="outline"
                      onClick={() => beginCustomizing(plan)}
                    >
                      Customize Plan
                    </Button>
                  </div>
                </CardContent>
              </Card>
            )})
          )}

          {selectedCustomPlan && (
            <Card>
              <CardHeader>
                <CardTitle>Customize: {getPlanDisplayName(selectedCustomPlan)}</CardTitle>
                <CardDescription>
                  Edit premium, annual limit, service prices and quantity, then save draft or submit.
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="grid gap-3 md:grid-cols-2">
                  <div className="space-y-2">
                    <Label>Preferred Premium (NGN)</Label>
                    <Input
                      type="number"
                      min={0}
                      value={customPremiumAmount}
                      onChange={(event) => setCustomPremiumAmount(Math.max(0, Number(event.target.value || 0)))}
                    />
                  </div>
                  <div className="space-y-2">
                    <Label>Preferred Annual Limit (NGN)</Label>
                    <Input
                      type="number"
                      min={0}
                      value={customAnnualLimit}
                      onChange={(event) => setCustomAnnualLimit(Math.max(0, Number(event.target.value || 0)))}
                    />
                  </div>
                </div>

                <div className="overflow-x-auto border rounded-md">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Category</TableHead>
                        <TableHead>Category Limit</TableHead>
                        <TableHead>Service</TableHead>
                        <TableHead>Quantity</TableHead>
                        <TableHead>Amount (NGN)</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {customServices.map((service, index) => (
                        <TableRow key={`${service.category}-${service.service_name}-${index}`}>
                          <TableCell>{service.category}</TableCell>
                          <TableCell>
                            {service.category_price_limit != null
                              ? formatCurrency(Number(service.category_price_limit || 0))
                              : "Unlimited"}
                          </TableCell>
                          <TableCell>{service.service_name}</TableCell>
                          <TableCell className="w-28">
                            <Input
                              type="number"
                              min={1}
                              value={service.quantity}
                              onChange={(event) =>
                                updateCustomService(index, "quantity", Number(event.target.value || 1))
                              }
                            />
                          </TableCell>
                          <TableCell className="w-40">
                            <Input
                              type="number"
                              min={0}
                              value={service.amount}
                              onChange={(event) =>
                                updateCustomService(index, "amount", Number(event.target.value || 0))
                              }
                            />
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </div>

                <div className="flex flex-wrap gap-2">
                  <Button
                    variant="outline"
                    disabled={createRequestMutation.isPending}
                    onClick={() =>
                      createRequestMutation.mutate({
                        plan_id: selectedCustomPlan.id,
                        services: customServices,
                        submit: false,
                        premium_amount: customPremiumAmount,
                        annual_limit: customAnnualLimit,
                      })
                    }
                  >
                    Save as Draft
                  </Button>
                  <Button
                    disabled={createRequestMutation.isPending}
                    onClick={() =>
                      createRequestMutation.mutate({
                        plan_id: selectedCustomPlan.id,
                        services: customServices,
                        submit: true,
                        premium_amount: customPremiumAmount,
                        annual_limit: customAnnualLimit,
                      })
                    }
                  >
                    Submit Customized Plan
                  </Button>
                </div>
              </CardContent>
            </Card>
          )}
        </TabsContent>

        <TabsContent value="registration" className="space-y-4 mt-4">
          <Card>
            <CardHeader>
              <CardTitle>Register for Self or Someone Else</CardTitle>
              <CardDescription>Submit beneficiary registration from the client portal.</CardDescription>
            </CardHeader>
            <CardContent>
              <form
                className="space-y-4"
                onSubmit={(event) => {
                  event.preventDefault()
                  createRegistrationMutation.mutate(registrationForm)
                }}
              >
                <div className="grid gap-4 md:grid-cols-2">
                  <div className="space-y-2">
                    <Label>Register For</Label>
                    <Select
                      value={registrationForm.register_for}
                      onValueChange={(value) =>
                        setRegistrationForm((prev) => ({ ...prev, register_for: value }))
                      }
                    >
                      <SelectTrigger>
                        <SelectValue placeholder="Select option" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="SELF">Self</SelectItem>
                        <SelectItem value="SOMEONE_ELSE">Someone Else</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="space-y-2">
                    <Label>Full Name</Label>
                    <Input
                      value={registrationForm.full_name}
                      onChange={(event) =>
                        setRegistrationForm((prev) => ({ ...prev, full_name: event.target.value }))
                      }
                      required
                    />
                  </div>
                  <div className="space-y-2">
                    <Label>Email</Label>
                    <Input
                      type="email"
                      value={registrationForm.email}
                      onChange={(event) =>
                        setRegistrationForm((prev) => ({ ...prev, email: event.target.value }))
                      }
                      required
                    />
                  </div>
                  <div className="space-y-2">
                    <Label>Phone Number</Label>
                    <Input
                      value={registrationForm.phone_number}
                      onChange={(event) =>
                        setRegistrationForm((prev) => ({ ...prev, phone_number: event.target.value }))
                      }
                      required
                    />
                  </div>
                  <div className="space-y-2">
                    <Label>Gender</Label>
                    <Select
                      value={registrationForm.gender}
                      onValueChange={(value) =>
                        setRegistrationForm((prev) => ({ ...prev, gender: value }))
                      }
                    >
                      <SelectTrigger>
                        <SelectValue placeholder="Select gender" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="MALE">Male</SelectItem>
                        <SelectItem value="FEMALE">Female</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="space-y-2">
                    <Label>Date of Birth</Label>
                    <Input
                      type="date"
                      value={registrationForm.date_of_birth}
                      onChange={(event) =>
                        setRegistrationForm((prev) => ({ ...prev, date_of_birth: event.target.value }))
                      }
                      required
                    />
                  </div>
                  <div className="space-y-2 md:col-span-2">
                    <Label>Residential Address</Label>
                    <Textarea
                      value={registrationForm.residential_address}
                      onChange={(event) =>
                        setRegistrationForm((prev) => ({ ...prev, residential_address: event.target.value }))
                      }
                      rows={3}
                      required
                    />
                  </div>
                  <div className="space-y-2 md:col-span-2">
                    <Label>Plan</Label>
                    <Select
                      value={registrationForm.plan_id}
                      onValueChange={(value) =>
                        setRegistrationForm((prev) => ({ ...prev, plan_id: value }))
                      }
                    >
                      <SelectTrigger>
                        <SelectValue placeholder="Select plan" />
                      </SelectTrigger>
                      <SelectContent>
                        {registrationPlans.map((plan) => (
                          <SelectItem key={plan.id} value={plan.id}>
                            {plan.plan_name} ({statusLabelMap[plan.status] || plan.status})
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                    {registrationPlans.length === 0 && (
                      <p className="text-xs text-amber-700">
                        No approved client plan available yet. Submit a plan, get invoice approval, then upload payment evidence.
                      </p>
                    )}
                  </div>
                  <div className="space-y-2 md:col-span-2">
                    <Label>Remarks (Optional)</Label>
                    <Textarea
                      value={registrationForm.remarks}
                      onChange={(event) =>
                        setRegistrationForm((prev) => ({ ...prev, remarks: event.target.value }))
                      }
                      rows={2}
                    />
                  </div>
                </div>

                <Button
                  type="submit"
                  disabled={
                    createRegistrationMutation.isPending ||
                    !registrationForm.plan_id ||
                    !registrationForm.gender ||
                    registrationPlans.length === 0
                  }
                >
                  {createRegistrationMutation.isPending && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
                  Submit Registration
                </Button>
              </form>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="pending-requests" className="space-y-4 mt-4">
          <Card>
            <CardHeader>
              <CardTitle>Pending Requests</CardTitle>
              <CardDescription>
                View submitted custom plans, edit drafts and resubmit modified requests.
              </CardDescription>
            </CardHeader>
            <CardContent>
              {requestsLoading ? (
                <div className="flex items-center text-slate-600">
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" /> Loading requests...
                </div>
              ) : requests.length === 0 ? (
                <p className="text-sm text-slate-600">No requests yet. Submit a plan from Benefit Package tab.</p>
              ) : (
                <div className="space-y-3">
                  {requests.map((request) => (
                    <Card key={request.id} className="border-slate-200">
                      <CardContent className="pt-5 space-y-4">
                        <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
                          <div>
                            <p className="text-sm text-slate-500">{request.client_plan_id}</p>
                            <h3 className="text-base font-semibold">{request.plan_name}</h3>
                            <p className="text-sm text-slate-600">{request.plan_description || "No description"}</p>
                            <div className="mt-2 flex flex-wrap gap-2">
                              <Badge variant="outline">
                                Preferred Premium: {formatCurrency(Number(request.requested_premium || 0))}
                              </Badge>
                              <Badge variant="outline">
                                Preferred Annual Limit: {formatCurrency(Number(request.requested_annual_limit || 0))}
                              </Badge>
                            </div>
                          </div>
                          <div className="flex items-center gap-2">
                            <Badge className={statusClassMap[request.status] || "bg-slate-100 text-slate-700"}>
                              {statusLabelMap[request.status] || request.status}
                            </Badge>
                            {request.status === "APPROVED" && <CheckCircle2 className="h-4 w-4 text-emerald-600" />}
                            {request.status === "PENDING" && <Clock3 className="h-4 w-4 text-amber-600" />}
                            {request.status === "REJECTED" && <XCircle className="h-4 w-4 text-rose-600" />}
                          </div>
                        </div>

                        <div className="overflow-x-auto border rounded-md">
                          <Table>
                            <TableHeader>
                              <TableRow>
                                <TableHead>Category</TableHead>
                                <TableHead>Category Limit</TableHead>
                                <TableHead>Service</TableHead>
                                <TableHead>Qty</TableHead>
                                <TableHead>Amount</TableHead>
                              </TableRow>
                            </TableHeader>
                            <TableBody>
                              {request.services.map((service, index) => (
                                <TableRow key={`${request.id}-${service.service_name}-${index}`}>
                                  <TableCell>{service.category}</TableCell>
                                  <TableCell>
                                    {service.category_price_limit != null
                                      ? formatCurrency(Number(service.category_price_limit || 0))
                                      : "Unlimited"}
                                  </TableCell>
                                  <TableCell>{service.service_name}</TableCell>
                                  <TableCell>{service.quantity}</TableCell>
                                  <TableCell>{formatCurrency(Number(service.amount || 0))}</TableCell>
                                </TableRow>
                              ))}
                            </TableBody>
                          </Table>
                        </div>

                        <div className="flex flex-wrap items-center gap-2 text-xs text-slate-500">
                          <span>Created: {dateLabel(request.created_at)}</span>
                          <span>Updated: {dateLabel(request.updated_at)}</span>
                          <span>Submitted: {dateLabel(request.submitted_at)}</span>
                        </div>

                        <div className="flex flex-wrap gap-2">
                          {request.invoice && (
                            <Button variant="outline" onClick={() => openPaymentDialog(request)}>
                              View
                            </Button>
                          )}
                          {!["INVOICED", "PAID"].includes(request.status) && (
                            <Button variant="outline" onClick={() => openEditDialog(request)}>
                              Modify and Resubmit
                            </Button>
                          )}
                        </div>
                      </CardContent>
                    </Card>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Registered Users Status</CardTitle>
              <CardDescription>Track statuses of all registrations submitted from your portal.</CardDescription>
            </CardHeader>
            <CardContent>
              {registrationsLoading ? (
                <div className="flex items-center text-slate-600">
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" /> Loading statuses...
                </div>
              ) : registrations.length === 0 ? (
                <p className="text-sm text-slate-600">No registrations submitted yet.</p>
              ) : (
                <div className="overflow-x-auto border rounded-md">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Name</TableHead>
                        <TableHead>Email</TableHead>
                        <TableHead>Plan</TableHead>
                        <TableHead>Status</TableHead>
                        <TableHead>Submitted</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {registrations.map((entry) => (
                        <TableRow key={entry.id}>
                          <TableCell>{entry.first_name} {entry.last_name}</TableCell>
                          <TableCell>{entry.email}</TableCell>
                          <TableCell>{entry.plan_name}</TableCell>
                          <TableCell>
                            <Badge className={statusClassMap[entry.status] || "bg-slate-100 text-slate-700"}>
                              {statusLabelMap[entry.status] || entry.status}
                            </Badge>
                          </TableCell>
                          <TableCell>{dateLabel(entry.submitted_at)}</TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>

      <Dialog open={isPaymentDialogOpen} onOpenChange={setIsPaymentDialogOpen}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle>Plan Payment</DialogTitle>
            <DialogDescription>
              View invoice details and upload payment evidence for confirmation.
            </DialogDescription>
          </DialogHeader>

          {selectedPaymentRequest?.invoice ? (
            <div className="space-y-4">
              <div className="grid gap-3 sm:grid-cols-2">
                <div>
                  <p className="text-xs text-slate-500">Invoice Number</p>
                  <p className="font-medium">{selectedPaymentRequest.invoice.invoice_number}</p>
                </div>
                <div>
                  <p className="text-xs text-slate-500">Amount</p>
                  <p className="font-semibold">
                    {formatCurrency(Number(selectedPaymentRequest.invoice.total_amount || 0))}
                  </p>
                </div>
                <div>
                  <p className="text-xs text-slate-500">Due Date</p>
                  <p className="font-medium">{dateLabel(selectedPaymentRequest.invoice.due_date)}</p>
                </div>
                <div>
                  <p className="text-xs text-slate-500">Status</p>
                  <Badge className={statusClassMap[selectedPaymentRequest.status] || "bg-slate-100 text-slate-700"}>
                    {statusLabelMap[selectedPaymentRequest.status] || selectedPaymentRequest.status}
                  </Badge>
                </div>
              </div>

              {selectedPaymentRequest.invoice.invoice_data?.payment_evidence?.url && (
                <div className="rounded-md border border-slate-200 bg-slate-50 p-3 text-sm">
                  <p className="font-medium">Uploaded Evidence</p>
                  <a
                    href={selectedPaymentRequest.invoice.invoice_data.payment_evidence.url}
                    target="_blank"
                    rel="noreferrer"
                    className="text-blue-700 underline"
                  >
                    {selectedPaymentRequest.invoice.invoice_data.payment_evidence.file_name || "View Evidence"}
                  </a>
                  <p className="text-xs text-slate-500">
                    Uploaded: {dateLabel(selectedPaymentRequest.invoice.invoice_data.payment_evidence.submitted_at)}
                  </p>
                </div>
              )}

              {selectedPaymentRequest.status === "INVOICED" && (
                <div className="space-y-3 rounded-md border border-slate-200 p-3">
                  <Label htmlFor="paymentEvidence">Upload Payment Evidence</Label>
                  <Input
                    id="paymentEvidence"
                    type="file"
                    accept="image/*,application/pdf"
                    onChange={(event) => setPaymentEvidenceFile(event.target.files?.[0] || null)}
                  />
                  <Button
                    disabled={!paymentEvidenceFile || uploadPaymentEvidenceMutation.isPending}
                    onClick={() => {
                      if (!selectedPaymentRequest || !paymentEvidenceFile) return
                      uploadPaymentEvidenceMutation.mutate({
                        requestId: selectedPaymentRequest.id,
                        file: paymentEvidenceFile,
                      })
                    }}
                  >
                    {uploadPaymentEvidenceMutation.isPending && (
                      <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    )}
                    Submit Evidence
                  </Button>
                </div>
              )}
            </div>
          ) : (
            <p className="text-sm text-slate-600">No invoice data available for this request.</p>
          )}
        </DialogContent>
      </Dialog>

      <Dialog open={isEditDialogOpen} onOpenChange={setIsEditDialogOpen}>
        <DialogContent className="max-w-5xl">
          <DialogHeader>
            <DialogTitle>Modify Request</DialogTitle>
            <DialogDescription>Adjust values and resubmit your plan request.</DialogDescription>
          </DialogHeader>

          <div className="grid gap-3 md:grid-cols-2">
            <div className="space-y-2">
              <Label>Preferred Premium (NGN)</Label>
              <Input
                type="number"
                min={0}
                value={editingPremiumAmount}
                onChange={(event) => setEditingPremiumAmount(Math.max(0, Number(event.target.value || 0)))}
              />
            </div>
            <div className="space-y-2">
              <Label>Preferred Annual Limit (NGN)</Label>
              <Input
                type="number"
                min={0}
                value={editingAnnualLimit}
                onChange={(event) => setEditingAnnualLimit(Math.max(0, Number(event.target.value || 0)))}
              />
            </div>
          </div>

          <div className="overflow-x-auto border rounded-md">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Category</TableHead>
                  <TableHead>Category Limit</TableHead>
                  <TableHead>Service</TableHead>
                  <TableHead>Quantity</TableHead>
                  <TableHead>Amount (NGN)</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {editingServices.map((service, index) => (
                  <TableRow key={`${service.category}-${service.service_name}-${index}`}>
                    <TableCell>{service.category}</TableCell>
                    <TableCell>
                      {service.category_price_limit != null
                        ? formatCurrency(Number(service.category_price_limit || 0))
                        : "Unlimited"}
                    </TableCell>
                    <TableCell>{service.service_name}</TableCell>
                    <TableCell className="w-32">
                      <Input
                        type="number"
                        min={1}
                        value={service.quantity}
                        onChange={(event) =>
                          updateEditingService(index, "quantity", Number(event.target.value || 1))
                        }
                      />
                    </TableCell>
                    <TableCell className="w-44">
                      <Input
                        type="number"
                        min={0}
                        value={service.amount}
                        onChange={(event) =>
                          updateEditingService(index, "amount", Number(event.target.value || 0))
                        }
                      />
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>

          <div className="flex flex-wrap justify-end gap-2">
            <Button
              variant="outline"
              disabled={updateRequestMutation.isPending || !editingRequestId}
              onClick={() => {
                if (!editingRequestId) return
                updateRequestMutation.mutate({
                  requestId: editingRequestId,
                  services: editingServices,
                  submit: false,
                  premium_amount: editingPremiumAmount,
                  annual_limit: editingAnnualLimit,
                })
              }}
            >
              Save as Draft
            </Button>
            <Button
              disabled={updateRequestMutation.isPending || !editingRequestId}
              onClick={() => {
                if (!editingRequestId) return
                updateRequestMutation.mutate({
                  requestId: editingRequestId,
                  services: editingServices,
                  submit: true,
                  premium_amount: editingPremiumAmount,
                  annual_limit: editingAnnualLimit,
                })
              }}
            >
              {updateRequestMutation.isPending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              Resubmit
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  )
}
