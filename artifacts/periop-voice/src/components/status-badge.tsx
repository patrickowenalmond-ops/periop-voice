import { cn } from "@/lib/utils";
import { formatters } from "@/lib/formatters";

export function CallStatusBadge({ status, pulse }: { status: string; pulse?: boolean }) {
  const { label, color } = formatters.callStatus(status);
  const isLive = status === "in_progress";
  return (
    <span className={cn("inline-flex items-center gap-1.5 px-2 py-0.5 rounded text-xs font-medium", color)}>
      {isLive && (
        <span className="relative flex h-2 w-2">
          <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-blue-400 opacity-75" />
          <span className="relative inline-flex rounded-full h-2 w-2 bg-blue-500" />
        </span>
      )}
      {label}
    </span>
  );
}

export function SeverityBadge({ severity }: { severity: string }) {
  const { label, color } = formatters.severity(severity);
  return (
    <span className={cn("inline-flex items-center px-2 py-0.5 rounded text-xs font-medium border", color)}>
      {label}
    </span>
  );
}

export function CallTypeBadge({ callType }: { callType: string }) {
  return (
    <span className="inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-blue-50 text-blue-700 border border-blue-100">
      {formatters.callType(callType)}
    </span>
  );
}
