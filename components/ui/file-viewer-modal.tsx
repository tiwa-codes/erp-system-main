"use client"

import { useEffect, useMemo, useState } from "react"
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import { Button } from "@/components/ui/button"
import { Download, ExternalLink, FileText, Loader2 } from "lucide-react"
import * as XLSX from "xlsx"

interface FileViewerModalProps {
  url: string
  name?: string
  isOpen: boolean
  onClose: () => void
}

function getExtension(url: string) {
  return url.split("?")[0].split(".").pop()?.toLowerCase() || ""
}

function getFileType(url: string, name?: string): "pdf" | "image" | "spreadsheet" | "office" | "other" {
  const ext = getExtension(name || "") || getExtension(url)
  if (ext === "pdf") return "pdf"
  if (["jpg", "jpeg", "png", "gif", "webp", "svg", "bmp"].includes(ext)) return "image"
  if (["xls", "xlsx", "csv"].includes(ext)) return "spreadsheet"
  if (["doc", "docx", "ppt", "pptx"].includes(ext)) return "office"
  return "other"
}

export function FileViewerModal({ url, name, isOpen, onClose }: FileViewerModalProps) {
  const [loading, setLoading] = useState(true)
  const [spreadsheetError, setSpreadsheetError] = useState<string | null>(null)
  const [sheetNames, setSheetNames] = useState<string[]>([])
  const [activeSheet, setActiveSheet] = useState("")
  const [sheetRows, setSheetRows] = useState<Record<string, any[][]>>({})
  const fileType = getFileType(url, name)

  const viewerUrl = useMemo(() => (
    fileType === "office"
      ? `https://docs.google.com/gview?url=${encodeURIComponent(url)}&embedded=true`
      : fileType === "other"
      ? `https://docs.google.com/viewer?url=${encodeURIComponent(url)}&embedded=true`
      : url
  ), [fileType, url])

  useEffect(() => {
    if (!isOpen) return

    setLoading(true)
    setSpreadsheetError(null)

    if (fileType !== "spreadsheet") {
      setSheetNames([])
      setActiveSheet("")
      setSheetRows({})
      return
    }

    let cancelled = false

    const loadSpreadsheet = async () => {
      try {
        const response = await fetch(url)
        if (!response.ok) {
          throw new Error("Failed to fetch spreadsheet")
        }

        const buffer = await response.arrayBuffer()
        const workbook = XLSX.read(buffer, { type: "array" })
        const nextSheetRows: Record<string, any[][]> = {}

        for (const sheetName of workbook.SheetNames) {
          const worksheet = workbook.Sheets[sheetName]
          nextSheetRows[sheetName] = XLSX.utils.sheet_to_json(worksheet, {
            header: 1,
            defval: "",
            blankrows: false,
          }) as any[][]
        }

        if (cancelled) return

        setSheetNames(workbook.SheetNames)
        setActiveSheet(workbook.SheetNames[0] || "")
        setSheetRows(nextSheetRows)
      } catch (error) {
        if (cancelled) return
        console.error("Failed to preview spreadsheet:", error)
        setSpreadsheetError("Couldn't preview spreadsheet. Try downloading or opening it instead.")
      } finally {
        if (!cancelled) {
          setLoading(false)
        }
      }
    }

    void loadSpreadsheet()

    return () => {
      cancelled = true
    }
  }, [fileType, isOpen, url])

  return (
    <Dialog open={isOpen} onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="max-w-4xl w-full h-[90vh] flex flex-col p-0 gap-0">
        <DialogHeader className="px-4 py-3 border-b flex-shrink-0">
          <div className="flex items-center justify-between">
            <DialogTitle className="flex items-center gap-2 text-sm font-medium truncate pr-8">
              <FileText className="h-4 w-4 text-blue-500 flex-shrink-0" />
              <span className="truncate">{name || "Attachment"}</span>
            </DialogTitle>
            <div className="flex items-center gap-2 flex-shrink-0">
              <a href={url} download={name} target="_blank" rel="noopener noreferrer">
                <Button variant="outline" size="sm" className="gap-1.5">
                  <Download className="h-3.5 w-3.5" />
                  Download
                </Button>
              </a>
              <a href={url} target="_blank" rel="noopener noreferrer">
                <Button variant="ghost" size="sm" className="gap-1.5 text-gray-500">
                  <ExternalLink className="h-3.5 w-3.5" />
                  Open
                </Button>
              </a>
            </div>
          </div>
        </DialogHeader>

        <div className="flex-1 relative overflow-hidden bg-gray-100">
          {loading && (
            <div className="absolute inset-0 flex items-center justify-center bg-gray-100 z-10">
              <Loader2 className="h-6 w-6 animate-spin text-blue-500" />
            </div>
          )}

          {fileType === "image" ? (
            <div className="w-full h-full flex items-center justify-center p-4 overflow-auto">
              <img
                src={url}
                alt={name || "Attachment"}
                className="max-w-full max-h-full object-contain"
                onLoad={() => setLoading(false)}
                onError={() => setLoading(false)}
              />
            </div>
          ) : fileType === "spreadsheet" ? (
            <div className="w-full h-full flex flex-col bg-white">
              {sheetNames.length > 1 && (
                <div className="flex items-center gap-2 px-4 py-3 border-b bg-gray-50 overflow-x-auto">
                  {sheetNames.map((sheetName) => (
                    <Button
                      key={sheetName}
                      type="button"
                      variant={sheetName === activeSheet ? "default" : "outline"}
                      size="sm"
                      onClick={() => setActiveSheet(sheetName)}
                      className="whitespace-nowrap"
                    >
                      {sheetName}
                    </Button>
                  ))}
                </div>
              )}

              {spreadsheetError ? (
                <div className="flex-1 flex items-center justify-center p-6 text-sm text-gray-600">
                  {spreadsheetError}
                </div>
              ) : (
                <div className="flex-1 overflow-auto">
                  <table className="min-w-full text-sm border-collapse">
                    <tbody>
                      {(sheetRows[activeSheet] || []).map((row, rowIndex) => (
                        <tr key={`${activeSheet}-${rowIndex}`} className={rowIndex === 0 ? "bg-gray-100 font-medium" : "bg-white"}>
                          {row.map((cell, cellIndex) => (
                            <td
                              key={`${activeSheet}-${rowIndex}-${cellIndex}`}
                              className="border border-gray-200 px-3 py-2 align-top whitespace-pre-wrap"
                            >
                              {String(cell ?? "")}
                            </td>
                          ))}
                        </tr>
                      ))}
                    </tbody>
                  </table>
                  {!spreadsheetError && (sheetRows[activeSheet] || []).length === 0 && !loading && (
                    <div className="p-6 text-sm text-gray-500">No spreadsheet data found.</div>
                  )}
                </div>
              )}
            </div>
          ) : (
            <iframe
              src={viewerUrl}
              className="w-full h-full border-0"
              title={name || "Attachment"}
              onLoad={() => setLoading(false)}
            />
          )}
        </div>
      </DialogContent>
    </Dialog>
  )
}
