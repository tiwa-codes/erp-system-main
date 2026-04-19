import React from "react"
import Link from "next/link"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { Badge } from "@/components/ui/badge"
import { ClientPlansDataTable } from "@/components/clients-plans/data-table"
import { columns } from "@/components/clients-plans/columns"
import { headers } from "next/headers"

interface ClientPlan {
  id: string
  client_plan_id: string
  plan_name: string
  status: "DRAFT" | "PENDING" | "REVIEW" | "APPROVED" | "REJECTED" | "INVOICED" | "PAID"
  organizations: {
    name: string
  }
  principal_account: {
    first_name: string
    last_name: string
    user?: {
      email: string
    }
  } | null
  client_account?: {
    user?: {
      first_name?: string
      last_name?: string
      email?: string
    }
  } | null
  submitted_at: string | null
  total_price: number | null
  invoice_sent_at: string | null
  notification_read: boolean
}

export default async function ClientsPlansPage() {
  const requestHeaders = await headers()
  const cookieHeader = requestHeaders.get("cookie") || ""

  // Fetch data from API
  const fetchPlans = async (status: string) => {
    try {
      const response = await fetch(
        `${process.env.NEXTAUTH_URL || "http://localhost:3000"}/api/clients-plans?status=${status}&limit=100`,
        {
          cache: "no-store",
          headers: {
            "Content-Type": "application/json",
            cookie: cookieHeader,
          },
        }
      )
      if (!response.ok) throw new Error("Failed to fetch plans")
      const data = await response.json()
      return data.data || []
    } catch (error) {
      console.error(`Error fetching ${status} plans:`, error)
      return []
    }
  }

  const pendingPlans = await fetchPlans("PENDING")
  const approvedPlans = await fetchPlans("APPROVED")
  const rejectedPlans = await fetchPlans("REJECTED")
  const invoicedPlans = await fetchPlans("INVOICED")

  const getStatusBadge = (status: string) => {
    const variants: Record<string, any> = {
      DRAFT: "secondary",
      PENDING: "default",
      REVIEW: "outline",
      APPROVED: "default",
      REJECTED: "destructive",
      INVOICED: "secondary",
      PAID: "outline",
    }
    return <Badge variant={variants[status] || "secondary"}>{status}</Badge>
  }

  const pendingCount = pendingPlans.length
  const approvedCount = approvedPlans.length
  const rejectedCount = rejectedPlans.length
  const invoicedCount = invoicedPlans.length

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Clients Plans</h1>
          <p className="text-muted-foreground">
            Manage custom plans submitted by clients from the mobile app
          </p>
        </div>
      </div>

      {/* Stats Cards */}
      <div className="grid gap-4 md:grid-cols-4">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Pending Review</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{pendingCount}</div>
            <p className="text-xs text-muted-foreground">Awaiting admin review</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Approved</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{approvedCount}</div>
            <p className="text-xs text-muted-foreground">Priced and invoiced</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Invoiced</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{invoicedCount}</div>
            <p className="text-xs text-muted-foreground">Awaiting payment</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Rejected</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{rejectedCount}</div>
            <p className="text-xs text-muted-foreground">Rejected plans</p>
          </CardContent>
        </Card>
      </div>

      {/* Tabs */}
      <Tabs defaultValue="pending" className="w-full">
        <TabsList>
          <TabsTrigger value="pending">
            Pending <Badge variant="outline" className="ml-2">{pendingCount}</Badge>
          </TabsTrigger>
          <TabsTrigger value="approved">
            Approved <Badge variant="outline" className="ml-2">{approvedCount}</Badge>
          </TabsTrigger>
          <TabsTrigger value="invoiced">
            Invoiced <Badge variant="outline" className="ml-2">{invoicedCount}</Badge>
          </TabsTrigger>
          <TabsTrigger value="rejected">
            Rejected <Badge variant="outline" className="ml-2">{rejectedCount}</Badge>
          </TabsTrigger>
        </TabsList>

        <TabsContent value="pending">
          <Card>
            <CardHeader>
              <CardTitle>Pending Plans</CardTitle>
            </CardHeader>
            <CardContent>
              {pendingPlans.length > 0 ? (
                <ClientPlansDataTable data={pendingPlans} columns={columns} />
              ) : (
                <p className="text-muted-foreground">No pending plans</p>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="approved">
          <Card>
            <CardHeader>
              <CardTitle>Approved Plans</CardTitle>
            </CardHeader>
            <CardContent>
              {approvedPlans.length > 0 ? (
                <ClientPlansDataTable data={approvedPlans} columns={columns} />
              ) : (
                <p className="text-muted-foreground">No approved plans</p>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="invoiced">
          <Card>
            <CardHeader>
              <CardTitle>Invoiced Plans</CardTitle>
            </CardHeader>
            <CardContent>
              {invoicedPlans.length > 0 ? (
                <ClientPlansDataTable data={invoicedPlans} columns={columns} />
              ) : (
                <p className="text-muted-foreground">No invoiced plans</p>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="rejected">
          <Card>
            <CardHeader>
              <CardTitle>Rejected Plans</CardTitle>
            </CardHeader>
            <CardContent>
              {rejectedPlans.length > 0 ? (
                <ClientPlansDataTable data={rejectedPlans} columns={columns} />
              ) : (
                <p className="text-muted-foreground">No rejected plans</p>
              )}
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  )
}
