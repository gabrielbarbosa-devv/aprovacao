import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

type MetricCardProps = { label: string; value: string; description: string };

export function MetricCard({ label, value, description }: MetricCardProps) {
  return (
    <Card size="sm" className="gap-0">
      <CardHeader className="gap-2 pb-2">
        <CardTitle className="text-sm font-normal text-muted-foreground">{label}</CardTitle>
        <p className="text-2xl font-semibold tracking-tight tabular-nums">{value}</p>
      </CardHeader>
      <CardContent className="text-xs text-muted-foreground">{description}</CardContent>
    </Card>
  );
}
