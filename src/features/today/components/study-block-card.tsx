import { Card, CardContent } from "@/components/ui/card";
import type { TodayStudyBlock } from "@/features/today/domain/types";
import { StudyBlockDetailsDialog } from "@/features/today/components/study-block-details-dialog";
import type { StudyTopicOption } from "@/features/study-sessions/domain/types";

export function StudyBlockCard({ block, topics, today }: { block: TodayStudyBlock; topics: StudyTopicOption[]; today: string }) {
  return (
    <Card className="rounded-xl py-0 shadow-none">
      <CardContent className="p-3 sm:p-3.5">
        <StudyBlockDetailsDialog block={block} topics={topics} today={today} />
      </CardContent>
    </Card>
  );
}
