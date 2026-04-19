import { Card, CardContent } from "@/components/ui/card"
import type { LucideIcon } from "lucide-react"
import { cn } from "@/lib/utils"

interface MetricCardProps {
  title: string
  value: string | number | null | undefined
  subtitle?: string
  description?: string
  icon: LucideIcon
  iconColor?: string
  trend?: {
    value: string | number
    isPositive: boolean
  }
}

export function MetricCard({
  title,
  value,
  subtitle,
  description,
  icon: Icon,
  iconColor = "text-blue-600",
  trend,
}: MetricCardProps) {
  return (
    <Card>
      <CardContent className="p-6">
        <div className="flex items-center justify-between">
          <div className="flex-1">
            <p className="text-sm font-medium text-gray-600">{title}</p>
            <p className="text-2xl font-bold text-gray-900 mt-1">
              {value != null ? (typeof value === 'number' ? value.toLocaleString() : value) : '---'}
            </p>
            {(description ?? subtitle) && (
              <p className="text-sm text-gray-500 mt-1">{description ?? subtitle}</p>
            )}
            {trend && (
              <p className={cn("text-sm mt-1", trend.isPositive ? "text-green-600" : "text-red-600")}>
                {trend.isPositive ? "↗" : "↘"} {trend.value}
              </p>
            )}
          </div>
          <div className={cn("", iconColor)}>
            <Icon className="w-6 h-6" />
          </div>
        </div>
      </CardContent>
    </Card>
  )
}
