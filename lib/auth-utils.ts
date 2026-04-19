import bcrypt from 'bcryptjs'

export async function hashPassword(password: string): Promise<string> {
  const saltRounds = 12
  return bcrypt.hash(password, saltRounds)
}

export async function verifyPassword(password: string, hashedPassword: string): Promise<boolean> {
  return bcrypt.compare(password, hashedPassword)
}

export function generateRandomPassword(length: number = 12): string {
  const charset = 'abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789!@#$%^&*'
  let password = ''
  
  for (let i = 0; i < length; i++) {
    password += charset.charAt(Math.floor(Math.random() * charset.length))
  }
  
  return password
}

export function generateEmployeeId(): string {
  const prefix = 'EMP'
  const timestamp = Date.now().toString().slice(-6)
  const random = Math.random().toString(36).substring(2, 5).toUpperCase()
  return `${prefix}${timestamp}${random}`
}

export function generateClaimNumber(): string {
  const prefix = 'CLM'
  const timestamp = Date.now().toString().slice(-6)
  const random = Math.random().toString(36).substring(2, 5).toUpperCase()
  return `${prefix}${timestamp}${random}`
}

export function generateProviderCode(): string {
  const prefix = 'PRV'
  const timestamp = Date.now().toString().slice(-6)
  const random = Math.random().toString(36).substring(2, 5).toUpperCase()
  return `${prefix}${timestamp}${random}`
}
