import React from 'react'

interface StatusTextProps {
  status: string
  className?: string
}

export const StatusText: React.FC<StatusTextProps> = ({ status, className = '' }) => {
  const getStatusClass = (status: string) => {
    const normalizedStatus = status.toLowerCase()
    
    switch (normalizedStatus) {
      case 'active':
      case 'approved':
        return 'status-text active'
      case 'pending':
        return 'status-text pending'
      case 'rejected':
        return 'status-text rejected'
      case 'inactive':
        return 'status-text inactive'
      case 'expired':
        return 'status-text expired'
      case 'used':
        return 'status-text used'
      case 'cancelled':
        return 'status-text cancelled'
      default:
        return 'status-text inactive'
    }
  }

  return (
    <span className={`${getStatusClass(status)} ${className}`}>
      {status.charAt(0).toUpperCase() + status.slice(1).toLowerCase()}
    </span>
  )
}

export default StatusText
