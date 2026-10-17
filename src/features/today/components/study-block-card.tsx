import { BookOpen, Clock3 } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { formatDuration } from "@/features/today/domain/format-duration";
import type { TodayStudyBlock } from "@/features/today/domain/types";
import { StartStudyBlockButton } from "@/features/today/components/start-study-block-button";

export function StudyBlockCard({ block }: { block: TodayStudyBlock }) {
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
          <Button type="button" variant="outline" disabled title="O registro de resultado será implementado na etapa 05" className="w-full sm:w-auto">
            Registrar resultado · Etapa 05
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}
