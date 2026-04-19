import * as XLSX from 'xlsx'
import jsPDF from 'jspdf'
import html2canvas from 'html2canvas'

export interface ExportData {
  headers: string[]
  rows: any[][]
  title: string
  subtitle?: string
}

export interface ReportData {
  title: string
  subtitle?: string
  data: any[]
  columns: {
    key: string
    label: string
    type?: string
  }[]
  filters?: Record<string, any>
}

/**
 * Export data to Excel format
 */
export const exportToExcel = (reportData: ReportData, filename?: string) => {
  try {
    // Prepare data for Excel
    const headers = reportData.columns.map(col => col.label)
    const rows = reportData.data.map(item => 
      reportData.columns.map(col => {
        const value = item[col.key]
        if (col.type === 'currency') {
          return typeof value === 'number' ? value : parseFloat(value) || 0
        }
        if (col.type === 'date') {
          return value ? new Date(value).toLocaleDateString() : ''
        }
        return value || ''
      })
    )

    // Create workbook
    const wb = XLSX.utils.book_new()
    
    // Add metadata sheet
    const metadata = [
      ['Report Title', reportData.title],
      ['Generated Date', new Date().toLocaleString()],
      ['Total Records', reportData.data.length.toString()],
      ...(reportData.subtitle ? [['Subtitle', reportData.subtitle]] : []),
      ...(reportData.filters ? Object.entries(reportData.filters).map(([key, value]) => [key, value]) : [])
    ]
    
    const metadataWs = XLSX.utils.aoa_to_sheet(metadata)
    XLSX.utils.book_append_sheet(wb, metadataWs, 'Metadata')

    // Add data sheet
    const dataSheet = XLSX.utils.aoa_to_sheet([headers, ...rows])
    XLSX.utils.book_append_sheet(wb, dataSheet, 'Data')

    // Generate filename
    const defaultFilename = `${reportData.title.replace(/[^a-zA-Z0-9]/g, '_')}_${new Date().toISOString().split('T')[0]}.xlsx`
    const finalFilename = filename || defaultFilename

    // Save file
    XLSX.writeFile(wb, finalFilename)
    
    return { success: true, filename: finalFilename }
  } catch (error) {
    console.error('Excel export error:', error)
    return { success: false, error: error instanceof Error ? error.message : 'Unknown error' }
  }
}

/**
 * Export data to PDF format
 */
