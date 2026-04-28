/**
 * Google Calendar helper with automatic token refresh.
 *
 * Google access tokens expire after 1 hour. This module handles refresh
 * transparently so calendar API calls never fail due to token expiry.
 */

export interface TokenSet {
  accessToken: string;
  refreshToken?: string;
  expiresAt?: number; // Unix timestamp (seconds)
}

export interface RefreshedTokenSet extends TokenSet {
  wasRefreshed: boolean;
}

/**
 * Returns a valid access token, refreshing if needed.
 * Throws if refresh fails (e.g. user revoked access).
 */
export async function getValidToken(tokens: TokenSet): Promise<RefreshedTokenSet> {
  const now = Math.floor(Date.now() / 1000);
  const bufferSeconds = 60; // refresh 60s before expiry

  const isExpired = tokens.expiresAt
    ? now >= tokens.expiresAt - bufferSeconds
    : false;

  if (!isExpired) {
    return { ...tokens, wasRefreshed: false };
  }

  if (!tokens.refreshToken) {
    throw new Error("no_refresh_token");
  }

  const res = await fetch("https://oauth2.googleapis.com/token", {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      client_id:     process.env.AUTH_GOOGLE_ID!,
      client_secret: process.env.AUTH_GOOGLE_SECRET!,
      grant_type:    "refresh_token",
      refresh_token: tokens.refreshToken,
    }),
  });

  if (!res.ok) {
    const err = await res.json();
    // Common case: user revoked access
    if (err.error === "invalid_grant") {
      throw new Error("token_revoked");
    }
    throw new Error(`refresh_failed: ${err.error_description ?? res.status}`);
  }

  const data = await res.json();

  return {
    accessToken:  data.access_token,
    refreshToken: data.refresh_token ?? tokens.refreshToken, // Google may or may not return a new refresh token
    expiresAt:    Math.floor(Date.now() / 1000) + (data.expires_in ?? 3600),
    wasRefreshed: true,
  };
}

/**
 * Create a Google Calendar event.
 * Accepts a TokenSet and handles refresh internally.
 * Returns the created event and the (possibly refreshed) token set
 * so the caller can persist updated tokens.
 */
export async function createCalendarEvent(
  tokens: TokenSet,
  event: {
    title: string;
    startTime: string;   // ISO 8601
    endTime: string;     // ISO 8601
    description?: string;
    timeZone?: string;
  }
): Promise<{ event: Record<string, unknown>; tokens: RefreshedTokenSet }> {
  const validTokens = await getValidToken(tokens);

  const body = {
    summary:     event.title,
    description: event.description ?? "",
    start: { dateTime: event.startTime, timeZone: event.timeZone ?? "UTC" },
    end:   { dateTime: event.endTime,   timeZone: event.timeZone ?? "UTC" },
  };

  const res = await fetch(
    "https://www.googleapis.com/calendar/v3/calendars/primary/events",
    {
      method: "POST",
      headers: {
        Authorization: `Bearer ${validTokens.accessToken}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify(body),
    }
  );

  if (!res.ok) {
    const err = await res.json();
    throw new Error(err.error?.message ?? `Calendar API error ${res.status}`);
  }

  const created = await res.json();
  return { event: created, tokens: validTokens };
}
