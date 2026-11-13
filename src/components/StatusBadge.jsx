import { Badge } from "@/components/ui/badge";

const STYLES = {
  OPEN: {
    label: "OPEN",
    dot: "bg-amber-500",
    cls: "bg-amber-500/15 text-amber-700 dark:text-amber-400",
  },
  CLOSED: {
    label: "CLOSED",
    dot: "bg-emerald-500",
    cls: "bg-emerald-500/15 text-emerald-700 dark:text-emerald-400",
  },
};

export default function StatusBadge({ status }) {
  const s = STYLES[status];
  if (!s) return <Badge variant="outline">{status ?? "—"}</Badge>;
  return (
    <Badge variant="secondary" className={s.cls}>
      <span className={`size-1.5 rounded-full ${s.dot}`} aria-hidden="true" />
      {s.label}
    </Badge>
  );
}