export const exportToPDF = async (reportData: ReportData, filename?: string) => {
  try {
    const doc = new jsPDF('l', 'mm', 'a4') // Landscape orientation
    
    // Add title
    doc.setFontSize(20)
    doc.setFont('helvetica', 'bold')
    doc.text(reportData.title, 14, 20)
    
    // Add subtitle if exists
    if (reportData.subtitle) {
      doc.setFontSize(12)
      doc.setFont('helvetica', 'normal')
      doc.text(reportData.subtitle, 14, 30)
    }
    
    // Add generation date
    doc.setFontSize(10)
    doc.text(`Generated: ${new Date().toLocaleString()}`, 14, 40)
    doc.text(`Total Records: ${reportData.data.length}`, 14, 45)
    
    // Add filters if any
    if (reportData.filters) {
      let yPos = 50
      doc.text('Filters Applied:', 14, yPos)
      yPos += 5
      Object.entries(reportData.filters).forEach(([key, value]) => {
        doc.text(`${key}: ${value}`, 20, yPos)
        yPos += 5
      })
    }
    
    // Prepare table data
    const headers = reportData.columns.map(col => col.label)
    const rows = reportData.data.map(item => 
      reportData.columns.map(col => {
        const value = item[col.key]
        if (col.type === 'currency') {
          return typeof value === 'number' ? `₦${value.toLocaleString()}` : value
        }
        if (col.type === 'date') {
          return value ? new Date(value).toLocaleDateString() : ''
        }
        return value ? value.toString() : ''
      })
    )
    
    // Calculate column widths
    const pageWidth = doc.internal.pageSize.width - 28 // 14mm margins on each side
    const colWidth = pageWidth / headers.length
    
    // Add table headers
    let xPos = 14
    let yPos = reportData.filters ? 70 : 60
    
    doc.setFontSize(8)
    doc.setFont('helvetica', 'bold')
    
    headers.forEach((header, index) => {
      doc.text(header, xPos, yPos)
      xPos += colWidth
    })
    
    // Add horizontal line
    yPos += 2
    doc.line(14, yPos, pageWidth + 14, yPos)
    yPos += 5
    
    // Add table rows
    doc.setFont('helvetica', 'normal')
    rows.forEach((row, rowIndex) => {
      if (yPos > doc.internal.pageSize.height - 20) {
        doc.addPage()
        yPos = 20
      }
      
      xPos = 14
      row.forEach((cell, colIndex) => {
        const cellText = cell.toString().substring(0, 20) // Truncate long text
        doc.text(cellText, xPos, yPos)
        xPos += colWidth
      })
      yPos += 5
    })
    
    // Generate filename
    const defaultFilename = `${reportData.title.replace(/[^a-zA-Z0-9]/g, '_')}_${new Date().toISOString().split('T')[0]}.pdf`
    const finalFilename = filename || defaultFilename
    
    // Save file
    doc.save(finalFilename)
    
    return { success: true, filename: finalFilename }
  } catch (error) {
    console.error('PDF export error:', error)
    return { success: false, error: error instanceof Error ? error.message : 'Unknown error' }
  }
}

/**
 * Export HTML element to PDF (for charts and complex layouts)
 */
export const exportElementToPDF = async (elementId: string, filename?: string) => {
  try {
    const element = document.getElementById(elementId)
    if (!element) {
      throw new Error('Element not found')
    }
    
    const canvas = await html2canvas(element, {
      scale: 2,
      useCORS: true,
      allowTaint: true
    })
    
    const imgData = canvas.toDataURL('image/png')
    const doc = new jsPDF('l', 'mm', 'a4')
    
    const imgWidth = doc.internal.pageSize.width
    const imgHeight = (canvas.height * imgWidth) / canvas.width
    
    doc.addImage(imgData, 'PNG', 0, 0, imgWidth, imgHeight)
    
    const defaultFilename = filename || `export_${new Date().toISOString().split('T')[0]}.pdf`
    doc.save(defaultFilename)
    
    return { success: true, filename: defaultFilename }
  } catch (error) {
    console.error('Element PDF export error:', error)
    return { success: false, error: error instanceof Error ? error.message : 'Unknown error' }
  }
}

/**
 * Export data to CSV format
 */
export const exportToCSV = (reportData: ReportData, filename?: string) => {
  try {
    const headers = reportData.columns.map(col => col.label)
    const rows = reportData.data.map(item => 
      reportData.columns.map(col => {
        const value = item[col.key]
        if (col.type === 'currency') {
          return typeof value === 'number' ? value : parseFloat(value) || 0
        }
        if (col.type === 'date') {
          return value ? new Date(value).toLocaleDateString() : ''
        }
        return value ? `"${value.toString().replace(/"/g, '""')}"` : ''
      })
    )
    
    const csvContent = [
      headers.join(','),
      ...rows.map(row => row.join(','))
    ].join('\n')
    
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' })
    const link = document.createElement('a')
    const url = URL.createObjectURL(blob)
    
    link.setAttribute('href', url)
    link.setAttribute('download', filename || `${reportData.title.replace(/[^a-zA-Z0-9]/g, '_')}_${new Date().toISOString().split('T')[0]}.csv`)
    link.style.visibility = 'hidden'
    
    document.body.appendChild(link)
    link.click()
    document.body.removeChild(link)
    
    return { success: true, filename: filename || `${reportData.title.replace(/[^a-zA-Z0-9]/g, '_')}_${new Date().toISOString().split('T')[0]}.csv` }
  } catch (error) {
    console.error('CSV export error:', error)
    return { success: false, error: error instanceof Error ? error.message : 'Unknown error' }
  }
}

