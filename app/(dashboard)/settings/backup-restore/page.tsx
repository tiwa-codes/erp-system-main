"use client"

export const dynamic = 'force-dynamic'

import { useState, useEffect } from "react"
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { Badge } from "@/components/ui/badge"
import { StatusIndicator } from "@/components/ui/status-indicator"
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import { useToast } from "@/hooks/use-toast"
import { PermissionGate } from "@/components/ui/permission-gate"
import { BackupProgressTracker, RestoreProgressTracker } from "@/components/ui/progress-bar"
import {


  Database,
  Download,
  Trash2,
  RefreshCw,
  Clock,
  HardDrive,
  AlertTriangle,
  Plus,
  MoreHorizontal,
  Cloud,
  CloudOff,
  Calendar,
  Settings,
  Upload,
} from "lucide-react"

interface Backup {
  id: string
  backup_name: string
  backup_type: "FULL" | "SCHEMA_ONLY" | "DATA_ONLY"
  file_path: string
  cloud_url?: string
  file_size: number
  status: "IN_PROGRESS" | "COMPLETED" | "FAILED" | "DELETED"
  error_message?: string
  created_at: string
  completed_at?: string
  created_by: {
    id: string
    first_name: string
    last_name: string
    email: string
  }
}

interface BackupStats {
  total_backups: number
  completed_backups: number
  failed_backups: number
  total_size_bytes: number
  total_size_mb: number
  last_backup: Backup | null
  active_schedules: number
}

interface BackupSchedule {
  id: string
  frequency: "DAILY" | "WEEKLY" | "MONTHLY"
  time: string
  backup_type: "FULL" | "SCHEMA_ONLY" | "DATA_ONLY"
  retention_days: number
  is_active: boolean
  last_run_at?: string
  next_run_at?: string
  created_by: {
    id: string
    first_name: string
    last_name: string
  }
}

