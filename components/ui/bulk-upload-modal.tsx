"use client"

import { useState, useRef } from "react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from "@/components/ui/dialog"
import { useToast } from "@/hooks/use-toast"
import { Upload, Download, FileSpreadsheet, X } from "lucide-react"
import * as XLSX from 'xlsx'

interface BulkUploadModalProps {
  isOpen: boolean
  onClose: () => void
  module: string
  submodule?: string
  onUploadSuccess: (data: any[], processedCount?: number) => void
  uploadEndpoint: string
  sampleFileName: string
  acceptedColumns: string[]
  requiredColumns?: string[] // Optional: specify which columns are actually required
  maxFileSize?: number // in MB
  providerId?: string // Optional: provider ID for tariff plan uploads
}

export function BulkUploadModal({
  isOpen,
  onClose,
  module,
  submodule,
  onUploadSuccess,
  uploadEndpoint,
  sampleFileName,
  acceptedColumns,
  requiredColumns,
  maxFileSize = 200,
  providerId
}: BulkUploadModalProps) {
  const { toast } = useToast()
  const [selectedFile, setSelectedFile] = useState<File | null>(null)
  const [isUploading, setIsUploading] = useState(false)
  const [dragActive, setDragActive] = useState(false)
  const fileInputRef = useRef<HTMLInputElement>(null)

  const handleFileSelect = (file: File) => {
    // Validate file type
    if (!file.name.endsWith('.xlsx') && !file.name.endsWith('.xls')) {
      toast({
        title: "Invalid file type",
        description: "Please select an Excel file (.xlsx or .xls)",
        variant: "destructive",
      })
      return
    }

    // Validate file size
    const fileSizeMB = file.size / (1024 * 1024)
    if (fileSizeMB > maxFileSize) {
      toast({
        title: "File too large",
        description: `File size must be less than ${maxFileSize}MB`,
        variant: "destructive",
      })
      return
    }

    setSelectedFile(file)
  }

  const handleDrag = (e: React.DragEvent) => {
    e.preventDefault()
    e.stopPropagation()
    if (e.type === "dragenter" || e.type === "dragover") {
      setDragActive(true)
    } else if (e.type === "dragleave") {
      setDragActive(false)
    }
  }

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault()
    e.stopPropagation()
    setDragActive(false)

    if (e.dataTransfer.files && e.dataTransfer.files[0]) {
      handleFileSelect(e.dataTransfer.files[0])
    }
  }

  const handleFileInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      handleFileSelect(e.target.files[0])
    }
  }

  const handleUpload = async () => {
    if (!selectedFile) {
      toast({
        title: "No file selected",
        description: "Please select a file to upload",
        variant: "destructive",
      })
      return
    }

    setIsUploading(true)

    try {
      // Read the Excel file
      const data = await readExcelFile(selectedFile)

      // Validate the data structure
      const validationResult = validateExcelData(data, acceptedColumns, requiredColumns)
      if (!validationResult.isValid) {
        toast({
          title: "Invalid file format",
          description: validationResult.error,
          variant: "destructive",
        })
        setIsUploading(false)
        return
      }

      // Upload to API
      const formData = new FormData()
      formData.append('file', selectedFile)
      formData.append('module', module)
      if (submodule) {
        formData.append('submodule', submodule)
      }
      if (providerId) {
        formData.append('provider_id', providerId)
      }

      const response = await fetch(uploadEndpoint, {
        method: 'POST',
        body: formData,
      })

      if (!response.ok) {
        let errorMsg = `Upload failed (${response.status})`
        try {
          const error = await response.json()
          errorMsg = error.error || errorMsg
        } catch {
          // Response was not JSON (e.g., 413 Request Entity Too Large from Nginx)
          if (response.status === 413) {
            errorMsg = 'File too large. Please reduce file size and try again.'
          } else if (response.status === 403) {
            errorMsg = 'You do not have permission to upload tariff files.'
          } else {
            errorMsg = `Server error (${response.status}). Please try again or contact support.`
          }
        }
        throw new Error(errorMsg)
      }

      const result = await response.json()

      // Check for errors or duplicates in the result
      const hasErrors = result.results?.errors?.length > 0
      const hasDuplicates = result.results?.duplicates?.length > 0
      const successCount = result.processedCount || 0
      
      if (successCount === 0 && (hasErrors || hasDuplicates)) {
        // All records failed - show detailed error
        let errorMessage = "Upload failed. "
        
        if (hasErrors) {
          const errorSummary = result.results.errors.slice(0, 3).map((e: any) => 
            `Row ${e.row}: ${e.error}`
          ).join("; ")
          errorMessage += `Errors: ${errorSummary}`
          if (result.results.errors.length > 3) {
            errorMessage += ` (and ${result.results.errors.length - 3} more errors)`
          }
        }
        
        if (hasDuplicates) {
          if (hasErrors) errorMessage += ". "
          errorMessage += `${result.results.duplicates.length} duplicate(s) found`
        }
        
        toast({
          title: "Upload failed",
          description: errorMessage,
          variant: "destructive",
        })
        setIsUploading(false)
        return
      }

      // Show success with warning if some records failed
      let description = `Successfully uploaded ${successCount} record(s)`
      if (hasErrors || hasDuplicates) {
        description += `. ${hasErrors ? result.results.errors.length + ' error(s)' : ''} ${hasDuplicates ? result.results.duplicates.length + ' duplicate(s)' : ''}`
      }

      toast({
        title: "Upload successful",
        description: description,
      })

      onUploadSuccess(result.data || [], result.processedCount)
      
      // Reset state before closing to prevent re-upload
      setSelectedFile(null)
      if (fileInputRef.current) {
        fileInputRef.current.value = ""
      }
      handleClose()

    } catch (error: any) {
      // Extract specific error message from API response
      let errorMessage = "An error occurred during upload"
      
      if (error.response?.data?.error) {
        errorMessage = error.response.data.error
      } else if (error.message) {
        errorMessage = error.message
      }
      
      // If there are detailed errors array, show first few
      if (error.response?.data?.errors && Array.isArray(error.response.data.errors)) {
        const errorList = error.response.data.errors.slice(0, 3).join("; ")
        const remaining = error.response.data.errors.length - 3
        errorMessage += ": " + errorList
        if (remaining > 0) {
          errorMessage += ` (and ${remaining} more errors)`
        }
      }
      
      toast({
        title: "Upload failed",
        description: errorMessage,
        variant: "destructive",
      })
    } finally {
      setIsUploading(false)
    }
  }

  const handleDownloadSample = () => {
    const sampleData = generateSampleData(module, acceptedColumns, submodule)
    const ws = XLSX.utils.json_to_sheet(sampleData)
    const wb = XLSX.utils.book_new()
    XLSX.utils.book_append_sheet(wb, ws, "Sample Data")
    XLSX.writeFile(wb, sampleFileName)
  }

  const handleClose = () => {
    setSelectedFile(null)
    setIsUploading(false)
    setDragActive(false)
    if (fileInputRef.current) {
      fileInputRef.current.value = ""
    }
    onClose()
  }

  return (
    <Dialog open={isOpen} onOpenChange={handleClose}>
      <DialogContent className="sm:max-w-[500px]">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Upload className="h-5 w-5 text-blue-600" />
            Bulk Upload
          </DialogTitle>
          <DialogDescription>
            Upload multiple records at once using an Excel file
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          {/* File Upload Area */}
          <div
            className={`border-2 border-dashed rounded-lg p-6 text-center transition-colors ${dragActive
              ? "border-blue-500 bg-blue-50"
              : selectedFile
                ? "border-green-500 bg-green-50"
                : "border-gray-300 hover:border-gray-400"
              }`}
            onDragEnter={handleDrag}
            onDragLeave={handleDrag}
            onDragOver={handleDrag}
            onDrop={handleDrop}
          >
            {selectedFile ? (
              <div className="space-y-2">
                <FileSpreadsheet className="h-12 w-12 text-green-600 mx-auto" />
                <p className="text-sm font-medium text-green-800">{selectedFile.name}</p>
                <p className="text-xs text-green-600">
                  {(selectedFile.size / (1024 * 1024)).toFixed(2)} MB
                </p>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => setSelectedFile(null)}
                  className="text-red-600 hover:text-red-700"
                >
                  <X className="h-4 w-4 mr-1" />
                  Remove
                </Button>
              </div>
            ) : (
              <div className="space-y-2">
                <Upload className="h-12 w-12 text-gray-400 mx-auto" />
                <div>
                  <p className="text-sm font-medium text-gray-900">
                    Drag and drop your file here
                  </p>
                  <p className="text-xs text-gray-500">or</p>
                </div>
                <Button
                  variant="outline"
                  onClick={() => fileInputRef.current?.click()}
                  className="mt-2"
                >
                  Browse Files
                </Button>
              </div>
            )}
          </div>

          {/* Hidden file input */}
          <Input
            ref={fileInputRef}
            type="file"
            accept=".xlsx,.xls"
            onChange={handleFileInputChange}
            className="hidden"
          />

          {/* File Requirements */}
          <div className="text-xs text-gray-500 space-y-1">
            <p>* Only XLSX Format (Max {maxFileSize}MB)</p>
            <p>
              Required columns: {requiredColumns && requiredColumns.length > 0
                ? requiredColumns.join(", ")
                : acceptedColumns.join(", ")}
            </p>
            {requiredColumns && requiredColumns.length > 0 && acceptedColumns.length > requiredColumns.length && (
              <p className="text-gray-400">Optional columns: {acceptedColumns.filter(col => !requiredColumns.includes(col)).join(", ")}</p>
            )}
            {module === "underwriting" && submodule === "dependents" && (
              <p className="text-amber-600">* Dependent ID and Principal Enrollee ID are required for dependent bulk upload.</p>
            )}
            {module === "underwriting" && submodule === "principals" && (
              <p className="text-amber-600">* Use Organization Code (e.g., "CC") and Plan Name (e.g., "CROWN JEWEL – PLATINUM")</p>
            )}
            {module === "provider" && submodule === "providers" && (
              <p className="text-amber-600">* Facility Name, Email, and Band (A, B, C, or D) are required. Contact is phone number. All other columns are optional.</p>
            )}
          </div>

          {/* Sample File Download */}
          <div className="border-t pt-4">
            <div className="flex items-center justify-between">
              <div>
                <Button
                  variant="link"
                  onClick={handleDownloadSample}
                  className="p-0 h-auto text-blue-600 hover:text-blue-700"
                >
                  <Download className="h-4 w-4 mr-1" />
                  Or Download Sample File
                </Button>
                <p className="text-xs text-gray-500 mt-1">
                  This serves as a guide for your uploads
                </p>
              </div>
            </div>
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={handleClose} disabled={isUploading}>
            Cancel
          </Button>
          <Button
            onClick={handleUpload}
            disabled={!selectedFile || isUploading}
            className="bg-[#BE1522] hover:bg-[#9B1219]"
          >
            {isUploading ? (
              <>
                <div className="animate-spin rounded-full h-4 w-4 border-t-2 border-b-2 border-white mr-2"></div>
                Processing...
              </>
            ) : (
              <>
                <Upload className="h-4 w-4 mr-2" />
                Upload
              </>
            )}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}

