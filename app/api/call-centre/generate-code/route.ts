import { NextRequest, NextResponse } from "next/server"
import { getServerSession } from "next-auth"
import { authOptions } from "@/lib/auth"
import { prisma } from "@/lib/prisma"
import { checkPermission } from "@/lib/permissions"
import { notificationService } from "@/lib/notifications"

export async function POST(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions)
    if (!session?.user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }

    // Check if user has call-centre permissions or provider add permission (providers may request encounter codes)
    const hasCallCentrePermission = await checkPermission(session.user.role as any, "call-centre", "add")
    const hasProviderPermissionLegacy = await checkPermission(session.user.role as any, "providers", "add")
    const hasProviderPermission = await checkPermission(session.user.role as any, "provider", "add")
    if (!hasCallCentrePermission && !hasProviderPermissionLegacy && !hasProviderPermission) {
      return NextResponse.json({ error: "Insufficient permissions" }, { status: 403 })
    }

    const body = await request.json()
    const {
      enrollee_id,
      enrollee_name
    } = body

    if (!enrollee_id || !enrollee_name) {
      return NextResponse.json({ error: "Required fields missing: enrollee_id and enrollee_name are required" }, { status: 400 })
    }

    // Find enrollee (Principal or Dependent)
    let enrollee: any = await prisma.principalAccount.findFirst({
      where: { enrollee_id },
      select: {
        id: true,
        first_name: true,
        last_name: true,
        enrollee_id: true,
        email: true,
        phone_number: true,
        organization: {
          select: {
            id: true,
            name: true
          }
        },
        plan: {
          select: {
            id: true,
            name: true
          }
        }
      }
    })

    let isDependent = false
    let principalEnrollee = null

    if (!enrollee) {
      // Check if it's a dependent
      const dependent = await prisma.dependent.findUnique({
        where: { dependent_id: enrollee_id },
        include: {
          principal: {
            select: {
              id: true,
              enrollee_id: true,
              first_name: true,
              last_name: true,
              email: true,
              phone_number: true,
              organization: {
                select: {
                  id: true,
                  name: true
                }
              },
              plan: {
                select: {
                  id: true,
                  name: true
                }
              }
            }
          }
        }
      })

      if (dependent) {
        isDependent = true
        // Normalize dependent data to match expected structure
        enrollee = {
          id: dependent.id,
          enrollee_id: dependent.dependent_id,
          first_name: dependent.first_name,
          last_name: dependent.last_name,
          phone_number: dependent.phone_number || dependent.principal.phone_number,
          email: dependent.email || dependent.principal.email,
          // Use principal's org and plan for the dependent
          organization: dependent.principal.organization,
          plan: dependent.principal.plan
        }
        principalEnrollee = dependent.principal
      }
    }

    if (!enrollee) {
      return NextResponse.json({ error: "Enrollee not found" }, { status: 404 })
    }

    // Get enrollee's contact info for notifications
    const enrolleeEmail = enrollee.email
    const enrolleePhone = enrollee.phone_number || ""

    // Verify that the current user exists in the database
    let currentUser = await prisma.user.findUnique({
      where: { id: session.user.id }
    })

    if (!currentUser) {
      // Try to find user by email as fallback
      const userByEmail = await prisma.user.findUnique({
        where: { email: session.user.email }
      })

      if (!userByEmail) {
        return NextResponse.json({
          error: "Current user not found in database",
          debug: {
            sessionUserId: session.user.id,
            sessionUserEmail: session.user.email
          }
        }, { status: 404 })
      }

      // Use the user found by email
      currentUser = userByEmail
    }

    const CHARACTERS = "ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789"
    const CODE_LENGTH = 4

    const generateRandomCode = () => (
      Array.from({ length: CODE_LENGTH }, () => CHARACTERS[Math.floor(Math.random() * CHARACTERS.length)]).join("")
    )

    const generateUniqueEncounterCode = async () => {
      let attempts = 0
      while (attempts < 10) {
        const candidate = generateRandomCode()
        const existing = await prisma.approvalCode.findUnique({
          where: { approval_code: candidate }
        })
        if (!existing) {
          return candidate
        }
        attempts++
      }
      throw new Error("Unable to generate a unique encounter code after multiple attempts")
    }

    const encounterCode = await generateUniqueEncounterCode()

    const approvalCodeRecord = await prisma.approvalCode.create({
      data: {
        approval_code: encounterCode,
        // IF it's a dependent, we MUST link to the Principal's ID to satisfy the foreign key constraint
        // The Dependent's name is stored in enrollee_name, so the facility knows who the patient is.
        enrollee_id: isDependent && principalEnrollee ? principalEnrollee.id : enrollee.id,
        // Store the actual beneficiary ID (e.g. CJH/D01) for display purposes
        beneficiary_id: isDependent && principalEnrollee ? enrollee.enrollee_id : enrollee.enrollee_id,
        enrollee_name: enrollee_name,
        hospital: "", // No hospital required
        services: "", // No services required
        amount: 0,
        diagnosis: "", // No diagnosis required
        admission_required: false,
        status: 'PENDING', // PENDING = Active for encounter codes
        generated_by_id: currentUser.id
      },
      include: {
        enrollee: {
          select: {
            id: true,
            enrollee_id: true,
            first_name: true,
            last_name: true
          }
        },
        generated_by: {
          select: {
            id: true,
            first_name: true,
            last_name: true
          }
        }
      }
    })

    // Create audit log
    await prisma.auditLog.create({
      data: {
        user_id: currentUser.id,
        action: "APPROVAL_CODE_GENERATE",
        resource: "approval_code",
        resource_id: approvalCodeRecord.id,
        new_values: {
          approval_code: approvalCodeRecord.approval_code,
          enrollee_name: approvalCodeRecord.enrollee_name,
          hospital: approvalCodeRecord.hospital,
          amount: approvalCodeRecord.amount,
          diagnosis: approvalCodeRecord.diagnosis,
          type: 'ENCOUNTER' // Encounter code type
        }
      }
    })

    // Send email notification to enrollee
    if (enrolleeEmail) {
      try {
        await notificationService.sendEncounterCodeEmail(
          enrolleeEmail,
          {
            name: enrollee_name,
            enrolleeId: enrollee.enrollee_id,
            plan: enrollee.plan.name,
            organization: enrollee.organization.name
          },
          {
            encounterCode: approvalCodeRecord.approval_code,
            hospital: approvalCodeRecord.hospital || "Any Accredited Facility",
            services: approvalCodeRecord.services || "General Consultation",
            diagnosis: approvalCodeRecord.diagnosis || undefined,
            generatedBy: `${currentUser.first_name} ${currentUser.last_name}`,
            generatedDate: new Date().toLocaleDateString('en-GB', {
              day: 'numeric',
              month: 'long',
              year: 'numeric'
            })
          }
        )
      } catch (emailError) {
        console.error("Failed to send encounter code email:", emailError)
        // Continue execution, don't fail the request just because email failed
      }
    }

    if (enrolleePhone) {
      try {
        await notificationService.sendEncounterCodeSMS(enrolleePhone, {
          name: enrollee_name,
          encounterCode: approvalCodeRecord.approval_code,
          hospital: approvalCodeRecord.hospital || "Any Accredited Facility"
        })
      } catch (smsError) {
        console.error("Failed to send encounter code SMS:", smsError)
      }
    }

    return NextResponse.json({
      success: true,
      approval_code: approvalCodeRecord.approval_code,
      message: "Encounter code generated successfully",
      data: {
        id: approvalCodeRecord.id,
        approval_code: approvalCodeRecord.approval_code,
        generated_by: `${approvalCodeRecord.generated_by.first_name} ${approvalCodeRecord.generated_by.last_name}`,
        hospital: approvalCodeRecord.hospital,
        services: approvalCodeRecord.services,
        amount: approvalCodeRecord.amount,
        status: approvalCodeRecord.status,
        date: approvalCodeRecord.created_at,
        enrollee_id: approvalCodeRecord.enrollee.enrollee_id,
        enrollee_name: `${approvalCodeRecord.enrollee.first_name} ${approvalCodeRecord.enrollee.last_name}`
      }
    }, { status: 201 })

  } catch (error) {
    console.error("Error generating approval code:", error)
    return NextResponse.json(
      { error: "Failed to generate approval code" },
      { status: 500 }
    )
  }
}
