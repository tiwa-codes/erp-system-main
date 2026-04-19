import { NextRequest, NextResponse } from "next/server"
import { getServerSession } from "next-auth"
import { authOptions } from "@/lib/auth"
import { prisma } from "@/lib/prisma"
import { checkPermission } from "@/lib/permissions"
import { SpecialProviderStatus } from "@prisma/client"

export async function POST(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const session = await getServerSession(authOptions)
    if (!session?.user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }

    const canApprove = await checkPermission(session.user.role as any, "special-risk", "approve")
    if (!canApprove) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 })
    }

    const provider = await prisma.specialProvider.findUnique({
      where: { id: params.id },
    })

    if (!provider) {
      return NextResponse.json({ error: "Special provider not found" }, { status: 404 })
    }

    if (provider.status === SpecialProviderStatus.APPROVED) {
      return NextResponse.json(
        {
          success: false,
          error: "Provider is already approved",
        },
        { status: 400 }
      )
    }

    // Approve provider
    const updatedProvider = await prisma.specialProvider.update({
      where: { id: params.id },
      data: {
        status: SpecialProviderStatus.APPROVED,
        approval_officer_id: session.user.id,
        date_approved: new Date(),
      },
      include: {
        approval_officer: {
          select: {
            id: true,
            first_name: true,
            last_name: true,
            email: true,
          },
        },
      },
    })

    await prisma.auditLog.create({
      data: {
        user_id: session.user.id,
        action: "SPECIAL_PROVIDER_APPROVE",
        resource: "special_provider",
        resource_id: updatedProvider.id,
        old_values: {
          status: provider.status,
        },
        new_values: {
          status: updatedProvider.status,
          approval_officer_id: updatedProvider.approval_officer_id,
          date_approved: updatedProvider.date_approved,
        },
      },
    })

    return NextResponse.json({
      success: true,
      data: updatedProvider,
    })
  } catch (error) {
    console.error("Error approving special provider:", error)
    return NextResponse.json(
      {
        success: false,
        error: error instanceof Error ? error.message : "Failed to approve special provider",
      },
      { status: 500 }
    )
  }
}








