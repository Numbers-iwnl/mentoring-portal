import type { UserRole } from "@prisma/client";
import "next-auth";
import "next-auth/jwt";

declare module "next-auth" {
  interface User {
    role: UserRole;
    studentId?: string | null;
    studentName?: string | null;
    mustChangePassword?: boolean;
  }

  interface Session {
    user: {
      id: string;
      name?: string | null;
      email?: string | null;
      image?: string | null;
      role: UserRole;
      studentId?: string | null;
      studentName?: string | null;
      mustChangePassword?: boolean;
    };
  }
}

declare module "next-auth/jwt" {
  interface JWT {
    role: UserRole;
    studentId?: string | null;
    studentName?: string | null;
    mustChangePassword?: boolean;
  }
}
