import { ReviewsPage } from "@/features/reviews/components/reviews-page";
import { getReviewBoard } from "@/features/reviews/data/get-review-board";

export default async function Page() {
  const board = await getReviewBoard();
  return <ReviewsPage email={board.email} today={board.studyDay} due={board.due} upcoming={board.upcoming} completed={board.completed} />;
}
