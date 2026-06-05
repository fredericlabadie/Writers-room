import NextAuth from "next-auth";
import GitHub from "next-auth/providers/github";
import Google from "next-auth/providers/google";
import { createSupabaseServiceClient } from "./supabase";

export const { handlers, signIn, signOut, auth } = NextAuth({
  providers: [
    Google({
      clientId: process.env.AUTH_GOOGLE_ID!,
      clientSecret: process.env.AUTH_GOOGLE_SECRET!,
      authorization: {
        params: {
          scope: [
            "openid email profile",
            "https://www.googleapis.com/auth/calendar.app.created",
            "https://www.googleapis.com/auth/calendar.events.freebusy",
            "https://www.googleapis.com/auth/calendar.freebusy",
          ].join(" "),
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
      // Use providerAccountId as the stable user ID — beta.19 generates a new
      // UUID for user.id on every OAuth sign-in when no DB adapter is configured.
      if (user && account) {
        token.userId = account.providerAccountId;
        if (account.provider === "google") {
          token.googleAccessToken = account.access_token;
          token.googleTokenExpiry = account.expires_at;
        }
      }
      return token;
    },

    async session({ session, token }) {
      if (token.userId) session.user.id = token.userId as string;
      session.hasCalendarAccess = !!token.googleAccessToken;
      (session as any).googleAccessToken = token.googleAccessToken;
      return session;
    },

    async signIn({ user, account }) {
      if (!user.email) return false;
      const stableId = account?.providerAccountId ?? user.id;
      const supabase = createSupabaseServiceClient();
      const { error } = await supabase.from("profiles").upsert(
        { id: stableId, name: user.name, avatar_url: user.image },
        { onConflict: "id" }
      );
      if (error) console.error("[signIn] profile upsert failed:", error.message, error.code);
      return true;
    },
  },
  pages: { signIn: "/login", error: "/login" },
});
