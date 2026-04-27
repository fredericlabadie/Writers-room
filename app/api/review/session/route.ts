import { auth } from "@/lib/auth";
import { getReviewSessionFromRequest, isReviewModeEnabled } from "@/lib/review-mode";
import { NextResponse } from "next/server";

export async function GET(req: Request) {
  const session = await auth();
  const review = await getReviewSessionFromRequest(req);

  return NextResponse.json({
    enabled: isReviewModeEnabled(),
    active: !!review,
    scope: review?.scope ?? null,
    label: review?.label ?? null,
    expiresAt: review?.exp ?? null,
    authenticated: !!session?.user?.id,
  });
}
