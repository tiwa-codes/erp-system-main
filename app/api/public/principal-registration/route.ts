import { NextRequest, NextResponse } from "next/server"
import { prisma } from "@/lib/prisma"

/**
 * Parse date string to Date object, handling various formats from different browsers
 * Mobile browsers (especially iOS Safari) may send dates in different formats
 * @param dateInput - Date string or Date object
 * @returns Date object
 * @throws Error if date is invalid
 */
function parseDate(dateInput: string | Date): Date {
  if (dateInput instanceof Date) {
    return dateInput
  }

  // Try parsing the date string
  const date = new Date(dateInput)

  // Check if date is valid
  if (isNaN(date.getTime())) {
    throw new Error(`Invalid date format: ${dateInput}`)
  }

  return date
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json()

    // COMPREHENSIVE DEBUG LOGGING - Log the entire request body
    console.log('===== PRINCIPAL REGISTRATION REQUEST =====')
    console.log('Full request body:', JSON.stringify(body, null, 2))
    console.log('==========================================')

    const {
      first_name,
      last_name,
      middle_name,
      gender,
      date_of_birth,
      phone_number,
      email,
      residential_address,
      profile_picture,
      organization_id,
      organization_name,
      organization_code,
      organization_email,
      organization_phone,
      organization_address,
      plan_id,
      plan_name,
      plan_type,
      primary_hospital,
      hospital_address,
      remarks,
      source = 'PUBLIC_LINK', // Default to PUBLIC_LINK
      dependents = []
    } = body

    // Log extracted values for debugging
    console.log('Extracted values:', {
      first_name,
      last_name,
      gender,
      date_of_birth,
      phone_number,
      email,
      organization_id,
      plan_id,
      dependents_count: dependents.length
    })

    // Validate required fields
    if (!first_name || !last_name || !gender || !date_of_birth || !phone_number || !email || !residential_address) {
      return NextResponse.json(
        { error: "Missing required personal information fields" },
        { status: 400 }
      )
    }

    // MANDATORY PICTURE VALIDATION
    if (!profile_picture) {
      return NextResponse.json(
        { error: "Profile picture is required" },
        { status: 400 }
      )
    }

    if (!organization_id || !plan_id) {
      return NextResponse.json(
        { error: "Organization and plan selection are required" },
        { status: 400 }
      )
    }

    // Check if email already exists in pending registrations or active principals
    const existingEmail = await prisma.principalRegistration.findFirst({
      where: { email: email.toLowerCase() }
    })

    if (existingEmail) {
      return NextResponse.json(
        { error: "A registration with this email address already exists. Please use a different email or contact support." },
        { status: 400 }
      )
    }

    // Check if email exists in active principals
    const existingPrincipal = await prisma.principalAccount.findFirst({
      where: { email: email.toLowerCase() }
    })

    if (existingPrincipal) {
      return NextResponse.json(
        { error: "This email is already registered. Please use a different email or contact support." },
        { status: 400 }
      )
    }

    // Parse and validate date_of_birth
    let parsedDateOfBirth: Date
    try {
      parsedDateOfBirth = parseDate(date_of_birth)
    } catch (error) {
      return NextResponse.json(
        { error: "Invalid date of birth format. Please select a valid date." },
        { status: 400 }
      )
    }

    // Validate and normalize organization_id and plan_id
    // Ensure they are either valid non-empty strings or null (not empty strings)
    const normalizedOrganizationId = organization_id && organization_id.trim() !== '' ? organization_id.trim() : null
    const normalizedPlanId = plan_id && plan_id.trim() !== '' ? plan_id.trim() : null

    // Validate that required string fields are not empty
    // Trim all string inputs to remove whitespace
    const trimmedFirstName = first_name?.trim()
    const trimmedLastName = last_name?.trim()
    const trimmedGender = gender?.trim()
    const trimmedPhone = phone_number?.trim()
    const trimmedEmail = email?.trim()
    const trimmedAddress = residential_address?.trim()
    const trimmedOrgName = organization_name?.trim()
    const trimmedPlanName = plan_name?.trim()

    // Validate that required fields have actual values (not just whitespace)
    if (!trimmedFirstName || !trimmedLastName || !trimmedGender || !trimmedPhone || !trimmedEmail || !trimmedAddress) {
      return NextResponse.json(
        { error: "All required fields must have valid values (not empty or whitespace)" },
        { status: 400 }
      )
    }

    if (!trimmedOrgName || !trimmedPlanName) {
      return NextResponse.json(
        { error: "Organization name and plan name are required" },
        { status: 400 }
      )
    }

    // Normalize optional string fields - convert empty strings to null
    const normalizedMiddleName = middle_name && middle_name.trim() !== '' ? middle_name.trim() : null
    const normalizedOrgCode = organization_code && organization_code.trim() !== '' ? organization_code.trim() : null
    const normalizedOrgEmail = organization_email && organization_email.trim() !== '' ? organization_email.trim() : null
    const normalizedOrgPhone = organization_phone && organization_phone.trim() !== '' ? organization_phone.trim() : null
    const normalizedOrgAddress = organization_address && organization_address.trim() !== '' ? organization_address.trim() : null
    const normalizedPlanType = plan_type && plan_type.trim() !== '' ? plan_type.trim() : null
    const normalizedPrimaryHospital = primary_hospital && primary_hospital.trim() !== '' ? primary_hospital.trim() : null
    const normalizedHospitalAddress = hospital_address && hospital_address.trim() !== '' ? hospital_address.trim() : null
    const normalizedRemarks = remarks && remarks.trim() !== '' ? remarks.trim() : null
    const normalizedProfilePicture = profile_picture && profile_picture.trim() !== '' ? profile_picture.trim() : null
    const normalizedSource = source && source.trim() !== '' ? source.trim() : 'PUBLIC_LINK'

    // Debug logging to help identify validation issues
    console.log('Creating principal registration with:', {
      date_of_birth: parsedDateOfBirth,
      organization_id: normalizedOrganizationId,
      plan_id: normalizedPlanId,
      email: trimmedEmail.toLowerCase(),
      gender: trimmedGender,
      source: normalizedSource
    })

    // Create registration record
    const registration = await prisma.principalRegistration.create({
      data: {
        first_name: trimmedFirstName,
        last_name: trimmedLastName,
        middle_name: normalizedMiddleName,
        gender: trimmedGender,
        date_of_birth: parsedDateOfBirth,
        phone_number: trimmedPhone,
        email: trimmedEmail.toLowerCase(),
        residential_address: trimmedAddress,
        profile_picture: normalizedProfilePicture,
        organization_id: normalizedOrganizationId,
        organization_name: trimmedOrgName,
        organization_code: normalizedOrgCode,
        organization_email: normalizedOrgEmail,
        organization_phone: normalizedOrgPhone,
        organization_address: normalizedOrgAddress,
        plan_id: normalizedPlanId,
        plan_name: trimmedPlanName,
        plan_type: normalizedPlanType,
        primary_hospital: normalizedPrimaryHospital,
        hospital_address: normalizedHospitalAddress,
        remarks: normalizedRemarks,
        source: normalizedSource,
        status: 'PENDING', // PENDING, APPROVED, REJECTED
        submitted_at: new Date(),
        // Create dependent registrations if provided
        dependents: dependents && dependents.length > 0 ? {
          create: dependents.map((dep: any, index: number) => {
            // Parse and validate dependent's date_of_birth
            let depDateOfBirth: Date
            try {
              depDateOfBirth = parseDate(dep.date_of_birth)
            } catch (error) {
              throw new Error(`Invalid date of birth for dependent ${index + 1}. Please select a valid date.`)
            }

            return {
              first_name: dep.first_name,
              last_name: dep.last_name,
              middle_name: dep.middle_name || null,
              date_of_birth: depDateOfBirth,
              gender: dep.gender || null,
              relationship: dep.relationship,
              profile_picture: dep.profile_picture, // MANDATORY
              phone_number: dep.phone_number || null,
              email: dep.email || null,
              residential_address: dep.residential_address || null,
              status: 'PENDING',
              submitted_at: new Date()
            }
          })
        } : undefined
      }
    })

    // TODO: Send email notification to admin about new registration
    // TODO: Send confirmation email to applicant

    return NextResponse.json({
      success: true,
      message: "Registration submitted successfully. We will review your application and contact you within 2-3 business days.",
      registration: {
        id: registration.id,
        email: registration.email,
        status: registration.status,
        submitted_at: registration.submitted_at
      }
    }, { status: 201 })

  } catch (error) {
    // Log the full error for debugging
    console.error("===== PRINCIPAL REGISTRATION ERROR =====")
    console.error("Error details:", error)

    // Check if it's a Prisma error with specific field information
    if (error && typeof error === 'object' && 'code' in error) {
      const prismaError = error as any
      console.error("Prisma Error Code:", prismaError.code)
      console.error("Prisma Error Meta:", prismaError.meta)

      // P2007 is the "data validation error" code from Prisma
      if (prismaError.code === 'P2007') {
        console.error("❌ PRISMA VALIDATION ERROR - Field validation failed")
        console.error("Target field:", prismaError.meta?.target)
        console.error("Error message:", prismaError.message)
      }
    }

    if (error instanceof Error) {
      console.error("Error message:", error.message)
      console.error("Error stack:", error.stack)

      // Handle date parsing errors
      if (error.message.includes("Invalid date")) {
        return NextResponse.json(
          { error: error.message },
          { status: 400 }
        )
      }

      // Handle Prisma validation errors - provide more details
      if (error.message.includes("expected pattern") || error.message.includes("Invalid")) {
        console.error("❌ PRISMA VALIDATION ERROR - Check the logs above for field details")

        // Try to extract which field failed from the error message
        let fieldHint = ""
        if (error.message.includes("date")) {
          fieldHint = " (Likely a date field issue)"
        } else if (error.message.includes("email")) {
          fieldHint = " (Likely an email field issue)"
        } else if (error.message.includes("phone")) {
          fieldHint = " (Likely a phone number issue)"
        }

        return NextResponse.json(
          {
            error: "Invalid data format detected. Please check all fields are filled correctly." + fieldHint,
            details: process.env.NODE_ENV === 'development' ? error.message : undefined,
            hint: "Check server logs for detailed field information"
          },
          { status: 400 }
        )
      }
    }

    console.error("========================================")

    return NextResponse.json(
      { error: "Failed to process registration. Please try again later." },
      { status: 500 }
    )
  }
}
