import { NextResponse } from "next/server"
import { getServerSession } from "next-auth"
import { authOptions } from "@/lib/auth"
import { prisma } from "@/lib/prisma"

export async function GET() {
  try {
    const session = await getServerSession(authOptions)
    if (!session?.user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }

    const pendingClaimStatuses = ["SUBMITTED", "UNDER_REVIEW", "VETTING"]

    const [
      deptOversightProcurement,
      internalControlProcurement,
      executiveDeskProcurement,
      deptOversightMemos,
      executiveDeskMemos,
      internalControlAuditClaims,
      executiveDeskApprovalClaims,
      executiveDeskCustomPlans,
      mobileUpdates,
      pendingPrincipalRegistrations,
      pendingDependentRegistrations,
      pendingFinancialTransactions,
      pendingClaimsSettlement,
      pendingProviderRequests,
      pendingEncounterCodes,
      pendingAutoBills,
      pendingManualBills,
      pendingProviderSubmissions,
      pendingTelemedicineRequests,
      pendingTelemedicineAppointments,
    ] = await Promise.all([
      prisma.procurementInvoice.count({ where: { status: "PENDING" } }),
      prisma.procurementInvoice.count({ where: { status: "PENDING_OPERATIONS" } }),
      prisma.procurementInvoice.count({ where: { status: "PENDING_MD" } }),
      prisma.memo.count({ where: { status: "PENDING_DEPT_OVERSIGHT" } }),
      prisma.memo.count({
        where: {
          status: {
            in: ["PENDING_DEPT_OVERSIGHT", "PENDING_EXECUTIVE"],
          },
        },
      }),
      prisma.claim.count({ where: { status: "VETTER2_COMPLETED" } }),
      prisma.claim.count({ where: { status: "AUDIT_COMPLETED" } }),
      prisma.plan.count({
        where: {
          status: "PENDING_APPROVAL",
          approval_stage: "MD",
        },
      }),
      prisma.mobileUpdate.count({ where: { status: "PENDING" } }),
      prisma.principalRegistration.count({ where: { status: "PENDING" } }),
      prisma.dependentRegistration.count({ where: { status: "PENDING" } }),
      prisma.financialTransaction.count({ where: { status: "PENDING" } }),
      prisma.claim.count({
        where: {
          status: "APPROVED",
          payouts: {
            none: {
              status: "PROCESSED",
            },
          },
        },
      }),
      prisma.providerRequest.count({ where: { status: "PENDING" } }),
      prisma.approvalCode.count({
        where: {
          status: "PENDING",
          AND: [
            {
              NOT: {
                approval_code: {
                  startsWith: "APR/",
                },
              },
            },
            {
              NOT: {
                approval_code: {
                  startsWith: "APR-",
                },
              },
            },
            {
              NOT: {
                approval_code: {
                  startsWith: "M-APR-",
                },
              },
            },
          ],
        },
      }),
      prisma.claim.count({
        where: {
          current_stage: "vetter1",
          status: { in: pendingClaimStatuses },
          NOT: {
            approval_codes: {
              some: {
                is_manual: true,
                is_deleted: false,
              },
            },
          },
        },
      }),
      prisma.claim.count({
        where: {
          current_stage: "vetter1",
          status: { in: pendingClaimStatuses },
          approval_codes: {
            some: {
              is_manual: true,
              is_deleted: false,
            },
          },
        },
      }),
      prisma.provider.count({ where: { status: "PENDING_APPROVAL" } }),
      prisma.telemedicineRequest.count({ where: { status: "PENDING" } }),
      prisma.telemedicineAppointment.count({ where: { status: "PENDING" } }),
    ])

    const notifications = {
      department_oversight: {
        procurement: deptOversightProcurement,
        memos: deptOversightMemos,
        total: deptOversightProcurement + deptOversightMemos,
      },
      internal_control: {
        procurement: internalControlProcurement,
        audit: internalControlAuditClaims,
        total: internalControlProcurement + internalControlAuditClaims,
      },
      executive_desk: {
        procurement: executiveDeskProcurement,
        claims_approval: executiveDeskApprovalClaims,
        custom_plans: executiveDeskCustomPlans,
        memos: executiveDeskMemos,
        total:
          executiveDeskProcurement +
          executiveDeskApprovalClaims +
          executiveDeskCustomPlans +
          executiveDeskMemos,
      },
      underwriting: {
        pending_updates:
          mobileUpdates + pendingPrincipalRegistrations + pendingDependentRegistrations,
        total: mobileUpdates + pendingPrincipalRegistrations + pendingDependentRegistrations,
      },
      finance: {
        pending_transactions: pendingFinancialTransactions,
        pending_claims_settlement: pendingClaimsSettlement,
        total: pendingFinancialTransactions + pendingClaimsSettlement,
      },
      call_centre: {
        pending_provider_requests: pendingProviderRequests,
        pending_encounter_codes: pendingEncounterCodes,
        total: pendingProviderRequests + pendingEncounterCodes,
      },
      claims: {
        pending_auto_bills: pendingAutoBills,
        pending_manual_bills: pendingManualBills,
        total: pendingAutoBills + pendingManualBills,
      },
      provider_management: {
        pending_submissions: pendingProviderSubmissions,
        total: pendingProviderSubmissions,
      },
      telemedicine: {
        pending_requests: pendingTelemedicineRequests,
        pending_appointments: pendingTelemedicineAppointments,
        total: pendingTelemedicineRequests + pendingTelemedicineAppointments,
      },
    }

    return NextResponse.json({ success: true, notifications })
  } catch (error) {
    console.error("Error fetching sidebar notifications:", error)
    return NextResponse.json(
      { error: "Failed to fetch sidebar notifications" },
      { status: 500 }
    )
  }
}
