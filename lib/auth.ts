import NextAuth from "next-auth";
import GitHub from "next-auth/providers/github";
import Google from "next-auth/providers/google";
import { createSupabaseServiceClient } from "./supabase";

export const { handlers, signIn, signOut, auth } = NextAuth({
  providers: [
    Google({
      clientId: process.env.AUTH_GOOGLE_ID!,
      clientSecret: process.env.AUTH_GOOGLE_SECRET!,
    }),
    GitHub({
      clientId: process.env.AUTH_GITHUB_ID!,
      clientSecret: process.env.AUTH_GITHUB_SECRET!,
    }),
  ],
  callbacks: {
    // Persist provider user id into the JWT so we can use it as a stable ID
    async jwt({ token, user, account }) {
      if (user) {
        token.userId = user.id;
      }
      return token;
    },
    async session({ session, token }) {
      if (token.userId) {
        session.user.id = token.userId as string;
      }
      return session;
    },
    // Upsert profile row in Supabase on every sign-in
    async signIn({ user }) {
      if (!user.email) return false;
      const supabase = createSupabaseServiceClient();
      await supabase.from("profiles").upsert(
        {
          id: user.id,
          name: user.name,
          avatar_url: user.image,
        },
        { onConflict: "id" }
      );
      return true;
    },
  },
  pages: {
    signIn: "/login",
    error: "/login",
  },
});
