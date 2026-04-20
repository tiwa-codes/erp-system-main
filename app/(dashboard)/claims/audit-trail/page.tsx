"use client"

export const dynamic = 'force-dynamic'

import { useState } from "react"
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Button } from "@/components/ui/button"
import { Search, History, AlertCircle } from "lucide-react"
import { AuditTrailView } from "@/components/claims/AuditTrailView"
import { PermissionGate } from "@/components/ui/permission-gate"



export default function ClaimsAuditTrailPage() {
    const [searchQuery, setSearchQuery] = useState("")
    const [searchedCode, setSearchedCode] = useState<string | null>(null)

    const handleSearch = (e: React.FormEvent) => {
        e.preventDefault()
        if (searchQuery.trim()) {
            setSearchedCode(searchQuery.trim())
        }
    }

    return (
        <PermissionGate module="claims" action="view">
            <div className="p-6 space-y-6">
                <div>
                    <div className="flex items-center gap-2 mb-1 text-blue-600">
                        <History className="h-5 w-5" />
                        <span className="text-xs font-black uppercase tracking-widest">Vetting Audit System</span>
                    </div>
                    <h1 className="text-3xl font-black text-gray-900 tracking-tight">Search Audit Trail</h1>
                    <p className="text-gray-500 mt-1 font-medium">Input an approval code to view its complete lifecycle and processing status.</p>
                </div>

                <Card className="border-gray-200 shadow-sm">
                    <CardContent className="pt-6">
                        <form onSubmit={handleSearch} className="flex flex-col md:flex-row gap-4">
                            <div className="relative flex-1">
                                <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" />
                                <Input
                                    placeholder="Enter Approval Code (e.g. APR-ABC-1234567)"
                                    className="pl-10 h-12 bg-gray-50 border-gray-200 focus:bg-white transition-all text-lg font-bold"
                                    value={searchQuery}
                                    onChange={(e) => setSearchQuery(e.target.value)}
                                />
                            </div>
                            <Button
                                type="submit"
                                className="h-12 px-8 bg-[#0891B2] hover:bg-[#9B1219] text-white font-black rounded-lg shadow-lg shadow-red-200 transition-all hover:scale-105"
                            >
                                <Search className="h-4 w-4 mr-2" />
                                TRACK AUDIT TRAIL
                            </Button>
                        </form>
                    </CardContent>
                </Card>

                {searchedCode ? (
                    <AuditTrailView approvalCode={searchedCode} key={searchedCode} />
                ) : (
                    <div className="flex flex-col items-center justify-center py-20 text-center space-y-4">
                        <div className="h-20 w-20 rounded-full bg-blue-50 flex items-center justify-center border border-blue-100">
                            <Search className="h-10 w-10 text-blue-400" />
                        </div>
                        <div className="max-w-md">
                            <h3 className="text-lg font-black text-gray-900">No approval code selected</h3>
                            <p className="text-gray-500 font-medium mt-2">
                                Enter an approval code above to view the detailed timeline of processing actions, users involved, and time delays.
                            </p>
                        </div>
                    </div>
                )}
            </div>
        </PermissionGate>
    )
}
