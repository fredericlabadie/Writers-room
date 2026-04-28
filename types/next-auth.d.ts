import type { DefaultSession } from "next-auth";

declare module "next-auth" {
  interface Session {
    user: {
      id: string;
    } & DefaultSession["user"];
    hasCalendarAccess: boolean;
    googleAccessToken?: string;
    googleRefreshToken?: string;
    googleTokenExpiry?: number;
  }
}

declare module "next-auth/jwt" {
  interface JWT {
    userId?: string;
    googleAccessToken?: string;
    googleRefreshToken?: string;
    googleTokenExpiry?: number;
  }
}
