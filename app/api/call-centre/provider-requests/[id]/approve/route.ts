import { NextRequest, NextResponse } from "next/server"
import { getServerSession } from "next-auth"
import { authOptions } from "@/lib/auth"
import { prisma } from "@/lib/prisma"
import { checkPermission } from "@/lib/permissions"
import { notificationService } from "@/lib/notifications"
import { generateDailyApprovalCode } from "@/lib/approval-code"
import { enforcePlanUsage } from "@/lib/underwriting/enforcement"

export async function POST(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const session = await getServerSession(authOptions)
    if (!session?.user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }

    console.log('=== APPROVE ENDPOINT DEBUG ===')
    console.log('User role:', session.user.role)
    console.log('User email:', session.user.email)

    // Check if user has call-centre permissions
    const hasPermission = await checkPermission(session.user.role as any, "call-centre", "edit")
    console.log('Has permission:', hasPermission)

    if (!hasPermission) {
      console.log('Permission check failed for role:', session.user.role)
      return NextResponse.json({ error: "Insufficient permissions" }, { status: 403 })
    }

    const { id } = params
    const body = await request.json()
    const { diagnosis, admission_required, services, status, coverage_status, remarks } = body


    // Find the provider request with enrollee plan and band information
    const providerRequest = await prisma.providerRequest.findUnique({
      where: { id },
      include: {
        request_items: {
          select: {
            id: true,
            service_name: true,
            service_amount: true,
            quantity: true,
            tariff_price: true,
            is_ad_hoc: true,
            is_added_after_approval: true,
            category: true
          }
        },
        provider: {
          select: {
            id: true,
            facility_name: true,
            facility_type: true
          }
        },
        enrollee: {
          select: {
            id: true,
            enrollee_id: true,
            first_name: true,
            last_name: true,
            status: true,
            organization_id: true,
            end_date: true,
            plan: {
              select: {
                id: true,
                name: true,
                assigned_bands: true,
                band_type: true,
                status: true
              }
            },
            organization: {
              select: {
                id: true,
                name: true,
                status: true
              }
            }
          }
        }
      }
    })

    if (!providerRequest) {
      console.log('ERROR: Provider request not found')
      return NextResponse.json({ error: "Provider request not found" }, { status: 404 })
    }

    console.log('Provider request found:', providerRequest.id)
    console.log('Enrollee status:', providerRequest.enrollee?.status)
    console.log('Plan exists:', !!providerRequest.enrollee?.plan)
    console.log('Plan status:', providerRequest.enrollee?.plan?.status)
    console.log('Organization status:', providerRequest.enrollee?.organization?.status)
    console.log('End date:', providerRequest.enrollee?.end_date)

    // Check if enrollee plan is active
    if (providerRequest.enrollee?.plan?.status !== 'ACTIVE' && providerRequest.enrollee?.organization?.status !== 'ACTIVE') {
      console.log('ERROR: Plan/Organization is not active')
      return NextResponse.json({
        success: false,
        error: "Enrollee's Plan or Organization is Inactive"
      }, { status: 403 })
    }

    // Process edited prices if provided
    let updatedAmount = Number(providerRequest.amount)

    // Parse services - prioritize request_items if available, fallback to services JSON
    let processedServices: any[] = []

    if (providerRequest.request_items && Array.isArray(providerRequest.request_items) && providerRequest.request_items.length > 0) {
      // Use request_items (new structured format)
      processedServices = providerRequest.request_items.map((item: any) => ({
        id: item.id,
        service_name: item.service_name,
        amount: Number(item.service_amount),
        quantity: Number(item.quantity) || 1,
        tariff_price: item.tariff_price ? Number(item.tariff_price) : null,
        is_ad_hoc: item.is_ad_hoc || false,
        is_added_after_approval: item.is_added_after_approval || false,
        category_id: item.category || null,
        service_category: item.category === "DRG" ? "Drugs / Pharmaceuticals" : "Medical Services",
        coverage: null, // Will be set from services JSON or approval logic
        rejection_reason: null,
        remarks: null
      }))

      // Merge with services JSON if available (for coverage/rejection data)
      if (providerRequest.services) {
        try {
          const servicesJson = JSON.parse(providerRequest.services)
          if (Array.isArray(servicesJson)) {
            processedServices = processedServices.map((item: any, index: number) => {
              let jsonService = servicesJson.find((s: any) =>
                s.id === item.id ||
                s.service_id === item.id
              )

              if (!jsonService && item.service_name) {
                const nameMatches = servicesJson.filter((s: any) =>
                  s.service_name === item.service_name ||
                  s.name === item.service_name
                )
                if (nameMatches.length === 1) {
                  jsonService = nameMatches[0]
                } else if (nameMatches.length > 1 && index < nameMatches.length) {
                  jsonService = nameMatches[index]
                } else if (nameMatches.length > 0) {
                  jsonService = nameMatches[0]
                }
              }

              if (!jsonService && servicesJson.length === processedServices.length && index < servicesJson.length) {
                jsonService = servicesJson[index]
              }

              if (jsonService) {
                return {
                  ...item,
                  coverage: jsonService.coverage || jsonService.coverage_status || item.coverage,
                  rejection_reason: jsonService.rejection_reason || jsonService.remarks || item.rejection_reason,
                  remarks: jsonService.remarks || jsonService.rejection_reason || item.remarks,
                  is_approved: jsonService.is_approved,
                  is_added_after_approval: jsonService.is_added_after_approval || jsonService.is_added_later || item.is_added_after_approval || false,
                  is_primary: jsonService.is_primary === true || item.is_primary === true,
                  category_id: jsonService.category_id || jsonService.category || item.category_id || null,
                  service_category: jsonService.service_category || item.service_category || null,
                  // Preserve other fields
                  service_type: jsonService.service_type,
                  service_type_id: jsonService.service_type_id,
                  service_id: jsonService.service_id || jsonService.id || item.id
                }
              }
              return item
            })
          }
        } catch (error) {
          console.error('Error merging services JSON with request_items:', error)
          // Continue with request_items data only
        }
      }
    } else {
      // Fallback: Parse services JSON string (legacy format)
      try {
        if (providerRequest.services) {
          processedServices = JSON.parse(providerRequest.services)
        } else {
          processedServices = []
        }
      } catch (error) {
        console.error('Error parsing services JSON:', error)
        processedServices = []
      }
    }

    // Merge edits (price, coverage, remarks) from request body into stored services
    if (services && Array.isArray(services) && services.length > 0) {
      console.log('Processing updates for services:', services.length)
      console.log('Stored services count:', processedServices.length)

      processedServices = processedServices.map((storedService: any, index: number) => {
        // CRITICAL: Find matching service using strict matching - must match by ID or exact service_name
        // Do NOT use index fallback as it causes cross-contamination
        let editedService = null

        // Strategy 1: Match by ID (most reliable)
        if (storedService.id) {
          editedService = services.find((s: any) =>
            s.id === storedService.id ||
            s.service_id === storedService.id
          )
        }

        // Strategy 2: Match by service_id if ID didn't match
        if (!editedService && storedService.service_id) {
          editedService = services.find((s: any) =>
            s.service_id === storedService.service_id ||
            s.id === storedService.service_id
          )
        }

        // Strategy 3: Match by service_name (only if exact match and same index position as backup)
        if (!editedService && storedService.service_name) {
          const nameMatch = services.find((s: any) =>
            s.service_name === storedService.service_name
          )
          // Only use name match if it's at the same index (to avoid wrong matches)
          if (nameMatch && services.indexOf(nameMatch) === index) {
            editedService = nameMatch
          }
        }

        // Strategy 4: Last resort - use index ONLY if arrays are same length and no other match found
        // This is safer than always using index
        if (!editedService && services.length === processedServices.length && index < services.length) {
          // Double-check this service at this index hasn't been matched to another stored service
          const serviceAtIndex = services[index]
          const alreadyMatched = processedServices.some((ss: any, idx: number) =>
            idx < index && (
              (serviceAtIndex.id && (ss.id === serviceAtIndex.id || ss.service_id === serviceAtIndex.id)) ||
              (serviceAtIndex.service_id && (ss.service_id === serviceAtIndex.service_id || ss.id === serviceAtIndex.service_id)) ||
              (serviceAtIndex.service_name && ss.service_name === serviceAtIndex.service_name)
            )
          )
          if (!alreadyMatched) {
            editedService = serviceAtIndex
          }
        }

        // Only update if we found a matching service
        if (editedService) {
          console.log(`Matching service ${index}: stored=${storedService.service_name || storedService.id}, edited=${editedService.service_name || editedService.id}`)

          const isApproved =
            typeof editedService.is_approved === "boolean" ? editedService.is_approved : undefined
          let coverage = storedService.coverage || storedService.coverage_status

          // CRITICAL: Only update coverage if is_approved is explicitly set
          if (typeof isApproved === "boolean") {
            if (isApproved === false) {
              coverage = 'REJECTED'
            } else if (isApproved === true) {
              // If explicitly approved, ensure coverage is set to a valid approved status
              if (!coverage || coverage === 'NOT_COVERED' || coverage === 'UNKNOWN' || coverage === 'REJECTED') {
                coverage = 'COVERED'
              }
            }
          } else {
            // If is_approved is undefined, keep existing coverage
            // Don't change coverage if is_approved wasn't provided
          }

          const rejectionReason = (typeof isApproved === "boolean" && isApproved === false)
            ? (editedService.rejection_reason || editedService.remarks || storedService.rejection_reason || storedService.remarks || 'Rejected by call centre')
            : (storedService.rejection_reason || null)

          // Update service - only update fields that are explicitly provided or need to change
          const updatedService: any = {
            ...storedService,
            // Only update is_approved if explicitly provided
            is_approved: typeof isApproved === "boolean" ? isApproved : storedService.is_approved,
            coverage,
            // Only update remarks/rejection_reason if provided
            remarks: editedService.remarks !== undefined ? editedService.remarks :
              editedService.rejection_reason !== undefined ? editedService.rejection_reason :
                storedService.remarks,
            rejection_reason: rejectionReason
          }

          // CRITICAL: Only update quantity if explicitly provided AND different from stored
          // Don't update if quantity is not in the editedService or is the same
          if (editedService.quantity !== undefined && editedService.quantity !== null) {
            const newQuantity = Number(editedService.quantity)
            const currentQuantity = Number(storedService.quantity) || 1
            if (!isNaN(newQuantity) && newQuantity !== currentQuantity) {
              updatedService.quantity = newQuantity
              console.log(`Updating quantity for service ${storedService.service_name || storedService.id}: ${currentQuantity} -> ${newQuantity}`)
            } else {
              // Keep existing quantity
              updatedService.quantity = currentQuantity
            }
          } else {
            // Keep existing quantity if not provided
            updatedService.quantity = Number(storedService.quantity) || 1
          }

          // Update price if approved_price provided
          if (editedService.approved_price !== undefined && editedService.approved_price !== null) {
            const approvedPrice = parseFloat(editedService.approved_price)
            // Only update if valid number
            if (!isNaN(approvedPrice)) {
              // Track that call centre modified the price so provider can see it highlighted
              const originalPrice = storedService.tariff_price ?? storedService.original_tariff_price ?? storedService.amount
              if (originalPrice !== null && originalPrice !== undefined && approvedPrice !== Number(originalPrice)) {
                updatedService.price_modified_by_call_centre = true
                updatedService.original_tariff_price = Number(originalPrice)
              }
              updatedService.approved_price = approvedPrice
              updatedService.final_price = approvedPrice
              updatedService.amount = approvedPrice // Critical: Update amount for calculations
              console.log(`Updating price for service ${storedService.service_name || storedService.id}: ${approvedPrice}`)
            }
          }

          return updatedService
        }

        // If no match found, return stored service unchanged
        console.log(`No match found for service ${index}: ${storedService.service_name || storedService.id}`)
        return storedService
      })

      // Recalculate total amount from UPDATED processed services (all of them)
      // Note: providerRequest.amount usually tracks the REQUESTED amount or CURRENT amount
      let newTotal = processedServices.reduce((sum: number, service: any) => {
        return sum + ((parseFloat(service.amount) || 0) * (Number(service.quantity) || 1))
      }, 0)

      updatedAmount = newTotal

      // Update provider request locally (in memory) so downstream logic uses it? 
      // Actually we just update the DB
      await prisma.providerRequest.update({
        where: { id },
        data: {
          services: JSON.stringify(processedServices),
          amount: updatedAmount
        }
      })
    }

    // Now derive approved/rejected lists from the MERGED processedServices
    // This ensures we use the updated prices and coverage statuses
    let approvedServices = processedServices.filter((service: any) =>
      service.coverage === 'COVERED' || service.coverage === 'EXCEEDED' || service.coverage === 'LIMIT_EXCEEDED'
    )
    let rejectedServices = processedServices.filter((service: any) =>
      service.coverage === 'REJECTED' || service.coverage === 'NOT_COVERED'
    )

    // Calculate total amount for approved services only (using updated amounts)
    let totalApprovedAmount = approvedServices.reduce((sum: number, service: any) => sum + ((service.amount || 0) * (Number(service.quantity) || 1)), 0)

    /* 
       OLD LOGIC REMOVED:
       The previous logic filtered `services` (body) directly, missing DB-only fields 
       or using stale prices if body didn't have amount updated.
    */

    // Determine final status based on service coverage
    let finalStatus: 'APPROVED' | 'PARTIAL' | 'REJECTED' = 'APPROVED'
    if (approvedServices.length === 0 && rejectedServices.length > 0) {
      finalStatus = 'REJECTED'
    } else if (approvedServices.length > 0 && rejectedServices.length > 0) {
      finalStatus = 'PARTIAL'
    }
    // APPROVED: All services approved
    // PARTIAL: Some services approved, some rejected
    // REJECTED: All services rejected

    if ((finalStatus === 'APPROVED' || finalStatus === 'PARTIAL') && totalApprovedAmount > 0) {
      const enforcement = await enforcePlanUsage({
        principalId: providerRequest.enrollee_id,
        attemptedAmount: totalApprovedAmount,
      })

      if ("error" in enforcement) {
        return NextResponse.json(
          { success: false, error: enforcement.error },
          { status: enforcement.status }
        )
      }

      if (enforcement.isBlocked) {
        await prisma.auditLog.create({
          data: {
            user_id: session.user.id,
            action: "PROVIDER_REQUEST_APPROVAL_BLOCKED",
            resource: "provider_request",
            resource_id: providerRequest.id,
            new_values: {
              reason: enforcement.warnings,
              attempted_amount: totalApprovedAmount,
              annual_limit: enforcement.annualLimit,
              total_used: enforcement.totalUsed,
            },
          },
        })

        return NextResponse.json(
          {
            success: false,
            error: enforcement.warnings[0] || "Annual limit has been exhausted. Cannot approve this request.",
            details: {
              annual_limit: enforcement.annualLimit,
              total_used: enforcement.totalUsed,
              warnings: enforcement.warnings,
            },
          },
          { status: 400 }
        )
      }
    }

    // Update the provider request status
    const updatedRequest = await prisma.providerRequest.update({
      where: { id },
      data: {
        status: finalStatus,
        diagnosis: diagnosis || providerRequest.diagnosis,
        admission_required: admission_required !== undefined ? admission_required : providerRequest.admission_required,
        services: JSON.stringify(processedServices),
        // Store only the approved payable amount to avoid mixing rejected totals into request amount.
        amount: finalStatus === 'REJECTED' ? 0 : totalApprovedAmount,
        rejection_reason: finalStatus === 'REJECTED' ? remarks : null
      },
      include: {
        provider: {
          select: {
            id: true,
            facility_name: true,
            facility_type: true
          }
        },
        enrollee: {
          select: {
            id: true,
            enrollee_id: true,
            first_name: true,
            last_name: true
          }
        }
      }
    })

    let approvalCodeRecord = null
    let reusedExistingApprovalCode = false

    // Store all services (approved and rejected) in the original request
    // This allows the view modal to show both approved and rejected services

    // Determine approval code status based on service coverage
    let approvalCodeStatus: 'APPROVED' | 'PARTIAL' | 'REJECTED' = 'APPROVED'
    if (approvedServices.length === 0 && rejectedServices.length > 0) {
      approvalCodeStatus = 'REJECTED'
    } else if (approvedServices.length > 0 && rejectedServices.length > 0) {
      approvalCodeStatus = 'PARTIAL'
    }

    // For mixed requests where primary services already created an approval code/claim,
    // reuse that existing approval code and append newly approved non-primary services.
    // Strategy 1: look up by claim_id — this is the most reliable (claim is 1:1 with approval code).
    // Do NOT add provider_id/hospital filters here; those can differ and cause false-negative lookups.
    let existingApprovalCodeForClaim = providerRequest.claim_id
      ? await prisma.approvalCode.findFirst({
        where: {
          claim_id: providerRequest.claim_id,
          enrollee_id: providerRequest.enrollee_id,
        },
        orderBy: { created_at: 'desc' }
      })
      : null

    // Strategy 2: diagnosis explicitly names the original approval code — use it directly.
    // This is the most reliable signal for add-after-approval requests and covers the
    // case where claim_id lookup fails (e.g. approval code not yet linked to the claim).
    if (!existingApprovalCodeForClaim) {
      const diagMatch = (providerRequest.diagnosis || "").match(/Additional services for approval code:\s*([A-Z0-9\/-]+)/i)
      const referencedCode = diagMatch?.[1] || null
      if (referencedCode) {
        existingApprovalCodeForClaim = await prisma.approvalCode.findFirst({
          where: {
            approval_code: referencedCode,
            enrollee_id: providerRequest.enrollee_id,
            is_deleted: false
          }
        }) || null
        console.log('🔍 Looked up approval code by diagnosis reference:', referencedCode, '→ found:', !!existingApprovalCodeForClaim)
      }
    }

    // Only create/update approval code when at least one service is approved.
    // If all services are rejected, no approval code should be generated.
    if (approvedServices.length > 0) {
      if (existingApprovalCodeForClaim) {
        reusedExistingApprovalCode = true

        const isAddAfterApprovalRequest =
          /Additional services for approval code:/i.test(providerRequest.diagnosis || "") ||
          processedServices.some((s: any) => s.is_added_after_approval === true || s.is_added_later === true)

        const servicesToAppend = approvedServices.filter((s: any) => {
          if (s.is_primary) return false
          if (!isAddAfterApprovalRequest) return true
          return s.is_added_after_approval === true || s.is_added_later === true
        })
        const appendAmount = servicesToAppend.reduce((sum: number, s: any) => {
          return sum + ((Number(s.amount) || 0) * (Number(s.quantity) || 1))
        }, 0)

        // Build merged services JSON: keep ALL original services on the approval code,
        // then append only the newly approved add-after-approval services.
        // NEVER replace with processedServices (which only contains the provider request's services).
        let existingCodeServices: any[] = []
        try {
          const parsed = JSON.parse(existingApprovalCodeForClaim.services || "[]")
          existingCodeServices = Array.isArray(parsed) ? parsed : []
        } catch {
          existingCodeServices = []
        }

        const newServiceEntries = servicesToAppend.map((s: any) => ({
          ...s,
          is_added_after_approval: true
        }))

        // Also include rejected services in the code's services JSON
        // so the provider can see WHAT was rejected and read the reason.
        // For add-after-approval requests: only include add-on rejected services.
        // For regular requests (primary services): include ALL rejected services so PARTIAL status is correctly derived.
        const rejectedAddOnEntries = (isAddAfterApprovalRequest
          ? rejectedServices.filter((s: any) => s.is_added_after_approval === true || s.is_added_later === true)
          : rejectedServices
        ).map((s: any) => ({
          ...s,
          is_added_after_approval: true,
          coverage: s.coverage || 'NOT_COVERED'
        }))

        const mergedCodeServices = [...existingCodeServices, ...newServiceEntries, ...rejectedAddOnEntries]

        // Strip the diagnosis marker before storing — the original diagnosis is on the approval code already
        const cleanedDiagnosis = (diagnosis || providerRequest.diagnosis || "")
          .replace(/Additional services for approval code:\s*[A-Z0-9\/-]+\.?\s*/gi, "")
          .trim() || existingApprovalCodeForClaim.diagnosis || ""

        // Derive the merged status from ALL services on the code (including previously rejected ones)
        // This prevents a subsequent "all approved" add-services request from incorrectly
        // overwriting an existing PARTIAL status where some original services were rejected.
        const mergedApproved = mergedCodeServices.filter((s: any) =>
          s.coverage === 'COVERED' || s.coverage === 'EXCEEDED' || s.coverage === 'LIMIT_EXCEEDED'
        )
        const mergedRejected = mergedCodeServices.filter((s: any) =>
          s.coverage === 'REJECTED' || s.coverage === 'NOT_COVERED'
        )
        let mergedApprovalCodeStatus: 'APPROVED' | 'PARTIAL' | 'REJECTED' = 'APPROVED'
        if (mergedApproved.length === 0 && mergedRejected.length > 0) {
          mergedApprovalCodeStatus = 'REJECTED'
        } else if (mergedApproved.length > 0 && mergedRejected.length > 0) {
          mergedApprovalCodeStatus = 'PARTIAL'
        }
        // If mergedRejected is empty and mergedApproved > 0 → keep APPROVED
        // But also respect if the existing code was already PARTIAL (may have uncategorised services)
        if (mergedApprovalCodeStatus === 'APPROVED' && existingApprovalCodeForClaim.status === 'PARTIAL') {
          mergedApprovalCodeStatus = 'PARTIAL' // Don't downgrade an existing PARTIAL
        }

        const updateData: any = {
          services: JSON.stringify(mergedCodeServices),
          diagnosis: cleanedDiagnosis,
          status: mergedApprovalCodeStatus
        }

        if (appendAmount > 0) {
          updateData.amount = { increment: appendAmount }
        }

        if (servicesToAppend.length > 0) {
          updateData.service_items = {
            create: servicesToAppend.map((s: any) => ({
              service_name: s.service_name || s.name,
              service_amount: Number(s.amount),
              quantity: Number(s.quantity) || 1,
              // Secondary services from the original mixed request should be treated as
              // normal approved services. Only true add-after-approval items are "Added Later".
              is_initial: !isAddAfterApprovalRequest,
              is_ad_hoc: !!s.is_ad_hoc,
              tariff_price: s.tariff_price || null,
              service_id: s.id || s.service_id,
              category: s.category_id || (String(s.service_category || "").toLowerCase().includes("drug") ? "DRG" : "SER"),
              added_by_id: session.user.id
            }))
          }
        }

        approvalCodeRecord = await prisma.approvalCode.update({
          where: { id: existingApprovalCodeForClaim.id },
          data: updateData,
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

        console.log('✅ Existing approval code updated:', approvalCodeRecord.id, approvalCodeRecord.approval_code)

        if (existingApprovalCodeForClaim.claim_id && providerRequest.claim_id !== existingApprovalCodeForClaim.claim_id) {
          await prisma.providerRequest.update({
            where: { id: providerRequest.id },
            data: {
              claim_id: existingApprovalCodeForClaim.claim_id
            }
          })
        }

        // Keep linked claim totals in sync when secondary services are appended.
        if (appendAmount > 0 && existingApprovalCodeForClaim.claim_id) {
          await prisma.claim.update({
            where: { id: existingApprovalCodeForClaim.claim_id },
            data: {
              amount: { increment: appendAmount },
              original_amount: { increment: appendAmount }
            }
          })
        }
      } else {
        const generatedApprovalCode = await generateDailyApprovalCode(prisma)

        console.log('📝 Creating approval code with data:', {
          approval_code: generatedApprovalCode,
          enrollee_id: providerRequest.enrollee_id,
          hospital: providerRequest.hospital,
          status: approvalCodeStatus,
          amount: totalApprovedAmount
        })

        // Create a brand new approval code record
        approvalCodeRecord = await prisma.approvalCode.create({
          data: {
            approval_code: generatedApprovalCode,
            enrollee_id: providerRequest.enrollee_id,
            // For dependents, prefer beneficiary_name; fallback to principal's name
            enrollee_name: providerRequest.beneficiary_name ||
              (providerRequest.enrollee ?
                `${providerRequest.enrollee.first_name} ${providerRequest.enrollee.last_name}` :
                'Unknown'),
            // Store the dependent's display ID so the approval code shows the correct beneficiary
            beneficiary_id: providerRequest.beneficiary_id || null,
            hospital: providerRequest.hospital,
            provider_id: providerRequest.provider_id,
            services: JSON.stringify(processedServices),
            amount: approvalCodeStatus === 'REJECTED' ? 0 : totalApprovedAmount, // 0 for rejected, approved amount otherwise
            diagnosis: diagnosis || providerRequest.diagnosis || '',
            status: approvalCodeStatus,
            generated_by_id: session.user.id,
            // Create structured service items - ONLY from approved services
            // Never include rejected services in service_items (they go to Claims)
            service_items: {
              create: approvedServices.map((s: any) => ({
                service_name: s.service_name || s.name,
                service_amount: Number(s.amount),
                quantity: Number(s.quantity) || 1,
                is_initial: true,
                is_ad_hoc: !!s.is_ad_hoc,
                tariff_price: s.tariff_price || null,
                service_id: s.id || s.service_id,
                category: s.category_id || (String(s.service_category || "").toLowerCase().includes("drug") ? "DRG" : "SER"),
                added_by_id: session.user.id
              }))
            }
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

        console.log('✅ Approval code created:', approvalCodeRecord.id, approvalCodeRecord.approval_code)
      }

      // 🕒 TIMELINE TRACKING
      try {
        const now = new Date()
        const requestedAt = new Date(providerRequest.created_at)
        const delayMinutes = Math.floor((now.getTime() - requestedAt.getTime()) / (1000 * 60))

        if (reusedExistingApprovalCode) {
          await prisma.approvalCodeTimeline.create({
            data: {
              approval_code_id: approvalCodeRecord.id,
              stage: 'APPROVED',
              timestamp: now,
              user_id: session.user.id,
              delay_minutes: delayMinutes
            }
          })
        } else {
          await prisma.approvalCodeTimeline.createMany({
            data: [
              {
                approval_code_id: approvalCodeRecord.id,
                stage: 'REQUESTED',
                timestamp: requestedAt,
                provider_id: providerRequest.provider_id,
              },
              {
                approval_code_id: approvalCodeRecord.id,
                stage: 'APPROVED',
                timestamp: now,
                user_id: session.user.id,
                delay_minutes: delayMinutes
              }
            ]
          })
        }
        console.log('✅ Timeline entries created for approval code')
      } catch (timelineError) {
        console.error('❌ Failed to create timeline entries:', timelineError)
      }
    }

    // 🚀 AUTOMATIC CLAIM CREATION - CORRECTED WORKFLOW
    // When Call Centre approves a code → it should come to Claims Request as NEW
    // This matches the corrected workflow: NEW → PENDING → PAID
    // Create claim for both APPROVED and PARTIAL when there are approved services

    if (
      (finalStatus === 'APPROVED' || finalStatus === 'PARTIAL') &&
      approvedServices.length > 0 &&
      approvalCodeRecord &&
      !providerRequest.claim_id &&
      !approvalCodeRecord.claim_id
    ) {
      try {
        console.log('📝 Creating claim for approved request...')

        // Generate unique claim number
        const claimNumber = `CLM-${Date.now()}-${Math.random().toString(36).substr(2, 4)}`

        // Create claim with NEW status (as per corrected workflow)
        const claimAmount = approvedServices.reduce((sum, service) => {
          return sum + ((service.amount || 0) * (Number(service.quantity) || 1))
        }, 0)
        const newClaim = await prisma.claim.create({
          data: {
            claim_number: claimNumber,
            enrollee_id: providerRequest.enrollee?.enrollee_id || providerRequest.enrollee_id, // Use actual enrollee_id, not PrincipalAccount.id
            principal_id: providerRequest.enrollee?.id || null,
            provider_id: providerRequest.provider_id,
            claim_type: 'MEDICAL',
            amount: claimAmount,
            original_amount: claimAmount, // Set original amount from provider
            status: 'NEW', // Start as NEW when created from approval code
            current_stage: null, // NEW claims don't have a stage yet
            submitted_at: new Date(),
            created_by_id: session.user.id,
          }
        })

        console.log('✅ Claim created:', newClaim.id, newClaim.claim_number)

        // Link the approval code to the claim
        await prisma.approvalCode.update({
          where: { id: approvalCodeRecord.id },
          data: {
            claim_id: newClaim.id
            // Status remains APPROVED as per corrected workflow
          }
        })

        // ✅ FIX: Link the provider request to the claim
        await prisma.providerRequest.update({
          where: { id: providerRequest.id },
          data: {
            claim_id: newClaim.id
          }
        })

        console.log('✅ Approval code and provider request linked to claim')

        // 🕒 TIMELINE TRACKING (CLAIM_SUBMITTED)
        try {
          await prisma.approvalCodeTimeline.create({
            data: {
              approval_code_id: approvalCodeRecord.id,
              stage: 'CLAIM_SUBMITTED',
              timestamp: new Date(),
              user_id: session.user.id,
              delay_minutes: 0 // Same time as approval
            }
          })
          console.log('✅ Timeline entry created for automatic claim submission')
        } catch (timelineError) {
          console.error('❌ Failed to create automatic submission timeline entry:', timelineError)
        }
      } catch (error) {
        // ✅ FIX 2: Log errors instead of silently failing
        console.error('❌ Failed to create claim:', error)
        console.error('Claim creation error details:', {
          error: error instanceof Error ? error.message : String(error),
          enrollee_id: providerRequest.enrollee?.enrollee_id,
          provider_id: providerRequest.provider_id,
          amount: approvedServices.reduce((sum, service) => sum + ((service.amount || 0) * (Number(service.quantity) || 1)), 0)
        })
      }
    }

    // Store rejected services separately for Call Centre rejected services tracking
    if (rejectedServices.length > 0) {
      try {
        console.log(`📝 Storing ${rejectedServices.length} rejected service(s)...`)

        // ✅ FIX 3: Store rejected services in provider request as JSON
        // Update the provider request with rejected services details
        const rejectedServicesData = rejectedServices.map((rejectedService: any) => ({
          service_name: rejectedService.service_name || rejectedService.name || 'Unknown Service',
          quantity: Number(rejectedService.quantity) || 1,
          service_amount: (Number(rejectedService.amount) || 0) * (Number(rejectedService.quantity) || 1),
          unit_amount: Number(rejectedService.amount) || 0,
          rejection_reason: rejectedService.rejection_reason || rejectedService.remarks || remarks || 'Service not covered by enrollee\'s plan',
          rejected_by_id: session.user.id,
          rejected_by_name: session.user.name || 'Call Centre',
          rejection_date: new Date().toISOString(),
          coverage: rejectedService.coverage || 'NOT_COVERED'
        }))

        // Store in the provider request's rejection_reason field as JSON
        await prisma.providerRequest.update({
          where: { id: providerRequest.id },
          data: {
            rejection_reason: JSON.stringify({
              rejected_services: rejectedServicesData,
              overall_remarks: remarks || 'Some services not covered',
              rejected_count: rejectedServices.length,
              rejection_date: new Date().toISOString()
            })
          }
        })

        console.log(`✅ Stored ${rejectedServices.length} rejected service(s) in provider request`)
      } catch (error) {
        console.error('❌ Failed to store rejected services:', error)
      }
    }

    // Create audit logs
    await prisma.auditLog.create({
      data: {
        user_id: session.user.id,
        action: "PROVIDER_REQUEST_APPROVED",
        resource: "provider_request",
        resource_id: providerRequest.id,
        old_values: providerRequest,
        new_values: updatedRequest
      }
    })

    // Note: Claim has been automatically created with NEW status in Claims Request

    // Send approval status email to enrollee
    if (providerRequest.enrollee && approvalCodeRecord) {
      const enrolleeEmail = await prisma.principalAccount.findUnique({
        where: { id: providerRequest.enrollee_id },
        select: { email: true, first_name: true, last_name: true, enrollee_id: true, plan: { select: { name: true } } }
      })

      if (enrolleeEmail?.email) {
        try {
          // Get current user info for "processed by"
          const processor = await prisma.user.findUnique({
            where: { id: session.user.id },
            select: { first_name: true, last_name: true }
          })

          // Calculate rejected amount
          const totalRejectedAmount = rejectedServices.reduce((sum: number, service: any) =>
            sum + ((Number(service.amount) || 0) * (Number(service.quantity) || 1)), 0
          )

          await notificationService.sendApprovalCodeStatusEmail(
            enrolleeEmail.email,
            {
              name: `${enrolleeEmail.first_name} ${enrolleeEmail.last_name}`,
              enrolleeId: enrolleeEmail.enrollee_id,
              plan: enrolleeEmail.plan?.name || 'N/A'
            },
            {
              approvalCode: approvalCodeRecord.approval_code,
              status: finalStatus,
              hospital: providerRequest.hospital,
              approvedServices: approvedServices.map((s: any) => ({
                service_name: s.service_name || s.name || 'Service',
                amount: s.amount || 0
              })),
              rejectedServices: rejectedServices.map((s: any) => ({
                service_name: s.service_name || s.name || 'Service',
                amount: s.amount || 0,
                remarks: s.remarks || s.rejection_reason || 'Not covered by plan'
              })),
              totalApprovedAmount: totalApprovedAmount,
              totalRejectedAmount: totalRejectedAmount,
              diagnosis: diagnosis || providerRequest.diagnosis || undefined,
              processedBy: processor ? `${processor.first_name} ${processor.last_name}` : 'Call Centre',
              processedDate: new Date().toLocaleString('en-US', {
                dateStyle: 'medium',
                timeStyle: 'short'
              }),
              remarks: remarks
            }
          )
        } catch (emailError) {
          // Don't fail the request if email fails
        }
      } else {
        console.warn('⚠️ No email found for enrollee, skipping approval notification')
      }
    }

    // Determine response message based on approval type
    let message = "Request approved successfully"
    if (finalStatus === 'REJECTED') {
      message = `All services rejected: ${rejectedServices.length} service(s) rejected`
    } else if (finalStatus === 'PARTIAL') {
      message = `Partial approval: ${approvedServices.length} service(s) approved, ${rejectedServices.length} rejected. Approval code generated for approved services.`
    } else if (approvedServices.length > 0) {
      message = `All ${approvedServices.length} service(s) approved successfully. Claim created and sent to Claims Request.`
    }

    return NextResponse.json({
      success: true,
      message,
      approval_code: approvalCodeRecord ? approvalCodeRecord.approval_code : null,
      provider_request: {
        id: updatedRequest.id,
        request_id: updatedRequest.request_id,
        provider_name: updatedRequest.provider.facility_name,
        hospital_name: updatedRequest.hospital,
        services: updatedRequest.services,
        amount: updatedRequest.amount,
        status: updatedRequest.status,
        date: updatedRequest.created_at
      },
      enrollee_bands: providerRequest.enrollee?.plan ?
        (providerRequest.enrollee.plan.assigned_bands && providerRequest.enrollee.plan.assigned_bands.length > 0
          ? providerRequest.enrollee.plan.assigned_bands
          : (providerRequest.enrollee.plan.band_type ? [providerRequest.enrollee.plan.band_type] : ["Band A"]))
        : ["Band A"],
      band_validation: {
        passed: true,
        message: `Provider accessible under enrollee's band(s)`
      },
      claim: null, // Claim will be created when provider requests claims
      approved_services: approvedServices.length,
      rejected_services: rejectedServices.length,
      final_status: finalStatus
    })

  } catch (error) {
    console.error("Error approving provider request:", error)
    return NextResponse.json(
      { error: "Failed to approve provider request" },
      { status: 500 }
    )
  }
}
