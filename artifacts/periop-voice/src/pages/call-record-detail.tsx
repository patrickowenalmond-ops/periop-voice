import { useParams, Link } from "wouter";
import { useGetCallRecord, getGetCallRecordQueryKey } from "@workspace/api-client-react";
import { Skeleton } from "@/components/ui/skeleton";
import { Button } from "@/components/ui/button";
import { formatters } from "@/lib/formatters";
import { CallTypeBadge, SeverityBadge } from "@/components/status-badge";
import { ArrowLeft, AlertTriangle, Clock, User } from "lucide-react";

export default function CallRecordDetail() {
  const { id } = useParams();
  const recordId = Number(id);

  const { data: record, isLoading } = useGetCallRecord(recordId, {
    query: { queryKey: getGetCallRecordQueryKey(recordId) },
  });

  if (isLoading) return <div className="p-6"><Skeleton className="h-40 w-full" /></div>;
  if (!record) return <div className="p-6 text-muted-foreground">Call record not found</div>;

  const flags = (record as any).flags ?? [];
  const structuredData = (record as any).structuredData;

  return (
    <div className="p-6 max-w-4xl mx-auto">
      <div className="flex items-center gap-3 mb-6">
        <Button variant="ghost" size="sm" className="gap-1.5" onClick={() => window.history.back()}>
          <ArrowLeft className="w-4 h-4" /> Back
        </Button>
        <div className="flex-1">
          <div className="flex items-center gap-2">
            <h1 className="text-xl font-semibold text-foreground">Call Record</h1>
            <CallTypeBadge callType={record.callType} />
          </div>
          <Link href={`/patients/${record.patientId}`} className="text-sm text-primary hover:underline flex items-center gap-1 mt-0.5">
            <User className="w-3 h-3" />
            {(record as any).patient?.firstName} {(record as any).patient?.lastName}
          </Link>
        </div>
      </div>

      {/* Summary stats */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-6">
        {[
          ["Date", formatters.datetime(record.startedAt)],
          ["Outcome", record.outcome?.replace(/_/g, " ") ?? "—"],
          ["Duration", record.durationSeconds ? formatters.duration(record.durationSeconds) : "—"],
          ["Flags", flags.length > 0 ? `${flags.length} flag${flags.length > 1 ? "s" : ""}` : "None"],
        ].map(([label, value]) => (
          <div key={label} className="bg-card border border-card-border rounded-lg p-3">
            <p className="text-xs text-muted-foreground mb-1">{label}</p>
            <p className="text-sm font-medium text-foreground capitalize">{value}</p>
          </div>
        ))}
      </div>

      {/* Flags / Alerts */}
      {flags.length > 0 && (
        <div className="mb-6">
          <h2 className="text-sm font-semibold text-foreground mb-3 flex items-center gap-1.5">
            <AlertTriangle className="w-4 h-4 text-red-500" /> Clinical Flags
          </h2>
          <div className="space-y-2">
            {flags.map((flag: any) => (
              <div key={flag.id} className="bg-card border border-card-border rounded-lg p-3 flex items-start gap-3" data-testid={`flag-${flag.id}`}>
                <SeverityBadge severity={flag.severity} />
                <div className="flex-1">
                  <p className="text-sm font-medium text-foreground">{flag.description}</p>
                  <p className="text-xs text-muted-foreground">{flag.category}</p>
                  {flag.recommendedAction && (
                    <p className="text-xs text-amber-700 mt-1">Action: {flag.recommendedAction}</p>
                  )}
                </div>
                {flag.acknowledged && (
                  <span className="text-xs text-muted-foreground bg-muted px-2 py-0.5 rounded">Acknowledged</span>
                )}
              </div>
            ))}
          </div>
        </div>
      )}

      {/* AI Summary */}
      {record.aiSummary && (
        <div className="mb-6">
          <h2 className="text-sm font-semibold text-foreground mb-3">AI Summary</h2>
          <div className="bg-blue-50 border border-blue-100 rounded-lg p-4 text-sm text-foreground whitespace-pre-wrap">
            {record.aiSummary}
          </div>
        </div>
      )}

      {/* Structured Data */}
      {structuredData && Object.keys(structuredData).length > 0 && (
        <div className="mb-6">
          <h2 className="text-sm font-semibold text-foreground mb-3">Extracted Clinical Data</h2>
          <div className="bg-card border border-card-border rounded-lg p-4">
            <dl className="grid grid-cols-2 gap-3">
              {Object.entries(structuredData).filter(([, v]) => v !== null && v !== undefined).map(([key, value]) => (
                <div key={key}>
                  <dt className="text-xs text-muted-foreground capitalize">{key.replace(/([A-Z])/g, " $1").trim()}</dt>
                  <dd className="text-sm font-medium text-foreground mt-0.5">
                    {Array.isArray(value) ? (value as string[]).join(", ") || "None" : String(value)}
                  </dd>
                </div>
              ))}
            </dl>
          </div>
        </div>
      )}

      {/* Transcript */}
      <div>
        <h2 className="text-sm font-semibold text-foreground mb-3 flex items-center gap-1.5">
          <Clock className="w-4 h-4" /> Transcript
        </h2>
        {record.transcript ? (
          <div className="bg-card border border-card-border rounded-lg p-4 text-sm text-foreground font-mono whitespace-pre-wrap leading-relaxed max-h-96 overflow-y-auto" data-testid="transcript-content">
            {record.transcript}
          </div>
        ) : (
          <div className="bg-card border border-card-border rounded-lg p-6 text-center text-sm text-muted-foreground">
            No transcript available
          </div>
        )}
      </div>
    </div>
  );
}
