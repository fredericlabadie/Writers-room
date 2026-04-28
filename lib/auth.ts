import NextAuth from "next-auth";
import GitHub from "next-auth/providers/github";
import Google from "next-auth/providers/google";
import { createSupabaseServiceClient } from "./supabase";

export const { handlers, signIn, signOut, auth } = NextAuth({
  providers: [
    Google({
      clientId: process.env.AUTH_GOOGLE_ID!,
      clientSecret: process.env.AUTH_GOOGLE_SECRET!,
      // Request calendar scope so @scheduler can create events
      authorization: {
        params: {
          scope: "openid email profile https://www.googleapis.com/auth/calendar.events",
          access_type: "offline",
          prompt: "consent",
        },
      },
    }),
    GitHub({
      clientId: process.env.AUTH_GITHUB_ID!,
      clientSecret: process.env.AUTH_GITHUB_SECRET!,
    }),
  ],
  callbacks: {
    async jwt({ token, user, account }) {
      if (user) token.userId = user.id;
      // Persist Google access token for calendar API calls
      if (account?.provider === "google") {
        token.googleAccessToken = account.access_token;
        token.googleRefreshToken = account.refresh_token;
        token.googleTokenExpiry = account.expires_at;
      }
      return token;
    },
    async session({ session, token }) {
      if (token.userId) session.user.id = token.userId as string;
      // Expose whether the user has calendar access
      session.hasCalendarAccess = !!token.googleAccessToken;
      // Pass access token to server actions that need it
      (session as any).googleAccessToken = token.googleAccessToken;
      return session;
    },
    async signIn({ user }) {
      if (!user.email) return false;
      const supabase = createSupabaseServiceClient();
      await supabase.from("profiles").upsert(
        { id: user.id, name: user.name, avatar_url: user.image },
        { onConflict: "id" }
      );
      return true;
    },
  },
  pages: { signIn: "/login", error: "/login" },
});
