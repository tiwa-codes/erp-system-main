import { NextRequest, NextResponse } from "next/server"
import { getServerSession } from "next-auth"
import { authOptions } from "@/lib/auth"
import { prisma } from "@/lib/prisma"
import { checkPermission } from "@/lib/permissions"
import { attachExecutiveMemoRecipients, sendMemoConfirmedNotification, sendMemoSubmittedNotification } from "@/lib/memo-notifications"
import { uploadFile } from "@/lib/cloudinary"

const ADMIN_ROLES = ['SUPER_ADMIN', 'SUPERADMIN', 'ADMIN']
const GLOBAL_MEMO_ADMIN_EMAIL = "admin@erp.com"
const EXECUTIVE_INBOX_FALLBACK_EMAILS = [
    GLOBAL_MEMO_ADMIN_EMAIL,
    "aliyu.sumaila@crownjewelhmo.com",
]

function normalizeRole(role?: string | null) {
    return (role || "").toUpperCase().replace(/[\s-]+/g, "_")
}

function normalizeModule(module?: string | null) {
    return (module || "").trim().toLowerCase().replace(/[\s_]+/g, "-")
}

function moduleVariants(module?: string | null) {
    const normalized = normalizeModule(module)
    if (!normalized) return []
    return Array.from(new Set([
        normalized,
        normalized.replace(/-/g, "_"),
    ]))
}

