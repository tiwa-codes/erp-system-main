"use client"

import { ReactNode } from "react"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Textarea } from "@/components/ui/textarea"
import { cn } from "@/lib/utils"

interface FormField {
  name: string
  label: string
  type: 'text' | 'email' | 'password' | 'number' | 'select' | 'textarea' | 'date'
  placeholder?: string
  required?: boolean
  options?: { value: string; label: string }[]
  className?: string
  mobileFullWidth?: boolean
}

interface MobileFormProps {
  title?: string
  description?: string
  fields: FormField[]
  values: Record<string, any>
  onChange: (name: string, value: any) => void
  onSubmit: () => void
  submitLabel?: string
  isLoading?: boolean
  className?: string
  children?: ReactNode
}

export function MobileForm({
  title,
  description,
  fields,
  values,
  onChange,
  onSubmit,
  submitLabel = "Submit",
  isLoading = false,
  className,
  children
}: MobileFormProps) {
  const renderField = (field: FormField) => {
    const commonProps = {
      id: field.name,
      value: values[field.name] || '',
      onChange: (e: any) => onChange(field.name, e.target.value),
      placeholder: field.placeholder,
      required: field.required,
      className: cn(
        "w-full",
        field.mobileFullWidth && "sm:w-full",
        field.className
      )
    }

    switch (field.type) {
      case 'select':
        return (
          <Select value={values[field.name] || ''} onValueChange={(value) => onChange(field.name, value)}>
            <SelectTrigger className={cn("w-full", field.className)}>
              <SelectValue placeholder={field.placeholder} />
            </SelectTrigger>
            <SelectContent>
              {field.options?.map((option) => (
                <SelectItem key={option.value} value={option.value}>
                  {option.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        )
      
      case 'textarea':
        return (
          <Textarea
            {...commonProps}
            onChange={(e) => onChange(field.name, e.target.value)}
            rows={3}
          />
        )
      
      default:
        return (
          <Input
            {...commonProps}
            type={field.type}
          />
        )
    }
  }

  return (
    <Card className={cn("w-full", className)}>
      {(title || description) && (
        <CardHeader className="pb-4">
          {title && <CardTitle className="text-lg sm:text-xl">{title}</CardTitle>}
          {description && <p className="text-sm text-gray-600">{description}</p>}
        </CardHeader>
      )}
      
      <CardContent className="space-y-4 sm:space-y-6">
        <div className="grid grid-cols-1 gap-4 sm:gap-6">
          {fields.map((field) => (
            <div key={field.name} className="space-y-2">
              <Label htmlFor={field.name} className="text-sm font-medium">
                {field.label}
                {field.required && <span className="text-red-500 ml-1">*</span>}
              </Label>
              {renderField(field)}
            </div>
          ))}
        </div>

        {children}

        <div className="flex flex-col sm:flex-row gap-3 pt-4">
          <Button
            onClick={onSubmit}
            disabled={isLoading}
            className="w-full sm:w-auto sm:ml-auto touch-target"
          >
            {isLoading ? "Processing..." : submitLabel}
          </Button>
        </div>
      </CardContent>
    </Card>
  )
}

// Mobile-optimized filter component
interface MobileFiltersProps {
  filters: FormField[]
  values: Record<string, any>
  onChange: (name: string, value: any) => void
  onApply: () => void
  onReset: () => void
  className?: string
}

export function MobileFilters({
  filters,
  values,
  onChange,
  onApply,
  onReset,
  className
}: MobileFiltersProps) {
  return (
    <Card className={cn("w-full", className)}>
      <CardContent className="p-4 sm:p-6">
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
          {filters.map((field) => (
            <div key={field.name} className="space-y-2">
              <Label htmlFor={field.name} className="text-sm font-medium">
                {field.label}
              </Label>
              {field.type === 'select' ? (
                <Select value={values[field.name] || ''} onValueChange={(value) => onChange(field.name, value)}>
                  <SelectTrigger className="w-full">
                    <SelectValue placeholder={field.placeholder} />
                  </SelectTrigger>
                  <SelectContent>
                    {field.options?.map((option) => (
                      <SelectItem key={option.value} value={option.value}>
                        {option.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              ) : (
                <Input
                  id={field.name}
                  type={field.type}
                  value={values[field.name] || ''}
                  onChange={(e) => onChange(field.name, e.target.value)}
                  placeholder={field.placeholder}
                  className="w-full"
                />
              )}
            </div>
          ))}
        </div>
        
        <div className="flex flex-col sm:flex-row gap-3 mt-6">
          <Button onClick={onApply} className="w-full sm:w-auto touch-target">
            Apply Filters
          </Button>
          <Button 
            variant="outline" 
            onClick={onReset} 
            className="w-full sm:w-auto touch-target"
          >
            Reset
          </Button>
        </div>
      </CardContent>
    </Card>
  )
}
