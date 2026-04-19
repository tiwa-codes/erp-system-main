import { Resend } from "resend"
import { prisma } from "./prisma"

const resend = new Resend(process.env.RESEND_API_KEY || "re_xxxxxxxxx")

function getSenderEmail() {
  const configuredFrom = process.env.FROM_EMAIL?.trim()

  if (!configuredFrom || configuredFrom.includes("support@sbfy360.com")) {
    return "Crown Jewel HMO <crownjewelhmo@sbfy360.com>"
  }

  return configuredFrom
}

function getAppBaseUrl() {
  const baseUrl =
    process.env.NEXTAUTH_URL ||
    process.env.NEXT_PUBLIC_APP_URL ||
    process.env.APP_URL ||
    "http://localhost:3000"

  return baseUrl.replace(/\/+$/, "")
}

interface EmailOptions {
  to: string
  subject: string
  html: string
  text?: string
  attachments?: Array<{
    filename: string
    content: string | Buffer
    contentType?: string
  }>
  recipientRole?: string
  metadata?: {
    isTeleconsultation?: boolean
  }
  skipSuperAdminCopy?: boolean
}

interface SMSOptions {
  to: string
  message: string
}

class NotificationService {
  private shouldSendNotifCopyToSuperAdmins(): boolean {
    return process.env.ENABLE_NOTIF_COPY_TO_SUPERADMINS === "true"
  }

  private async getSuperAdminEmails(): Promise<string[]> {
    try {
      const superAdmins = await prisma.user.findMany({
        where: {
          role: {
            name: {
              in: ['SUPER_ADMIN', 'SUPERADMIN'],
              mode: 'insensitive'
            }
          },
          status: 'ACTIVE'
        },
        select: { email: true }
      })
      return superAdmins.map(u => u.email).filter(Boolean) as string[]
    } catch (error) {
      console.error("Error fetching super admin emails:", error)
      return []
    }
  }

  private async sendToSuperAdmins(subject: string, html: string, originalRecipient?: string) {
    try {
      const emails = await this.getSuperAdminEmails()
      if (emails.length === 0) return

      const enrichedSubject = originalRecipient 
        ? `[NOTIF COPY] (To: ${originalRecipient}) ${subject}`
        : `[SYSTEM NOTIF] ${subject}`

      for (const email of emails) {
        await resend.emails.send({
          from: getSenderEmail(),
          to: [email],
          subject: enrichedSubject,
          html: html,
        })
      }
    } catch (error) {
      console.error("Failed to send copies to Super Admins:", error)
    }
  }

  async sendEmail(options: EmailOptions): Promise<boolean> {
    try {
      const email = options.to.toLowerCase()
      
      // 1. Determine role
      let role = options.recipientRole
      
      if (!role) {
        // Try User table first
        const user = await prisma.user.findFirst({
          where: { email: { equals: email, mode: 'insensitive' } },
          select: { role: { select: { name: true } } }
        })
        role = user?.role?.name?.toUpperCase()

        // If not found in User table or role is not ENROLLEE, check PrincipalAccount and Dependent
        if (role !== 'ENROLLEE') {
          const isPrincipal = await prisma.principalAccount.findFirst({
            where: { email: { equals: email, mode: 'insensitive' } }
          })
          
          if (isPrincipal) {
            role = 'ENROLLEE'
          } else {
            const isDependent = await prisma.dependent.findFirst({
              where: { email: { equals: email, mode: 'insensitive' } }
            })
            if (isDependent) role = 'ENROLLEE'
          }
        }
      }

      // 2. Global Filtering Logic
      const isEnrollee = role === 'ENROLLEE'
      const isSuperAdmin = role === 'SUPER_ADMIN' || role === 'SUPERADMIN'
      const isProviderRole = role === 'PROVIDER'
      const isTelemedicine = role === 'TELEMEDICINE'
      const isTeleconsultation = options.metadata?.isTeleconsultation === true
      
      // Known internal staff roles that should be blocked (except Super Admin)
      const internalStaffRoles = [
        'ADMIN', 'HR_MANAGER', 'HR_OFFICER', 'CLAIMS_PROCESSOR', 
        'CLAIMS_MANAGER', 'FINANCE_OFFICER', 'PROVIDER_MANAGER', 
        'UNDERWRITER', 'SPECIAL_RISK_MANAGER', 'SALES', 
        'TECHNICAL_ASSISTANT_SALES', 'HEAD_OF_AGENCY', 
        'SALES_OPERATIONS_MANAGER', 'CALL_CENTRE'
      ]

      let shouldSendToRecipient = false
      
      if (isEnrollee || isSuperAdmin || isProviderRole) {
        shouldSendToRecipient = true
      } else if (isTelemedicine && isTeleconsultation) {
        shouldSendToRecipient = true
      } else if (!role) {
        // If no role is found at all (not even in User table), it's likely an external recipient
        // (e.g. provider coordinator, external auditor, etc.) - we should allow these.
        shouldSendToRecipient = true
      } else if (!internalStaffRoles.includes(role)) {
        // If it's a role we don't recognize as an internal staff role, allow it by default
        shouldSendToRecipient = true
      }

      // 3. Optional copy to SUPER_ADMINs (disabled by default)
      if (this.shouldSendNotifCopyToSuperAdmins() && !isSuperAdmin && !options.skipSuperAdminCopy) {
        // We do this asynchronously to not block the main flow
        this.sendToSuperAdmins(options.subject, options.html, options.to)
      }

      if (!shouldSendToRecipient) {
        console.log(`[NOTIF BLOCK] Email to ${options.to} blocked. Role: ${role || 'UNKNOWN'}`)
        return false
      }

      const response = await resend.emails.send({
        from: getSenderEmail(),
        to: [options.to],
        subject: options.subject,
        html: options.html,
        text: options.text,
        attachments: options.attachments,
      })

      await this.logNotification({
        type: "EMAIL",
        recipient: options.to,
        subject: options.subject,
        message: options.html,
        status: "SENT",
        sent_at: new Date(),
      })

      return true
    } catch (error) {
      console.error("Email sending failed:", {
        to: options.to,
        subject: options.subject,
        error: error instanceof Error ? error.message : "Unknown error",
        stack: error instanceof Error ? error.stack : undefined
      })

      await this.logNotification({
        type: "EMAIL",
        recipient: options.to,
        subject: options.subject,
        message: options.html,
        status: "FAILED",
        error_message: error instanceof Error ? error.message : "Unknown error",
      })

      // We no longer throw error to prevent breaking flows if email fails
      return false
    }
  }

  async sendSMS(options: SMSOptions): Promise<boolean> {
    try {
      await this.logNotification({
        type: "SMS",
        recipient: options.to,
        subject: "SMS Notification",
        message: options.message,
        status: "SENT",
        sent_at: new Date(),
      })

      return true
    } catch (error) {
      console.error("SMS error:", error)

      await this.logNotification({
        type: "SMS",
        recipient: options.to,
        subject: "SMS Notification",
        message: options.message,
        status: "FAILED",
        error_message: error instanceof Error ? error.message : "Unknown error",
      })

      return false
    }
  }

  private async logNotification(notification: any) {
    try {
      // Skip logging if notificationLog table doesn't exist
      // This prevents the email sending from failing due to missing table
    } catch (error) {
    }
  }

  async sendWelcomeEmail(
    userEmail: string,
    userName: string,
    userRole: string,
    tempPassword: string
  ) {
    const subject = "Welcome to ERP System"
    const html = `
      <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
        <h2 style="color: #10b981;">Welcome to ERP System</h2>
        <p>Your account has been created successfully.</p>
        
        <div style="background-color: #f9fafb; padding: 20px; border-radius: 8px; margin: 20px 0;">
          <h3 style="margin-top: 0;">Account Details</h3>
          <p><strong>Name:</strong> ${userName}</p>
          <p><strong>Email:</strong> ${userEmail}</p>
          <p><strong>Role:</strong> ${userRole}</p>
          <p><strong>Temporary Password:</strong> <code style="background-color: #e5e7eb; padding: 2px 6px; border-radius: 4px;">${tempPassword}</code></p>
        </div>
        
        <div style="background-color: #fef3c7; padding: 15px; border-radius: 8px; margin: 20px 0;">
          <p style="margin: 0; color: #92400e;"><strong>Important:</strong> Please log in and change your password immediately for security reasons.</p>
        </div>
        
        <p>You can access the system at: <a href="${process.env.NEXTAUTH_URL}/auth/signin" style="color: #10b981;">${process.env.NEXTAUTH_URL}/auth/signin</a></p>
        
        <p>If you have any questions, please contact your system administrator.</p>
        
        <hr style="border: none; border-top: 1px solid #e5e7eb; margin: 30px 0;">
        <p style="color: #6b7280; font-size: 14px;">This is an automated message from the ERP System.</p>
      </div>
    `

    return this.sendEmail({ to: userEmail, subject, html })
  }