export async function GET(request: NextRequest) {
    try {
        const session = await getServerSession(authOptions)

        if (!session?.user) {
            return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
        }

        const { searchParams } = new URL(request.url)
        const moduleFilterRaw = searchParams.get("module") || null
        const moduleFilter = normalizeModule(moduleFilterRaw)

        const userEmail = (session.user.email || "").toLowerCase()
        const userRoleUpper = normalizeRole(session.user.role as string)
        const isAdmin = ADMIN_ROLES.includes(userRoleUpper)
        const isGlobalMemoAdmin = userEmail === GLOBAL_MEMO_ADMIN_EMAIL
        const isExecutiveByFallbackEmail = EXECUTIVE_INBOX_FALLBACK_EMAILS.includes(userEmail)
        const isExecutiveApprover =
            moduleFilter === "executive-desk" &&
            (
                userRoleUpper.includes("MD") ||
                userRoleUpper.includes("MANAGING_DIRECTOR") ||
                ADMIN_ROLES.includes(userRoleUpper) ||
                isExecutiveByFallbackEmail
            )
        const canApproveExecutiveDesk =
            moduleFilter === "executive-desk"
                ? (isExecutiveApprover || await checkPermission(session.user.role as any, "executive-desk", "approve"))
                : false
        const hasSharedExecutiveInbox = moduleFilter === "executive-desk" && isExecutiveApprover

        // Build where clause
        const where: any = {}
        const moduleScopedCondition = moduleFilter
            ? {
                OR: [
                    { module: { in: moduleVariants(moduleFilter) } },
                    { module: null }, // legacy memos with no module
                ]
            }
            : null

        if (isGlobalMemoAdmin) {
            // The original bootstrap admin account acts as a global memo supervisor.
            // That inbox should see all memos regardless of module scoping.
        } else if (hasSharedExecutiveInbox && moduleScopedCondition) {
            where.OR = [
                ...moduleScopedCondition.OR,
                { status: "PENDING_DEPT_OVERSIGHT" },
                { status: "PENDING_EXECUTIVE" },
                { recipients: { some: { user_id: session.user.id } } },
            ]
        } else if (!isAdmin) {
            // Non-admin: only see memos they sent, are a recipient of, OR are the linked employee for (legacy data)
            // Fetch the employee record linked to this user so we can include legacy memos
            const linkedEmployee = await prisma.employee.findFirst({
                where: { email: session.user.email ?? "" },
                select: { id: true }
            })

            const sentOrLegacyConditions: any[] = [{ sender_user_id: session.user.id }]
            if (linkedEmployee) sentOrLegacyConditions.push({ employee_id: linkedEmployee.id })

            // Inbox requirement: recipients should see copied/sent memos in any module.
            // Keep module scoping for sent/legacy memos, but always include direct recipient memos.
            if (moduleScopedCondition) {
                const scopedConditions: any[] = [
                    {
                        AND: [
                            moduleScopedCondition,
                            { OR: sentOrLegacyConditions },
                        ],
                    },
                    { recipients: { some: { user_id: session.user.id } } },
                ]
                if (canApproveExecutiveDesk) {
                    // Executive approvers must be able to review pending executive memos
                    // even when not explicitly copied.
                    scopedConditions.push({ status: "PENDING_EXECUTIVE" })
                }
                where.OR = scopedConditions
            } else {
                where.OR = [
                    { OR: sentOrLegacyConditions },
                    { recipients: { some: { user_id: session.user.id } } },
                ]
            }
        } else if (moduleScopedCondition) {
            // Admins keep full module visibility, but also include cross-module memos
            // where they are explicit recipients so inbox behavior is consistent.
            where.OR = [
                moduleScopedCondition,
                { recipients: { some: { user_id: session.user.id } } },
            ]
        } else {
            // Admin + no module filter: no restrictions
        }

        const memos = await prisma.memo.findMany({
            where,
            include: {
                employee: {
                    include: { department: true }
                },
                sender_user: {
                    select: { id: true, first_name: true, last_name: true, email: true }
                },
                recipients: {
                    include: {
                        user: {
                            select: { id: true, first_name: true, last_name: true, email: true }
                        }
                    }
                },
                dept_oversight_approver: {
                    select: { id: true, first_name: true, last_name: true, email: true }
                },
                executive_approver: {
                    select: { id: true, first_name: true, last_name: true, email: true }
                },
                comments: {
                    include: {
                        user: {
                            select: { id: true, first_name: true, last_name: true, email: true }
                        }
                    },
                    orderBy: { created_at: 'asc' }
                }
            },
            orderBy: { created_at: 'desc' }
        })

        const memoIds = memos.map(m => m.id)
        const auditLogs = await prisma.auditLog.findMany({
            where: { resource: 'Memo', action: 'CREATE', resource_id: { in: memoIds } },
            select: { resource_id: true, new_values: true }
        })

        const departmentIds = auditLogs
            .map(l => (l.new_values as any)?.department_id)
            .filter(Boolean) as string[]

        const departments = await prisma.department.findMany({
            where: { id: { in: departmentIds } },
            select: { id: true, name: true }
        })
        const departmentMap = new Map(departments.map(d => [d.id, d]))

        const memosWithMeta = memos.map(memo => {
            const log = auditLogs.find(l => l.resource_id === memo.id)
            const newValues = (log?.new_values || {}) as any
            const originDepartment = newValues.department_id ? departmentMap.get(newValues.department_id) : null
            const attachment = newValues.attachment || null
            return { ...memo, origin_department: originDepartment, attachment }
        })

        return NextResponse.json(memosWithMeta)
    } catch (error) {
        console.error("Error fetching memos:", error)
        return NextResponse.json({ error: "Failed to fetch memos" }, { status: 500 })
    }
}

