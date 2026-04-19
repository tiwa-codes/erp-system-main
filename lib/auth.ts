import type { NextAuthOptions } from "next-auth"
import CredentialsProvider from "next-auth/providers/credentials"
import { decode } from "next-auth/jwt"
import { prisma } from "./prisma"
import { verifyPassword, hashPassword } from "./auth-utils"
import { createAuditLog } from "./audit"

declare module "next-auth" {
  interface Session {
    user: {
      id: string
      email: string
      name: string
      role: string
      departmentId: string | null
      department: any
      first_login?: boolean
      provider_id?: string | null
    }
  }

  interface User {
    role: string
    departmentId: string | null
    department: any
    first_login?: boolean
    provider_id?: string | null
  }
}

declare module "next-auth/jwt" {
  interface JWT {
    role: string
    departmentId: string | null
    department: any
    first_login?: boolean
    provider_id?: string | null
  }
}

export const authOptions: NextAuthOptions = {
  providers: [
    CredentialsProvider({
      name: "credentials",
      credentials: {
        email: { label: "Email", type: "email" },
        password: { label: "Password", type: "password" },
      },
      async authorize(credentials, req) {
        if (!credentials?.email || !credentials?.password) {
          return null
        }

        let user
        try {
          user = await prisma.user.findUnique({
            where: {
              email: credentials.email,
            },
            include: {
              department: true,
              role: true,
            },
          })
        } catch (error) {
          console.error("Auth user lookup failed:", error)
          throw new Error("DatabaseUnavailable")
        }

        if (!user) {
          return null
        }

        // Check if user is active
        if (user.status !== "ACTIVE") {
          return null
        }

        // Verify password
        let isPasswordValid = await verifyPassword(credentials.password, user.password!)

        // Backward-compatibility: if stored password was plaintext (from previous bug), migrate it
        if (!isPasswordValid) {
          const looksHashed = typeof user.password === "string" && user.password.startsWith("$2") && user.password.length >= 50
          if (!looksHashed && credentials.password === user.password) {
            const newHash = await hashPassword(credentials.password)
            await prisma.user.update({ where: { id: user.id }, data: { password: newHash } })
            isPasswordValid = true
          }
        }

        if (!isPasswordValid) {
          return null
        }

        // Update last login
        try {
          await prisma.user.update({
            where: { id: user.id },
            data: { last_login_at: new Date() },
          })
        } catch (error) {
          console.error("Auth last_login update failed:", error)
        }

        // Create audit log for login
        await createAuditLog({
          userId: user.id,
          action: "LOGIN",
          resource: "auth",
          ipAddress: (req?.headers?.["x-forwarded-for"] as string) || "unknown",
          userAgent: (req?.headers?.["user-agent"] as string) || "unknown",
        })

        return {
          id: user.id,
          email: user.email,
          name: `${user.first_name} ${user.last_name}`,
          role: user.role?.name || 'HR_OFFICER',
          departmentId: user.department_id,
          department: user.department,
          first_login: user.first_login,
          provider_id: user.provider_id || null,
        }
      },
    }),
    CredentialsProvider({
      id: "mobile-jwt",
      name: "Mobile Token",
      credentials: {
        token: { label: "Token", type: "text" },
      },
      async authorize(credentials, req) {
        if (!credentials?.token) return null;

        try {
          const MOBILE_JWT_SECRET = process.env.NEXTAUTH_SECRET || "fallback-dev-secret-change-in-prod";
          const decoded = await decode({
            token: credentials.token,
            secret: MOBILE_JWT_SECRET,
            salt: "mobile-token",
          });

          if (!decoded?.sub) return null;

          // Validate user still exists and is active
          const user = await prisma.user.findUnique({
            where: { id: decoded.sub as string },
            include: { department: true, role: true },
          });

          if (!user || user.status !== "ACTIVE") return null;

          return {
            id: user.id,
            email: user.email,
            name: `${user.first_name} ${user.last_name}`,
            role: user.role?.name || "HR_OFFICER",
            departmentId: user.department_id,
            department: user.department,
            first_login: user.first_login,
            provider_id: user.provider_id || null,
          };
        } catch (error) {
          console.error("Mobile JWT login failed:", error);
          return null;
        }
      },
    }),
  ],
  session: {
    strategy: "jwt",
    maxAge: 8 * 60 * 60,    // 8 hours — full working day
    updateAge: 60 * 60,      // Rolling: refresh if active every 1 hour
  },
  callbacks: {
    async jwt({ token, user }) {
      if (user) {
        token.id = user.id;
        token.email = user.email;
        token.role = user.role;
        token.departmentId = user.departmentId;
        token.department = user.department;
        token.first_login = user.first_login;
        token.provider_id = (user as any).provider_id || null;
      }
      return token;
    },
    async session({ session, token }) {
      // Always ensure session.user exists
      session.user = session.user || {};
      session.user.id = token.id as string;
      session.user.email = token.email as string;
      session.user.role = token.role as string;
      session.user.departmentId = token.departmentId as string;
      session.user.department = token.department as any;
      session.user.first_login = token.first_login as boolean;
      session.user.provider_id = (token.provider_id as string) || null;
      return session;
    },
  },
  pages: {
    signIn: "/auth/signin",
  },
  events: {
    async signOut({ token }) {
      // Additional cleanup on signout
      if (token?.sub) {
        await createAuditLog({
          userId: token.sub,
          action: "LOGOUT",
          resource: "auth",
        })
      }
    },
  },
}