  async sendProviderLoginCredentials(
    providerEmail: string,
    providerName: string,
    facilityName: string,
    tempPassword: string
  ) {
    const subject = "Your Provider Portal Login Credentials"
    const html = `
      <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
        <h2 style="color: #10b981;">Welcome to the Provider Portal</h2>
        <p>Your provider registration has been approved and your account has been created.</p>
        
        <div style="background-color: #f9fafb; padding: 20px; border-radius: 8px; margin: 20px 0;">
          <h3 style="margin-top: 0;">Provider Details</h3>
          <p><strong>Facility Name:</strong> ${facilityName}</p>
          <p><strong>Name:</strong> ${providerName}</p>
          <p><strong>Email:</strong> ${providerEmail}</p>
        </div>
        
        <div style="background-color: #dbeafe; padding: 20px; border-radius: 8px; margin: 20px 0;">
          <h3 style="margin-top: 0; color: #1e40af;">Login Credentials</h3>
          <p><strong>Email:</strong> ${providerEmail}</p>
          <p><strong>Temporary Password:</strong> <code style="background-color: #e5e7eb; padding: 4px 8px; border-radius: 4px; font-size: 16px; font-weight: bold;">${tempPassword}</code></p>
        </div>
        
        <div style="background-color: #fef3c7; padding: 15px; border-radius: 8px; margin: 20px 0;">
          <p style="margin: 0; color: #92400e;">
            <strong>⚠️ Important Security Notice:</strong> Please log in immediately and change your password for security reasons.
          </p>
        </div>
        
        <div style="background-color: #d1fae5; padding: 15px; border-radius: 8px; margin: 20px 0;">
          <h4 style="margin-top: 0; color: #065f46;">Next Steps:</h4>
          <ol style="color: #065f46; padding-left: 20px;">
            <li>Log in to the provider portal using the credentials above</li>
            <li>Change your password immediately</li>
            <li>Set up your <strong>Tariff Plan</strong> - This is required before you can request approval codes</li>
            <li>Add your service prices in the Tariff Plan</li>
            <li>Submit your Tariff Plan for approval</li>
          </ol>
        </div>
        
        <p>You can access the provider portal at: <a href="${process.env.NEXTAUTH_URL || 'https://your-domain.com'}/auth/signin" style="color: #10b981; font-weight: bold;">${process.env.NEXTAUTH_URL || 'https://your-domain.com'}/auth/signin</a></p>
        
        <p>If you have any questions or need assistance, please contact our support team.</p>
        
        <hr style="border: none; border-top: 1px solid #e5e7eb; margin: 30px 0;">
        <p style="color: #6b7280; font-size: 14px;">This is an automated message from the ERP System. Please do not reply to this email.</p>
      </div>
    `

    return this.sendEmail({ to: providerEmail, subject, html })
  }

  async sendProviderLinkageNotification(
    providerEmail: string,
    providerName: string,
    facilityName: string
  ) {
    const subject = "Provider Facility Linked to Your Account"
    const html = `
      <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
        <h2 style="color: #10b981;">Provider Facility Linked</h2>
        <p>Your account has been linked to a new provider facility.</p>
        
        <div style="background-color: #f9fafb; padding: 20px; border-radius: 8px; margin: 20px 0;">
          <h3 style="margin-top: 0;">Provider Details</h3>
          <p><strong>Facility Name:</strong> ${facilityName}</p>
          <p><strong>Your Name:</strong> ${providerName}</p>
          <p><strong>Email:</strong> ${providerEmail}</p>
        </div>
        
        <div style="background-color: #d1fae5; padding: 15px; border-radius: 8px; margin: 20px 0;">
          <h4 style="margin-top: 0; color: #065f46;">What's Next:</h4>
          <ol style="color: #065f46; padding-left: 20px;">
            <li>Log in to the provider portal using your existing credentials</li>
            <li>Review and update your facility information if needed</li>
            <li>Set up your <strong>Tariff Plan</strong> if not already done</li>
            <li>Start managing your provider services</li>
          </ol>
        </div>
        
        <p>You can access the provider portal at: <a href="${process.env.NEXTAUTH_URL || 'https://your-domain.com'}/auth/signin" style="color: #10b981; font-weight: bold;">${process.env.NEXTAUTH_URL || 'https://your-domain.com'}/auth/signin</a></p>
        
        <p>If you have any questions or did not request this linkage, please contact our support team immediately.</p>
        
        <hr style="border: none; border-top: 1px solid #e5e7eb; margin: 30px 0;">
        <p style="color: #6b7280; font-size: 14px;">This is an automated message from the ERP System. Please do not reply to this email.</p>
      </div>
    `

    return this.sendEmail({ to: providerEmail, subject, html })
  }

  async sendLabOrderEmail(
    facilityEmail: string,
    facilityName: string,
    orderDetails: {
      testName: string
      patientName: string
      patientId: string
      patientPhone: string
      orderId: string
      facilityPortalLink?: string
      publicLink?: string
      requestedBy: string
    }
  ) {
    const subject = `New Lab Test Request - ${orderDetails.testName}`
    const html = `
      <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
        <h2 style="color: #10b981;">New Lab Test Request</h2>
        <p>Dear ${facilityName},</p>
        <p>A new lab test has been requested for one of our patients. Please find the details below:</p>
        
        <div style="background-color: #f9fafb; padding: 20px; border-radius: 8px; margin: 20px 0;">
          <h3 style="margin-top: 0; color: #374151;">Test Details</h3>
          <p><strong>Test Name:</strong> ${orderDetails.testName}</p>
          <p><strong>Order ID:</strong> ${orderDetails.orderId}</p>
          <p><strong>Requested By:</strong> ${orderDetails.requestedBy}</p>
        </div>
        
        <div style="background-color: #dbeafe; padding: 20px; border-radius: 8px; margin: 20px 0;">
          <h3 style="margin-top: 0; color: #1e40af;">Patient Information</h3>
          <p><strong>Patient Name:</strong> ${orderDetails.patientName}</p>
          <p><strong>Patient ID:</strong> ${orderDetails.patientId}</p>
          <p><strong>Phone Number:</strong> ${orderDetails.patientPhone}</p>
        </div>
        
        <div style="background-color: #fef3c7; padding: 20px; border-radius: 8px; margin: 20px 0;">
          <h3 style="margin-top: 0; color: #92400e;">Submit Results</h3>
          <p>Please use the link below to submit the test results:</p>
          <div style="text-align: center; margin: 20px 0;">
            <a href="${orderDetails.facilityPortalLink || orderDetails.publicLink}" 
               style="background-color: #10b981; color: white; padding: 12px 24px; text-decoration: none; border-radius: 6px; display: inline-block; font-weight: bold;">
              Submit Test Results & Complete Order
            </a>
          </div>
          <p style="font-size: 14px; color: #6b7280;">
            You can upload PDF reports, images, and fill out detailed results. Once completed, a claim will be automatically created for processing.
          </p>
        </div>
        
        <div style="background-color: #f3f4f6; padding: 15px; border-radius: 8px; margin: 20px 0;">
          <p style="margin: 0; color: #374151;">
            <strong>Important:</strong> Please complete the test and submit results as soon as possible. 
            Once completed, a claim will be automatically created for processing.
          </p>
        </div>
        
        <p>If you have any questions about this request, please contact our support team.</p>
        
        <hr style="border: none; border-top: 1px solid #e5e7eb; margin: 30px 0;">
        <p style="color: #6b7280; font-size: 14px;">This is an automated message from the ERP System.</p>
      </div>
    `

    return this.sendEmail({ to: facilityEmail, subject, html })
  }

  async sendRadiologyOrderEmail(
    facilityEmail: string,
    facilityName: string,
    orderDetails: {
      testName: string
      patientName: string
      patientId: string
      patientPhone: string
      orderId: string
      facilityPortalLink?: string
      publicLink?: string
      requestedBy: string
    }
  ) {
    const subject = `New Radiology Request - ${orderDetails.testName}`
    const html = `
      <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
        <h2 style="color: #10b981;">New Radiology Request</h2>
        <p>Dear ${facilityName},</p>
        <p>A new radiology test has been requested for one of our patients. Please find the details below:</p>
        
        <div style="background-color: #f9fafb; padding: 20px; border-radius: 8px; margin: 20px 0;">
          <h3 style="margin-top: 0; color: #374151;">Test Details</h3>
          <p><strong>Test Name:</strong> ${orderDetails.testName}</p>
          <p><strong>Order ID:</strong> ${orderDetails.orderId}</p>
          <p><strong>Requested By:</strong> ${orderDetails.requestedBy}</p>
        </div>
        
        <div style="background-color: #dbeafe; padding: 20px; border-radius: 8px; margin: 20px 0;">
          <h3 style="margin-top: 0; color: #1e40af;">Patient Information</h3>
          <p><strong>Patient Name:</strong> ${orderDetails.patientName}</p>
          <p><strong>Patient ID:</strong> ${orderDetails.patientId}</p>
          <p><strong>Phone Number:</strong> ${orderDetails.patientPhone}</p>
        </div>
        
        <div style="background-color: #fef3c7; padding: 20px; border-radius: 8px; margin: 20px 0;">
          <h3 style="margin-top: 0; color: #92400e;">Submit Results</h3>
          <p>Please use the link below to submit the test results:</p>
          <div style="text-align: center; margin: 20px 0;">
            <a href="${orderDetails.facilityPortalLink || orderDetails.publicLink}" 
               style="background-color: #10b981; color: white; padding: 12px 24px; text-decoration: none; border-radius: 6px; display: inline-block; font-weight: bold;">
              Submit Test Results & Complete Order
            </a>
          </div>
          <p style="font-size: 14px; color: #6b7280;">
            You can upload PDF reports, images, and fill out detailed results. Once completed, a claim will be automatically created for processing.
          </p>
        </div>
        
        <div style="background-color: #f3f4f6; padding: 15px; border-radius: 8px; margin: 20px 0;">
          <p style="margin: 0; color: #374151;">
            <strong>Important:</strong> Please complete the test and submit results as soon as possible. 
            Once completed, a claim will be automatically created for processing.
          </p>
        </div>
        
        <p>If you have any questions about this request, please contact our support team.</p>
        
        <hr style="border: none; border-top: 1px solid #e5e7eb; margin: 30px 0;">
        <p style="color: #6b7280; font-size: 14px;">This is an automated message from the ERP System.</p>
      </div>
    `

    return this.sendEmail({ to: facilityEmail, subject, html })
  }

