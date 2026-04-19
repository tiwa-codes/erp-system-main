/**
 * Provisions a User account for an enrollee (PrincipalAccount) when they are activated.
 * Creates the User with the ENROLLEE role, sets first_login = true, and sends a welcome email.
 */
import { prisma } from "@/lib/prisma"
import { hashPassword, generateRandomPassword } from "@/lib/auth-utils"
import { notificationService } from "@/lib/notifications"

export async function provisionEnrolleeUser(principalId: string): Promise<void> {
  // Fetch the full principal with current user link
  const principal = await prisma.principalAccount.findUnique({
    where: { id: principalId },
    select: {
      id: true,
      first_name: true,
      last_name: true,
      email: true,
      enrollee_id: true,
      user_id: true,
    },
  })

  if (!principal) return
  // Already has a user account
  if (principal.user_id) return
  // No email → can't create account
  if (!principal.email) {
    console.warn(`[Enrollee Provision] Principal ${principalId} has no email — skipping user creation`)
    return
  }

  // Check if a user already exists with this email
  const existingUser = await prisma.user.findUnique({ where: { email: principal.email } })
  if (existingUser) {
    // Link the existing user to this principal
    await prisma.principalAccount.update({
      where: { id: principalId },
      data: { user_id: existingUser.id },
    })
    return
  }

  // Find the ENROLLEE role
  const enrolleeRole = await prisma.role.findUnique({ where: { name: "ENROLLEE" } })
  if (!enrolleeRole) {
    console.error("[Enrollee Provision] ENROLLEE role not found — run 'npm run db:seed:enrollee-role' first")
    return
  }

  // Generate temp password
  const tempPassword = generateRandomPassword(12)
  const hashedPassword = await hashPassword(tempPassword)

  // Create the user
  const newUser = await prisma.user.create({
    data: {
      email: principal.email,
      password: hashedPassword,
      first_name: principal.first_name,
      last_name: principal.last_name,
      role_id: enrolleeRole.id,
      status: "ACTIVE",
      first_login: true,
    },
  })

  // Link principal to user
  await prisma.principalAccount.update({
    where: { id: principalId },
    data: { user_id: newUser.id },
  })

  // Send welcome email with temp password
  try {
    await notificationService.sendEmail({
      to: principal.email,
      subject: "Welcome to CrownJewel HMO — Your Account Details",
      html: `
        <div style="font-family: sans-serif; max-width: 600px; margin: 0 auto;">
          <h2 style="color: #1a56db;">Welcome to CrownJewel HMO</h2>
          <p>Hello <strong>${principal.first_name} ${principal.last_name}</strong>,</p>
          <p>Your health insurance account has been activated. You can now access the <strong>CrownJewel HMO mobile app</strong> to manage your plan, book telemedicine appointments, and request encounter codes.</p>
          <div style="background: #f3f4f6; padding: 16px; border-radius: 8px; margin: 24px 0;">
            <p style="margin: 0 0 8px;"><strong>Enrollee ID:</strong> ${principal.enrollee_id}</p>
            <p style="margin: 0 0 8px;"><strong>Login Email:</strong> ${principal.email}</p>
            <p style="margin: 0;"><strong>Temporary Password:</strong> <code style="background:#e5e7eb; padding: 2px 6px; border-radius: 4px;">${tempPassword}</code></p>
          </div>
          <p style="color: #ef4444;"><strong>Important:</strong> You will be asked to change your password on first login.</p>
          <p>Download the CrownJewel HMO app to get started.</p>
          <p style="color: #6b7280; font-size: 12px;">If you did not expect this email, please contact us at support@crownjewelhmo.com</p>
        </div>
      `,
      text: `Welcome to CrownJewel HMO!\n\nYour account has been activated.\nEnrollee ID: ${principal.enrollee_id}\nEmail: ${principal.email}\nTemporary Password: ${tempPassword}\n\nPlease change your password on first login.`,
    })
  } catch (emailError) {
    // Email failure should NOT block provisioning
    console.error("[Enrollee Provision] Failed to send welcome email:", emailError)
  }

  console.log(`[Enrollee Provision] Created user account for ${principal.email} (${principal.enrollee_id})`)
}
