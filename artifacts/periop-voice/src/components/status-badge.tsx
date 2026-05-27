import { cn } from "@/lib/utils";
import { formatters } from "@/lib/formatters";

export function CallStatusBadge({ status }: { status: string }) {
  const { label, color } = formatters.callStatus(status);
  return (
    <span className={cn("inline-flex items-center px-2 py-0.5 rounded text-xs font-medium", color)}>
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