  async sendPharmacyOrderEmail(
    facilityEmail: string,
    facilityName: string,
    orderDetails: {
      medicationName: string
      dosage: string
      instructions: string
      patientName: string
      patientId: string
      patientPhone: string
      patientEmail?: string
      patientAddress?: string
      orderId: string
      facilityPortalLink?: string
      requestedBy: string
      medicationsList?: Array<{
        medication: string
        dose: string
        quantity: string | number
        duration: string
        frequency: string
        amount: string
      }>
      totalAmount?: string
    }
  ) {
    const medicationCount = orderDetails.medicationsList?.length || 1
    const subject = `New Pharmacy Order - ${medicationCount} Medication${medicationCount > 1 ? 's' : ''}`

    // Build medications table if multiple medications
    const medicationsTable = orderDetails.medicationsList && orderDetails.medicationsList.length > 0
      ? `
        <table style="width: 100%; border-collapse: collapse; margin: 15px 0;">
          <thead>
            <tr style="background-color: #f3f4f6;">
              <th style="padding: 10px; text-align: left; border: 1px solid #d1d5db;">Medication</th>
              <th style="padding: 10px; text-align: left; border: 1px solid #d1d5db;">Dose</th>
              <th style="padding: 10px; text-align: center; border: 1px solid #d1d5db;">Quantity</th>
              <th style="padding: 10px; text-align: left; border: 1px solid #d1d5db;">Duration</th>
              <th style="padding: 10px; text-align: left; border: 1px solid #d1d5db;">Frequency</th>
              <th style="padding: 10px; text-align: right; border: 1px solid #d1d5db;">Amount</th>
            </tr>
          </thead>
          <tbody>
            ${orderDetails.medicationsList.map((med, index) => `
              <tr style="background-color: ${index % 2 === 0 ? '#ffffff' : '#f9fafb'};">
                <td style="padding: 10px; border: 1px solid #d1d5db;">${med.medication}</td>
                <td style="padding: 10px; border: 1px solid #d1d5db;">${med.dose}</td>
                <td style="padding: 10px; text-align: center; border: 1px solid #d1d5db;">${med.quantity}</td>
                <td style="padding: 10px; border: 1px solid #d1d5db;">${med.duration}</td>
                <td style="padding: 10px; border: 1px solid #d1d5db;">${med.frequency}</td>
                <td style="padding: 10px; text-align: right; border: 1px solid #d1d5db;">${med.amount}</td>
              </tr>
            `).join('')}
            ${orderDetails.totalAmount ? `
              <tr style="background-color: #dbeafe; font-weight: bold;">
                <td colspan="5" style="padding: 10px; text-align: right; border: 1px solid #d1d5db;">Total Amount:</td>
                <td style="padding: 10px; text-align: right; border: 1px solid #d1d5db;">${orderDetails.totalAmount}</td>
              </tr>
            ` : ''}
          </tbody>
        </table>
      `
      : `
        <p><strong>Medication:</strong> ${orderDetails.medicationName}</p>
        <p><strong>Dosage:</strong> ${orderDetails.dosage}</p>
        <p><strong>Instructions:</strong> ${orderDetails.instructions}</p>
      `

    const html = `
      <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
        <h2 style="color: #10b981;">New Pharmacy Order</h2>
        <p>Dear ${facilityName},</p>
        <p>A new pharmacy order has been requested for one of our patients. Please find the details below:</p>
        
        <div style="background-color: #f9fafb; padding: 20px; border-radius: 8px; margin: 20px 0;">
          <h3 style="margin-top: 0; color: #374151;">Medication Details ${medicationCount > 1 ? `(${medicationCount} medications)` : ''}</h3>
          ${medicationsTable}
          <p style="margin-top: 15px;"><strong>Order ID:</strong> ${orderDetails.orderId}</p>
          <p><strong>Requested By:</strong> ${orderDetails.requestedBy}</p>
        </div>
        
        <div style="background-color: #dbeafe; padding: 20px; border-radius: 8px; margin: 20px 0;">
          <h3 style="margin-top: 0; color: #1e40af;">Patient Information</h3>
          <p><strong>Patient Name:</strong> ${orderDetails.patientName}</p>
          <p><strong>Patient ID:</strong> ${orderDetails.patientId}</p>
          <p><strong>Phone Number:</strong> ${orderDetails.patientPhone}</p>
          ${orderDetails.patientEmail ? `<p><strong>Email:</strong> ${orderDetails.patientEmail}</p>` : ''}
        </div>
        
        ${orderDetails.patientAddress ? `
        <div style="background-color: #fef3c7; padding: 20px; border-radius: 8px; margin: 20px 0;">
          <h3 style="margin-top: 0; color: #92400e;">Delivery Address</h3>
          <p style="margin: 0;">
            <strong>📍 ${orderDetails.patientAddress}</strong>
          </p>
          <p style="margin-top: 10px; font-size: 14px; color: #6b7280;">
            Please deliver the medication to the address above.
          </p>
        </div>
        ` : ''}
        
        <div style="background-color: #f3f4f6; padding: 20px; border-radius: 8px; margin: 20px 0;">
          <h3 style="margin-top: 0; color: #374151;">Process Order</h3>
          <p>Please use the link below to process the pharmacy order:</p>
          <div style="text-align: center; margin: 20px 0;">
            <a href="${orderDetails.facilityPortalLink}" 
               style="background-color: #10b981; color: white; padding: 12px 24px; text-decoration: none; border-radius: 6px; display: inline-block; font-weight: bold;">
              Process Order
            </a>
          </div>
          <p style="font-size: 14px; color: #6b7280;">
            You can either upload a PDF receipt or fill out the order status using our online form.
          </p>
        </div>
        
        <div style="background-color: #fee2e2; padding: 15px; border-radius: 8px; margin: 20px 0;">
          <p style="margin: 0; color: #991b1b;">
            <strong>⚠️ Important:</strong> Please process and deliver the order as soon as possible. 
            The patient and their healthcare provider will be notified once the order is processed.
          </p>
        </div>
        
        <p>If you have any questions about this order, please contact our support team.</p>
        
        <hr style="border: none; border-top: 1px solid #e5e7eb; margin: 30px 0;">
        <p style="color: #6b7280; font-size: 14px;">This is an automated message from the ERP System.</p>
      </div>
    `

    return this.sendEmail({ to: facilityEmail, subject, html })
  }

  async sendPasswordResetEmail(
    userEmail: string,
    resetToken: string
  ) {
    const resetUrl = `${getAppBaseUrl()}/auth/reset-password?token=${resetToken}`
    const subject = "Password Reset - ERP System"
    const html = `
      <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
        <h2 style="color: #10b981;">Password Reset Request</h2>
        <p>You requested a password reset for your ERP System account.</p>
        
        <div style="text-align: center; margin: 30px 0;">
          <a href="${resetUrl}" style="background-color: #10b981; color: white; padding: 12px 24px; text-decoration: none; border-radius: 6px; display: inline-block;">Reset Password</a>
        </div>
        
        <p>This link will expire in 1 hour for security reasons.</p>
        
        <div style="background-color: #fef3c7; padding: 15px; border-radius: 8px; margin: 20px 0;">
          <p style="margin: 0; color: #92400e;"><strong>Security Notice:</strong> If you didn't request this password reset, please ignore this email and contact your system administrator.</p>
        </div>
        
        <hr style="border: none; border-top: 1px solid #e5e7eb; margin: 30px 0;">
        <p style="color: #6b7280; font-size: 14px;">This is an automated message from the ERP System.</p>
      </div>
    `

    return this.sendEmail({ to: userEmail, subject, html, skipSuperAdminCopy: true })
  }

