import { jwtVerify, SignJWT } from "jose";
import { cookies } from "next/headers";

export const REVIEW_COOKIE_NAME = "wr_review_session";
const REVIEW_ALG = "HS256";

export interface ReviewScope {
  read: boolean;
  write: boolean;
}

export interface ReviewSession {
  kind: "review";
  scope: ReviewScope;
  label?: string;
  exp: number;
}

function getSecret() {
  return process.env.REVIEW_TOKEN_SECRET ?? "";
}

function getSecretKey() {
  return new TextEncoder().encode(getSecret());
}

export function isReviewModeEnabled() {
  return process.env.REVIEW_MODE_ENABLED === "true";
}

export async function createReviewToken(input: {
  scope?: Partial<ReviewScope>;
  label?: string;
  expiresInSeconds?: number;
}) {
  const secret = getSecret();
  if (!secret) throw new Error("REVIEW_TOKEN_SECRET is missing");

  const scope: ReviewScope = {
    read: input.scope?.read ?? true,
    write: input.scope?.write ?? false,
  };
  const expiresInSeconds = input.expiresInSeconds ?? 60 * 60;

  return await new SignJWT({
    kind: "review",
    scope,
    label: input.label ?? "AI reviewer",
  })
    .setProtectedHeader({ alg: REVIEW_ALG })
    .setIssuedAt()
    .setExpirationTime(`${expiresInSeconds}s`)
    .sign(getSecretKey());
}

export async function verifyReviewToken(token: string): Promise<ReviewSession | null> {
  if (!isReviewModeEnabled()) return null;
  const secret = getSecret();
  if (!secret || !token) return null;

  try {
    const { payload } = await jwtVerify(token, getSecretKey(), {
      algorithms: [REVIEW_ALG],
    });

    if (payload.kind !== "review") return null;
    if (typeof payload.exp !== "number") return null;

    const scope = (payload.scope ?? {}) as Partial<ReviewScope>;
    if (!scope.read) return null;

    return {
      kind: "review",
      scope: {
        read: !!scope.read,
        write: !!scope.write,
      },
      label: typeof payload.label === "string" ? payload.label : undefined,
      exp: payload.exp,
    };
  } catch {
    return null;
  }
}

export async function getReviewSessionFromCookieValue(rawCookieValue?: string | null) {
  if (!rawCookieValue) return null;
  return verifyReviewToken(rawCookieValue);
}

export async function getReviewSessionFromRequest(req: Request) {
  const rawCookie = req.headers.get("cookie") ?? "";
  const parts = rawCookie.split(";").map((p) => p.trim());
  const tokenPair = parts.find((p) => p.startsWith(`${REVIEW_COOKIE_NAME}=`));
  const token = tokenPair ? decodeURIComponent(tokenPair.slice(REVIEW_COOKIE_NAME.length + 1)) : "";
  return getReviewSessionFromCookieValue(token);
}

export async function getReviewSessionFromServerCookies() {
  const token = cookies().get(REVIEW_COOKIE_NAME)?.value;
  return getReviewSessionFromCookieValue(token);
}