export default function BackupRestorePage() {
  const { toast } = useToast()
  const queryClient = useQueryClient()
  const [page, setPage] = useState(1)
  const [showCreateBackup, setShowCreateBackup] = useState(false)
  const [showRestoreDialog, setShowRestoreDialog] = useState(false)
  const [showUploadRestoreDialog, setShowUploadRestoreDialog] = useState(false)
  const [showScheduleDialog, setShowScheduleDialog] = useState(false)
  const [selectedBackup, setSelectedBackup] = useState<Backup | null>(null)
  const [selectedSchedule, setSelectedSchedule] = useState<BackupSchedule | null>(null)
  const [activeBackupId, setActiveBackupId] = useState<string | null>(null)
  const [activeRestoreId, setActiveRestoreId] = useState<string | null>(null)
  const [uploadedBackupFile, setUploadedBackupFile] = useState<File | null>(null)

  const [backupForm, setBackupForm] = useState({
    backup_name: "",
    backup_type: "FULL" as "FULL" | "SCHEMA_ONLY" | "DATA_ONLY",
    upload_to_cloud: true,
  })

  const [scheduleForm, setScheduleForm] = useState({
    frequency: "DAILY" as "DAILY" | "WEEKLY" | "MONTHLY",
    time: "02:00",
    backup_type: "FULL" as "FULL" | "SCHEMA_ONLY" | "DATA_ONLY",
    retention_days: 30,
    is_active: true,
  })

  // Fetch backups
  const { data: backupsData, isLoading: backupsLoading } = useQuery({
    queryKey: ["backups", page],
    queryFn: async () => {
      const res = await fetch(`/api/settings/backup-restore/backups?page=${page}&limit=10`)
      if (!res.ok) throw new Error("Failed to fetch backups")
      return res.json()
    },
  })

  // Fetch stats
  const { data: statsData } = useQuery({
    queryKey: ["backup-stats"],
    queryFn: async () => {
      const res = await fetch("/api/settings/backup-restore/stats")
      if (!res.ok) throw new Error("Failed to fetch stats")
      return res.json()
    },
  })

  // Fetch schedules
  const { data: schedulesData } = useQuery({
    queryKey: ["backup-schedules"],
    queryFn: async () => {
      const res = await fetch("/api/settings/backup-restore/schedule")
      if (!res.ok) throw new Error("Failed to fetch schedules")
      return res.json()
    },
  })

  const stats: BackupStats = statsData?.data || {
    total_backups: 0,
    completed_backups: 0,
    failed_backups: 0,
    total_size_bytes: 0,
    total_size_mb: 0,
    last_backup: null,
    active_schedules: 0,
  }

  const backups: Backup[] = backupsData?.data?.backups || []
  const schedules: BackupSchedule[] = schedulesData?.data || []

  // Create backup mutation
  const createBackupMutation = useMutation({
    mutationFn: async (data: typeof backupForm) => {
      const res = await fetch("/api/settings/backup-restore/backups", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(data),
      })
      if (!res.ok) {
        const error = await res.json()
        throw new Error(error.error || "Failed to create backup")
      }
      return res.json()
    },
    onSuccess: (data) => {
      const backupId = data.data?.id
      if (backupId) {
        setActiveBackupId(backupId)
        // Keep dialog open to show progress
      } else {
        setShowCreateBackup(false)
        setBackupForm({ backup_name: "", backup_type: "FULL", upload_to_cloud: true })
      }
      queryClient.invalidateQueries({ queryKey: ["backups"] })
      queryClient.invalidateQueries({ queryKey: ["backup-stats"] })
    },
    onError: (error: Error) => {
      toast({
        title: "Error",
        description: error.message,
        variant: "destructive",
      })
    },
  })

  // Restore backup mutation
  const restoreBackupMutation = useMutation({
    mutationFn: async (backupId: string) => {
      const res = await fetch(`/api/settings/backup-restore/backups/${backupId}/restore`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ confirm: true, create_pre_restore_backup: true }),
      })
      if (!res.ok) {
        const error = await res.json()
        throw new Error(error.error || "Failed to restore backup")
      }
      return res.json()
    },
    onSuccess: (data) => {
      console.log("Restore mutation success:", data)
      if (selectedBackup) {
        setActiveRestoreId(selectedBackup.id)
        // Keep dialog open to show progress
      } else {
        setShowRestoreDialog(false)
        setSelectedBackup(null)
      }
      queryClient.invalidateQueries({ queryKey: ["backups"] })
    },
    onError: (error: Error) => {
      toast({
        title: "Error",
        description: error.message,
        variant: "destructive",
      })
    },
  })

  // Delete backup mutation
  const deleteBackupMutation = useMutation({
    mutationFn: async (backupId: string) => {
      const res = await fetch(`/api/settings/backup-restore/backups/${backupId}`, {
        method: "DELETE",
      })
      if (!res.ok) {
        const error = await res.json()
        throw new Error(error.error || "Failed to delete backup")
      }
      return res.json()
    },
    onSuccess: () => {
      toast({
        title: "Success",
        description: "Backup deleted successfully",
      })
      queryClient.invalidateQueries({ queryKey: ["backups"] })
      queryClient.invalidateQueries({ queryKey: ["backup-stats"] })
    },
    onError: (error: Error) => {
      toast({
        title: "Error",
        description: error.message,
        variant: "destructive",
      })
    },
  })

  // Create schedule mutation
  const createScheduleMutation = useMutation({
    mutationFn: async (data: typeof scheduleForm) => {
      const res = await fetch("/api/settings/backup-restore/schedule", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(data),
      })
      if (!res.ok) {
        const error = await res.json()
        throw new Error(error.error || "Failed to create schedule")
      }
      return res.json()
    },
    onSuccess: () => {
      toast({
        title: "Success",
        description: "Backup schedule created successfully",
      })
      setShowScheduleDialog(false)
      setScheduleForm({
        frequency: "DAILY",
        time: "02:00",
        backup_type: "FULL",
        retention_days: 30,
        is_active: true,
      })
      queryClient.invalidateQueries({ queryKey: ["backup-schedules"] })
    },
    onError: (error: Error) => {
      toast({
        title: "Error",
        description: error.message,
        variant: "destructive",
      })
    },
  })

  const formatFileSize = (bytes: number): string => {
    if (bytes < 1024) return `${bytes} B`
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(2)} KB`
    return `${(bytes / (1024 * 1024)).toFixed(2)} MB`
  }

  const formatDate = (dateString: string): string => {
    return new Date(dateString).toLocaleString()
  }

  const handleDownload = (backup: Backup) => {
    window.open(`/api/settings/backup-restore/backups/${backup.id}/download`, "_blank")
  }

  const handleRestore = (backup: Backup) => {
    setSelectedBackup(backup)
    setShowRestoreDialog(true)
  }

  const confirmRestore = () => {
    if (!selectedBackup) {
      toast({
        title: "Error",
        description: "Please select a backup to restore",
        variant: "destructive",
      })
      return
    }
    
    console.log("Starting restore for backup:", selectedBackup.id)
    restoreBackupMutation.mutate(selectedBackup.id)
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold">Backup and Restore</h1>
          <p className="text-gray-600 mt-1">Manage database backups and restore operations</p>
        </div>
        <PermissionGate permission="settings.edit">
          <Button onClick={() => setShowCreateBackup(true)}>
            <Plus className="h-4 w-4 mr-2" />
            Create Backup
          </Button>
        </PermissionGate>
      </div>

      {/* Statistics Cards */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <Card>
          <CardContent className="p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-gray-600">Total Backups</p>
                <p className="text-2xl font-bold mt-1">{stats.total_backups}</p>
              </div>
              <Database className="h-8 w-8 text-blue-500" />
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-gray-600">Total Size</p>
                <p className="text-2xl font-bold mt-1">{stats.total_size_mb} MB</p>
              </div>
              <HardDrive className="h-8 w-8 text-green-500" />
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-gray-600">Last Backup</p>
                <p className="text-sm font-medium mt-1">
                  {stats.last_backup
                    ? formatDate(stats.last_backup.created_at)
                    : "Never"}
                </p>
              </div>
              <Clock className="h-8 w-8 text-orange-500" />
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-gray-600">Active Schedules</p>
                <p className="text-2xl font-bold mt-1">{stats.active_schedules}</p>
              </div>
              <Calendar className="h-8 w-8 text-purple-500" />
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Restore Section */}
      <Card>
        <CardHeader>
          <CardTitle>Restore Database</CardTitle>
          <CardDescription>Restore database from a backup file or select from existing backups</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="space-y-4">
            <div className="flex items-center gap-4">
              <PermissionGate permission="settings.edit">
                <Button
                  variant="outline"
                  onClick={() => {
                    setShowRestoreDialog(true)
                    setSelectedBackup(null)
                  }}
                >
                  <RefreshCw className="h-4 w-4 mr-2" />
                  Restore from Existing Backup
                </Button>
              </PermissionGate>
              <PermissionGate permission="settings.edit">
                <Button
                  variant="outline"
                  onClick={() => {
                    setShowUploadRestoreDialog(true)
                  }}
                >
                  <Database className="h-4 w-4 mr-2" />
                  Upload and Restore Backup File
                </Button>
              </PermissionGate>
            </div>
            <p className="text-sm text-gray-600">
              Select an existing backup from the list below, or upload a backup file to restore the database.
              A pre-restore backup will be created automatically before restoring.
            </p>
          </div>
        </CardContent>
      </Card>

      {/* Backups Table */}
      <Card>
        <CardHeader>
          <CardTitle>Backups</CardTitle>
          <CardDescription>List of all database backups</CardDescription>
        </CardHeader>
        <CardContent>
          {backupsLoading ? (
            <div className="text-center py-8">Loading...</div>
          ) : backups.length === 0 ? (
            <div className="text-center py-8 text-gray-500">No backups found</div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Name</TableHead>
                  <TableHead>Type</TableHead>
                  <TableHead>Size</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Created</TableHead>
                  <TableHead>Cloud</TableHead>
                  <TableHead className="text-right">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {backups.map((backup) => (
                  <TableRow key={backup.id}>
                    <TableCell className="font-medium">{backup.backup_name}</TableCell>
                    <TableCell>
                      <Badge variant="outline">{backup.backup_type}</Badge>
                    </TableCell>
                    <TableCell>{formatFileSize(backup.file_size)}</TableCell>
                    <TableCell>
                      <StatusIndicator status={backup.status} />
                    </TableCell>
                    <TableCell>{formatDate(backup.created_at)}</TableCell>
                    <TableCell>
                      {backup.cloud_url ? (
                        <Cloud className="h-4 w-4 text-green-500" />
                      ) : (
                        <CloudOff className="h-4 w-4 text-gray-400" />
                      )}
                    </TableCell>
                    <TableCell className="text-right">
                      <DropdownMenu>
                        <DropdownMenuTrigger asChild>
                          <Button variant="ghost" size="sm">
                            <MoreHorizontal className="h-4 w-4" />
                          </Button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent align="end">
                          {backup.status === "COMPLETED" && (
                            <>
                              <DropdownMenuItem onClick={() => handleDownload(backup)}>
                                <Download className="h-4 w-4 mr-2" />
                                Download
                              </DropdownMenuItem>
                              <PermissionGate permission="settings.edit">
                                <DropdownMenuItem
                                  onClick={() => handleRestore(backup)}
                                  className="text-orange-600"
                                >
                                  <RefreshCw className="h-4 w-4 mr-2" />
                                  Restore
                                </DropdownMenuItem>
                              </PermissionGate>
                            </>
                          )}
                          <PermissionGate permission="settings.edit">
                            <DropdownMenuItem
                              onClick={() => deleteBackupMutation.mutate(backup.id)}
                              className="text-red-600"
                            >
                              <Trash2 className="h-4 w-4 mr-2" />
                              Delete
                            </DropdownMenuItem>
                          </PermissionGate>
                        </DropdownMenuContent>
                      </DropdownMenu>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>

      {/* Scheduled Backups */}
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <div>
              <CardTitle>Scheduled Backups</CardTitle>
              <CardDescription>Automated backup schedules</CardDescription>
            </div>
            <PermissionGate permission="settings.edit">
              <Button onClick={() => setShowScheduleDialog(true)} size="sm">
                <Plus className="h-4 w-4 mr-2" />
                Add Schedule
              </Button>
            </PermissionGate>
          </div>
        </CardHeader>
        <CardContent>
          {schedules.length === 0 ? (
            <div className="text-center py-8 text-gray-500">No scheduled backups</div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Frequency</TableHead>
                  <TableHead>Time</TableHead>
                  <TableHead>Type</TableHead>
                  <TableHead>Retention</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Next Run</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {schedules.map((schedule) => (
                  <TableRow key={schedule.id}>
                    <TableCell>
                      <Badge variant="outline">{schedule.frequency}</Badge>
                    </TableCell>
                    <TableCell>{schedule.time}</TableCell>
                    <TableCell>
                      <Badge variant="secondary">{schedule.backup_type}</Badge>
                    </TableCell>
                    <TableCell>{schedule.retention_days} days</TableCell>
                    <TableCell>
                      <StatusIndicator
                        status={schedule.is_active ? "ACTIVE" : "INACTIVE"}
                      />
                    </TableCell>
                    <TableCell>
                      {schedule.next_run_at
                        ? formatDate(schedule.next_run_at)
                        : "Not scheduled"}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>

      {/* Create Backup Dialog */}
      <Dialog open={showCreateBackup} onOpenChange={(open) => {
        setShowCreateBackup(open)
        if (!open) {
          setActiveBackupId(null)
          setBackupForm({ backup_name: "", backup_type: "FULL", upload_to_cloud: true })
        }
      }}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Create Backup</DialogTitle>
            <DialogDescription>Create a new database backup</DialogDescription>
          </DialogHeader>
          
          {activeBackupId ? (
            <BackupProgressTracker
              backupId={activeBackupId}
              onComplete={() => {
                toast({
                  title: "Success",
                  description: "Backup created successfully",
                })
                setShowCreateBackup(false)
                setActiveBackupId(null)
                setBackupForm({ backup_name: "", backup_type: "FULL", upload_to_cloud: true })
                queryClient.invalidateQueries({ queryKey: ["backups"] })
                queryClient.invalidateQueries({ queryKey: ["backup-stats"] })
              }}
              onError={(error) => {
                toast({
                  title: "Error",
                  description: error,
                  variant: "destructive",
                })
                setActiveBackupId(null)
              }}
            />
          ) : (
            <div className="space-y-4">
            <div>
              <Label htmlFor="backup_name">Backup Name (Optional)</Label>
              <Input
                id="backup_name"
                value={backupForm.backup_name}
                onChange={(e) =>
                  setBackupForm({ ...backupForm, backup_name: e.target.value })
                }
                placeholder="Enter backup name"
              />
            </div>
            <div>
              <Label htmlFor="backup_type">Backup Type</Label>
              <Select
                value={backupForm.backup_type}
                onValueChange={(value: any) =>
                  setBackupForm({ ...backupForm, backup_type: value })
                }
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="FULL">Full Backup</SelectItem>
                  <SelectItem value="SCHEMA_ONLY">Schema Only</SelectItem>
                  <SelectItem value="DATA_ONLY">Data Only</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="flex items-center space-x-2">
              <input
                type="checkbox"
                id="upload_to_cloud"
                checked={backupForm.upload_to_cloud}
                onChange={(e) =>
                  setBackupForm({ ...backupForm, upload_to_cloud: e.target.checked })
                }
                className="rounded"
              />
              <Label htmlFor="upload_to_cloud">Upload to Cloudinary</Label>
            </div>
            </div>
          )}
          
          {!activeBackupId && (
            <DialogFooter>
              <Button variant="outline" onClick={() => setShowCreateBackup(false)}>
                Cancel
              </Button>
              <Button
                onClick={() => createBackupMutation.mutate(backupForm)}
                disabled={createBackupMutation.isPending}
              >
                {createBackupMutation.isPending ? "Creating..." : "Create Backup"}
              </Button>
            </DialogFooter>
          )}
        </DialogContent>
      </Dialog>

      {/* Restore Confirmation Dialog */}
      <Dialog open={showRestoreDialog} onOpenChange={(open) => {
        setShowRestoreDialog(open)
        if (!open) {
          setActiveRestoreId(null)
          setSelectedBackup(null)
        }
      }}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-orange-600">
              <AlertTriangle className="h-5 w-5" />
              {activeRestoreId ? "Restoring Database" : "Select Backup to Restore"}
            </DialogTitle>
            <DialogDescription>
              {activeRestoreId
                ? "Database restore in progress. Please wait..."
                : "Select a backup from the list below to restore the database. This will overwrite all current data. A pre-restore backup will be created automatically."}
            </DialogDescription>
          </DialogHeader>
          
          {activeRestoreId ? (
            <RestoreProgressTracker
              backupId={activeRestoreId}
              onComplete={() => {
                toast({
                  title: "Success",
                  description: "Database restored successfully",
                })
                setShowRestoreDialog(false)
                setActiveRestoreId(null)
                setSelectedBackup(null)
                queryClient.invalidateQueries({ queryKey: ["backups"] })
              }}
              onError={(error) => {
                toast({
                  title: "Error",
                  description: error,
                  variant: "destructive",
                })
                setActiveRestoreId(null)
              }}
            />
          ) : (
            <>
              <div className="space-y-4">
                {backups.filter(b => b.status === "COMPLETED").length === 0 ? (
                  <div className="text-center py-8 text-gray-500">
                    No completed backups available for restore
                  </div>
                ) : (
                  <div className="max-h-96 overflow-y-auto">
                    <Table>
                      <TableHeader>
                        <TableRow>
                          <TableHead>Name</TableHead>
                          <TableHead>Type</TableHead>
                          <TableHead>Size</TableHead>
                          <TableHead>Created</TableHead>
                          <TableHead>Action</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {backups
                          .filter(b => b.status === "COMPLETED")
                          .map((backup) => (
                            <TableRow key={backup.id}>
                              <TableCell className="font-medium">{backup.backup_name}</TableCell>
                              <TableCell>
                                <Badge variant="outline">{backup.backup_type}</Badge>
                              </TableCell>
                              <TableCell>{formatFileSize(backup.file_size)}</TableCell>
                              <TableCell>{formatDate(backup.created_at)}</TableCell>
                              <TableCell>
                                <Button
                                  size="sm"
                                  variant={selectedBackup?.id === backup.id ? "default" : "outline"}
                                  onClick={() => {
                                    console.log("Select backup clicked:", backup.id, backup.backup_name)
                                    setSelectedBackup(backup)
                                    console.log("selectedBackup set to:", backup)
                                  }}
                                  disabled={restoreBackupMutation.isPending}
                                >
                                  {selectedBackup?.id === backup.id ? "Selected" : "Select"}
                                </Button>
                              </TableCell>
                            </TableRow>
                          ))}
                      </TableBody>
                    </Table>
                  </div>
                )}
                {selectedBackup && (
                  <div className="bg-yellow-50 border border-yellow-200 rounded p-3">
                    <p className="text-sm text-yellow-800">
                      <AlertTriangle className="h-4 w-4 inline mr-2" />
                      Selected: {selectedBackup.backup_name} - This will replace all current database data.
                    </p>
                  </div>
                )}
              </div>
              <DialogFooter>
                <Button variant="outline" onClick={() => setShowRestoreDialog(false)}>
                  Cancel
                </Button>
                <Button
                  variant="destructive"
                  onClick={() => {
                    console.log("Confirm Restore button clicked")
                    console.log("selectedBackup:", selectedBackup)
                    confirmRestore()
                  }}
                  disabled={!selectedBackup || restoreBackupMutation.isPending}
                >
                  {restoreBackupMutation.isPending ? "Restoring..." : "Confirm Restore"}
                </Button>
              </DialogFooter>
            </>
          )}
        </DialogContent>
      </Dialog>

      {/* Upload and Restore Dialog */}
      <Dialog open={showUploadRestoreDialog} onOpenChange={(open) => {
        setShowUploadRestoreDialog(open)
        if (!open) {
          setUploadedBackupFile(null)
        }
      }}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-orange-600">
              <Upload className="h-5 w-5" />
              Upload and Restore Backup
            </DialogTitle>
            <DialogDescription>
              Upload a backup file (.sql) to restore the database. This will overwrite all current data.
              A pre-restore backup will be created automatically.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div>
              <Label htmlFor="backup_file">Backup File (.sql)</Label>
              <Input
                id="backup_file"
                type="file"
                accept=".sql,.dump"
                onChange={(e) => {
                  const file = e.target.files?.[0]
                  if (file) {
                    setUploadedBackupFile(file)
                  }
                }}
              />
              {uploadedBackupFile && (
                <p className="text-sm text-gray-600 mt-2">
                  Selected: {uploadedBackupFile.name} ({(uploadedBackupFile.size / (1024 * 1024)).toFixed(2)} MB)
                </p>
              )}
            </div>
            <div className="bg-yellow-50 border border-yellow-200 rounded p-3">
              <p className="text-sm text-yellow-800">
                <AlertTriangle className="h-4 w-4 inline mr-2" />
                Warning: This will replace all current database data with the backup file contents.
              </p>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowUploadRestoreDialog(false)}>
              Cancel
            </Button>
            <Button
              variant="destructive"
              onClick={async () => {
                if (!uploadedBackupFile) {
                  toast({
                    title: "Error",
                    description: "Please select a backup file",
                    variant: "destructive",
                  })
                  return
                }

                try {
                  // Upload file to server first
                  const formData = new FormData()
                  formData.append('file', uploadedBackupFile)

                  const uploadRes = await fetch('/api/settings/backup-restore/backups/upload-restore', {
                    method: 'POST',
                    body: formData,
                  })

                  if (!uploadRes.ok) {
                    const error = await uploadRes.json()
                    throw new Error(error.error || 'Failed to upload backup file')
                  }

                  const uploadData = await uploadRes.json()
                  
                  // Now restore from the uploaded file
                  if (uploadData.data?.backup_id) {
                    setSelectedBackup({ id: uploadData.data.backup_id } as Backup)
                    setShowUploadRestoreDialog(false)
                    restoreBackupMutation.mutate(uploadData.data.backup_id)
                  }
                } catch (error) {
                  toast({
                    title: "Error",
                    description: error instanceof Error ? error.message : "Failed to upload backup file",
                    variant: "destructive",
                  })
                }
              }}
              disabled={!uploadedBackupFile || restoreBackupMutation.isPending}
            >
              {restoreBackupMutation.isPending ? "Restoring..." : "Upload and Restore"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Schedule Dialog */}
      <Dialog open={showScheduleDialog} onOpenChange={setShowScheduleDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Create Backup Schedule</DialogTitle>
            <DialogDescription>Set up an automated backup schedule</DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div>
              <Label htmlFor="frequency">Frequency</Label>
              <Select
                value={scheduleForm.frequency}
                onValueChange={(value: any) =>
                  setScheduleForm({ ...scheduleForm, frequency: value })
                }
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="DAILY">Daily</SelectItem>
                  <SelectItem value="WEEKLY">Weekly</SelectItem>
                  <SelectItem value="MONTHLY">Monthly</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label htmlFor="time">Time (HH:MM)</Label>
              <Input
                id="time"
                type="time"
                value={scheduleForm.time}
                onChange={(e) =>
                  setScheduleForm({ ...scheduleForm, time: e.target.value })
                }
              />
            </div>
            <div>
              <Label htmlFor="schedule_backup_type">Backup Type</Label>
              <Select
                value={scheduleForm.backup_type}
                onValueChange={(value: any) =>
                  setScheduleForm({ ...scheduleForm, backup_type: value })
                }
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="FULL">Full Backup</SelectItem>
                  <SelectItem value="SCHEMA_ONLY">Schema Only</SelectItem>
                  <SelectItem value="DATA_ONLY">Data Only</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label htmlFor="retention_days">Retention Days</Label>
              <Input
                id="retention_days"
                type="number"
                min="1"
                max="365"
                value={scheduleForm.retention_days}
                onChange={(e) =>
                  setScheduleForm({
                    ...scheduleForm,
                    retention_days: parseInt(e.target.value) || 30,
                  })
                }
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowScheduleDialog(false)}>
              Cancel
            </Button>
            <Button
              onClick={() => createScheduleMutation.mutate(scheduleForm)}
              disabled={createScheduleMutation.isPending}
            >
              {createScheduleMutation.isPending ? "Creating..." : "Create Schedule"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}

