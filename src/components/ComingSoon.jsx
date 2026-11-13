import { Card, CardContent } from "@/components/ui/card";
import { Hourglass } from "lucide-react";

export default function ComingSoon({ title }) {
  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-semibold tracking-tight">{title}</h1>
      <Card>
        <CardContent className="flex items-center gap-3 text-muted-foreground">
          <Hourglass className="h-4 w-4" />
          <span className="text-sm">Módulo {title} (Próximamente)</span>
        </CardContent>
      </Card>
    </div>
  );
}