/**
 * Get report data structure for different report types
 */
export const getReportDataStructure = (reportType: string, data: any[], filters?: Record<string, any>) => {
  const baseStructure = {
    title: '',
    subtitle: '',
    data,
    columns: [],
    filters
  }
  
  switch (reportType) {
    case 'utilization':
      return {
        ...baseStructure,
        title: 'Utilization Report',
        subtitle: 'Enrollee utilization and activity report',
        columns: [
          { key: 'enrollee_id', label: 'Enrollee ID', type: 'string' },
          { key: 'enrollee_name', label: 'Name', type: 'string' },
          { key: 'plan_name', label: 'Plan', type: 'string' },
          { key: 'amount_utilized', label: 'Amount Utilized', type: 'currency' },
          { key: 'balance', label: 'Balance', type: 'currency' },
          { key: 'status', label: 'Status', type: 'string' }
        ]
      }
      
    case 'overview':
      return {
        ...baseStructure,
        title: 'Overview Report',
        subtitle: 'System overview and summary report',
        columns: [
          { key: 'id', label: 'Organization ID', type: 'string' },
          { key: 'organization_name', label: 'Organization Name', type: 'string' },
          { key: 'enrollees_count', label: 'Enrollees Count', type: 'number' },
          { key: 'services_count', label: 'Services Count', type: 'number' },
          { key: 'performance_score', label: 'Performance Score', type: 'number' },
          { key: 'status', label: 'Status', type: 'string' }
        ]
      }
      
    case 'analytics':
      return {
        ...baseStructure,
        title: 'Analytics Report',
        subtitle: 'System analytics and performance report',
        columns: [
          { key: 'metric', label: 'Metric', type: 'string' },
          { key: 'value', label: 'Value', type: 'number' },
          { key: 'change', label: 'Change', type: 'number' },
          { key: 'trend', label: 'Trend', type: 'string' },
          { key: 'period', label: 'Period', type: 'string' }
        ]
      }
      
    case 'financial':
      return {
        ...baseStructure,
        title: 'Financial Report',
        subtitle: 'Financial transactions and revenue report',
        columns: [
          { key: 'transaction_id', label: 'Transaction ID', type: 'string' },
          { key: 'type', label: 'Type', type: 'string' },
          { key: 'amount', label: 'Amount', type: 'currency' },
          { key: 'status', label: 'Status', type: 'string' },
          { key: 'date', label: 'Date', type: 'date' },
          { key: 'description', label: 'Description', type: 'string' }
        ]
      }
      
    case 'claims':
      return {
        ...baseStructure,
        title: 'Claims Report',
        subtitle: 'Claims processing and status report',
        columns: [
          { key: 'claim_id', label: 'Claim ID', type: 'string' },
          { key: 'enrollee_name', label: 'Enrollee', type: 'string' },
          { key: 'provider', label: 'Provider', type: 'string' },
          { key: 'amount', label: 'Amount', type: 'currency' },
          { key: 'status', label: 'Status', type: 'string' },
          { key: 'submitted_date', label: 'Submitted Date', type: 'date' },
          { key: 'processed_date', label: 'Processed Date', type: 'date' }
        ]
      }
      
    case 'filters':
      return {
        ...baseStructure,
        title: 'Report Filters',
        subtitle: 'Filtered reports and generated documents',
        columns: [
          { key: 'category', label: 'Category', type: 'string' },
          { key: 'department', label: 'Department', type: 'string' },
          { key: 'report_type', label: 'Report Type', type: 'string' },
          { key: 'generated_date', label: 'Generated Date', type: 'date' },
          { key: 'status', label: 'Status', type: 'string' }
        ]
      }
      
    default:
      return baseStructure
  }
}
