import { getReviewSessionFromServerCookies } from "@/lib/review-mode";
import { redirect } from "next/navigation";
import ReviewClient from "./client";

export default async function ReviewPage() {
  const review = await getReviewSessionFromServerCookies();
  if (!review?.scope.read) {
    redirect("/login");
  }

  return (
    <ReviewClient
      expiresAt={review.exp}
      label={review.label ?? "AI reviewer"}
      canWrite={review.scope.write}
    />
  );
}
