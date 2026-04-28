import NextAuth from "next-auth";
import GitHub from "next-auth/providers/github";
import Google from "next-auth/providers/google";
import { createSupabaseServiceClient } from "./supabase";
import { getValidToken } from "./googleCalendar";

export const { handlers, signIn, signOut, auth } = NextAuth({
  providers: [
    Google({
      clientId: process.env.AUTH_GOOGLE_ID!,
      clientSecret: process.env.AUTH_GOOGLE_SECRET!,
      authorization: {
        params: {
          scope: "openid email profile https://www.googleapis.com/auth/calendar.events.owned",
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
      // Initial sign-in — persist tokens from provider
      if (account?.provider === "google") {
        token.googleAccessToken  = account.access_token;
        token.googleRefreshToken = account.refresh_token;
        // account.expires_at is a Unix timestamp in seconds
        token.googleTokenExpiry  = account.expires_at;
      }

      if (user) token.userId = user.id;

      // On every subsequent request, proactively refresh if the token
      // is expired or within 60 seconds of expiry
      if (
        token.googleAccessToken &&
        token.googleRefreshToken &&
        token.googleTokenExpiry
      ) {
        const now = Math.floor(Date.now() / 1000);
        const expiresAt = token.googleTokenExpiry as number;
        const needsRefresh = now >= expiresAt - 60;

        if (needsRefresh) {
          try {
            const refreshed = await getValidToken({
              accessToken:  token.googleAccessToken as string,
              refreshToken: token.googleRefreshToken as string,
              expiresAt:    expiresAt,
            });
            if (refreshed.wasRefreshed) {
              token.googleAccessToken = refreshed.accessToken;
              token.googleTokenExpiry = refreshed.expiresAt;
              if (refreshed.refreshToken) {
                token.googleRefreshToken = refreshed.refreshToken;
              }
            }
          } catch (err: any) {
            // Refresh failed (revoked, etc.) — clear tokens so UI shows the re-auth prompt
            console.error("Token refresh failed:", err.message);
            token.googleAccessToken  = undefined;
            token.googleRefreshToken = undefined;
            token.googleTokenExpiry  = undefined;
          }
        }
      }

      return token;
    },

    async session({ session, token }) {
      if (token.userId) session.user.id = token.userId as string;
      session.hasCalendarAccess = !!token.googleAccessToken;
      (session as any).googleAccessToken  = token.googleAccessToken;
      (session as any).googleRefreshToken = token.googleRefreshToken;
      (session as any).googleTokenExpiry  = token.googleTokenExpiry;
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
