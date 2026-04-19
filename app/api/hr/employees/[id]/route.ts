import { NextRequest, NextResponse } from "next/server"
import { getServerSession } from "next-auth"
import { authOptions } from "@/lib/auth"
import { prisma } from "@/lib/prisma"
import { checkPermission } from "@/lib/permissions"
import { z } from "zod"

const updateEmployeeSchema = z.object({
  employee_id: z.string().optional(),
  first_name: z.string().min(1),
  last_name: z.string().min(1),
  email: z.string().email(),
  phone: z.string().optional(),
  address: z.string().optional(),
  title: z.string().optional(),
  emergency_contact_name: z.string().optional(),
  emergency_contact_phone: z.string().optional(),
  emergency_contact_relationship: z.string().optional(),
  department_id: z.string().min(1),
  position: z.string().optional(),
  hire_date: z.string().optional(),
  salary: z.number().optional(),
  gender: z.string().optional(),
  employment_type: z.string().optional(),
  status: z.string().optional(),
  role: z.string().optional(),
  uploadedFileUrls: z.union([
    z.array(z.string()),
    z.object({
      resume: z.array(z.string()).optional(),
      certificates: z.array(z.string()).optional(),
      others: z.array(z.string()).optional(),
    })
  ]).optional(),
})

export async function GET(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const session = await getServerSession(authOptions)
    if (!session?.user?.id) {
      return NextResponse.json({ success: false, message: "Unauthorized" }, { status: 401 })
    }

    // Check permissions
    const hasPermission = await checkPermission(session.user.role as any, 'hr', 'view')

    if (!hasPermission && session.user.role !== "SUPER_ADMIN") {
      return NextResponse.json({ success: false, message: "Forbidden" }, { status: 403 })
    }

    const employee = await prisma.employee.findUnique({
      where: { id: params.id },
      select: {
        id: true,
        employee_id: true,
        first_name: true,
        last_name: true,
        email: true,
        phone_number: true,
        position: true,
        status: true,
        employment_type: true,
        hire_date: true,
        salary: true,
        gender: true,
        role: true,
        address: true,
        title: true,
        department_id: true,
        emergency_contact_name: true,
        emergency_contact_phone: true,
        emergency_contact_relationship: true,
        uploadedFileUrls: true,
        created_at: true,
        updated_at: true,
        department: {
          select: {
            id: true,
            name: true
          }
        }
      }
    })

    if (!employee) {
      return NextResponse.json({ success: false, message: "Employee not found" }, { status: 404 })
    }

    return NextResponse.json({
      success: true,
      data: employee,
    })
  } catch (error) {
    console.error("Error fetching employee:", error)
    return NextResponse.json(
      { success: false, message: "Internal server error" },
      { status: 500 }
    )
  }
}

export async function PUT(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const session = await getServerSession(authOptions)
    if (!session?.user?.id) {
      return NextResponse.json({ success: false, message: "Unauthorized" }, { status: 401 })
    }

    // Check if prisma client is available
    if (!prisma) {
      console.error('Prisma client is not available')
      return NextResponse.json(
        { success: false, message: "Database connection error" },
        { status: 500 }
      )
    }

    // Check permissions
    const hasPermission = await checkPermission(session.user.role as any, 'hr', 'edit')

    if (!hasPermission && session.user.role !== "SUPER_ADMIN") {
      return NextResponse.json({ success: false, message: "Forbidden" }, { status: 403 })
    }

    const body = await request.json()
    const validatedData = updateEmployeeSchema.parse(body)
    
    // Check if employee exists
    const existingEmployee = await prisma.employee.findUnique({
      where: { id: params.id },
    })

    if (!existingEmployee) {
      return NextResponse.json({ success: false, message: "Employee not found" }, { status: 404 })
    }

    // Check for unique employee_id (excluding current employee) - only if employee_id is provided
    if (validatedData.employee_id && validatedData.employee_id.trim() !== '') {
      const duplicateEmployeeId = await prisma.employee.findFirst({
        where: {
          employee_id: validatedData.employee_id,
          id: { not: params.id },
        },
      })

      if (duplicateEmployeeId) {
        return NextResponse.json(
          { success: false, message: "Employee ID already exists" },
          { status: 400 }
        )
      }
    }

    // Check for unique email (excluding current employee)
    const duplicateEmail = await prisma.employee.findFirst({
      where: {
        email: validatedData.email,
        id: { not: params.id },
      },
    })

    if (duplicateEmail) {
      return NextResponse.json(
        { success: false, message: "Email already exists" },
        { status: 400 }
      )
    }

    // Update employee
    const updatedEmployee = await prisma.employee.update({
      where: { id: params.id },
      data: {
        employee_id: validatedData.employee_id,
        first_name: validatedData.first_name,
        last_name: validatedData.last_name,
        email: validatedData.email,
        phone_number: validatedData.phone,
        address: validatedData.address,
        title: validatedData.title,
        emergency_contact_name: validatedData.emergency_contact_name,
        emergency_contact_phone: validatedData.emergency_contact_phone,
        emergency_contact_relationship: validatedData.emergency_contact_relationship,
        department_id: validatedData.department_id,
        position: validatedData.position,
        hire_date: validatedData.hire_date ? new Date(validatedData.hire_date) : undefined,
        salary: validatedData.salary,
        gender: validatedData.gender as any,
        employment_type: validatedData.employment_type as any,
        status: validatedData.status as any,
        role: validatedData.role,
        uploadedFileUrls: validatedData.uploadedFileUrls,
      },
      include: {
        department: {
          select: {
            id: true,
            name: true,
          },
        },
      },
    })

    // Log audit trail
    await prisma.auditLog.create({
      data: {
        user_id: session.user.id,
        action: "UPDATE",
        resource: "Employee",
        resource_id: params.id,
        old_values: {
          employee_id: existingEmployee.employee_id,
          first_name: existingEmployee.first_name,
          last_name: existingEmployee.last_name,
          email: existingEmployee.email,
          position: existingEmployee.position,
          status: existingEmployee.status,
        },
        new_values: {
          employee_id: updatedEmployee.employee_id,
          first_name: updatedEmployee.first_name,
          last_name: updatedEmployee.last_name,
          email: updatedEmployee.email,
          position: updatedEmployee.position,
          status: updatedEmployee.status,
        },
        ip_address: request.headers.get("x-forwarded-for") || request.headers.get("x-real-ip") || "unknown",
        user_agent: request.headers.get("user-agent") || "unknown",
      },
    })

    return NextResponse.json({
      success: true,
      data: updatedEmployee,
      message: "Employee updated successfully",
    })
  } catch (error) {
    console.error("Error updating employee:", error)
    
    if (error instanceof z.ZodError) {
      return NextResponse.json(
        { success: false, message: "Validation error", errors: error.errors },
        { status: 400 }
      )
    }

    return NextResponse.json(
      { success: false, message: "Internal server error" },
      { status: 500 }
    )
  }
}

