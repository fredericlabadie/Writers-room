import { auth } from "@/lib/auth";
import { createReviewToken, isReviewModeEnabled } from "@/lib/review-mode";
import { NextResponse } from "next/server";

// POST /api/review/token
// Body: { write?: boolean, expiresInSeconds?: number, label?: string }
export async function POST(req: Request) {
  if (!isReviewModeEnabled()) {
    return NextResponse.json({ error: "Review mode disabled" }, { status: 404 });
  }

  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const body = await req.json().catch(() => ({}));
  const write = !!body?.write;
  const expiresInSeconds = Number(body?.expiresInSeconds ?? 3600);
  const label = typeof body?.label === "string" ? body.label : "AI reviewer";

  const token = await createReviewToken({
    scope: { read: true, write },
    expiresInSeconds: Math.max(300, Math.min(expiresInSeconds, 60 * 60 * 24)),
    label,
  });

  return NextResponse.json({
    token,
    reviewUrl: `/review?review_token=${encodeURIComponent(token)}`,
    scope: { read: true, write },
  });
}
