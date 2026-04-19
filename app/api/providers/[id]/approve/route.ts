import { NextRequest, NextResponse } from "next/server"
import { getServerSession } from "next-auth"
import { authOptions } from "@/lib/auth"
import { prisma } from "@/lib/prisma"
import { checkPermission } from "@/lib/permissions"
import { notificationService } from "@/lib/notifications"
import { hashPassword, generateRandomPassword } from "@/lib/auth-utils"

function getCredentialRecipients(provider: {
  email?: string | null
  hmo_coordinator_email?: string | null
}): string[] {
  const emails = [provider.email, provider.hmo_coordinator_email]
    .map((value) => (value || "").trim().toLowerCase())
    .filter(Boolean)
  return Array.from(new Set(emails))
}

export async function POST(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const session = await getServerSession(authOptions)
    if (!session?.user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }

    // Check if user has provider approval permissions
    const hasPermission = await checkPermission(session.user.role as any, "provider", "approve")
    if (!hasPermission) {
      return NextResponse.json({ error: "Insufficient permissions" }, { status: 403 })
    }

    const { id } = params
    const body = await request.json()
    const { action, comments, assigned_bands } = body

    // Find the provider
    const provider = await prisma.provider.findUnique({
      where: { id }
    })

    if (!provider) {
      return NextResponse.json({ error: "Provider not found" }, { status: 404 })
    }

    if (provider.status !== 'PENDING_APPROVAL') {
      return NextResponse.json({ error: "Provider has already been processed" }, { status: 400 })
    }

    // Update provider status and bands
    const newStatus = action === 'approve' ? 'ACTIVE' : 'REJECTED'
    const updateData: any = {
      status: newStatus,
      updated_at: new Date()
    }
    
    // If approving and bands are provided, assign them
    if (action === 'approve' && assigned_bands && Array.isArray(assigned_bands)) {
      updateData.selected_bands = assigned_bands
    }
    
    const updatedProvider = await prisma.provider.update({
      where: { id },
      data: updateData
    })

    // Log audit trail
    await prisma.auditLog.create({
      data: {
        user_id: session.user.id,
        action: action === 'approve' ? 'PROVIDER_APPROVED' : 'PROVIDER_REJECTED',
        resource: 'provider',
        resource_id: id,
        old_values: { status: provider.status },
        new_values: { 
          status: newStatus,
          approval_comments: comments,
          approved_by: session.user.id,
          approved_at: new Date(),
          assigned_bands: assigned_bands || []
        },
        ip_address: request.headers.get('x-forwarded-for') || 'unknown',
        user_agent: request.headers.get('user-agent') || 'unknown'
      }
    })

    // If approved, automatically create user account and send login credentials
    let createdUser = null
    let credentialsSent = false
    if (action === 'approve') {
      try {
        // Check if user already exists with this email
        const existingUser = await prisma.user.findUnique({
          where: { email: provider.email }
        })

        if (!existingUser) {
          // Find PROVIDER role
          const providerRole = await prisma.role.findFirst({
            where: { name: 'PROVIDER' }
          })

          if (!providerRole) {
            console.error('PROVIDER role not found in database')
          } else {
            // Generate temporary password
            const tempPassword = generateRandomPassword(12)
            const hashedPassword = await hashPassword(tempPassword)

            // Extract name from HMO coordinator or use facility name
            const coordinatorName = provider.hmo_coordinator_name || provider.facility_name
            const nameParts = coordinatorName.split(' ')
            const firstName = nameParts[0] || 'Provider'
            const lastName = nameParts.slice(1).join(' ') || 'User'

            // Create user account
            createdUser = await prisma.user.create({
              data: {
                email: provider.email,
                first_name: firstName,
                last_name: lastName,
                phone_number: provider.hmo_coordinator_phone || provider.phone_whatsapp,
                role_id: providerRole.id,
                provider_id: provider.id,
                password: hashedPassword,
                status: 'ACTIVE',
                first_login: true
              },
              include: {
                role: true,
                provider: true
              }
            })

            // Log user creation
            await prisma.auditLog.create({
              data: {
                user_id: session.user.id,
                action: 'USER_CREATED',
                resource: 'user',
                resource_id: createdUser.id,
                new_values: {
                  email: createdUser.email,
                  role: 'PROVIDER',
                  provider_id: provider.id,
                  auto_created: true
                }
              }
            })

            // Send login credentials email to provider + coordinator (if different)
            try {
              const recipients = getCredentialRecipients(provider)
              if (recipients.length === 0) {
                console.error(`No recipient email found for provider ${provider.id} during credential dispatch`)
              } else {
                let sentAny = false
                for (const recipient of recipients) {
                  const sent = await notificationService.sendProviderLoginCredentials(
                    recipient,
                    `${firstName} ${lastName}`,
                    provider.facility_name,
                    tempPassword
                  )
                  sentAny = sentAny || sent
                  if (sent) {
                    console.log(`Login credentials sent to ${recipient}`)
                  } else {
                    console.error(`Credential email dispatch failed for ${recipient}`)
                  }
                }
                credentialsSent = sentAny
              }
            } catch (emailError) {
              console.error('Failed to send login credentials email:', emailError)
              // Don't fail if email fails
            }
          }
        } else {
          // User already exists, just link to provider if not already linked
          if (!existingUser.provider_id) {
            await prisma.user.update({
              where: { id: existingUser.id },
              data: { provider_id: provider.id }
            })
            console.log(`Linked existing user ${existingUser.email} to provider ${provider.id}`)
          }
        }
      } catch (userCreationError) {
        console.error('Failed to create user account for provider:', userCreationError)
        // Don't fail the approval if user creation fails
      }
    }

    // Send email notification to provider
    try {
      // Get user details for the email
      const userDetails = await prisma.user.findUnique({
        where: { id: session.user.id },
        select: {
          first_name: true,
          last_name: true,
          email: true
        }
      })
      
      await sendProviderNotification({
        provider: updatedProvider,
        action,
        comments,
        approvedBy: userDetails || { first_name: 'Admin', last_name: 'User', email: session.user.email },
        userCreated: createdUser !== null
      })
    } catch (emailError) {
      console.error('Failed to send email notification:', emailError)
      // Don't fail the request if email fails
    }

    return NextResponse.json({
      success: true,
      message: `Provider ${action === 'approve' ? 'approved' : 'rejected'} successfully`,
      provider: updatedProvider,
      credentials_sent: credentialsSent
    })

  } catch (error) {
    console.error('Error processing provider approval:', error)
    return NextResponse.json(
      { error: 'Failed to process provider approval' },
      { status: 500 }
    )
  }
}