// Helper function to read Excel file
async function readExcelFile(file: File): Promise<any[]> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader()
    reader.onload = (e) => {
      try {
        const data = e.target?.result
        const workbook = XLSX.read(data, { type: 'binary' })
        const sheetName = workbook.SheetNames[0]
        const worksheet = workbook.Sheets[sheetName]
        const jsonData = XLSX.utils.sheet_to_json(worksheet)
        resolve(jsonData)
      } catch (error) {
        reject(error)
      }
    }
    reader.onerror = () => reject(new Error('Failed to read file'))
    reader.readAsBinaryString(file)
  })
}

// Helper function to validate Excel data
function validateExcelData(data: any[], acceptedColumns: string[], requiredColumns?: string[]): { isValid: boolean; error?: string } {
  if (!data || data.length === 0) {
    return { isValid: false, error: "File is empty or contains no data" }
  }

  const firstRow = data[0]
  const fileColumns = Object.keys(firstRow)

  // Normalize column names for comparison (lowercase, replace spaces with underscores)
  const normalizeColumn = (col: string) => col.toLowerCase().replace(/\s+/g, '_')

  const normalizedFileColumns = fileColumns.map(normalizeColumn)

  // Use requiredColumns if provided, otherwise use all acceptedColumns
  const columnsToCheck = requiredColumns || acceptedColumns
  const normalizedRequired = columnsToCheck.map(normalizeColumn)

  // Check if all required columns are present (case-insensitive, space-insensitive)
  const missingColumns = columnsToCheck.filter(col => {
    const normalized = normalizeColumn(col)
    return !normalizedFileColumns.includes(normalized)
  })

  if (missingColumns.length > 0) {
    return {
      isValid: false,
      error: `Missing required columns: ${missingColumns.join(", ")}`
    }
  }

  // Check for empty rows - only check required columns (not all accepted columns)
  const columnsToValidate = requiredColumns && requiredColumns.length > 0 ? requiredColumns : columnsToCheck
  const emptyRows = data.filter(row =>
    columnsToValidate.every(col => {
      // Find the actual column name in the row (case-insensitive match)
      const actualCol = fileColumns.find(fc => normalizeColumn(fc) === normalizeColumn(col))
      return !actualCol || !row[actualCol] || row[actualCol].toString().trim() === ""
    })
  )

  if (emptyRows.length > 0) {
    return {
      isValid: false,
      error: `Found ${emptyRows.length} empty rows. Please ensure required columns are filled.`
    }
  }

  return { isValid: true }
}

