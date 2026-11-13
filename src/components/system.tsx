/**
 * TBO Assemble design-system primitives.
 * Rules : pages compose these instead of hand-styling surfaces,
 * so type, spacing, radius, colour and imagery stay consistent everywhere.
 */
import type { LucideIcon } from "lucide-react";
import { cn } from "@/lib/utils";

/* ── Icon chip: the only way an icon gets a background ─────────────── */
export function IconChip({ icon: Icon, className }: { icon: LucideIcon; className?: string }) {
  return (
    <span className={cn("flex size-9 shrink-0 items-center justify-center rounded-full bg-muted text-foreground", className)}>
      <Icon className="size-4" />
    </span>
  );
}

/* ── Eyebrow: small label above a title ────────────────────────────── */
export function Eyebrow({ children, className }: { children: React.ReactNode; className?: string }) {
  return <span className={cn("eyebrow", className)}>{children}</span>;
}

/* ── Page header (app pages) ───────────────────────────────────────── */
export function PageHeader({ title, description, actions, className }: { title: string; description?: string; actions?: React.ReactNode; className?: string }) {
  return (
    <div className={cn("mb-8 flex flex-wrap items-end justify-between gap-4", className)}>
      <div className="min-w-0">
        <h1 className="text-[2rem] font-bold leading-tight">{title}</h1>
        {description && <p className="mt-1 text-[15px] text-muted-foreground">{description}</p>}
      </div>
      {actions && <div className="flex flex-wrap items-center gap-2">{actions}</div>}
    </div>
  );
}

/* ── Section (marketing pages): fixed container, rhythm and heading ── */
export function Section({
  id, eyebrow, title, description, align = "left", tone = "plain", children, className,
}: {
  id?: string; eyebrow?: string; title?: string; description?: string; align?: "left" | "center";
  tone?: "plain" | "muted"; children?: React.ReactNode; className?: string;
}) {
  return (
    <section id={id} className={cn("scroll-mt-16", tone === "muted" && "border-y bg-surface/60", className)}>
      <div className="mx-auto max-w-6xl px-6 py-24">
        {title && (
          <div className={cn("mb-12 max-w-2xl", align === "center" && "mx-auto text-center")}>
            {eyebrow && <Eyebrow>{eyebrow}</Eyebrow>}
            <h2 className="mt-3 text-4xl font-bold leading-[1.05] sm:text-5xl">{title}</h2>
            {description && <p className="mt-4 text-[17px] leading-relaxed text-muted-foreground">{description}</p>}
          </div>
        )}
        {children}
      </div>
    </section>
  );
}

/* ── Stat card: label + icon, value, caption, optional fixed-height visual ── */
export function StatCard({
  label, icon, value, caption, visual, tone = "default", className,
}: {
  label: string; icon: LucideIcon; value: React.ReactNode; caption?: React.ReactNode; visual?: React.ReactNode;
  tone?: "default" | "danger"; className?: string;
}) {
  return (
    <div className={cn("flex flex-col rounded-2xl border bg-card p-5", className)}>
      <div className="flex items-center justify-between">
        <p className="text-sm font-medium text-muted-foreground">{label}</p>
        <IconChip icon={icon} className="size-8" />
      </div>
      <div className={cn("mt-3 text-[1.75rem] font-semibold leading-none tabular-nums tracking-tight", tone === "danger" && "text-red-600 dark:text-red-500")}>{value}</div>
      {caption && <p className="mt-2 text-xs text-muted-foreground">{caption}</p>}
      {visual && <div className="mt-auto flex min-h-16 items-end pt-4">{visual}</div>}
    </div>
  );
}

/* ── Feature block: the only surface that uses block colour ── */
const BLOCK_TONES = {
  yellow: "bg-ill-yellow text-black",
  green: "bg-ill-green text-black",
  neutral: "bg-surface text-foreground border",
} as const;

export function FeatureBlock({
  tone = "neutral", tag, title, description, children, className,
}: {
  tone?: keyof typeof BLOCK_TONES; tag?: string; title: string; description: string; children?: React.ReactNode; className?: string;
}) {
  const onColour = tone !== "neutral";
  return (
    <div className={cn("flex flex-col overflow-hidden rounded-[28px] p-8", BLOCK_TONES[tone], className)}>
      {tag && <span className={cn("ill-chip w-fit", !onColour && "bg-foreground/10 text-foreground/70")}>{tag}</span>}
      <h3 className="mt-4 font-display text-[1.75rem] font-bold leading-tight">{title}</h3>
      <p className={cn("mt-3 max-w-md text-[15px] leading-relaxed", onColour ? "text-black/70" : "text-muted-foreground")}>{description}</p>
      {children && <div className="mt-auto pt-6">{children}</div>}
    </div>
  );
}

/* ── Photo frame: photos always sit in a rounded frame with a scrim ── */
export function PhotoFrame({ src, alt, className, children }: { src: string; alt: string; className?: string; children?: React.ReactNode }) {
  return (
    <div className={cn("relative overflow-hidden rounded-2xl bg-muted", className)}>
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img src={src} alt={alt} loading="lazy" className="absolute inset-0 size-full object-cover" />
      {children && (
        <>
          <div className="photo-scrim-strong absolute inset-0" />
          <div className="absolute inset-x-5 bottom-5 text-white">{children}</div>
        </>
      )}
    </div>
  );
}
