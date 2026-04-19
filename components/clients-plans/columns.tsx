"use client"

import React from "react"
import { ColumnDef } from "@tanstack/react-table"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import Link from "next/link"
import { formatDistanceToNow } from "date-fns"

export interface ClientPlanData {
  id: string
  client_plan_id: string
  plan_name: string
  status: string
  organization: {
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
  notification_read: boolean
}

const getStatusColor = (status: string) => {
  const colors: Record<string, string> = {
    DRAFT: "bg-gray-100 text-gray-800",
    PENDING: "bg-blue-100 text-blue-800",
    REVIEW: "bg-yellow-100 text-yellow-800",
    APPROVED: "bg-green-100 text-green-800",
    REJECTED: "bg-red-100 text-red-800",
    INVOICED: "bg-purple-100 text-purple-800",
    PAID: "bg-emerald-100 text-emerald-800",
  }
  return colors[status] || "bg-gray-100 text-gray-800"
}

export const columns: ColumnDef<ClientPlanData>[] = [
  {
    accessorKey: "plan_name",
    header: "Plan Name",
    cell: ({ row }) => (
      <div className="font-medium">{row.getValue("plan_name")}</div>
    ),
  },
  {
    accessorKey: "principal_account",
    header: "Client Name",
    cell: ({ row }) => {
      const principal = row.original.principal_account
      const clientAccountUser = row.original.client_account?.user
      const displayName = principal
        ? `${principal.first_name} ${principal.last_name}`
        : `${clientAccountUser?.first_name || ""} ${clientAccountUser?.last_name || ""}`.trim() || "N/A"
      const displayEmail = principal?.user?.email || clientAccountUser?.email || "N/A"
      return (
        <div>
          <div className="font-medium">{displayName}</div>
          <div className="text-sm text-muted-foreground">{displayEmail}</div>
        </div>
      )
    },
  },
  {
    accessorKey: "organization",
    header: "Organization",
    cell: ({ row }) => (
      <div className="text-sm">{row.original.organization.name}</div>
    ),
  },
  {
    accessorKey: "submitted_at",
    header: "Submitted",
    cell: ({ row }) => {
      const submitted = row.getValue("submitted_at") as string | null
      return submitted ? (
        <div className="text-sm">
          {formatDistanceToNow(new Date(submitted), { addSuffix: true })}
        </div>
      ) : (
        <span className="text-muted-foreground text-sm">Not submitted</span>
      )
    },
  },
  {
    accessorKey: "total_price",
    header: "Total Price",
    cell: ({ row }) => {
      const price = row.getValue("total_price") as number | null
      return price ? (
        <div className="font-medium">₦{price.toLocaleString()}</div>
      ) : (
        <span className="text-muted-foreground text-sm">Pending</span>
      )
    },
  },
  {
    accessorKey: "status",
    header: "Status",
    cell: ({ row }) => (
      <Badge className={getStatusColor(row.getValue("status") as string)}>
        {row.getValue("status")}
      </Badge>
    ),
  },
  {
    id: "actions",
    header: "Actions",
    cell: ({ row }) => (
      <Link href={`/settings/clients-plans/${row.original.id}`}>
        <Button variant="outline" size="sm">
          View
        </Button>
      </Link>
    ),
  },
]