// Email notification function
async function sendProviderNotification({
  provider,
  action,
  comments,
  approvedBy,
  userCreated = false
}: {
  provider: any
  action: string
  comments: string
  approvedBy: any
  userCreated?: boolean
}) {
  try {
    console.log('Sending provider notification:', {
      provider_email: provider.email,
      action,
      approvedBy: approvedBy
    })
    
    const subject = `Provider Registration ${action === 'approve' ? 'Approved' : 'Rejected'}`
    const html = `
      <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
        <h2 style="color: ${action === 'approve' ? '#10b981' : '#ef4444'};">
          Provider Registration ${action === 'approve' ? 'Approved' : 'Rejected'}
        </h2>
        
        <div style="background-color: #f9fafb; padding: 20px; border-radius: 8px; margin: 20px 0;">
          <h3 style="margin-top: 0;">Provider Details</h3>
          <p><strong>Facility Name:</strong> ${provider.facility_name}</p>
          <p><strong>Email:</strong> ${provider.email}</p>
          <p><strong>Phone:</strong> ${provider.phone_whatsapp}</p>
          <p><strong>Address:</strong> ${provider.address}</p>
        </div>
        
        <div style="background-color: ${action === 'approve' ? '#d1fae5' : '#fee2e2'}; padding: 15px; border-radius: 8px; margin: 20px 0;">
          <p style="margin: 0; color: ${action === 'approve' ? '#065f46' : '#991b1b'};">
            <strong>Status:</strong> ${action === 'approve' ? 'APPROVED' : 'REJECTED'}
          </p>
          <p style="margin: 5px 0 0 0; color: ${action === 'approve' ? '#065f46' : '#991b1b'};">
            <strong>Approved by:</strong> ${approvedBy?.first_name || 'Admin'} ${approvedBy?.last_name || 'User'}
          </p>
          <p style="margin: 5px 0 0 0; color: ${action === 'approve' ? '#065f46' : '#991b1b'};">
            <strong>Date:</strong> ${new Date().toLocaleDateString()}
          </p>
          ${comments ? `<p style="margin: 5px 0 0 0; color: ${action === 'approve' ? '#065f46' : '#991b1b'};"><strong>Comments:</strong> ${comments}</p>` : ''}
        </div>
        
        ${action === 'approve' ? `
          <div style="background-color: #dbeafe; padding: 15px; border-radius: 8px; margin: 20px 0;">
            <p style="margin: 0; color: #1e40af;">
              <strong>Next Steps:</strong> ${userCreated ? 'Your login credentials have been sent to this email address. ' : ''}You can now access the provider portal and begin using our services. 
              Please contact our support team if you need any assistance.
            </p>
            ${userCreated ? `
              <p style="margin: 10px 0 0 0; color: #1e40af;">
                <strong>Important:</strong> Please check your email for your login credentials. You will need to set up your tariff plan before you can start requesting approval codes.
              </p>
            ` : ''}
          </div>
        ` : `
          <div style="background-color: #fef3c7; padding: 15px; border-radius: 8px; margin: 20px 0;">
            <p style="margin: 0; color: #92400e;">
              <strong>Next Steps:</strong> Please review the feedback above and resubmit your application 
              with the necessary corrections. Contact our support team if you have any questions.
            </p>
          </div>
        `}
        
        <p>If you have any questions, please contact our support team.</p>
        
        <hr style="border: none; border-top: 1px solid #e5e7eb; margin: 30px 0;">
        <p style="color: #6b7280; font-size: 14px;">This is an automated message from the ERP System.</p>
      </div>
    `

    console.log('Sending provider notification email to:', provider.email)
    
    const success = await notificationService.sendEmail({
      to: provider.email,
      subject,
      html
    })

    if (success) {
      console.log(`Provider ${action} notification sent successfully to ${provider.email}`)
    } else {
      console.error(`Failed to send provider ${action} notification to ${provider.email}`)
    }

    return success
  } catch (error) {
    console.error('Email notification error:', error)
    throw error
  }
}
