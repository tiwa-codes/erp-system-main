import { NextRequest, NextResponse } from "next/server"
import { getServerSession } from "next-auth"
import { authOptions } from "@/lib/auth"
import { prisma } from "@/lib/prisma"
import { checkPermission } from "@/lib/permissions"
import fs from 'fs'
import path from 'path'

export async function GET(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions)
    if (!session?.user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }

    // Check if user has settings permissions
    const hasPermission = await checkPermission(session.user.role as any, "settings", "view")
    if (!hasPermission) {
      return NextResponse.json({ error: "Insufficient permissions" }, { status: 403 })
    }

    const { searchParams } = new URL(request.url)
    const packageType = searchParams.get("package_type") || ""
    const planId = searchParams.get("plan_id") || ""
    const search = searchParams.get("search") || ""

    // Get service categories for the package type
    let serviceCategories: string[] = []
    
    if (packageType) {
      // Load categories from plan_categories.json file
      const categoriesPath = path.join(process.cwd(), 'public', 'plan_categories.json')
      const categoriesData = fs.readFileSync(categoriesPath, 'utf8')
      const categories = JSON.parse(categoriesData)
      
      // Map package types to existing database service categories
      const packageCategoryMap: { [key: string]: string[] } = {
        "Eye Care": ["Eye/Optical Care"],
        "Dental Package": ["Dental Care"],
        "Maternity Package": ["Antenatal, Care Delivery and Postnatal"],
        "Surgery Package": ["Surgeries"],
        "Emergency Package": ["Accident and Emergency Packages"],
        "Laboratory Package": ["Laboratory Packages"],
        "Diagnostic Package": ["Basic Diagnostic Packages", "Advanced Diagnostic Packages"],
        "Specialist Package": ["Specialist Medical Services", "Specialist Consultations Group 1", "Specialist Consultations Group 2"],
        "Physiotherapy Package": ["Physiotherapy Care"],
        "ENT Package": ["ENT (Otolaryngological Services)"],
        "Intensive Care Package": ["Intensive Care"],
        "Cancer Care Package": ["Cancer Care"],
        "Renal Care Package": ["Renal Care (Dialysis)"],
        "Wellness Package": ["Wellness Checks"],
        "Mental Care Package": ["Mental Care"],
        "Ambulance Package": ["Ambulance Services"],
        "Drug Delivery Package": ["Drugs Delivery / Refills"],
        "Telemedicine Package": ["Telemedicine"]
      }
      
      serviceCategories = packageCategoryMap[packageType] || []
    }

    // Build where clause for service types
    const whereClause: any = {}
    
    // Filter by package type if provided
    if (packageType && serviceCategories.length > 0) {
      whereClause.service_category = {
        in: serviceCategories
      }
    }
    
    // Add search filter if provided
    if (search) {
      whereClause.OR = [
        {
          service_name: {
            contains: search,
            mode: 'insensitive'
          }
        },
        {
          service_category: {
            contains: search,
            mode: 'insensitive'
          }
        }
      ]
    }

    // Get service types with filtering
    const serviceTypes = await prisma.serviceType.findMany({
      where: whereClause,
      select: {
        id: true,
        service_name: true,
        service_category: true
      },
      orderBy: {
        service_name: 'asc'
      }
    })

    // Get covered services for the plan if planId is provided
    let coveredServices: any[] = []
    if (planId) {
      coveredServices = await prisma.coveredService.findMany({
        where: {
          plan_id: planId,
          service_type: {
            service_category: {
              in: serviceCategories
            }
          }
        },
        include: {
          service_type: {
            select: {
              id: true,
              service_name: true,
              service_category: true
            }
          }
        }
      })
    }

    return NextResponse.json({
      success: true,
      serviceTypes,
      coveredServices,
      serviceCategories
    })

  } catch (error) {
    console.error("Error fetching package services:", error)
    return NextResponse.json(
      { error: "Failed to fetch package services" },
      { status: 500 }
    )
  }
}
