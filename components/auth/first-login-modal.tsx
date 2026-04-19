"use client"

import { useState } from "react"
import { useSession, signOut } from "next-auth/react"
import { useMutation } from "@tanstack/react-query"
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { useToast } from "@/hooks/use-toast"
import { Lock, Eye, EyeOff } from "lucide-react"

interface FirstLoginModalProps {
  isOpen: boolean
  onClose: () => void
}

export function FirstLoginModal({ isOpen, onClose }: FirstLoginModalProps) {
  const { data: session, update } = useSession()
  const { toast } = useToast()
  
  const [formData, setFormData] = useState({
    newPassword: "",
    confirmPassword: ""
  })
  const [showPassword, setShowPassword] = useState(false)
  const [showConfirmPassword, setShowConfirmPassword] = useState(false)

  const changePasswordMutation = useMutation({
    mutationFn: async (data: { newPassword: string }) => {
      const res = await fetch("/api/user/first-login-password", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(data)
      })
      if (!res.ok) {
        const error = await res.json()
        throw new Error(error.message || "Failed to set password")
      }
      return res.json()
    },
    onSuccess: async () => {
      toast({
        title: "Success",
        description: "Password set successfully. Please log in again with your new password.",
      })
      
      // Logout user immediately after password change
      await signOut({ callbackUrl: '/auth/signin' })
    },
    onError: (error: any) => {
      toast({
        title: "Error",
        description: error.message || "Failed to set password",
        variant: "destructive",
      })
    }
  })

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    
    if (formData.newPassword !== formData.confirmPassword) {
      toast({
        title: "Error",
        description: "Passwords do not match",
        variant: "destructive",
      })
      return
    }

    if (formData.newPassword.length < 6) {
      toast({
        title: "Error",
        description: "Password must be at least 6 characters long",
        variant: "destructive",
      })
      return
    }

    await changePasswordMutation.mutateAsync({
      newPassword: formData.newPassword
    })
  }

  return (
    <Dialog open={isOpen} onOpenChange={() => {}}>
      <DialogContent className="sm:max-w-md" hideClose>
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Lock className="h-5 w-5" />
            Set Your Password
          </DialogTitle>
          <DialogDescription>
            Welcome to the CoverConnect! Please set a new password to continue.
          </DialogDescription>
        </DialogHeader>
        
        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="new-password">New Password</Label>
            <div className="relative">
              <Input
                id="new-password"
                type={showPassword ? "text" : "password"}
                value={formData.newPassword}
                onChange={(e) => setFormData(prev => ({ ...prev, newPassword: e.target.value }))}
                required
                minLength={6}
                placeholder="Enter your new password"
              />
              <Button
                type="button"
                variant="ghost"
                size="sm"
                className="absolute right-0 top-0 h-full px-3 py-2 hover:bg-transparent"
                onClick={() => setShowPassword(!showPassword)}
              >
                {showPassword ? (
                  <EyeOff className="h-4 w-4" />
                ) : (
                  <Eye className="h-4 w-4" />
                )}
              </Button>
            </div>
          </div>
          
          <div className="space-y-2">
            <Label htmlFor="confirm-password">Confirm New Password</Label>
            <div className="relative">
              <Input
                id="confirm-password"
                type={showConfirmPassword ? "text" : "password"}
                value={formData.confirmPassword}
                onChange={(e) => setFormData(prev => ({ ...prev, confirmPassword: e.target.value }))}
                required
                minLength={6}
                placeholder="Confirm your new password"
              />
              <Button
                type="button"
                variant="ghost"
                size="sm"
                className="absolute right-0 top-0 h-full px-3 py-2 hover:bg-transparent"
                onClick={() => setShowConfirmPassword(!showConfirmPassword)}
              >
                {showConfirmPassword ? (
                  <EyeOff className="h-4 w-4" />
                ) : (
                  <Eye className="h-4 w-4" />
                )}
              </Button>
            </div>
          </div>
          
          <Button 
            type="submit" 
            className="w-full"
            disabled={changePasswordMutation.isPending}
          >
            {changePasswordMutation.isPending ? "Setting Password..." : "Set Password"}
          </Button>
        </form>
        
        <div className="text-xs text-gray-500 text-center">
          Password must be at least 6 characters long
        </div>
      </DialogContent>
    </Dialog>
  )
}
