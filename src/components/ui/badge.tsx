import { cva, type VariantProps } from "class-variance-authority";
import { cn } from "@/lib/cn";

const badgeVariants = cva(
  "inline-flex items-center gap-1.5 rounded-full px-2 py-0.5 text-xs font-medium",
  {
    variants: {
      tone: {
        neutral: "bg-muted text-muted-foreground",
        yellow: "bg-[color-mix(in_srgb,var(--accent)_20%,transparent)] text-brand-charcoal dark:text-accent",
        teal: "bg-[color-mix(in_srgb,var(--success)_15%,transparent)] text-success",
        red: "bg-[color-mix(in_srgb,var(--danger)_15%,transparent)] text-danger",
      },
    },
    defaultVariants: { tone: "neutral" },
  },
);

export interface BadgeProps
  extends React.HTMLAttributes<HTMLSpanElement>,
    VariantProps<typeof badgeVariants> {}

export function Badge({ className, tone, ...props }: BadgeProps) {
  return <span className={cn(badgeVariants({ tone }), className)} {...props} />;
}

const TONE_BY_STATUS: Record<string, "neutral" | "yellow" | "teal" | "red"> = {
  ACTIVE: "teal",
  INACTIVE: "neutral",
  PENDING: "yellow",
  SCHEDULED: "neutral",
  LIVE: "yellow",
  FINISHED: "teal",
};

const LABEL_BY_STATUS: Record<string, string> = {
  ACTIVE: "Activo",
  INACTIVE: "Inactivo",
  PENDING: "Pendiente",
  SCHEDULED: "Programado",
  LIVE: "En juego",
  FINISHED: "Finalizado",
};

export function StatusBadge({ status }: { status: string }) {
  return (
    <Badge tone={TONE_BY_STATUS[status] ?? "neutral"}>
      {LABEL_BY_STATUS[status] ?? status}
    </Badge>
  );
}
