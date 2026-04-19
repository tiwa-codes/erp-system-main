import { NextRequest, NextResponse } from "next/server"
import { getServerSession } from "next-auth"
import { authOptions } from "@/lib/auth"
import { prisma } from "@/lib/prisma"
import { checkPermission } from "@/lib/permissions"

interface RouteParams {
    params: {
        id: string
    }
}

export async function POST(request: NextRequest, { params }: RouteParams) {
    try {
        const session = await getServerSession(authOptions)

        if (!session) {
            return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
        }

        const canEdit = await checkPermission(session.user.role as any, "underwriting", "edit")
        if (!canEdit) {
            return NextResponse.json({ error: "Forbidden" }, { status: 403 })
        }

        // Get the dependent registration
        const registration = await prisma.dependentRegistration.findUnique({
            where: { id: params.id },
            include: {
                principal_registration: true,
                principal: true,
            },
        })

        if (!registration) {
            return NextResponse.json({ error: "Registration not found" }, { status: 404 })
        }

        if (registration.status !== "PENDING") {
            return NextResponse.json(
                { error: "Registration has already been processed" },
                { status: 400 }
            )
        }

        let principalAccount = null

        if (registration.principal_id) {
            // Mobile app request for existing account
            principalAccount = registration.principal
        } else if (registration.principal_registration) {
            // Public link or mobile app new registration
            if (registration.principal_registration.status !== "APPROVED") {
                return NextResponse.json(
                    {
                        error: "Principal must be approved before dependent can be approved",
                        principal_status: registration.principal_registration.status
                    },
                    { status: 400 }
                )
            }

            // Find the approved principal account
            principalAccount = await prisma.principalAccount.findFirst({
                where: {
                    email: registration.principal_registration.email,
                    status: "ACTIVE",
                },
            })
        }

        if (!principalAccount) {
            return NextResponse.json(
                { error: "Principal account not found. Please ensure principal is approved first." },
                { status: 404 }
            )
        }

        if (principalAccount.status !== "ACTIVE") {
            return NextResponse.json(
                { error: "Associated principal account is not active" },
                { status: 400 }
            )
        }

        // Generate dependent ID based on principal's enrollee_id
        // Format: Principal's ID + /D + sequential number
        console.log('Counting existing dependents for principal:', principalAccount.id)
        const existingDependentsCount = await prisma.dependent.count({
            where: { principal_id: principalAccount.id },
        })
        console.log('Existing dependents count:', existingDependentsCount)

        const dependentSerial = (existingDependentsCount + 1).toString()
        const dependentId = `${principalAccount.enrollee_id}/${dependentSerial}`

        console.log('Creating dependent account with ID:', dependentId)
        console.log('Registration data:', {
            first_name: registration.first_name,
            last_name: registration.last_name,
            middle_name: registration.middle_name,
            has_date_of_birth: !!registration.date_of_birth,
            has_gender: !!registration.gender,
            has_relationship: !!registration.relationship,
        })

        // Map relationship values to match Prisma enum
        // The registration uses "CHILD" but Prisma enum has "SON" and "DAUGHTER"
        let mappedRelationship = registration.relationship?.toUpperCase()
        if (mappedRelationship === 'CHILD') {
            // Determine SON or DAUGHTER based on gender
            const gender = registration.gender?.toUpperCase()
            if (gender === 'MALE') {
                mappedRelationship = 'SON'
            } else if (gender === 'FEMALE') {
                mappedRelationship = 'DAUGHTER'
            } else {
                // Default to SON if gender is not specified
                mappedRelationship = 'SON'
            }
        }

        console.log('Mapped relationship:', mappedRelationship)

        // Create dependent account
        const dependent = await prisma.dependent.create({
            data: {
                dependent_id: dependentId,
                principal_id: principalAccount.id,
                first_name: registration.first_name,
                last_name: registration.last_name,
                middle_name: registration.middle_name || null,
                date_of_birth: registration.date_of_birth,
                gender: registration.gender?.toUpperCase() as any, // Convert to uppercase for Gender enum
                relationship: mappedRelationship as any, // Use mapped relationship
                phone_number: registration.phone_number || null,
                email: registration.email || null,
                residential_address: registration.residential_address || null,
                profile_picture: registration.profile_picture || null,
                status: "ACTIVE",
                created_by_id: session.user.id,
            },
        })

        // Update registration status
        await prisma.dependentRegistration.update({
            where: { id: params.id },
            data: {
                status: "APPROVED",
                approved_at: new Date(),
                approved_by: {
                    connect: { id: session.user.id }
                },
            },
        })

        // TODO: Send approval email with dependent ID

        return NextResponse.json({
            success: true,
            message: "Dependent registration approved successfully",
            dependent: {
                id: dependent.id,
                dependent_id: dependent.dependent_id,
            },
        })
    } catch (error) {
        console.error("Error approving dependent registration:", error)
        return NextResponse.json(
            { error: "Failed to approve registration" },
            { status: 500 }
        )
    }
}
