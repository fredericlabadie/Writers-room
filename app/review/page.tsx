import { getReviewSessionFromServerCookies } from "@/lib/review-mode";
import { redirect } from "next/navigation";

export default async function ReviewPage() {
  const review = await getReviewSessionFromServerCookies();
  if (!review?.scope.read) {
    redirect("/login");
  }

  return (
    <main
      style={{
        minHeight: "100vh",
        background: "#0a0a0a",
        color: "#e5e5e5",
        fontFamily: "var(--font-sans)",
        padding: "40px 24px",
      }}
    >
      <div style={{ maxWidth: "760px", margin: "0 auto" }}>
        <h1 style={{ fontSize: "26px", marginBottom: "8px" }}>AI Review Mode</h1>
        <p style={{ color: "#999", marginBottom: "24px" }}>
          Scoped review access is active. Use these links to inspect key flows.
        </p>

        <div style={{ display: "grid", gap: "10px", marginBottom: "24px" }}>
          <a href="/rooms" style={{ color: "#60a5fa" }}>
            Open Rooms Dashboard
          </a>
          <a href="/api/review/manifest" style={{ color: "#60a5fa" }}>
            Review Manifest (JSON)
          </a>
          <a href="/api/review/session" style={{ color: "#60a5fa" }}>
            Review Session Status (JSON)
          </a>
        </div>

        <p style={{ color: "#777", fontSize: "13px" }}>
          Scope: read={String(review.scope.read)} write={String(review.scope.write)}
        </p>
      </div>
    </main>
  );
}
