import { prisma } from "@/lib/prisma"

export async function resolveTelemedicinePatient(patientId: string) {
  const dependent = await prisma.dependent.findFirst({
    where: {
      OR: [
        { id: patientId },
        { dependent_id: patientId }
      ]
    },
    select: {
      id: true,
      dependent_id: true,
      principal_id: true
    }
  })

  return {
    enrolleeId: dependent?.principal_id || patientId,
    dependent
  }
}

export function getDependentAppointmentMarker(dependentId: string) {
  return `DEPENDENT_ID:${dependentId}`
}
