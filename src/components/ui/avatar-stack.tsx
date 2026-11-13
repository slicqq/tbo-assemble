import { cn } from "@/lib/utils";

const TONES = ["bg-neutral-200 text-neutral-700 dark:bg-neutral-700 dark:text-neutral-100"];

export function initials(name: string) {
  return name.split(/\s+/).filter(Boolean).slice(0, 2).map((n) => n[0]?.toUpperCase()).join("");
}

// Overlapping initials avatars with a "+N" overflow chip
export function AvatarStack({ names, max = 4, size = "size-7", className }: { names: string[]; max?: number; size?: string; className?: string }) {
  const shown = names.slice(0, max);
  const extra = names.length - shown.length;
  return (
    <div className={cn("flex -space-x-2", className)}>
      {shown.map((n, i) => (
        <span key={`${n}-${i}`} title={n} className={cn("flex items-center justify-center rounded-full text-[10px] font-semibold ring-2 ring-card", size, TONES[i % TONES.length])}>
          {initials(n)}
        </span>
      ))}
      {extra > 0 && (
        <span className={cn("flex items-center justify-center rounded-full bg-muted text-[10px] font-medium text-muted-foreground ring-2 ring-card", size)}>+{extra}</span>
      )}
    </div>
  );
}
