"use client"

import { useState } from "react"
import { Card, CardContent } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Search, Download } from "lucide-react"
import { cn } from "@/lib/utils"

interface Category {
    id: string
    name: string
}

interface CategorySidebarProps {
    categories: Category[]
    selectedCategory: string | null
    onSelectCategory: (categoryId: string) => void
    onExportCategory: (categoryId: string) => void
    serviceCountByCategory: Record<string, number>
    isLoading?: boolean
}

export function CategorySidebar({
    categories,
    selectedCategory,
    onSelectCategory,
    onExportCategory,
    serviceCountByCategory,
    isLoading = false
}: CategorySidebarProps) {
    const [searchTerm, setSearchTerm] = useState("")
    const normalizedCategories = Array.isArray(categories)
        ? categories.filter((category): category is Category => Boolean(category?.id && category?.name))
        : []

    // Filter categories by search term
    const filteredCategories = normalizedCategories.filter(category =>
        category.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
        category.id.toLowerCase().includes(searchTerm.toLowerCase())
    )

    const totalCategories = normalizedCategories.length

    return (
        <Card className="h-full">
            <CardContent className="p-4">
                {/* Search */}
                <div className="mb-4">
                    <div className="relative">
                        <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 h-4 w-4" />
                        <Input
                            placeholder="Search Category"
                            value={searchTerm}
                            onChange={(e) => setSearchTerm(e.target.value)}
                            className="pl-10"
                        />
                    </div>
                </div>

                {/* Total Count */}
                <div className="mb-4 text-sm text-gray-600">
                    Total: <span className="font-semibold">{totalCategories}</span>
                </div>

                {/* Category List */}
                <div className="space-y-2 max-h-[calc(100vh-300px)] overflow-y-auto">
                    {isLoading ? (
                        <div className="flex items-center justify-center py-8">
                            <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-blue-600"></div>
                        </div>
                    ) : filteredCategories.length === 0 ? (
                        <div className="text-center py-8 text-gray-500 text-sm">
                            No categories found
                        </div>
                    ) : (
                        filteredCategories.map((category) => {
                            const serviceCount = serviceCountByCategory[category.id] || 0
                            const isSelected = selectedCategory === category.id

                            return (
                                <div
                                    key={category.id}
                                    className={cn(
                                        "p-3 rounded-lg border cursor-pointer transition-all",
                                        isSelected
                                            ? "bg-blue-50 border-blue-300 shadow-sm"
                                            : "bg-white border-gray-200 hover:bg-gray-50 hover:border-gray-300"
                                    )}
                                    onClick={() => onSelectCategory(category.id)}
                                >
                                    <div className="flex items-start justify-between mb-2">
                                        <div className="flex-1">
                                            <h3 className={cn(
                                                "font-semibold text-sm",
                                                isSelected ? "text-blue-900" : "text-gray-900"
                                            )}>
                                                {category.name}
                                            </h3>
                                            <p className="text-xs text-gray-500 mt-1">
                                                ID: {category.id}
                                            </p>
                                        </div>
                                    </div>

                                    <div className="flex items-center justify-between">
                                        <div className="text-xs text-gray-600">
                                            <Badge variant="secondary" className="text-xs">
                                                {serviceCount} Service{serviceCount !== 1 ? 's' : ''}
                                            </Badge>
                                        </div>
                                        <Button
                                            size="sm"
                                            variant="outline"
                                            onClick={(e) => {
                                                e.stopPropagation()
                                                onExportCategory(category.id)
                                            }}
                                            className="h-7 text-xs"
                                        >
                                            <Download className="h-3 w-3 mr-1" />
                                            Export
                                        </Button>
                                    </div>
                                </div>
                            )
                        })
                    )}
                </div>
            </CardContent>
        </Card>
    )
}