  async sendNewPasswordEmail(
    userEmail: string,
    userName: string,
    newPassword: string
  ) {
    const subject = "Password Reset - ERP System"
    const html = `
      <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
        <h2 style="color: #10b981;">Password Reset Complete</h2>
        <p>Your password has been reset by an administrator.</p>
        
        <div style="background-color: #f9fafb; padding: 20px; border-radius: 8px; margin: 20px 0;">
          <h3 style="margin-top: 0;">Account Details</h3>
          <p><strong>Name:</strong> ${userName}</p>
          <p><strong>Email:</strong> ${userEmail}</p>
          <p><strong>New Password:</strong> <code style="background-color: #e5e7eb; padding: 2px 6px; border-radius: 4px;">${newPassword}</code></p>
        </div>
        
        <div style="background-color: #fef3c7; padding: 15px; border-radius: 8px; margin: 20px 0;">
          <p style="margin: 0; color: #92400e;"><strong>Important:</strong> Please log in and change your password immediately for security reasons.</p>
        </div>
        
        <p>You can access the system at: <a href="${getAppBaseUrl()}/auth/signin" style="color: #10b981;">${getAppBaseUrl()}/auth/signin</a></p>
        
        <p>If you have any questions, please contact your system administrator.</p>
        
        <hr style="border: none; border-top: 1px solid #e5e7eb; margin: 30px 0;">
        <p style="color: #6b7280; font-size: 14px;">This is an automated message from the ERP System.</p>
      </div>
    `

    return this.sendEmail({ to: userEmail, subject, html, skipSuperAdminCopy: true })
  }

  async sendClaimNotification(
    claimNumber: string,
    claimAmount: number,
    providerName: string,
    emails: string[]
  ) {
    const subject = `New Claim Submitted - ${claimNumber}`
    const html = `
      <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
        <h2 style="color: #10b981;">New Claim Submitted</h2>
        <p>A new claim has been submitted and requires your attention.</p>
        
        <div style="background-color: #f9fafb; padding: 20px; border-radius: 8px; margin: 20px 0;">
          <h3 style="margin-top: 0;">Claim Details</h3>
          <p><strong>Claim Number:</strong> ${claimNumber}</p>
          <p><strong>Amount:</strong> ₦${claimAmount.toLocaleString()}</p>
          <p><strong>Provider:</strong> ${providerName}</p>
          <p><strong>Submitted:</strong> ${new Date().toLocaleString()}</p>
        </div>
        
        <p>Please review and process this claim in the ERP system.</p>
        
        <hr style="border: none; border-top: 1px solid #e5e7eb; margin: 30px 0;">
        <p style="color: #6b7280; font-size: 14px;">This is an automated message from the ERP System.</p>
      </div>
    `

    for (const email of emails) {
      await this.sendEmail({ to: email, subject, html })
    }
  }

  async sendApprovalNotification(
    enrolleeName: string,
    organizationName: string,
    emails: string[]
  ) {
    const subject = `Enrollee Approval Required - ${enrolleeName}`
    const html = `
      <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
        <h2 style="color: #10b981;">Enrollee Approval Required</h2>
        <p>A new enrollee is waiting for approval.</p>
        
        <div style="background-color: #f9fafb; padding: 20px; border-radius: 8px; margin: 20px 0;">
          <h3 style="margin-top: 0;">Enrollee Details</h3>
          <p><strong>Name:</strong> ${enrolleeName}</p>
          <p><strong>Organization:</strong> ${organizationName}</p>
          <p><strong>Submitted:</strong> ${new Date().toLocaleString()}</p>
        </div>
        
        <p>Please review and approve this enrollee in the ERP system.</p>
        
        <hr style="border: none; border-top: 1px solid #e5e7eb; margin: 30px 0;">
        <p style="color: #6b7280; font-size: 14px;">This is an automated message from the ERP System.</p>
      </div>
    `

    for (const email of emails) {
      await this.sendEmail({ to: email, subject, html })
    }
  }

  async sendEncounterCodeEmail(
    enrolleeEmail: string,
    enrolleeDetails: {
      name: string
      enrolleeId: string
      plan: string
      organization: string
    },
    encounterDetails: {
      encounterCode: string
      hospital: string
      services: string
      diagnosis?: string
      generatedBy: string
      generatedDate: string
    }
  ) {
    const subject = `Encounter Code Generated - ${encounterDetails.encounterCode}`
    const html = `
      <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
        <div style="background-color: #10b981; color: white; padding: 20px; border-radius: 8px 8px 0 0; text-align: center;">
          <h1 style="margin: 0; font-size: 28px;">✓ Encounter Code Generated</h1>
        </div>
        
        <div style="background-color: #f9fafb; padding: 30px; border-radius: 0 0 8px 8px;">
          <p style="font-size: 16px;">Dear ${enrolleeDetails.name},</p>
          <p>Your encounter code has been successfully generated. Please present this code at the healthcare facility.</p>
          
          <div style="background-color: white; padding: 25px; border-radius: 8px; margin: 25px 0; border: 2px solid #10b981;">
            <h2 style="margin-top: 0; color: #10b981; text-align: center;">Encounter Code</h2>
            <div style="text-align: center; background-color: #f0fdf4; padding: 20px; border-radius: 6px; margin: 15px 0;">
              <span style="font-size: 32px; font-weight: bold; color: #059669; letter-spacing: 2px; font-family: 'Courier New', monospace;">
                ${encounterDetails.encounterCode}
              </span>
            </div>
            <p style="text-align: center; color: #6b7280; font-size: 14px; margin: 10px 0 0 0;">
              Please keep this code safe and present it at the hospital
            </p>
          </div>
          
          <div style="background-color: white; padding: 20px; border-radius: 8px; margin: 20px 0;">
            <h3 style="margin-top: 0; color: #374151; border-bottom: 2px solid #e5e7eb; padding-bottom: 10px;">
              📋 Encounter Details
            </h3>
            <table style="width: 100%; border-collapse: collapse;">
              <tr>
                <td style="padding: 10px 0; border-bottom: 1px solid #f3f4f6;"><strong>Hospital:</strong></td>
                <td style="padding: 10px 0; border-bottom: 1px solid #f3f4f6; text-align: right;">${encounterDetails.hospital}</td>
              </tr>
              <tr>
                <td style="padding: 10px 0; border-bottom: 1px solid #f3f4f6;"><strong>Services:</strong></td>
                <td style="padding: 10px 0; border-bottom: 1px solid #f3f4f6; text-align: right;">${encounterDetails.services}</td>
              </tr>
              ${encounterDetails.diagnosis ? `
              <tr>
                <td style="padding: 10px 0; border-bottom: 1px solid #f3f4f6;"><strong>Diagnosis:</strong></td>
                <td style="padding: 10px 0; border-bottom: 1px solid #f3f4f6; text-align: right;">${encounterDetails.diagnosis}</td>
              </tr>
              ` : ''}
              <tr>
                <td style="padding: 10px 0; border-bottom: 1px solid #f3f4f6;"><strong>Generated Date:</strong></td>
                <td style="padding: 10px 0; border-bottom: 1px solid #f3f4f6; text-align: right;">${encounterDetails.generatedDate}</td>
              </tr>
              <tr>
                <td style="padding: 10px 0;"><strong>Generated By:</strong></td>
                <td style="padding: 10px 0; text-align: right;">${encounterDetails.generatedBy}</td>
              </tr>
            </table>
          </div>
          
          <div style="background-color: white; padding: 20px; border-radius: 8px; margin: 20px 0;">
            <h3 style="margin-top: 0; color: #374151; border-bottom: 2px solid #e5e7eb; padding-bottom: 10px;">
              👤 Your Information
            </h3>
            <table style="width: 100%; border-collapse: collapse;">
              <tr>
                <td style="padding: 10px 0; border-bottom: 1px solid #f3f4f6;"><strong>Name:</strong></td>
                <td style="padding: 10px 0; border-bottom: 1px solid #f3f4f6; text-align: right;">${enrolleeDetails.name}</td>
              </tr>
              <tr>
                <td style="padding: 10px 0; border-bottom: 1px solid #f3f4f6;"><strong>Enrollee ID:</strong></td>
                <td style="padding: 10px 0; border-bottom: 1px solid #f3f4f6; text-align: right;">${enrolleeDetails.enrolleeId}</td>
              </tr>
              <tr>
                <td style="padding: 10px 0; border-bottom: 1px solid #f3f4f6;"><strong>Plan:</strong></td>
                <td style="padding: 10px 0; border-bottom: 1px solid #f3f4f6; text-align: right;">${enrolleeDetails.plan}</td>
              </tr>
              <tr>
                <td style="padding: 10px 0;"><strong>Organization:</strong></td>
                <td style="padding: 10px 0; text-align: right;">${enrolleeDetails.organization}</td>
              </tr>
            </table>
          </div>
          
          <div style="background-color: #fef3c7; padding: 20px; border-radius: 8px; margin: 20px 0; border-left: 4px solid #f59e0b;">
            <h4 style="margin-top: 0; color: #92400e;">
              ⚠️ Important Instructions
            </h4>
            <ul style="margin: 10px 0; padding-left: 20px; color: #78350f;">
              <li>Present this encounter code to the hospital reception</li>
              <li>Keep a copy of this code for your records</li>
              <li>The code is valid for the specified services only</li>
              <li>Contact call centre if you need assistance</li>
            </ul>
          </div>
          
          <p style="color: #6b7280; font-size: 14px; margin-top: 30px;">
            If you have any questions or need assistance, please contact our call centre.
          </p>
        </div>
        
        <div style="background-color: #f3f4f6; padding: 15px; text-align: center; margin-top: 20px; border-radius: 8px;">
          <p style="color: #6b7280; font-size: 12px; margin: 0;">
            This is an automated message from Crown Jewel HMO ERP System.<br>
            Please do not reply to this email.
          </p>
        </div>
      </div>
    `

    return this.sendEmail({ to: enrolleeEmail, subject, html, skipSuperAdminCopy: true })
  }

