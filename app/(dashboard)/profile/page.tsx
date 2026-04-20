"use client"

import { useQuery, useMutation } from "@tanstack/react-query"
import { useState } from "react"
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Button } from "@/components/ui/button"
import { Separator } from "@/components/ui/separator"
import { useToast } from "@/hooks/use-toast"
import { Eye, EyeOff } from "lucide-react"

export const dynamic = 'force-dynamic'

export default function ProfilePage() {
  const { toast } = useToast()

  const { data: user, isLoading } = useQuery({
    queryKey: ["me"],
    queryFn: async () => {
      const res = await fetch("/api/users/me")
      if (!res.ok) throw new Error("Failed to load profile")
      return res.json()
    },
  })

  const [form, setForm] = useState({
    first_name: "",
    last_name: "",
    title: "",
    date_of_birth: "",
    gender: "",
    phone_number: "",
    contact_address: "",
  })

  const [pwd, setPwd] = useState({ current_password: "", new_password: "", confirm_password: "" })

  const [showPasswords, setShowPasswords] = useState({
    current: false,
    new: false,
    confirm: false
  })

  const updateProfile = useMutation({
    mutationFn: async (payload: any) => {
      const res = await fetch("/api/users/me", { method: "PUT", headers: { "Content-Type": "application/json" }, body: JSON.stringify(payload) })
      if (!res.ok) throw new Error("Failed to update profile")
      return res.json()
    },
    onSuccess: () => toast({ title: "Profile updated" }),
  })

  const changePassword = useMutation({
    mutationFn: async (payload: any) => {
      const res = await fetch("/api/users/change-password", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(payload) })
      if (!res.ok) throw new Error((await res.json()).error || "Failed to change password")
      return res.json()
    },
    onSuccess: () => { toast({ title: "Password changed" }); setPwd({ current_password: "", new_password: "", confirm_password: "" }) },
  })

  if (!isLoading && user && form.first_name === "") {
    setForm({
      first_name: user.first_name || "",
      last_name: user.last_name || "",
      title: user.title || "",
      date_of_birth: user.date_of_birth ? new Date(user.date_of_birth).toISOString().split('T')[0] : "",
      gender: user.gender || "",
      phone_number: user.phone_number || "",
      contact_address: user.contact_address || "",
    })
  }

  return (
    <div className="space-y-6 p-6">
      <Card>
        <CardHeader>
          <CardTitle>Profile Information</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <Label htmlFor="first_name">First Name</Label>
              <Input id="first_name" value={form.first_name} onChange={(e) => setForm({ ...form, first_name: e.target.value })} />
            </div>
            <div>
              <Label htmlFor="last_name">Last Name</Label>
              <Input id="last_name" value={form.last_name} onChange={(e) => setForm({ ...form, last_name: e.target.value })} />
            </div>
            <div>
              <Label htmlFor="title">Title</Label>
              <Input id="title" value={form.title} onChange={(e) => setForm({ ...form, title: e.target.value })} />
            </div>
            <div>
              <Label htmlFor="date_of_birth">Date of Birth</Label>
              <Input id="date_of_birth" type="date" value={form.date_of_birth} onChange={(e) => setForm({ ...form, date_of_birth: e.target.value })} />
            </div>
            <div>
              <Label htmlFor="gender">Gender</Label>
              <Input id="gender" value={form.gender} onChange={(e) => setForm({ ...form, gender: e.target.value })} />
            </div>
            <div>
              <Label htmlFor="phone_number">Phone Number</Label>
              <Input id="phone_number" value={form.phone_number} onChange={(e) => setForm({ ...form, phone_number: e.target.value })} />
            </div>
          </div>
          <div>
            <Label htmlFor="contact_address">Contact Address</Label>
            <Input id="contact_address" value={form.contact_address} onChange={(e) => setForm({ ...form, contact_address: e.target.value })} />
          </div>
          <div className="text-right">
            <Button variant="secondary" onClick={() => updateProfile.mutate(form)} disabled={updateProfile.isPending}>Update Profile</Button>
          </div>
        </CardContent>
      </Card>

      <Separator />

      <Card>
        <CardHeader>
          <CardTitle>Change Password</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div>
              <Label htmlFor="current_password">Current Password</Label>
              <div className="relative">
                <Input
                  id="current_password"
                  type={showPasswords.current ? "text" : "password"}
                  value={pwd.current_password}
                  onChange={(e) => setPwd({ ...pwd, current_password: e.target.value })}
                  className="pr-10"
                />
                <button
                  type="button"
                  onClick={() => setShowPasswords(prev => ({ ...prev, current: !prev.current }))}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-500 hover:text-gray-700 focus:outline-none"
                >
                  {showPasswords.current ? (
                    <EyeOff className="h-4 w-4" />
                  ) : (
                    <Eye className="h-4 w-4" />
                  )}
                </button>
              </div>
            </div>
            <div>
              <Label htmlFor="new_password">New Password</Label>
              <div className="relative">
                <Input
                  id="new_password"
                  type={showPasswords.new ? "text" : "password"}
                  value={pwd.new_password}
                  onChange={(e) => setPwd({ ...pwd, new_password: e.target.value })}
                  className="pr-10"
                />
                <button
                  type="button"
                  onClick={() => setShowPasswords(prev => ({ ...prev, new: !prev.new }))}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-500 hover:text-gray-700 focus:outline-none"
                >
                  {showPasswords.new ? (
                    <EyeOff className="h-4 w-4" />
                  ) : (
                    <Eye className="h-4 w-4" />
                  )}
                </button>
              </div>
            </div>
            <div>
              <Label htmlFor="confirm_password">Confirm Password</Label>
              <div className="relative">
                <Input
                  id="confirm_password"
                  type={showPasswords.confirm ? "text" : "password"}
                  value={pwd.confirm_password}
                  onChange={(e) => setPwd({ ...pwd, confirm_password: e.target.value })}
                  className="pr-10"
                />
                <button
                  type="button"
                  onClick={() => setShowPasswords(prev => ({ ...prev, confirm: !prev.confirm }))}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-500 hover:text-gray-700 focus:outline-none"
                >
                  {showPasswords.confirm ? (
                    <EyeOff className="h-4 w-4" />
                  ) : (
                    <Eye className="h-4 w-4" />
                  )}
                </button>
              </div>
            </div>
          </div>
          <div className="text-right">
            <Button variant="secondary" onClick={() => changePassword.mutate(pwd)} disabled={changePassword.isPending}>Update Password</Button>
          </div>
        </CardContent>
      </Card>
    </div>
  )
}





