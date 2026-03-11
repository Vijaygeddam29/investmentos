import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";

function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

interface ScoreBadgeProps {
  score: number | undefined;
  type: "fortress" | "rocket" | "wave" | "neutral";
  className?: string;
}

export function ScoreBadge({ score, type, className }: ScoreBadgeProps) {
  if (score === undefined || score === null) return <span className="text-muted-foreground font-mono text-xs">-</span>;

  const formattedScore = score.toFixed(2);
  
  let colorClass = "";
  if (type === "fortress") {
    colorClass = score > 0.7 
      ? "bg-emerald-500/10 text-emerald-400 border-emerald-500/20" 
      : "bg-secondary text-muted-foreground border-border";
  } else if (type === "rocket") {
    colorClass = score > 0.65 
      ? "bg-orange-500/10 text-orange-400 border-orange-500/20" 
      : "bg-secondary text-muted-foreground border-border";
  } else if (type === "wave") {
    colorClass = score > 0.6 
      ? "bg-cyan-500/10 text-cyan-400 border-cyan-500/20" 
      : "bg-secondary text-muted-foreground border-border";
  } else {
    colorClass = score > 0.7 
      ? "bg-primary/10 text-primary border-primary/20" 
      : score > 0.4 
        ? "bg-warning/10 text-warning border-warning/20"
        : "bg-destructive/10 text-destructive border-destructive/20";
  }

  return (
    <div className={cn("inline-flex items-center px-2 py-0.5 rounded text-xs font-mono border font-medium", colorClass, className)}>
      {formattedScore}
    </div>
  );
}
