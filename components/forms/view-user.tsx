"use client"

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { 
  User, 
  Mail, 
  Phone, 
  MapPin, 
  Calendar, 
  Shield, 
  Building,
  Clock,
  Edit,
  Trash2
} from "lucide-react"

interface ViewUserProps {
  user: any
  onClose: () => void
  onEdit?: () => void
  onDelete?: () => void
}

export function ViewUser({ user, onClose, onEdit, onDelete }: ViewUserProps) {
  const getRoleBadgeColor = (role: string) => {
    switch (role) {
      case "SUPER_ADMIN": return "bg-red-100 text-red-800"
      case "ADMIN": return "bg-purple-100 text-purple-800"
      case "HR_MANAGER": return "bg-green-100 text-green-800"
      case "HR_OFFICER": return "bg-emerald-100 text-emerald-800"
      case "CLAIMS_PROCESSOR": return "bg-yellow-100 text-yellow-800"
      case "CLAIMS_MANAGER": return "bg-orange-100 text-orange-800"
      case "FINANCE_OFFICER": return "bg-indigo-100 text-indigo-800"
      case "PROVIDER_MANAGER": return "bg-pink-100 text-pink-800"
      case "UNDERWRITER": return "bg-cyan-100 text-cyan-800"
      default: return "bg-gray-100 text-gray-800"
    }
  }

  const getStatusBadgeColor = (status: string) => {
    switch (status) {
      case "ACTIVE": return "bg-green-100 text-green-800"
      case "INACTIVE": return "bg-yellow-100 text-yellow-800"
      case "SUSPENDED": return "bg-red-100 text-red-800"
      default: return "bg-gray-100 text-gray-800"
    }
  }

  const formatDate = (dateString: string) => {
    if (!dateString) return "Not provided"
    return new Date(dateString).toLocaleDateString()
  }

  return (
    <div className="space-y-6">
      {/* User Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-4">
          <div className="w-16 h-16 bg-gray-100 rounded-full flex items-center justify-center">
            <User className="h-8 w-8 text-gray-600" />
          </div>
          <div>
            <h2 className="text-2xl font-bold text-gray-900">
              {user.title && `${user.title}. `}{user.first_name} {user.last_name}
            </h2>
            <p className="text-gray-600">{user.email}</p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <Badge className={getRoleBadgeColor(user.role)}>
            {user.role.replace('_', ' ')}
          </Badge>
          <Badge className={getStatusBadgeColor(user.status)}>
            {user.status}
          </Badge>
        </div>
      </div>

      {/* User Details */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {/* Personal Information */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <User className="h-5 w-5" />
              Personal Information
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="flex items-center gap-3">
              <Mail className="h-4 w-4 text-gray-500" />
              <div>
                <p className="text-sm font-medium text-gray-900">Email</p>
                <p className="text-sm text-gray-600">{user.email}</p>
              </div>
            </div>
            
            {user.phone_number && (
              <div className="flex items-center gap-3">
                <Phone className="h-4 w-4 text-gray-500" />
                <div>
                  <p className="text-sm font-medium text-gray-900">Phone</p>
                  <p className="text-sm text-gray-600">{user.phone_number}</p>
                </div>
              </div>
            )}

            {user.contact_address && (
              <div className="flex items-center gap-3">
                <MapPin className="h-4 w-4 text-gray-500" />
                <div>
                  <p className="text-sm font-medium text-gray-900">Address</p>
                  <p className="text-sm text-gray-600">{user.contact_address}</p>
                </div>
              </div>
            )}

            {user.date_of_birth && (
              <div className="flex items-center gap-3">
                <Calendar className="h-4 w-4 text-gray-500" />
                <div>
                  <p className="text-sm font-medium text-gray-900">Date of Birth</p>
                  <p className="text-sm text-gray-600">{formatDate(user.date_of_birth)}</p>
                </div>
              </div>
            )}

            {user.gender && (
              <div className="flex items-center gap-3">
                <User className="h-4 w-4 text-gray-500" />
                <div>
                  <p className="text-sm font-medium text-gray-900">Gender</p>
                  <p className="text-sm text-gray-600">{user.gender}</p>
                </div>
              </div>
            )}
          </CardContent>
        </Card>

        {/* Work Information */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Shield className="h-5 w-5" />
              Work Information
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="flex items-center gap-3">
              <Shield className="h-4 w-4 text-gray-500" />
              <div>
                <p className="text-sm font-medium text-gray-900">Role</p>
                <p className="text-sm text-gray-600">{user.role.replace('_', ' ')}</p>
              </div>
            </div>

            {user.department && (
              <div className="flex items-center gap-3">
                <Building className="h-4 w-4 text-gray-500" />
                <div>
                  <p className="text-sm font-medium text-gray-900">Department</p>
                  <p className="text-sm text-gray-600">{user.department.name}</p>
                </div>
              </div>
            )}

            <div className="flex items-center gap-3">
              <Clock className="h-4 w-4 text-gray-500" />
              <div>
                <p className="text-sm font-medium text-gray-900">Status</p>
                <p className="text-sm text-gray-600">{user.status}</p>
              </div>
            </div>

            <div className="flex items-center gap-3">
              <Calendar className="h-4 w-4 text-gray-500" />
              <div>
                <p className="text-sm font-medium text-gray-900">Created</p>
                <p className="text-sm text-gray-600">{formatDate(user.created_at)}</p>
              </div>
            </div>

            {user.last_login_at && (
              <div className="flex items-center gap-3">
                <Clock className="h-4 w-4 text-gray-500" />
                <div>
                  <p className="text-sm font-medium text-gray-900">Last Login</p>
                  <p className="text-sm text-gray-600">{formatDate(user.last_login_at)}</p>
                </div>
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Action Buttons */}
      <div className="flex items-center justify-end gap-4">
        <Button variant="outline" onClick={onClose}>
          Close
        </Button>
        <Button 
          variant="outline" 
          onClick={onEdit}
          className="border-blue-500 text-blue-600 hover:bg-blue-50"
        >
          <Edit className="h-4 w-4 mr-2" />
          Edit User
        </Button>
        <Button 
          variant="outline" 
          onClick={onDelete}
          className="border-red-500 text-red-600 hover:bg-red-50"
        >
          <Trash2 className="h-4 w-4 mr-2" />
          Delete User
        </Button>
      </div>
    </div>
  )
}