  async sendApprovalCodeStatusEmail(
    enrolleeEmail: string,
    enrolleeDetails: {
      name: string
      enrolleeId: string
      plan: string
    },
    approvalDetails: {
      approvalCode: string
      status: 'APPROVED' | 'REJECTED' | 'PARTIAL'
      hospital: string
      approvedServices?: Array<{ service_name: string; amount: number }>
      rejectedServices?: Array<{ service_name: string; amount?: number; remarks?: string }>
      totalApprovedAmount: number
      totalRejectedAmount?: number
      diagnosis?: string
      processedBy: string
      processedDate: string
      remarks?: string
    }
  ) {
    const statusColors = {
      APPROVED: { bg: '#10b981', text: '#065f46', light: '#d1fae5', icon: '✓' },
      REJECTED: { bg: '#ef4444', text: '#991b1b', light: '#fee2e2', icon: '✗' },
      PARTIAL: { bg: '#f59e0b', text: '#92400e', light: '#fef3c7', icon: '⚠' }
    }

    const status = approvalDetails.status
    const color = statusColors[status]

    const statusText = {
      APPROVED: 'Approved',
      REJECTED: 'Rejected',
      PARTIAL: 'Partially Approved'
    }

    const subject = `Approval Code ${statusText[status]} - ${approvalDetails.approvalCode}`

    const html = `
      <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
        <div style="background-color: ${color.bg}; color: white; padding: 20px; border-radius: 8px 8px 0 0; text-align: center;">
          <h1 style="margin: 0; font-size: 28px;">${color.icon} Approval Code ${statusText[status]}</h1>
        </div>
        
        <div style="background-color: #f9fafb; padding: 30px; border-radius: 0 0 8px 8px;">
          <p style="font-size: 16px;">Dear ${enrolleeDetails.name},</p>
          <p>Your approval code has been processed. Please see the details below:</p>
          
          <div style="background-color: white; padding: 25px; border-radius: 8px; margin: 25px 0; border: 2px solid ${color.bg};">
            <h2 style="margin-top: 0; color: ${color.bg}; text-align: center;">Approval Code</h2>
            <div style="text-align: center; background-color: ${color.light}; padding: 20px; border-radius: 6px; margin: 15px 0;">
              <span style="font-size: 32px; font-weight: bold; color: ${color.text}; letter-spacing: 2px; font-family: 'Courier New', monospace;">
                ${approvalDetails.approvalCode}
              </span>
            </div>
            <div style="text-align: center; margin-top: 15px;">
              <span style="background-color: ${color.light}; color: ${color.text}; padding: 8px 16px; border-radius: 20px; font-weight: bold; font-size: 14px;">
                ${statusText[status].toUpperCase()}
              </span>
            </div>
          </div>
          
          <div style="background-color: white; padding: 20px; border-radius: 8px; margin: 20px 0;">
            <h3 style="margin-top: 0; color: #374151; border-bottom: 2px solid #e5e7eb; padding-bottom: 10px;">
              📋 Request Details
            </h3>
            <table style="width: 100%; border-collapse: collapse;">
              <tr>
                <td style="padding: 10px 0; border-bottom: 1px solid #f3f4f6;"><strong>Hospital:</strong></td>
                <td style="padding: 10px 0; border-bottom: 1px solid #f3f4f6; text-align: right;">${approvalDetails.hospital}</td>
              </tr>
              ${approvalDetails.diagnosis ? `
              <tr>
                <td style="padding: 10px 0; border-bottom: 1px solid #f3f4f6;"><strong>Diagnosis:</strong></td>
                <td style="padding: 10px 0; border-bottom: 1px solid #f3f4f6; text-align: right;">${approvalDetails.diagnosis}</td>
              </tr>
              ` : ''}
              <tr>
                <td style="padding: 10px 0; border-bottom: 1px solid #f3f4f6;"><strong>Processed Date:</strong></td>
                <td style="padding: 10px 0; border-bottom: 1px solid #f3f4f6; text-align: right;">${approvalDetails.processedDate}</td>
              </tr>
              <tr>
                <td style="padding: 10px 0;"><strong>Processed By:</strong></td>
                <td style="padding: 10px 0; text-align: right;">${approvalDetails.processedBy}</td>
              </tr>
            </table>
          </div>

          ${status !== 'REJECTED' && approvalDetails.approvedServices && approvalDetails.approvedServices.length > 0 ? `
          <div style="background-color: #d1fae5; padding: 20px; border-radius: 8px; margin: 20px 0; border-left: 4px solid #10b981;">
            <h3 style="margin-top: 0; color: #065f46;">
              ✓ Approved Services
            </h3>
            <table style="width: 100%; border-collapse: collapse; margin-top: 15px;">
              <thead>
                <tr style="background-color: #10b981; color: white;">
                  <th style="padding: 12px; text-align: left; border-radius: 4px 0 0 4px;">Service</th>
                  <th style="padding: 12px; text-align: right; border-radius: 0 4px 4px 0;">Amount</th>
                </tr>
              </thead>
              <tbody>
                ${approvalDetails.approvedServices.map((service, index) => `
                  <tr style="background-color: ${index % 2 === 0 ? '#f0fdf4' : 'white'};">
                    <td style="padding: 12px; border-bottom: 1px solid #d1fae5;">${service.service_name}</td>
                    <td style="padding: 12px; text-align: right; border-bottom: 1px solid #d1fae5; font-weight: bold;">₦${service.amount.toLocaleString()}</td>
                  </tr>
                `).join('')}
                <tr style="background-color: #10b981; color: white; font-weight: bold;">
                  <td style="padding: 12px;">Total Approved</td>
                  <td style="padding: 12px; text-align: right;">₦${approvalDetails.totalApprovedAmount.toLocaleString()}</td>
                </tr>
              </tbody>
            </table>
          </div>
          ` : ''}

          ${approvalDetails.rejectedServices && approvalDetails.rejectedServices.length > 0 ? `
          <div style="background-color: #fee2e2; padding: 20px; border-radius: 8px; margin: 20px 0; border-left: 4px solid #ef4444;">
            <h3 style="margin-top: 0; color: #991b1b;">
              ✗ Rejected Services
            </h3>
            <table style="width: 100%; border-collapse: collapse; margin-top: 15px;">
              <thead>
                <tr style="background-color: #ef4444; color: white;">
                  <th style="padding: 12px; text-align: left;">Service</th>
                  <th style="padding: 12px; text-align: right;">Reason</th>
                </tr>
              </thead>
              <tbody>
                ${approvalDetails.rejectedServices.map((service, index) => `
                  <tr style="background-color: ${index % 2 === 0 ? '#fef2f2' : 'white'};">
                    <td style="padding: 12px; border-bottom: 1px solid #fee2e2;">${service.service_name}</td>
                    <td style="padding: 12px; text-align: right; border-bottom: 1px solid #fee2e2; font-size: 13px; color: #991b1b;">${service.remarks || 'Not covered by plan'}</td>
                  </tr>
                `).join('')}
              </tbody>
            </table>
            ${approvalDetails.totalRejectedAmount ? `
              <p style="margin: 10px 0 0 0; text-align: right; color: #991b1b; font-weight: bold;">
                Total Rejected Amount: ₦${approvalDetails.totalRejectedAmount.toLocaleString()}
              </p>
            ` : ''}
          </div>
          ` : ''}

          ${approvalDetails.remarks ? `
          <div style="background-color: #fef3c7; padding: 20px; border-radius: 8px; margin: 20px 0; border-left: 4px solid #f59e0b;">
            <h4 style="margin-top: 0; color: #92400e;">📝 Additional Notes</h4>
            <p style="margin: 0; color: #78350f;">${approvalDetails.remarks}</p>
          </div>
          ` : ''}

          <div style="background-color: white; padding: 20px; border-radius: 8px; margin: 20px 0;">
            <h3 style="margin-top: 0; color: #374151; border-bottom: 2px solid #e5e7eb; padding-bottom: 10px;">
              👤 Your Information
            </h3>
            <table style="width: 100%; border-collapse: collapse;">
              <tr>
                <td style="padding: 10px 0; border-bottom: 1px solid #f3f4f6;"><strong>Name:</strong></td>
                <td style="padding: 10px 0; border-bottom: 1px solid #f3f4f6; text-align: right;">${enrolleeDetails.name}</td>
              </tr>
              <tr>
                <td style="padding: 10px 0; border-bottom: 1px solid #f3f4f6;"><strong>Enrollee ID:</strong></td>
                <td style="padding: 10px 0; border-bottom: 1px solid #f3f4f6; text-align: right;">${enrolleeDetails.enrolleeId}</td>
              </tr>
              <tr>
                <td style="padding: 10px 0;"><strong>Plan:</strong></td>
                <td style="padding: 10px 0; text-align: right;">${enrolleeDetails.plan}</td>
              </tr>
            </table>
          </div>
          
          ${status === 'APPROVED' ? `
          <div style="background-color: #d1fae5; padding: 20px; border-radius: 8px; margin: 20px 0; border-left: 4px solid #10b981;">
            <h4 style="margin-top: 0; color: #065f46;">
              ✓ Next Steps
            </h4>
            <ul style="margin: 10px 0; padding-left: 20px; color: #065f46;">
              <li>Visit ${approvalDetails.hospital} with your approval code</li>
              <li>Present the approval code: <strong>${approvalDetails.approvalCode}</strong></li>
              <li>Receive the approved services listed above</li>
              <li>Keep this email for your records</li>
            </ul>
          </div>
          ` : status === 'PARTIAL' ? `
          <div style="background-color: #fef3c7; padding: 20px; border-radius: 8px; margin: 20px 0; border-left: 4px solid #f59e0b;">
            <h4 style="margin-top: 0; color: #92400e;">
              ⚠️ Next Steps
            </h4>
            <ul style="margin: 10px 0; padding-left: 20px; color: #78350f;">
              <li>You can proceed with the approved services listed above</li>
              <li>The rejected services are not covered under your plan</li>
              <li>Contact call centre to discuss alternative options for rejected services</li>
              <li>Present the approval code at ${approvalDetails.hospital}</li>
            </ul>
          </div>
          ` : `
          <div style="background-color: #fee2e2; padding: 20px; border-radius: 8px; margin: 20px 0; border-left: 4px solid #ef4444;">
            <h4 style="margin-top: 0; color: #991b1b;">
              ✗ Important Information
            </h4>
            <p style="margin: 10px 0; color: #991b1b;">
              Unfortunately, your approval request has been rejected. The services requested are not covered under your current plan.
            </p>
            <p style="margin: 10px 0; color: #991b1b;">
              Please contact our call centre to discuss:
            </p>
            <ul style="margin: 10px 0; padding-left: 20px; color: #991b1b;">
              <li>Alternative covered services</li>
              <li>Plan upgrade options</li>
              <li>Payment arrangements</li>
            </ul>
          </div>
          `}
          
          <p style="color: #6b7280; font-size: 14px; margin-top: 30px;">
            If you have any questions or need assistance, please contact our call centre.
          </p>
        </div>
        
        <div style="background-color: #f3f4f6; padding: 15px; text-align: center; margin-top: 20px; border-radius: 8px;">
          <p style="color: #6b7280; font-size: 12px; margin: 0;">
            This is an automated message from Crown Jewel HMO ERP System.<br>
            Please do not reply to this email.
          </p>
        </div>
      </div>
    `

    return this.sendEmail({ to: enrolleeEmail, subject, html })
  }

