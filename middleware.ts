import { auth } from "@/lib/auth";
import { REVIEW_COOKIE_NAME, verifyReviewToken } from "@/lib/review-mode";
import { NextResponse } from "next/server";

export default auth(async (req) => {
  const isLoggedIn = !!req.auth;
  const isLoginPage = req.nextUrl.pathname.startsWith("/login");
  const isApiAuth = req.nextUrl.pathname.startsWith("/api/auth");
  const isReviewPage = req.nextUrl.pathname.startsWith("/review");

  const reviewTokenParam = req.nextUrl.searchParams.get("review_token");
  if (reviewTokenParam) {
    const reviewSession = await verifyReviewToken(reviewTokenParam);
    if (!reviewSession) {
      return NextResponse.json({ error: "Invalid or expired review token" }, { status: 401 });
    }

    const nextUrl = req.nextUrl.clone();
    nextUrl.searchParams.delete("review_token");
    const response = NextResponse.redirect(nextUrl);
    response.cookies.set(REVIEW_COOKIE_NAME, reviewTokenParam, {
      httpOnly: true,
      sameSite: "lax",
      secure: req.nextUrl.protocol === "https:",
      path: "/",
      maxAge: Math.max(60, reviewSession.exp - Math.floor(Date.now() / 1000)),
    });
    return response;
  }

  const reviewCookie = req.cookies.get(REVIEW_COOKIE_NAME)?.value;
  const reviewSession = await verifyReviewToken(reviewCookie ?? "");
  const hasReviewAccess = !!reviewSession?.scope.read;

  // Always allow auth API routes
  if (isApiAuth) return NextResponse.next();

  // Redirect unauthenticated users to login
  if (!isLoggedIn && !isLoginPage && !hasReviewAccess && !isReviewPage) {
    return NextResponse.redirect(new URL("/login", req.url));
  }

  // Redirect logged-in users away from login page
  if ((isLoggedIn || hasReviewAccess) && isLoginPage) {
    return NextResponse.redirect(new URL("/rooms", req.url));
  }

  if (!hasReviewAccess && isReviewPage) {
    return NextResponse.redirect(new URL("/login", req.url));
  }

  return NextResponse.next();
});

export const config = {
  matcher: ["/((?!_next/static|_next/image|favicon.ico).*)"],
};