export async function POST(request: NextRequest) {
    try {
        const session = await getServerSession(authOptions)

        if (!session?.user) {
            return NextResponse.json(
                { error: "Unauthorized" },
                { status: 401 }
            )
        }

        const contentType = request.headers.get("content-type") || ""
        const isMultipart = contentType.includes("multipart/form-data")

        let title = ""
        let content = ""
        let priority = "NORMAL"
        let employee_id = ""
        let memo_type = "STANDARD"
        let department_id = ""
        let module_name = ""
        let recipient_ids: string[] = []
        let attachment: File | null = null

        if (isMultipart) {
            const formData = await request.formData()
            title = String(formData.get("title") || "")
            content = String(formData.get("content") || "")
            priority = String(formData.get("priority") || "NORMAL")
            employee_id = String(formData.get("employee_id") || "")
            memo_type = String(formData.get("memo_type") || "STANDARD")
            department_id = String(formData.get("department_id") || "")
            module_name = normalizeModule(String(formData.get("module") || ""))
            const recipientsRaw = formData.get("recipient_ids")
            if (recipientsRaw) {
                try { recipient_ids = JSON.parse(String(recipientsRaw)) } catch { recipient_ids = [] }
            }
            attachment = (formData.get("attachment") as File | null) || null
        } else {
            const body = await request.json()
            title = body.title
            content = body.content
            priority = body.priority || "NORMAL"
            employee_id = body.employee_id || ""
            memo_type = body.memo_type || "STANDARD"
            department_id = body.department_id || ""
            module_name = normalizeModule(body.module || "")
            recipient_ids = Array.isArray(body.recipient_ids) ? body.recipient_ids : []
        }

        // Validate required fields
        if (!title || !content) {
            return NextResponse.json({ error: "Title and content are required" }, { status: 400 })
        }

        // department_id lookup: optional but try if provided
        let department: { id: string; name: string } | null = null
        if (department_id) {
            department = await prisma.department.findUnique({
                where: { id: department_id },
                select: { id: true, name: true }
            })
        }

        let attachmentMeta: { name: string; url: string; type: string; size: number } | null = null
        if (attachment) {
            const allowedTypes = [
                "application/pdf",
                "application/msword",
                "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
                "application/vnd.ms-excel",
                "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
            ]
            const maxBytes = 1 * 1024 * 1024
            if (!allowedTypes.includes(attachment.type)) {
                return NextResponse.json(
                    { error: "File type not allowed. Use PDF, Word, or Excel documents." },
                    { status: 400 }
                )
            }
            if (attachment.size > maxBytes) {
                return NextResponse.json(
                    { error: "File must be smaller than 1 MB" },
                    { status: 400 }
                )
            }

            const uploadResult = await uploadFile(attachment, {
                folder: `erp-memos/${(department?.name || module_name || 'general').replace(/\s+/g, "_")}`,
                resource_type: "raw",
                max_bytes: maxBytes
            })

            attachmentMeta = {
                name: attachment.name,
                url: uploadResult.secure_url,
                type: attachment.type,
                size: attachment.size
            }
        }

        // Determine initial status based on memo type
        let initialStatus = 'PENDING_DEPT_OVERSIGHT'
        if (memo_type === 'REQUEST') {
            initialStatus = 'PENDING_EXECUTIVE'
        }

        // Create the memo
        const memo = await prisma.memo.create({
            data: {
                title,
                content,
                priority: priority || 'NORMAL',
                status: initialStatus,
                memo_type: memo_type || 'STANDARD',
                ...(employee_id ? { employee_id } : {}),
                sender_user_id: session.user.id,
                module: module_name || null,
            },
            include: {
                employee: { include: { department: true } },
                sender_user: { select: { id: true, first_name: true, last_name: true, email: true } },
            }
        })

        // Create recipient records
        if (recipient_ids.length > 0) {
            await prisma.memoRecipient.createMany({
                data: recipient_ids.map(uid => ({ memo_id: memo.id, user_id: uid })),
                skipDuplicates: true,
            })
        }

        if (initialStatus === 'PENDING_EXECUTIVE') {
            await attachExecutiveMemoRecipients(memo.id)
        }

        // Send notification
        try {
            if (initialStatus === 'PENDING_EXECUTIVE') {
                await sendMemoConfirmedNotification(memo.id)
            } else {
                await sendMemoSubmittedNotification(memo.id)
            }
        } catch (notificationError) {
            console.error("Failed to send notification:", notificationError)
        }

        // Audit log
        await prisma.auditLog.create({
            data: {
                user_id: session.user.id,
                action: 'CREATE',
                resource: 'Memo',
                resource_id: memo.id,
                new_values: {
                    title: memo.title,
                    priority: memo.priority,
                    status: memo.status,
                    memo_type: memo.memo_type,
                    employee_id: memo.employee_id,
                    sender_user_id: session.user.id,
                    module: module_name,
                    department_id,
                    recipient_ids,
                    attachment: attachmentMeta
                }
            }
        })

        return NextResponse.json({
            ...memo,
            origin_department: department,
            attachment: attachmentMeta,
            recipient_ids,
        }, { status: 201 })
    } catch (error) {
        console.error("Error creating memo:", error)
        return NextResponse.json({ error: "Failed to create memo" }, { status: 500 })
    }
}