  async sendApprovalCodeServicesAddedEmail(
    enrolleeName: string,
    enrolleeEmail: string,
    approvalCode: string,
    hospital: string,
    addedServices: Array<{ service_name: string; service_amount: number }>,
    newServicesAmount: number,
    totalAmount: number
  ) {
    const subject = `New Services Added to Approval Code - ${approvalCode}`

    // Format services list
    const servicesListHTML = addedServices.map(service => `
      <tr>
        <td style="padding: 10px; border-bottom: 1px solid #f3f4f6;">${service.service_name}</td>
        <td style="padding: 10px; border-bottom: 1px solid #f3f4f6; text-align: right; font-weight: bold;">₦${parseFloat(service.service_amount.toString()).toLocaleString()}</td>
      </tr>
    `).join('')

    const html = `
      <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
        <div style="background-color: #f59e0b; color: white; padding: 20px; border-radius: 8px 8px 0 0; text-align: center;">
          <h1 style="margin: 0; font-size: 28px;">📝 Services Added to Approval Code</h1>
        </div>
        
        <div style="background-color: #f9fafb; padding: 30px; border-radius: 0 0 8px 8px;">
          <p style="font-size: 16px;">Dear ${enrolleeName},</p>
          <p>New services have been added to your existing approval code. Please see the details below:</p>
          
          <div style="background-color: white; padding: 25px; border-radius: 8px; margin: 25px 0; border: 2px solid #f59e0b;">
            <h2 style="margin-top: 0; color: #f59e0b; text-align: center;">Approval Code</h2>
            <div style="text-align: center; background-color: #fffbeb; padding: 20px; border-radius: 6px; margin: 15px 0;">
              <span style="font-size: 32px; font-weight: bold; color: #d97706; letter-spacing: 2px; font-family: 'Courier New', monospace;">
                ${approvalCode}
              </span>
            </div>
          </div>
          
          <div style="background-color: white; padding: 20px; border-radius: 8px; margin: 20px 0;">
            <h3 style="margin-top: 0; color: #374151; border-bottom: 2px solid #e5e7eb; padding-bottom: 10px;">
              ✨ Newly Added Services
            </h3>
            <table style="width: 100%; border-collapse: collapse;">
              <thead>
                <tr style="background-color: #fffbeb;">
                  <th style="padding: 10px; text-align: left; border-bottom: 2px solid #f59e0b;">Service</th>
                  <th style="padding: 10px; text-align: right; border-bottom: 2px solid #f59e0b;">Amount</th>
                </tr>
              </thead>
              <tbody>
                ${servicesListHTML}
              </tbody>
              <tfoot>
                <tr style="background-color: #fffbeb; font-weight: bold;">
                  <td style="padding: 15px; border-top: 2px solid #f59e0b;">New Services Total</td>
                  <td style="padding: 15px; text-align: right; border-top: 2px solid #f59e0b; color: #d97706;">₦${newServicesAmount.toLocaleString()}</td>
                </tr>
              </tfoot>
            </table>
          </div>
          
          <div style="background-color: white; padding: 20px; border-radius: 8px; margin: 20px 0;">
            <h3 style="margin-top: 0; color: #374151; border-bottom: 2px solid #e5e7eb; padding-bottom: 10px;">
              📊 Updated Total
            </h3>
            <table style="width: 100%; border-collapse: collapse;">
              <tr>
                <td style="padding: 10px 0; border-bottom: 1px solid #f3f4f6;"><strong>Hospital:</strong></td>
                <td style="padding: 10px 0; border-bottom: 1px solid #f3f4f6; text-align: right;">${hospital}</td>
              </tr>
              <tr>
                <td style="padding: 10px 0; border-bottom: 1px solid #f3f4f6;"><strong>Services Added:</strong></td>
                <td style="padding: 10px 0; border-bottom: 1px solid #f3f4f6; text-align: right;">${addedServices.length} service(s)</td>
              </tr>
              <tr style="background-color: #ecfdf5;">
                <td style="padding: 15px 0; font-size: 18px;"><strong>New Total Amount:</strong></td>
                <td style="padding: 15px 0; text-align: right; font-size: 20px; font-weight: bold; color: #059669;">₦${totalAmount.toLocaleString()}</td>
              </tr>
            </table>
          </div>
          
          <div style="background-color: #dbeafe; padding: 20px; border-radius: 8px; margin: 20px 0; border-left: 4px solid #3b82f6;">
            <h4 style="margin-top: 0; color: #1e40af;">
              ℹ️ What This Means
            </h4>
            <ul style="margin: 10px 0; padding-left: 20px; color: #1e3a8a;">
              <li>Your existing approval code has been updated with additional services</li>
              <li>You can now access the newly added services at ${hospital}</li>
              <li>The same approval code (${approvalCode}) covers all services</li>
              <li>No need to request a new approval code</li>
            </ul>
          </div>
          
          <p style="color: #6b7280; font-size: 14px; margin-top: 30px;">
            If you have any questions about these changes, please contact our call centre.
          </p>
        </div>
        
        <div style="background-color: #f3f4f6; padding: 15px; text-align: center; margin-top: 20px; border-radius: 8px;">
          <p style="color: #6b7280; font-size: 12px; margin: 0;">
            This is an automated message from Crown Jewel HMO ERP System.<br>
            Please do not reply to this email.
          </p>
        </div>
      </div>
    `

    return this.sendEmail({ to: enrolleeEmail, subject, html })
  }

