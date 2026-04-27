import type { DefaultSession } from "next-auth";

declare module "next-auth" {
  /**
   * Extends the built-in session.user type so TypeScript knows
   * session.user.id exists throughout the app.
   */
  interface Session {
    user: {
      id: string;
    } & DefaultSession["user"];
  }
}
