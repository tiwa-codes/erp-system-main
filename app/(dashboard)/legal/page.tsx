"use client"

export const dynamic = 'force-dynamic'

import { useQuery } from "@tanstack/react-query"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { FileText, Users, CheckCircle, Clock } from "lucide-react"
import Link from "next/link"
import { PermissionGate } from "@/components/ui/permission-gate"



export default function LegalServicesPage() {
  const { data: documentsData } = useQuery({
    queryKey: ["legal-documents-stats"],
    queryFn: async () => {
      const res = await fetch("/api/legal/documents?limit=1000")
      if (!res.ok) throw new Error("Failed to fetch documents")
      return res.json()
    },
  })

  const { data: meetingsData } = useQuery({
    queryKey: ["meeting-minutes-stats"],
    queryFn: async () => {
      const res = await fetch("/api/legal/meeting-minutes?limit=1000")
      if (!res.ok) throw new Error("Failed to fetch meeting minutes")
      return res.json()
    },
  })

  const documents = documentsData?.data?.documents || []
  const meetings = meetingsData?.data?.meetings || []

  const stats = {
    totalDocuments: documents.length,
    draftDocuments: documents.filter((d: any) => d.status === "DRAFT").length,
    vettedDocuments: documents.filter((d: any) => d.status === "VETTED").length,
    approvedDocuments: documents.filter((d: any) => d.status === "APPROVED").length,
    totalMeetings: meetings.length,
    draftMeetings: meetings.filter((m: any) => m.status === "DRAFT").length,
    vettedMeetings: meetings.filter((m: any) => m.status === "VETTED").length,
    approvedMeetings: meetings.filter((m: any) => m.status === "APPROVED").length,
  }

  const recentDocuments = documents.slice(0, 5)
  const recentMeetings = meetings.slice(0, 5)

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold">Legal Services</h1>
        <p className="text-muted-foreground">
          Manage company legal documents, compliance certificates, licenses, and meeting minutes
        </p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Total Documents</CardTitle>
            <FileText className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{stats.totalDocuments}</div>
            <p className="text-xs text-muted-foreground">
              {stats.approvedDocuments} approved
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Draft Documents</CardTitle>
            <Clock className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{stats.draftDocuments}</div>
            <p className="text-xs text-muted-foreground">
              Awaiting review
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Vetted Documents</CardTitle>
            <Users className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{stats.vettedDocuments}</div>
            <p className="text-xs text-muted-foreground">
              Awaiting approval
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Total Meetings</CardTitle>
            <FileText className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{stats.totalMeetings}</div>
            <p className="text-xs text-muted-foreground">
              {stats.approvedMeetings} approved
            </p>
          </CardContent>
        </Card>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <Card>
          <CardHeader>
            <div className="flex items-center justify-between">
              <div>
                <CardTitle>Recent Documents</CardTitle>
                <CardDescription>Latest legal documents</CardDescription>
              </div>
              <PermissionGate permission="legal:view">
                <Link href="/legal/documents">
                  <Button variant="outline" size="sm">View All</Button>
                </Link>
              </PermissionGate>
            </div>
          </CardHeader>
          <CardContent>
            {recentDocuments.length === 0 ? (
              <p className="text-sm text-muted-foreground">No documents yet</p>
            ) : (
              <div className="space-y-2">
                {recentDocuments.map((doc: any) => (
                  <Link
                    key={doc.id}
                    href={`/legal/documents/${doc.id}`}
                    className="flex items-center justify-between p-2 rounded hover:bg-muted"
                  >
                    <div>
                      <p className="text-sm font-medium">{doc.title}</p>
                      <p className="text-xs text-muted-foreground">
                        {doc.document_type.replace(/_/g, " ")} • {doc.status}
                      </p>
                    </div>
                    {doc.status === "APPROVED" && (
                      <CheckCircle className="h-4 w-4 text-green-600" />
                    )}
                  </Link>
                ))}
              </div>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <div className="flex items-center justify-between">
              <div>
                <CardTitle>Recent Meeting Minutes</CardTitle>
                <CardDescription>Latest meeting minutes</CardDescription>
              </div>
              <PermissionGate permission="legal:view">
                <Link href="/legal/meeting-minutes">
                  <Button variant="outline" size="sm">View All</Button>
                </Link>
              </PermissionGate>
            </div>
          </CardHeader>
          <CardContent>
            {recentMeetings.length === 0 ? (
              <p className="text-sm text-muted-foreground">No meeting minutes yet</p>
            ) : (
              <div className="space-y-2">
                {recentMeetings.map((meeting: any) => (
                  <Link
                    key={meeting.id}
                    href={`/legal/meeting-minutes/${meeting.id}`}
                    className="flex items-center justify-between p-2 rounded hover:bg-muted"
                  >
                    <div>
                      <p className="text-sm font-medium">{meeting.title}</p>
                      <p className="text-xs text-muted-foreground">
                        {meeting.meeting_type.replace(/_/g, " ")} • {meeting.status}
                      </p>
                    </div>
                    {meeting.status === "APPROVED" && (
                      <CheckCircle className="h-4 w-4 text-green-600" />
                    )}
                  </Link>
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <PermissionGate permission="legal:view">
          <Link href="/legal/documents">
            <Card className="hover:bg-muted cursor-pointer">
              <CardHeader>
                <CardTitle className="text-lg">Documents</CardTitle>
                <CardDescription>Manage legal documents and certificates</CardDescription>
              </CardHeader>
            </Card>
          </Link>
        </PermissionGate>

        <PermissionGate permission="legal:view">
          <Link href="/legal/meeting-minutes">
            <Card className="hover:bg-muted cursor-pointer">
              <CardHeader>
                <CardTitle className="text-lg">Meeting Minutes</CardTitle>
                <CardDescription>Record and manage meeting minutes</CardDescription>
              </CardHeader>
            </Card>
          </Link>
        </PermissionGate>

        <PermissionGate permission="legal:view">
          <Link href="/legal/sales-documents">
            <Card className="hover:bg-muted cursor-pointer">
              <CardHeader>
                <CardTitle className="text-lg">Sales Documents</CardTitle>
                <CardDescription>View approved documents for bids</CardDescription>
              </CardHeader>
            </Card>
          </Link>
        </PermissionGate>
      </div>
    </div>
  )
}