  async sendEncounterCodeSMS(
    phoneNumber: string,
    encounterDetails: {
      name: string
      encounterCode: string
      hospital: string
    }
  ) {
    if (!phoneNumber) {
      return false
    }

    const message = `Hello ${encounterDetails.name}, your encounter code ${encounterDetails.encounterCode} is ready for ${encounterDetails.hospital}. Please present it at the facility.`

    try {
      await this.sendSMS({
        to: phoneNumber,
        message,
      })
      return true
    } catch (error) {
      console.error("Encounter SMS failed:", error)
      return false
    }
  }

  async sendProcurementBillNotification(invoice: any) {
    const subject = `New Procurement Bill Initiated - ${invoice.invoice_number}`
    const html = `
      <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; border: 1px solid #e5e7eb; border-radius: 8px; overflow: hidden;">
        <div style="background-color: #4f46e5; color: white; padding: 20px; text-align: center;">
          <h2 style="margin: 0;">New Procurement Bill</h2>
        </div>
        <div style="padding: 30px; background-color: #ffffff;">
          <p style="font-size: 16px; color: #374151;">A new procurement bill has been initiated and requires oversight.</p>
          
          <div style="background-color: #f9fafb; padding: 20px; border-radius: 8px; margin: 20px 0; border: 1px solid #f3f4f6;">
            <h3 style="margin-top: 0; color: #111827; border-bottom: 1px solid #e5e7eb; padding-bottom: 10px;">Bill Details</h3>
            <table style="width: 100%; border-collapse: collapse;">
              <tr>
                <td style="padding: 8px 0; color: #6b7280;">Invoice Number:</td>
                <td style="padding: 8px 0; text-align: right; font-weight: bold; color: #111827;">${invoice.invoice_number}</td>
              </tr>
              <tr>
                <td style="padding: 8px 0; color: #6b7280;">Service Type:</td>
                <td style="padding: 8px 0; text-align: right; color: #111827;">${invoice.service_type}</td>
              </tr>
              <tr>
                <td style="padding: 8px 0; color: #6b7280;">Department:</td>
                <td style="padding: 8px 0; text-align: right; color: #111827;">${invoice.department}</td>
              </tr>
              <tr>
                <td style="padding: 8px 0; color: #6b7280;">Amount:</td>
                <td style="padding: 8px 0; text-align: right; font-weight: bold; color: #059669; font-size: 18px;">₦${parseFloat(invoice.amount.toString()).toLocaleString()}</td>
              </tr>
              <tr>
                <td style="padding: 8px 0; color: #6b7280;">Generated By:</td>
                <td style="padding: 8px 0; text-align: right; color: #111827;">${invoice.generated_by}</td>
              </tr>
              <tr>
                <td style="padding: 8px 0; color: #6b7280;">Date initiated:</td>
                <td style="padding: 8px 0; text-align: right; color: #111827;">${new Date(invoice.created_at).toLocaleString()}</td>
              </tr>
            </table>
          </div>

          ${invoice.description ? `
          <div style="margin: 20px 0;">
            <h4 style="color: #374151; margin-bottom: 8px;">Description</h4>
            <div style="background-color: #fffbeb; padding: 15px; border-radius: 6px; border-left: 4px solid #f59e0b; color: #92400e;">
              ${invoice.description}
            </div>
          </div>
          ` : ''}

          <div style="text-align: center; margin-top: 30px;">
            <a href="${process.env.NEXTAUTH_URL}/hr/procurement" style="background-color: #4f46e5; color: white; padding: 12px 24px; text-decoration: none; border-radius: 6px; display: inline-block; font-weight: bold;">View in ERP System</a>
          </div>
        </div>
        <div style="background-color: #f3f4f6; padding: 15px; text-align: center; font-size: 12px; color: #6b7280;">
          This is an automated notification from the Crown Jewel HMO ERP System.
        </div>
      </div>
    `

    // Super Admins are automatically notified via the sendEmail duplication logic,
    // but we can also explicitly send it to them if we want to ensure it's not filtered.
    // However, the rule is "Only SUPERADMIN receive mail of the notification".
    // So we send it to a dummy or specifically to Super Admins.
    const emails = await this.getSuperAdminEmails()
    for (const email of emails) {
      await this.sendEmail({
        to: email,
        subject,
        html,
        recipientRole: 'SUPER_ADMIN'
      })
    }
  }

  async sendTelemedicineAppointmentNotification(appointment: any, recipientEmail: string) {
    const subject = `New Tele-consultation Appointment - ${appointment.appointment_id}`
    const html = `
      <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; border: 1px solid #e5e7eb; border-radius: 8px; overflow: hidden;">
        <div style="background-color: #10b981; color: white; padding: 20px; text-align: center;">
          <h2 style="margin: 0;">New Tele-consultation</h2>
        </div>
        <div style="padding: 30px; background-color: #ffffff;">
          <p style="font-size: 16px; color: #374151;">A new tele-consultation appointment has been booked via mobile.</p>
          
          <div style="background-color: #f9fafb; padding: 20px; border-radius: 8px; margin: 20px 0; border: 1px solid #f3f4f6;">
            <table style="width: 100%; border-collapse: collapse;">
              <tr>
                <td style="padding: 8px 0; color: #6b7280;">Appointment ID:</td>
                <td style="padding: 8px 0; text-align: right; font-weight: bold; color: #111827;">${appointment.appointment_id}</td>
              </tr>
              <tr>
                <td style="padding: 8px 0; color: #6b7280;">Patient Name:</td>
                <td style="padding: 8px 0; text-align: right; color: #111827;">${appointment.enrollee?.first_name} ${appointment.enrollee?.last_name}</td>
              </tr>
              <tr>
                <td style="padding: 8px 0; color: #6b7280;">Schedule:</td>
                <td style="padding: 8px 0; text-align: right; color: #111827;">${appointment.appointment_date} at ${appointment.appointment_time}</td>
              </tr>
              <tr>
                <td style="padding: 8px 0; color: #6b7280;">Status:</td>
                <td style="padding: 8px 0; text-align: right; color: #111827;">${appointment.status}</td>
              </tr>
            </table>
          </div>

          <div style="text-align: center; margin-top: 30px;">
            <a href="${process.env.NEXTAUTH_URL}/telemedicine/appointments" style="background-color: #10b981; color: white; padding: 12px 24px; text-decoration: none; border-radius: 6px; display: inline-block; font-weight: bold;">Manage Appointment</a>
          </div>
        </div>
      </div>
    `

    return this.sendEmail({
      to: recipientEmail,
      subject,
      html,
      recipientRole: 'TELEMEDICINE',
      metadata: { isTeleconsultation: true }
    })
  }
}

export const notificationService = new NotificationService()

// Helper function exports for easier use
export async function sendApprovalCodeServicesAdded(
  enrolleeName: string,
  enrolleeEmail: string,
  approvalCode: string,
  hospital: string,
  addedServices: Array<{ service_name: string; service_amount: number }>,
  newServicesAmount: number,
  totalAmount: number
) {
  return notificationService.sendApprovalCodeServicesAddedEmail(
    enrolleeName,
    enrolleeEmail,
    approvalCode,
    hospital,
    addedServices,
    newServicesAmount,
    totalAmount
  )
}

// Tariff Plan Notification Functions
export async function sendTariffPlanSubmissionNotification({
  tariffPlan,
  provider,
}: {
  tariffPlan: any
  provider: any
}) {
  // Get Provider Management Team emails (users with provider.approve_tariff_plan permission)
  // For now, we'll use a default email or get from env
  const hmoTeamEmail = process.env.PROVIDER_MANAGEMENT_TEAM_EMAIL || "provider-management@hmo.com"

  const subject = `New Tariff Plan Submission - ${provider.facility_name}`
  const html = `
    <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
      <h2 style="color: #10b981;">New Tariff Plan Submission</h2>
      <p>A hospital has submitted a new tariff plan for approval.</p>
      
      <div style="background-color: #f9fafb; padding: 20px; border-radius: 8px; margin: 20px 0;">
        <h3 style="margin-top: 0;">Provider Details</h3>
        <p><strong>Hospital Name:</strong> ${provider.facility_name}</p>
        <p><strong>Email:</strong> ${provider.email}</p>
        <p><strong>Phone:</strong> ${provider.phone_whatsapp || "N/A"}</p>
        <p><strong>HCP Code:</strong> ${provider.hcp_code || "N/A"}</p>
      </div>
      
      <div style="background-color: #dbeafe; padding: 20px; border-radius: 8px; margin: 20px 0;">
        <h3 style="margin-top: 0; color: #1e40af;">Tariff Plan Information</h3>
        <p><strong>Version:</strong> ${tariffPlan.version}</p>
        <p><strong>Services Count:</strong> ${tariffPlan._count?.tariff_plan_services || 0}</p>
        <p><strong>Submitted Date:</strong> ${tariffPlan.submitted_at ? new Date(tariffPlan.submitted_at).toLocaleString() : "N/A"}</p>
      </div>
      
      <div style="background-color: #fef3c7; padding: 15px; border-radius: 8px; margin: 20px 0;">
        <p style="margin: 0; color: #92400e;">
          <strong>Action Required:</strong> Please review and approve or reject this tariff plan in the Provider Management section.
        </p>
      </div>
      
      <p>If you have any questions, please contact the provider directly.</p>
      
      <hr style="border: none; border-top: 1px solid #e5e7eb; margin: 30px 0;">
      <p style="color: #6b7280; font-size: 14px;">This is an automated message from the ERP System.</p>
    </div>
  `

  return notificationService.sendEmail({
    to: hmoTeamEmail,
    subject,
    html,
  })
}

