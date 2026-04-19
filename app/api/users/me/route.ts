import { NextResponse, type NextRequest } from "next/server"
import { getServerSession } from "next-auth"
import { authOptions } from "@/lib/auth"
import { prisma } from "@/lib/prisma"

export async function GET() {
  const session = await getServerSession(authOptions)
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })

  const user = await prisma.user.findUnique({
    where: { id: session.user.id },
    select: {
      id: true,
      email: true,
      first_name: true,
      last_name: true,
      title: true,
      date_of_birth: true,
      gender: true,
      phone_number: true,
      contact_address: true,
      role: true,
      provider_id: true,
      created_at: true,
      updated_at: true,
    },
  })

  if (!user) {
    return NextResponse.json({ error: "User not found" }, { status: 404 })
  }

  return NextResponse.json(user)
}

export async function PUT(request: NextRequest) {
  const session = await getServerSession(authOptions)
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })

  const body = await request.json()
  const {
    first_name,
    last_name,
    title,
    date_of_birth,
    gender,
    phone_number,
    contact_address,
  } = body

  const updated = await prisma.user.update({
    where: { id: session.user.id },
    data: {
      first_name: first_name ?? undefined,
      last_name: last_name ?? undefined,
      title: title ?? undefined,
      date_of_birth: date_of_birth ? new Date(date_of_birth) : undefined,
      gender: gender ?? undefined,
      phone_number: phone_number ?? undefined,
      contact_address: contact_address ?? undefined,
    },
    select: {
      id: true,
      email: true,
      first_name: true,
      last_name: true,
      title: true,
      date_of_birth: true,
      gender: true,
      phone_number: true,
      contact_address: true,
    },
  })

  return NextResponse.json(updated)
}
