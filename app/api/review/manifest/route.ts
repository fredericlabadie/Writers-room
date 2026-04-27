import { getReviewSessionFromRequest } from "@/lib/review-mode";
import { NextResponse } from "next/server";

const ROUTES = [
  "/login",
  "/rooms",
  "/rooms/[roomId]",
  "/api/rooms",
  "/api/messages",
  "/api/chat",
  "/api/artifacts",
];

const COMPONENTS = [
  "components/WritersRoom.tsx",
  "app/rooms/page.tsx",
  "app/login/page.tsx",
];

export async function GET(req: Request) {
  const review = await getReviewSessionFromRequest(req);
  if (!review?.scope.read) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  return NextResponse.json({
    app: "writers-room",
    reviewMode: {
      label: review.label,
      scope: review.scope,
      expiresAt: review.exp,
    },
    routes: ROUTES,
    components: COMPONENTS,
    focusAreas: [
      "UI consistency and interaction friction",
      "Performance and payload size",
      "API error handling and resilience",
      "Accessibility and keyboard interactions",
    ],
  });
}
