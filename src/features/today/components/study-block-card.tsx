import { BookOpen, Clock3 } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import { formatDuration } from "@/features/today/domain/format-duration";
import type { TodayStudyBlock } from "@/features/today/domain/types";
import { StartStudyBlockButton } from "@/features/today/components/start-study-block-button";
import { StudySessionDialog } from "@/features/study-sessions/components/study-session-dialog";
import type { StudyTopicOption } from "@/features/study-sessions/domain/types";

export function StudyBlockCard({ block, topics, today }: { block: TodayStudyBlock; topics: StudyTopicOption[]; today: string }) {
  return (
    <Card className="rounded-xl py-0 shadow-none">
      <CardContent className="flex flex-col gap-4 p-4 sm:flex-row sm:items-center">
        <span className="grid size-10 shrink-0 place-items-center rounded-lg bg-primary/10 text-primary">
          <BookOpen aria-hidden="true" className="size-5" />
        </span>
        <div className="min-w-0 flex-1">
          <h3 className="text-sm font-semibold">{block.subject}</h3>
          <p className="mt-1 text-sm text-muted-foreground">{block.topic}</p>
        </div>
        <div className="flex flex-wrap items-center justify-between gap-3 sm:justify-end">
          <Badge variant="secondary" className="whitespace-nowrap">Bloco {String(block.sequence).padStart(2, "0")}</Badge>
          <span className="flex items-center gap-1.5 text-sm text-muted-foreground">
            <Clock3 aria-hidden="true" className="size-4" />{formatDuration(block.durationMinutes)}
          </span>
          {block.status === "em_andamento" ? (
            <Badge className="bg-primary/10 text-primary hover:bg-primary/10">Em andamento</Badge>
          ) : <StartStudyBlockButton blockId={block.id} />}
          <StudySessionDialog topics={topics} today={today} selectedBlock={{ id: block.id, topicId: block.topicId, subject: block.subject, topic: block.topic, durationMinutes: block.durationMinutes }} />
        </div>
      </CardContent>
    </Card>
  );
}