// Helper function to generate sample data
function generateSampleData(module: string, acceptedColumns: string[], submodule?: string): any[] {
  const sampleData: any[] = []

  if (module === "settings" && submodule === "service-types") {
    sampleData.push(
      {
        "Service Name": "FBC",
        "Service Category": "LAB",
        "Service Type (Optional)": "1"
      },
      {
        "Service Name": "ECG",
        "Service Category": "RAD",
        "Service Type (Optional)": "2"
      },
      {
        "Service Name": "Surgery",
        "Service Category": "PRC",
        "Service Type (Optional)": "1"
      },
      {
        "Service Name": "Vitamin C",
        "Service Category": "DRG",
        "Service Type (Optional)": "2"
      },
      {
        "Service Name": "RBS",
        "Service Category": "LAB",
        "Service Type (Optional)": "1"
      }
    )
  } else if (module === "settings" && submodule === "plans") {
    sampleData.push(
      {
        "Plan Name": "Gold Plan",
        "Description": "Premium health coverage",
        "Plan Type": "INDIVIDUAL",
        "Premium Amount": 50000,
        "Annual Limit": 2000000,
        "Assigned Bands": "A, B"
      },
      {
        "Plan Name": "Silver Plan",
        "Description": "Standard health coverage",
        "Plan Type": "FAMILY",
        "Premium Amount": 75000,
        "Annual Limit": 1500000,
        "Assigned Bands": "B, C"
      }
    )
  } else if (module === "provider" && submodule === "tariff-plan") {
    sampleData.push(
      {
        "Service Name": "General Consultation",
        "Service Price": 5000,
        "Category ID": "9",
        "Service Type": "1"
      },
      {
        "Service Name": "Specialist Consultation",
        "Service Price": 10000,
        "Category ID": "9",
        "Service Type": ""
      },
      {
        "Service Name": "Full Blood Count",
        "Service Price": 3000,
        "Category ID": "15",
        "Service Type": "1"
      },
      {
        "Service Name": "Chest X-Ray",
        "Service Price": 8000,
        "Category ID": "4",
        "Service Type": "1"
      },
      {
        "Service Name": "Pain Relief Medication",
        "Service Price": 2000,
        "Category ID": "24",
        "Service Type": ""
      }
    )
  } else if (module === "underwriting" && submodule === "organizations") {
    sampleData.push(
      {
        "name": "Tech Solutions Ltd",
        "code": "TS",
        "type": "CORPORATE",
        "address": "123 Technology Street, Lagos",
        "phone": "+234-801-234-5678",
        "email": "info@techsolutions.com",
        "contact_person": "John Doe",
        "registration_number": "RC123456"
      },
      {
        "name": "Healthcare Partners Inc",
        "code": "HP",
        "type": "CORPORATE",
        "address": "456 Medical Avenue, Abuja",
        "phone": "+234-802-345-6789",
        "email": "contact@healthcarepartners.com",
        "contact_person": "Dr. Sarah Johnson",
        "registration_number": "RC789012"
      }
    )
  } else if (module === "underwriting" && submodule === "principals") {
    sampleData.push(
      {
        "Enrollee ID": "",
        "First Name": "John",
        "Last Name": "Doe",
        "Email": "john.doe@email.com",
        "Phone Number": "+234-801-234-5678",
        "Date of Birth": "1985-05-15",
        "Gender": "MALE",
        "Address": "123 Main Street, Lagos",
        "Organization Code": "CC",
        "Plan Name": "CROWN JEWEL – PLATINUM",
        "Period": "July 2025",
        "Utilization": 250000,
        "Account Type": "Individual",
        "Status": "ACTIVE"
      },
      {
        "Enrollee ID": "CJH/TS/001",
        "First Name": "Sarah",
        "Last Name": "Johnson",
        "Email": "sarah.johnson@email.com",
        "Phone Number": "+234-802-345-6789",
        "Date of Birth": "1990-08-22",
        "Gender": "FEMALE",
        "Address": "456 Oak Avenue, Abuja",
        "Organization Code": "TS",
        "Plan Name": "CROWN JEWEL – GOLD",
        "Period": "August 2025",
        "Utilization": 125000,
        "Account Type": "Individual",
        "Status": "ACTIVE"
      }
    )
  } else if (module === "underwriting" && submodule === "dependents") {
    sampleData.push(
      {
        "Dependent ID": "CJH/CC/001/01",
        "First Name": "Jane",
        "Last Name": "Doe",
        "Date of Birth": "2010-03-15",
        "Gender": "FEMALE",
        "Relationship": "CHILD",
        "Principal Enrollee ID": "CJH/CC/001",
        "Period": "July 2025",
        "Utilization": 15000,
        "Status": "ACTIVE"
      },
      {
        "Dependent ID": "CJH/TS/001/001",
        "First Name": "Mary",
        "Last Name": "Johnson",
        "Date of Birth": "1985-11-20",
        "Gender": "FEMALE",
        "Relationship": "SPOUSE",
        "Principal Enrollee ID": "CJH/TS/001",
        "Period": "August 2025",
        "Utilization": 50000,
        "Status": "ACTIVE"
      }
    )
  } else if (module === "settings" && submodule === "covered-services") {
    sampleData.push(
      {
        "Plan Name": "Gold Plan",
        "Facility Name": "City General Hospital",
        "Service Name": "FBC",
        "Facility Price": 3500,
        "Limit Count": 12,
        "Status": "ACTIVE"
      },
      {
        "Plan Name": "Gold Plan",
        "Facility Name": "City General Hospital",
        "Service Name": "ECG",
        "Facility Price": 5000,
        "Limit Count": 6,
        "Status": "ACTIVE"
      }
    )
  } else if (module === "settings" && submodule === "provider-plans") {
    sampleData.push(
      {
        "Plan Name": "Gold Plan",
        "Provider Name": "City General Hospital",
        "Band Type": "A",
        "Status": "ACTIVE"
      },
      {
        "Plan Name": "Silver Plan",
        "Provider Name": "City General Hospital",
        "Band Type": "B",
        "Status": "ACTIVE"
      }
    )
  } else if (module === "provider" && submodule === "providers") {
    // Provider bulk upload - updated template
    sampleData.push(
      {
        "Facility Name": "City General Hospital",
        "Facility Type": "Hospital",
        "Region": "South West",
        "State": "Lagos",
        "Hospital Address": "123 Medical Street, Ikeja, Lagos",
        "Email": "info@citygeneral.com",
        "Contact": "+234-901-234-5678",
        "Whatsapp Contact": "+234-801-234-5678",
        "Band": "A"
      },
      {
        "Facility Name": "Lagos Specialist Clinic",
        "Facility Type": "Clinic",
        "Region": "South West",
        "State": "Lagos",
        "Hospital Address": "45 Victoria Island Road, Lagos",
        "Email": "contact@lagosspecialist.com",
        "Contact": "+234-902-345-6789",
        "Whatsapp Contact": "+234-802-345-6789",
        "Band": "B"
      },
      {
        "Facility Name": "Abuja Medical Center",
        "Facility Type": "Hospital",
        "Region": "North Central",
        "State": "FCT",
        "Hospital Address": "78 Wuse II, Abuja",
        "Email": "admin@abujamedical.com",
        "Contact": "+234-903-456-7890",
        "Whatsapp Contact": "+234-803-456-7890",
        "Band": "A"
      }
    )
  } else if (module === "settings" && submodule === "package-limits") {
    sampleData.push(
      {
        "Plan Name": "Premium Health Plan",
        "Package Type": "Eye Care",
        "Limit Type": "duration",
        "Amount": 20000,
        "Time Frame Value": "1",
        "Time Frame Unit": "months"
      },
      {
        "Plan Name": "Premium Health Plan",
        "Package Type": "Dental Package",
        "Limit Type": "count",
        "Limit Count": 3,
        "Time Frame Value": "1",
        "Time Frame Unit": "months"
      },
      {
        "Plan Name": "Premium Health Plan",
        "Package Type": "Maternity Package",
        "Limit Type": "duration",
        "Amount": 50000,
        "Time Frame Value": "12",
        "Time Frame Unit": "months"
      },
      {
        "Plan Name": "Premium Health Plan",
        "Package Type": "Surgery Package",
        "Limit Type": "count",
        "Limit Count": 2,
        "Time Frame Value": "6",
        "Time Frame Unit": "months"
      },
      {
        "Plan Name": "Premium Health Plan",
        "Package Type": "Emergency Package",
        "Limit Type": "duration",
        "Amount": 10000,
        "Time Frame Value": "1",
        "Time Frame Unit": "days"
      }
    )
  }

  return sampleData
}