export async function sendTariffPlanApprovalNotification({
  tariffPlan,
  provider,
  approvedBy,
  comments,
}: {
  tariffPlan: any
  provider: any
  approvedBy: any
  comments?: string
}) {
  const subject = `Tariff Plan Approved - ${provider.facility_name}`
  const html = `
    <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
      <div style="background-color: #10b981; color: white; padding: 20px; border-radius: 8px 8px 0 0; text-align: center;">
        <h1 style="margin: 0; font-size: 28px;">✓ Tariff Plan Approved</h1>
      </div>
      
      <div style="background-color: #f9fafb; padding: 30px; border-radius: 0 0 8px 8px;">
        <p style="font-size: 16px;">Dear ${provider.facility_name},</p>
        <p>Your tariff plan has been approved by the Provider Management Team. You can now start using the services and prices in your tariff plan.</p>
        
        <div style="background-color: white; padding: 20px; border-radius: 8px; margin: 20px 0;">
          <h3 style="margin-top: 0; color: #374151; border-bottom: 2px solid #e5e7eb; padding-bottom: 10px;">
            📋 Approval Details
          </h3>
          <table style="width: 100%; border-collapse: collapse;">
            <tr>
              <td style="padding: 10px 0; border-bottom: 1px solid #f3f4f6;"><strong>Version:</strong></td>
              <td style="padding: 10px 0; border-bottom: 1px solid #f3f4f6; text-align: right;">${tariffPlan.version}</td>
            </tr>
            <tr>
              <td style="padding: 10px 0; border-bottom: 1px solid #f3f4f6;"><strong>Services Count:</strong></td>
              <td style="padding: 10px 0; border-bottom: 1px solid #f3f4f6; text-align: right;">${tariffPlan._count?.tariff_plan_services || 0}</td>
            </tr>
            <tr>
              <td style="padding: 10px 0; border-bottom: 1px solid #f3f4f6;"><strong>Approved Date:</strong></td>
              <td style="padding: 10px 0; border-bottom: 1px solid #f3f4f6; text-align: right;">${tariffPlan.approved_at ? new Date(tariffPlan.approved_at).toLocaleString() : "N/A"}</td>
            </tr>
            <tr>
              <td style="padding: 10px 0;"><strong>Approved By:</strong></td>
              <td style="padding: 10px 0; text-align: right;">${approvedBy.first_name} ${approvedBy.last_name}</td>
            </tr>
          </table>
        </div>
        
        ${comments ? `
        <div style="background-color: #dbeafe; padding: 20px; border-radius: 8px; margin: 20px 0;">
          <h4 style="margin-top: 0; color: #1e40af;">📝 Approval Comments</h4>
          <p style="margin: 0; color: #1e3a8a;">${comments}</p>
        </div>
        ` : ''}
        
        <div style="background-color: #d1fae5; padding: 20px; border-radius: 8px; margin: 20px 0; border-left: 4px solid #10b981;">
          <h4 style="margin-top: 0; color: #065f46;">
            ✓ Next Steps
          </h4>
          <ul style="margin: 10px 0; padding-left: 20px; color: #065f46;">
            <li>Your tariff plan is now active and can be used for service requests</li>
            <li>All services in your approved tariff plan are now visible in the Provider Module</li>
            <li>You will receive a Medical Service Agreement (MSA) document via email shortly</li>
            <li>Contact support if you have any questions</li>
          </ul>
        </div>
        
        <p style="color: #6b7280; font-size: 14px; margin-top: 30px;">
          If you have any questions, please contact our Provider Management Team.
        </p>
      </div>
      
      <div style="background-color: #f3f4f6; padding: 15px; text-align: center; margin-top: 20px; border-radius: 8px;">
        <p style="color: #6b7280; font-size: 12px; margin: 0;">
          This is an automated message from the ERP System.<br>
          Please do not reply to this email.
        </p>
      </div>
    </div>
  `

  // Send to both provider email and HMO coordinator email
  const emails = [provider.email]
  if (provider.hmo_coordinator_email && provider.hmo_coordinator_email !== provider.email) {
    emails.push(provider.hmo_coordinator_email)
  }

  for (const email of emails) {
    await notificationService.sendEmail({
      to: email,
      subject,
      html,
    })
  }
}

export async function sendTariffPlanRejectionNotification({
  tariffPlan,
  provider,
  rejectedBy,
  rejection_reason,
}: {
  tariffPlan: any
  provider: any
  rejectedBy: any
  rejection_reason: string
}) {
  const subject = `Tariff Plan Rejected - ${provider.facility_name}`
  const html = `
    <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
      <div style="background-color: #ef4444; color: white; padding: 20px; border-radius: 8px 8px 0 0; text-align: center;">
        <h1 style="margin: 0; font-size: 28px;">✗ Tariff Plan Rejected</h1>
      </div>
      
      <div style="background-color: #f9fafb; padding: 30px; border-radius: 0 0 8px 8px;">
        <p style="font-size: 16px;">Dear ${provider.facility_name},</p>
        <p>Unfortunately, your tariff plan submission has been rejected. Please review the feedback below and resubmit with the necessary corrections.</p>
        
        <div style="background-color: white; padding: 20px; border-radius: 8px; margin: 20px 0;">
          <h3 style="margin-top: 0; color: #374151; border-bottom: 2px solid #e5e7eb; padding-bottom: 10px;">
            📋 Rejection Details
          </h3>
          <table style="width: 100%; border-collapse: collapse;">
            <tr>
              <td style="padding: 10px 0; border-bottom: 1px solid #f3f4f6;"><strong>Version:</strong></td>
              <td style="padding: 10px 0; border-bottom: 1px solid #f3f4f6; text-align: right;">${tariffPlan.version}</td>
            </tr>
            <tr>
              <td style="padding: 10px 0; border-bottom: 1px solid #f3f4f6;"><strong>Services Count:</strong></td>
              <td style="padding: 10px 0; border-bottom: 1px solid #f3f4f6; text-align: right;">${tariffPlan._count?.tariff_plan_services || 0}</td>
            </tr>
            <tr>
              <td style="padding: 10px 0; border-bottom: 1px solid #f3f4f6;"><strong>Rejected Date:</strong></td>
              <td style="padding: 10px 0; border-bottom: 1px solid #f3f4f6; text-align: right;">${new Date().toLocaleString()}</td>
            </tr>
            <tr>
              <td style="padding: 10px 0;"><strong>Rejected By:</strong></td>
              <td style="padding: 10px 0; text-align: right;">${rejectedBy.first_name} ${rejectedBy.last_name}</td>
            </tr>
          </table>
        </div>
        
        <div style="background-color: #fee2e2; padding: 20px; border-radius: 8px; margin: 20px 0; border-left: 4px solid #ef4444;">
          <h4 style="margin-top: 0; color: #991b1b;">📝 Rejection Reason</h4>
          <p style="margin: 0; color: #991b1b;">${rejection_reason}</p>
        </div>
        
        <div style="background-color: #fef3c7; padding: 20px; border-radius: 8px; margin: 20px 0; border-left: 4px solid #f59e0b;">
          <h4 style="margin-top: 0; color: #92400e;">
            ⚠️ Next Steps
          </h4>
          <ul style="margin: 10px 0; padding-left: 20px; color: #78350f;">
            <li>Review the rejection reason above</li>
            <li>Make the necessary corrections to your tariff plan</li>
            <li>Resubmit your tariff plan for approval</li>
            <li>Contact Provider Management Team if you need clarification</li>
          </ul>
        </div>
        
        <p style="color: #6b7280; font-size: 14px; margin-top: 30px;">
          If you have any questions about this rejection, please contact our Provider Management Team.
        </p>
      </div>
      
      <div style="background-color: #f3f4f6; padding: 15px; text-align: center; margin-top: 20px; border-radius: 8px;">
        <p style="color: #6b7280; font-size: 12px; margin: 0;">
          This is an automated message from the ERP System.<br>
          Please do not reply to this email.
        </p>
      </div>
    </div>
  `

  // Send to both provider email and HMO coordinator email
  const emails = [provider.email]
  if (provider.hmo_coordinator_email && provider.hmo_coordinator_email !== provider.email) {
    emails.push(provider.hmo_coordinator_email)
  }

  for (const email of emails) {
    await notificationService.sendEmail({
      to: email,
      subject,
      html,
    })
  }
}
