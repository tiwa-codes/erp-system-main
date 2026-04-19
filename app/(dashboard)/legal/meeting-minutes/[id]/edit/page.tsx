"use client"

import { useState, useEffect } from "react"
import { useRouter } from "next/navigation"
import { useQuery, useMutation } from "@tanstack/react-query"
import { useToast } from "@/hooks/use-toast"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { FileUpload } from "@/components/ui/file-upload"
import { ArrowLeft, Save, Plus, X } from "lucide-react"
import Link from "next/link"
import { useFileUpload } from "@/hooks/use-file-upload"
import { MeetingType } from "@prisma/client"

interface Attendee {
  name: string
  email?: string
}

export default function EditMeetingMinutesPage({
  params,
}: {
  params: { id: string }
}) {
  const router = useRouter()
  const { toast } = useToast()

  const { data, isLoading } = useQuery({
    queryKey: ["meeting-minutes", params.id],
    queryFn: async () => {
      const res = await fetch(`/api/legal/meeting-minutes/${params.id}`)
      if (!res.ok) throw new Error("Failed to fetch meeting minutes")
      return res.json()
    },
  })

  const meeting = data?.data

  const { uploadFiles, isUploading: isUploadingFiles } = useFileUpload({
    folder: "legal-documents",
    resourceType: "auto",
  })

  const [form, setForm] = useState({
    meeting_type: "" as MeetingType | "",
    meeting_date: "",
    title: "",
    meeting_notes: "",
  })

  const [attendees, setAttendees] = useState<Attendee[]>([])
  const [newAttendee, setNewAttendee] = useState({ name: "", email: "" })
  const [attachmentUrls, setAttachmentUrls] = useState<string[]>([])

  useEffect(() => {
    if (meeting) {
      setForm({
        meeting_type: meeting.meeting_type || "",
        meeting_date: meeting.meeting_date
          ? new Date(meeting.meeting_date).toISOString().slice(0, 16)
          : "",
        title: meeting.title || "",
        meeting_notes: meeting.meeting_notes || "",
      })
      setAttendees(Array.isArray(meeting.attendees) ? meeting.attendees : [])
      setAttachmentUrls(Array.isArray(meeting.attachments) ? meeting.attachments : [])
    }
  }, [meeting])

  const updateMutation = useMutation({
    mutationFn: async (data: any) => {
      const res = await fetch(`/api/legal/meeting-minutes/${params.id}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(data),
      })
      if (!res.ok) {
        const error = await res.json()
        throw new Error(error.error || "Failed to update meeting minutes")
      }
      return res.json()
    },
    onSuccess: () => {
      toast({
        title: "Success",
        description: "Meeting minutes updated successfully",
      })
      router.push(`/legal/meeting-minutes/${params.id}`)
    },
    onError: (error: Error) => {
      toast({
        title: "Error",
        description: error.message,
        variant: "destructive",
      })
    },
  })

  const handleAddAttendee = () => {
    if (!newAttendee.name.trim()) return
    setAttendees([...attendees, { ...newAttendee }])
    setNewAttendee({ name: "", email: "" })
  }

  const handleRemoveAttendee = (index: number) => {
    setAttendees(attendees.filter((_, i) => i !== index))
  }

  const handleAttachmentUpload = async (files: File[]) => {
    if (files.length === 0) return
    try {
      const results = await uploadFiles(files)
      const urls = results.map((r) => r.secure_url)
      setAttachmentUrls([...attachmentUrls, ...urls])
      toast({
        title: "Success",
        description: "Attachments uploaded successfully",
      })
    } catch (error) {
      toast({
        title: "Error",
        description: error instanceof Error ? error.message : "Failed to upload attachments",
        variant: "destructive",
      })
    }
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()

    if (!meeting) return

    const payload = {
      meeting_type: form.meeting_type,
      meeting_date: new Date(form.meeting_date).toISOString(),
      title: form.title,
      attendees: attendees,
      meeting_notes: form.meeting_notes,
      attachments: attachmentUrls,
    }

    updateMutation.mutate(payload)
  }

  if (isLoading) {
    return <div className="text-center py-8">Loading...</div>
  }

  if (!meeting) {
    return <div className="text-center py-8">Meeting minutes not found</div>
  }

  if (meeting.status !== "DRAFT") {
    return (
      <div className="text-center py-8">
        <p className="text-muted-foreground mb-4">
          Only draft meeting minutes can be edited
        </p>
        <Link href={`/legal/meeting-minutes/${params.id}`}>
          <Button variant="outline">Back to Meeting Minutes</Button>
        </Link>
      </div>
    )
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-4">
        <Link href={`/legal/meeting-minutes/${params.id}`}>
          <Button variant="ghost" size="sm">
            <ArrowLeft className="h-4 w-4 mr-1" />
            Back
          </Button>
        </Link>
        <div>
          <h1 className="text-3xl font-bold">Edit Meeting Minutes</h1>
          <p className="text-muted-foreground">Update meeting minutes information</p>
        </div>
      </div>

      <form onSubmit={handleSubmit}>
        <Card>
          <CardHeader>
            <CardTitle>Meeting Information</CardTitle>
            <CardDescription>Update meeting details and notes</CardDescription>
          </CardHeader>
          <CardContent className="space-y-6">
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="meeting_type">Meeting Type *</Label>
                <Select
                  value={form.meeting_type}
                  onValueChange={(value) =>
                    setForm((prev) => ({ ...prev, meeting_type: value as MeetingType }))
                  }
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Select meeting type" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="BOARD_MEETING">Board Meeting</SelectItem>
                    <SelectItem value="MANAGEMENT_MEETING">Management Meeting</SelectItem>
                    <SelectItem value="COMMITTEE_MEETING">Committee Meeting</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-2">
                <Label htmlFor="meeting_date">Meeting Date *</Label>
                <Input
                  id="meeting_date"
                  type="datetime-local"
                  value={form.meeting_date}
                  onChange={(e) => setForm((prev) => ({ ...prev, meeting_date: e.target.value }))}
                  required
                />
              </div>
            </div>

            <div className="space-y-2">
              <Label htmlFor="title">Title *</Label>
              <Input
                id="title"
                value={form.title}
                onChange={(e) => setForm((prev) => ({ ...prev, title: e.target.value }))}
                placeholder="Enter meeting title"
                required
              />
            </div>

            <div className="space-y-2">
              <Label>Attendees</Label>
              <div className="flex gap-2">
                <Input
                  placeholder="Name"
                  value={newAttendee.name}
                  onChange={(e) => setNewAttendee((prev) => ({ ...prev, name: e.target.value }))}
                />
                <Input
                  placeholder="Email (optional)"
                  type="email"
                  value={newAttendee.email}
                  onChange={(e) => setNewAttendee((prev) => ({ ...prev, email: e.target.value }))}
                />
                <Button type="button" onClick={handleAddAttendee} variant="outline">
                  <Plus className="h-4 w-4 mr-1" />
                  Add
                </Button>
              </div>
              {attendees.length > 0 && (
                <div className="mt-2 space-y-1">
                  {attendees.map((attendee, index) => (
                    <div
                      key={index}
                      className="flex items-center justify-between p-2 bg-muted rounded"
                    >
                      <span>
                        {attendee.name}
                        {attendee.email && (
                          <span className="text-muted-foreground ml-2">({attendee.email})</span>
                        )}
                      </span>
                      <Button
                        type="button"
                        variant="ghost"
                        size="sm"
                        onClick={() => handleRemoveAttendee(index)}
                      >
                        <X className="h-4 w-4" />
                      </Button>
                    </div>
                  ))}
                </div>
              )}
            </div>

            <div className="space-y-2">
              <Label htmlFor="meeting_notes">Meeting Notes *</Label>
              <Textarea
                id="meeting_notes"
                value={form.meeting_notes}
                onChange={(e) => setForm((prev) => ({ ...prev, meeting_notes: e.target.value }))}
                placeholder="Enter meeting notes..."
                rows={12}
                required
              />
            </div>

            <div className="space-y-2">
              <Label>Attachments (Optional)</Label>
              <FileUpload
                onUpload={handleAttachmentUpload}
                onRemove={() => setAttachmentUrls([])}
                acceptedTypes={["image/*", "application/pdf"]}
                maxFiles={5}
                folder="legal-documents"
                resourceType="auto"
                disabled={isUploadingFiles}
              />
              {attachmentUrls.length > 0 && (
                <div className="mt-2 space-y-1">
                  {attachmentUrls.map((url, index) => (
                    <div key={index} className="flex items-center justify-between p-2 border rounded">
                      <a
                        href={url}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="text-blue-600 hover:underline text-sm"
                      >
                        Attachment {index + 1}
                      </a>
                      <Button
                        type="button"
                        variant="ghost"
                        size="sm"
                        onClick={() => setAttachmentUrls(attachmentUrls.filter((_, i) => i !== index))}
                      >
                        <X className="h-4 w-4" />
                      </Button>
                    </div>
                  ))}
                </div>
              )}
            </div>

            <div className="flex gap-2">
              <Button type="submit" disabled={updateMutation.isPending || isUploadingFiles}>
                <Save className="h-4 w-4 mr-1" />
                {updateMutation.isPending ? "Saving..." : "Save Changes"}
              </Button>
              <Link href={`/legal/meeting-minutes/${params.id}`}>
                <Button type="button" variant="outline">
                  Cancel
                </Button>
              </Link>
            </div>
          </CardContent>
        </Card>
      </form>
    </div>
  )
}

