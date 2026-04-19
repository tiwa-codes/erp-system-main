import { NextRequest, NextResponse } from "next/server"
import { prisma } from "@/lib/prisma"
import { uploadFile } from "@/lib/cloudinary"

// Handle unhandled promise rejections
process.on('unhandledRejection', (reason, promise) => {
  console.error('Unhandled Rejection at:', promise, 'reason:', reason)
  // Don't let unhandled rejections crash the process
})

export async function POST(request: NextRequest) {
  try {
    // Wrap the entire function to catch any unhandled errors
    return await handleProviderRegistration(request)
  } catch (error) {
    console.error('Unexpected error in provider registration:', error)
    return NextResponse.json(
      { 
        success: false,
        error: 'An unexpected error occurred. Please try again.',
        details: error instanceof Error ? error.message : 'Unknown error'
      },
      { status: 500 }
    )
  }
}

async function handleProviderRegistration(request: NextRequest) {
  try {
    const formData = await request.formData()
    
    // Extract form fields
    const accountType = formData.get('account_type') as string
    const status = formData.get('status') as string
    
    // Handle USER account type
    if (accountType === 'USER') {
      // Generate unique provider_id
      const lastProvider = await prisma.provider.findFirst({
        orderBy: { provider_id: 'desc' }
      })
      
      const nextProviderId = lastProvider 
        ? (parseInt(lastProvider.provider_id) + 1).toString()
        : '1'

      const provider = await prisma.provider.create({
        data: {
          provider_id: nextProviderId,
          facility_name: formData.get('hospital_name') as string,
          address: formData.get('address') as string || "",
          phone_whatsapp: formData.get('contact_number') as string,
          email: formData.get('email') as string,
          medical_director_name: formData.get('person_in_charge') as string,
          hmo_coordinator_name: "",
          hmo_coordinator_phone: "",
          hmo_coordinator_email: "",
          year_of_incorporation: "",
          facility_reg_number: "",
          practice: "",
          proprietor_partners: "",
          hcp_code: "",
          hours_of_operation: "",
          other_branches: "",
          emergency_care_services: [],
          facility_type: [],
          personnel_licensed: "",
          blood_bank_available: "",
          blood_sourcing_method: "",
          radiology_lab_services: [],
          other_services: [],
          account_name: "",
          account_number: "",
          designation: "",
          date: null,
          cac_registration_url: null,
          nhis_accreditation_url: null,
          professional_indemnity_url: null,
          state_facility_registration_url: null,
          status: status as any
        }
      })

      return NextResponse.json({
        success: true,
        message: "User registration submitted successfully",
        provider: {
          id: provider.id,
          facility_name: provider.facility_name,
          status: provider.status
        }
      })
    }
    
    // Handle PROVIDER account type
    // Validate required fields
    const facility_name = formData.get('facility_name') as string
    const address = formData.get('address') as string
    const phone_whatsapp = formData.get('phone_whatsapp') as string
    const email = formData.get('email') as string
    const medical_director_name = formData.get('medical_director_name') as string
    const declarationAccepted = (formData.get('declaration_accepted') as string) === 'true'

    if (!facility_name || !address || !phone_whatsapp || !email || !medical_director_name) {
      return NextResponse.json(
        { 
          success: false,
          error: 'Facility name, address, phone number, email, and medical director name are required' 
        },
        { status: 400 }
      )
    }

    if (!declarationAccepted) {
      return NextResponse.json(
        {
          success: false,
          error: 'Please accept the declaration statement before submitting.'
        },
        { status: 400 }
      )
    }

    // Check if facility already exists
    const existingProvider = await prisma.provider.findFirst({
      where: { 
        OR: [
          { facility_name },
          { email }
        ]
      }
    })

    if (existingProvider) {
      return NextResponse.json(
        { 
          success: false,
          error: 'A provider with this facility name or email already exists' 
        },
        { status: 400 }
      )
    }

    // Upload documents to Cloudinary
    let cac_registration_url = null
    let nhis_accreditation_url = null
    let professional_indemnity_url = null
    let state_facility_registration_url = null
    let others_attachment_url = null
    let medical_director_certificate_url = null
    let facility_license_url = null

    try {
      // Upload CAC Registration
      const cacFile = formData.get('documents.cac_registration') as File
      if (cacFile && cacFile.size > 0) {
        try {
          const cacResult = await uploadFile(cacFile, { 
            folder: 'provider-documents',
            resource_type: 'auto',
            max_bytes: 5 * 1024 * 1024 // 5MB
          })
          cac_registration_url = cacResult.secure_url
        } catch (error) {
          return NextResponse.json(
            { error: `Failed to upload CAC Registration: ${error instanceof Error ? error.message : 'Invalid file format'}` },
            { status: 400 }
          )
        }
      }

      // Upload NHIS Accreditation
      const nhisFile = formData.get('documents.nhis_accreditation') as File
      if (nhisFile && nhisFile.size > 0) {
        try {
          const nhisResult = await uploadFile(nhisFile, { 
            folder: 'provider-documents',
            resource_type: 'auto',
            max_bytes: 5 * 1024 * 1024 // 5MB
          })
          nhis_accreditation_url = nhisResult.secure_url
        } catch (error) {
          return NextResponse.json(
            { error: `Failed to upload NHIS Accreditation: ${error instanceof Error ? error.message : 'Invalid file format'}` },
            { status: 400 }
          )
        }
      }

      // Upload Professional Indemnity
      const indemnityFile = formData.get('documents.professional_indemnity') as File
      if (indemnityFile && indemnityFile.size > 0) {
        try {
          const indemnityResult = await uploadFile(indemnityFile, { 
            folder: 'provider-documents',
            resource_type: 'auto',
            max_bytes: 5 * 1024 * 1024 // 5MB
          })
          professional_indemnity_url = indemnityResult.secure_url
        } catch (error) {
          return NextResponse.json(
            { error: `Failed to upload Professional Indemnity: ${error instanceof Error ? error.message : 'Invalid file format'}` },
            { status: 400 }
          )
        }
      }

      // Upload State Facility Registration
      const stateFile = formData.get('documents.state_facility_registration') as File
      if (stateFile && stateFile.size > 0) {
        try {
          const stateResult = await uploadFile(stateFile, { 
            folder: 'provider-documents',
            resource_type: 'auto',
            max_bytes: 5 * 1024 * 1024 // 5MB
          })
          state_facility_registration_url = stateResult.secure_url
        } catch (error) {
          return NextResponse.json(
            { error: `Failed to upload State Facility Registration: ${error instanceof Error ? error.message : 'Invalid file format'}` },
            { status: 400 }
          )
        }
      }

      // Upload Others attachment
      const othersFile = formData.get('documents.others') as File
      if (othersFile && othersFile.size > 0) {
        try {
          const othersResult = await uploadFile(othersFile, {
            folder: 'provider-documents',
            resource_type: 'auto',
            max_bytes: 5 * 1024 * 1024 // 5MB
          })
          others_attachment_url = othersResult.secure_url
        } catch (error) {
          return NextResponse.json(
            { error: `Failed to upload Others attachment: ${error instanceof Error ? error.message : 'Invalid file format'}` },
            { status: 400 }
          )
        }
      }

      // Upload Medical Director Certificate
      const medicalFile = formData.get('documents.medical_director_certificate') as File
      if (medicalFile && medicalFile.size > 0) {
        try {
          const medicalResult = await uploadFile(medicalFile, { 
            folder: 'provider-documents',
            resource_type: 'auto',
            max_bytes: 5 * 1024 * 1024 // 5MB
          })
          medical_director_certificate_url = medicalResult.secure_url
        } catch (error) {
          return NextResponse.json(
            { error: `Failed to upload Medical Director Certificate: ${error instanceof Error ? error.message : 'Invalid file format'}` },
            { status: 400 }
          )
        }
      }

      // Upload Facility License
      const licenseFile = formData.get('documents.facility_license') as File
      if (licenseFile && licenseFile.size > 0) {
        try {
          const licenseResult = await uploadFile(licenseFile, { 
            folder: 'provider-documents',
            resource_type: 'auto',
            max_bytes: 5 * 1024 * 1024 // 5MB
          })
          facility_license_url = licenseResult.secure_url
        } catch (error) {
          return NextResponse.json(
            { error: `Failed to upload Facility License: ${error instanceof Error ? error.message : 'Invalid file format'}` },
            { status: 400 }
          )
        }
      }
    } catch (uploadError) {
      return NextResponse.json(
        { 
          success: false,
          error: 'Failed to process file uploads. Please check your files and try again.',
          details: uploadError instanceof Error ? uploadError.message : 'Unknown upload error'
        },
        { status: 400 }
      )
    }

    // Generate unique provider_id with retry logic (matching dashboard behavior)
    let attempts = 0
    const maxAttempts = 5
    let providerId: string
    
    do {
      const lastProvider = await prisma.provider.findFirst({
        orderBy: { provider_id: 'desc' }
      })
      
      providerId = lastProvider 
        ? (parseInt(lastProvider.provider_id) + 1).toString()
        : '1'
      
      // Check if this ID already exists
      const existingId = await prisma.provider.findFirst({
        where: { provider_id: providerId }
      })
      
      if (!existingId) {
        break // ID is unique, we can use it
      }
      
      attempts++
      if (attempts >= maxAttempts) {
        // Fallback to UUID-based ID if numeric generation fails
        providerId = `PROV-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`
        break
      }
      
      // Add a small delay and try again
      await new Promise(resolve => setTimeout(resolve, 100))
    } while (attempts < maxAttempts)

    const provider = await prisma.provider.create({
      data: {
        provider_id: providerId,
        partnership_interest: formData.get('partnership_interest') as string || "",
        facility_name,
        address,
        phone_whatsapp,
        email,
        medical_director_name,
        hmo_coordinator_name: formData.get('hmo_coordinator_name') as string,
        hmo_coordinator_phone: formData.get('hmo_coordinator_phone') as string || "",
        hmo_coordinator_email: formData.get('hmo_coordinator_email') as string || "",
        year_of_incorporation: formData.get('year_of_incorporation') as string || "",
        facility_reg_number: formData.get('facility_reg_number') as string || "",
        practice: formData.get('practice') as string || "",
        proprietor_partners: formData.get('proprietor_partners') as string || "",
        hcp_code: formData.get('hcp_code') as string || "",
        hours_of_operation: formData.get('hours_of_operation') as string || "",
        other_branches: formData.get('other_branches') as string || "",
        emergency_care_services: JSON.parse(formData.get('emergency_care_services') as string || '[]'),
        facility_type: JSON.parse(formData.get('facility_type_services') as string || '[]'),
        personnel_licensed: formData.get('personnel_licensed') as string || "",
        blood_bank_available: formData.get('blood_bank_available') as string || "",
        blood_sourcing_method: formData.get('blood_sourcing_method') as string || "",
        radiology_lab_services: JSON.parse(formData.get('radiology_lab_services') as string || '[]'),
        other_services: JSON.parse(formData.get('other_services') as string || '[]'),
        account_name: formData.get('account_name') as string || "",
        account_number: formData.get('account_number') as string || "",
        // Keep using existing column for backward compatibility while public form now captures bank_name.
        designation: formData.get('bank_name') as string || "",
        date: null,
        cac_registration_url,
        nhis_accreditation_url,
        professional_indemnity_url,
        state_facility_registration_url,
        status: status as any
      }
    })

    // Persist extra document URLs that don't have dedicated columns (e.g. Others)
    if (others_attachment_url) {
      await prisma.providerUpdate.create({
        data: {
          provider_id: provider.id,
          source: 'PUBLIC_REGISTRATION_ATTACHMENTS',
          payload: {
            documents: {
              cac_registration: cac_registration_url,
              nhis_accreditation: nhis_accreditation_url,
              professional_indemnity: professional_indemnity_url,
              state_facility_registration: state_facility_registration_url,
              others: others_attachment_url,
            },
          },
        },
      })
    }

    const response = {
      success: true,
      message: "Provider registration submitted successfully",
      provider: {
        id: provider.id,
        facility_name: provider.facility_name,
        status: provider.status
      }
    }
    
    return NextResponse.json(response)

  } catch (error) {
    // Provide more specific error messages
    let errorMessage = 'Failed to create provider registration'
    let statusCode = 500
    
    if (error instanceof Error) {
      if (error.message.includes('Unique constraint')) {
        errorMessage = 'A provider with this facility name or email already exists'
        statusCode = 400
      } else if (error.message.includes('Invalid value')) {
        errorMessage = 'Invalid data provided. Please check your input and try again.'
        statusCode = 400
      } else if (error.message.includes('Failed to upload')) {
        errorMessage = 'Failed to upload documents. Please try again with valid files.'
        statusCode = 400
      } else if (error.message.includes('File type') || error.message.includes('not allowed')) {
        errorMessage = error.message
        statusCode = 400
      } else if (error.message.includes('File size exceeds')) {
        errorMessage = error.message
        statusCode = 400
      } else {
        errorMessage = error.message
      }
    }
    
    return NextResponse.json(
      { 
        success: false,
        error: errorMessage,
        details: process.env.NODE_ENV === 'development' ? error : undefined
      },
      { status: statusCode }
    )
  }
}

// Handle OPTIONS request for CORS
export async function OPTIONS(request: NextRequest) {
  return new NextResponse(null, {
    status: 200,
    headers: {
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Methods': 'POST, OPTIONS',
      'Access-Control-Allow-Headers': 'Content-Type',
    },
  })
}