export async function PATCH(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const session = await getServerSession(authOptions)
    if (!session?.user?.id) {
      return NextResponse.json({ success: false, message: "Unauthorized" }, { status: 401 })
    }

    // Check permissions
    const canEdit = await checkPermission(session.user.role as any, 'hr', 'edit')
    if (!canEdit) {
      return NextResponse.json({ success: false, message: "Forbidden" }, { status: 403 })
    }

    const { status } = await request.json()

    if (!status) {
      return NextResponse.json({ 
        success: false, 
        message: "Status is required" 
      }, { status: 400 })
    }

    // Validate status value
    const validStatuses = ['ACTIVE', 'INACTIVE', 'SUSPENDED', 'TERMINATED', 'ON_LEAVE']
    if (!validStatuses.includes(status)) {
      return NextResponse.json({ 
        success: false, 
        message: "Invalid status value" 
      }, { status: 400 })
    }

    // Get current employee data for audit log
    const currentEmployee = await prisma.employee.findUnique({
      where: { id: params.id }
    })

    if (!currentEmployee) {
      return NextResponse.json({ 
        success: false, 
        message: "Employee not found" 
      }, { status: 404 })
    }

    // Update employee status
    const updatedEmployee = await prisma.employee.update({
      where: { id: params.id },
      data: { 
        status,
        updated_at: new Date()
      },
      include: {
        department: {
          select: {
            id: true,
            name: true
          }
        }
      }
    })

    // Log the status change
    await prisma.auditLog.create({
      data: {
        user_id: session.user.id,
        action: "UPDATE",
        resource: "Employee",
        resource_id: params.id,
        old_values: {
          status: currentEmployee.status
        },
        new_values: {
          status: status
        },
        ip_address: request.headers.get("x-forwarded-for") || request.headers.get("x-real-ip") || "unknown",
        user_agent: request.headers.get("user-agent") || "unknown",
      }
    })

    return NextResponse.json({
      success: true,
      data: updatedEmployee,
      message: "Employee status updated successfully"
    })

  } catch (error) {
    console.error("Error updating employee status:", error)
    return NextResponse.json(
      { success: false, message: "Internal server error" },
      { status: 500 }
    )
  }
}

export async function DELETE(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const session = await getServerSession(authOptions)
    if (!session?.user?.id) {
      return NextResponse.json({ success: false, message: "Unauthorized" }, { status: 401 })
    }

    // Check permissions
    const hasPermission = await checkPermission(session.user.role as any, 'hr', 'delete')
    if (!hasPermission) {
      return NextResponse.json({ success: false, message: "Forbidden" }, { status: 403 })
    }

    // Check if employee exists
    const existingEmployee = await prisma.employee.findUnique({
      where: { id: params.id },
    })

    if (!existingEmployee) {
      return NextResponse.json({ success: false, message: "Employee not found" }, { status: 404 })
    }

    // Delete employee
    await prisma.employee.delete({
      where: { id: params.id },
    })

    // Log audit trail
    await prisma.auditLog.create({
      data: {
        user_id: session.user.id,
        action: "DELETE",
        resource: "Employee",
        resource_id: params.id,
        old_values: {
          employee_id: existingEmployee.employee_id,
          first_name: existingEmployee.first_name,
          last_name: existingEmployee.last_name,
          email: existingEmployee.email,
          position: existingEmployee.position,
        },
        new_values: {},
        ip_address: request.headers.get("x-forwarded-for") || request.headers.get("x-real-ip") || "unknown",
        user_agent: request.headers.get("user-agent") || "unknown",
      },
    })

    return NextResponse.json({
      success: true,
      message: "Employee deleted successfully",
    })
  } catch (error) {
    console.error("Error deleting employee:", error)
    return NextResponse.json(
      { success: false, message: "Internal server error" },
      { status: 500 }
    )
  }
}
