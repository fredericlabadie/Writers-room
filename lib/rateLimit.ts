import { createSupabaseServiceClient } from "./supabase";
import { NextResponse } from "next/server";

// Per-user limit: 30 agent calls per hour
const LIMIT_PER_HOUR = 30;

export interface RateLimitResult {
  allowed: boolean;
  remaining: number;
  resetAt: Date;
}

/**
 * Checks and records an API call for a user.
 * Uses a simple append-only log: counts rows in the current hour window.
 * Race condition window is negligible for this use case.
 */
export async function checkAndRecordCall(userId: string): Promise<RateLimitResult> {
  const supabase = createSupabaseServiceClient();

  // Hour window: from the top of the current hour
  const now = new Date();
  const windowStart = new Date(now);
  windowStart.setMinutes(0, 0, 0);
  const windowEnd = new Date(windowStart);
  windowEnd.setHours(windowEnd.getHours() + 1);

  // Count existing calls this hour
  const { count, error } = await supabase
    .from("rate_limits")
    .select("*", { count: "exact", head: true })
    .eq("user_id", userId)
    .gte("called_at", windowStart.toISOString())
    .lt("called_at", windowEnd.toISOString());

  if (error) {
    // On DB error, fail open — don't block the user
    console.error("Rate limit check failed:", error);
    return { allowed: true, remaining: LIMIT_PER_HOUR, resetAt: windowEnd };
  }

  const current = count ?? 0;

  if (current >= LIMIT_PER_HOUR) {
    return { allowed: false, remaining: 0, resetAt: windowEnd };
  }

  // Record the call
  await supabase.from("rate_limits").insert({ user_id: userId });

  return {
    allowed: true,
    remaining: LIMIT_PER_HOUR - current - 1,
    resetAt: windowEnd,
  };
}

/**
 * Returns a 429 response with Retry-After header.
 */
export function rateLimitResponse(resetAt: Date) {
  const secondsUntilReset = Math.ceil((resetAt.getTime() - Date.now()) / 1000);
  return NextResponse.json(
    {
      error: "Rate limit exceeded",
      message: `You've made ${LIMIT_PER_HOUR} agent calls this hour. Resets at ${resetAt.toLocaleTimeString()}.`,
      resetAt: resetAt.toISOString(),
    },
    {
      status: 429,
      headers: {
        "Retry-After": String(secondsUntilReset),
        "X-RateLimit-Limit": String(LIMIT_PER_HOUR),
        "X-RateLimit-Remaining": "0",
        "X-RateLimit-Reset": resetAt.toISOString(),
      },
    }
  );
}
