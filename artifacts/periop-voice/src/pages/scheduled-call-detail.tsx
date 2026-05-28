import { useParams, Link } from "wouter";
import { useGetScheduledCall, getGetScheduledCallQueryKey, useTriggerCall, useUpdateScheduledCall } from "@workspace/api-client-react";
import { Skeleton } from "@/components/ui/skeleton";
import { Button } from "@/components/ui/button";
import { formatters } from "@/lib/formatters";
import { CallTypeBadge, CallStatusBadge } from "@/components/status-badge";
import { ArrowLeft, Phone, X, User, Calendar, RefreshCw, Hash } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { useQueryClient } from "@tanstack/react-query";

export default function ScheduledCallDetail() {
  const { id } = useParams();
  const callId = Number(id);
  const { toast } = useToast();
  const qc = useQueryClient();

  const { data: call, isLoading } = useGetScheduledCall(callId, {
    query: {
      queryKey: getGetScheduledCallQueryKey(callId),
      refetchInterval: (query) => {
        const status = (query.state.data as any)?.status;
        return status === "in_progress" ? 5000 : false;
      },
    },
  });

  const triggerCall = useTriggerCall();
  const updateCall = useUpdateScheduledCall();

  const handleTrigger = () => {
    triggerCall.mutate({ id: callId } as any, {
      onSuccess: () => {
        toast({ title: "Call triggered" });
        qc.invalidateQueries({ queryKey: getGetScheduledCallQueryKey(callId) });
      },
      onError: (err: any) => {
        const detail = err?.response?.data?.error ?? "Failed to trigger call";
        toast({ title: detail, variant: "destructive" });
      },
    });
  };

  const handleCancel = () => {
    if (!confirm("Cancel this scheduled call?")) return;
    updateCall.mutate({ id: callId, data: { status: "cancelled" } } as any, {
      onSuccess: () => {
        toast({ title: "Call cancelled" });
        qc.invalidateQueries({ queryKey: getGetScheduledCallQueryKey(callId) });
      },
      onError: () => toast({ title: "Failed to cancel", variant: "destructive" }),
    });
  };

  if (isLoading) {
    return (
      <div className="p-6 max-w-3xl mx-auto">
        <Skeleton className="h-8 w-48 mb-6" />
        <Skeleton className="h-48 w-full" />
      </div>
    );
  }

  if (!call) {
    return <div className="p-6 text-muted-foreground">Scheduled call not found</div>;
  }

  const patient = (call as any).patient;
  const procedure = (call as any).procedure;
  const isInProgress = call.status === "in_progress";
  const canTrigger = ["pending", "failed", "no_answer"].includes(call.status);
  const canCancel = ["pending", "in_progress"].includes(call.status);

  return (
    <div className="p-6 max-w-3xl mx-auto">
      <div className="flex items-center gap-3 mb-6">
        <Button variant="ghost" size="sm" className="gap-1.5" onClick={() => window.history.back()}>
          <ArrowLeft className="w-4 h-4" /> Back
        </Button>
        <div className="flex-1">
          <div className="flex items-center gap-2 flex-wrap">
            <h1 className="text-xl font-semibold text-foreground">Scheduled Call</h1>
            <CallTypeBadge callType={call.callType} />
            <CallStatusBadge status={call.status} />
          </div>
          {patient && (
            <Link
              href={`/patients/${call.patientId}`}
              className="text-sm text-primary hover:underline flex items-center gap-1 mt-0.5"
            >
              <User className="w-3 h-3" />
              {patient.firstName} {patient.lastName}
            </Link>
          )}
        </div>
      </div>

      {isInProgress && (
        <div className="mb-5 flex items-center gap-3 bg-blue-50 border border-blue-200 rounded-lg px-4 py-3" data-testid="live-call-banner">
          <span className="relative flex h-3 w-3">
            <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-blue-400 opacity-75" />
            <span className="relative inline-flex rounded-full h-3 w-3 bg-blue-500" />
          </span>
          <p className="text-sm font-medium text-blue-800">
            Call is live — status refreshes automatically every 5 seconds
          </p>
          <RefreshCw className="w-3.5 h-3.5 text-blue-500 ml-auto animate-spin" style={{ animationDuration: "3s" }} />
        </div>
      )}

      <div className="grid grid-cols-2 md:grid-cols-3 gap-3 mb-6">
        {[
          ["Scheduled", formatters.datetime(call.scheduledAt)],
          ["Last Attempt", call.lastAttemptAt ? formatters.datetime(call.lastAttemptAt) : "—"],
          ["Attempts", String(call.attemptCount ?? 0)],
        ].map(([label, value]) => (
          <div key={label} className="bg-card border border-card-border rounded-lg p-3">
            <p className="text-xs text-muted-foreground mb-1">{label}</p>
            <p className="text-sm font-medium text-foreground">{value}</p>
          </div>
        ))}
      </div>

      {procedure && (
        <div className="mb-5 bg-card border border-card-border rounded-lg p-4">
          <h2 className="text-sm font-semibold text-foreground mb-2 flex items-center gap-1.5">
            <Calendar className="w-4 h-4" /> Procedure
          </h2>
          <div className="grid grid-cols-2 gap-3 text-sm">
            <div>
              <p className="text-xs text-muted-foreground">Type</p>
              <p className="font-medium text-foreground capitalize">{procedure.procedureType?.replace(/_/g, " ") ?? "—"}</p>
            </div>
            <div>
              <p className="text-xs text-muted-foreground">Date</p>
              <p className="font-medium text-foreground">
                {procedure.scheduledDate ? formatters.date(procedure.scheduledDate) : "—"}
              </p>
            </div>
            {procedure.surgeonName && (
              <div>
                <p className="text-xs text-muted-foreground">Surgeon</p>
                <p className="font-medium text-foreground">{procedure.surgeonName}</p>
              </div>
            )}
            {procedure.facility && (
              <div>
                <p className="text-xs text-muted-foreground">Facility</p>
                <p className="font-medium text-foreground">{procedure.facility}</p>
              </div>
            )}
          </div>
          <Link href={`/procedures/${call.procedureId}`} className="text-xs text-primary hover:underline mt-3 flex items-center gap-1">
            <Hash className="w-3 h-3" /> View procedure
          </Link>
        </div>
      )}

      {call.vapiCallId && (
        <div className="mb-5 bg-card border border-card-border rounded-lg p-4">
          <h2 className="text-sm font-semibold text-foreground mb-1">Vapi Reference</h2>
          <p className="text-xs text-muted-foreground font-mono break-all">{call.vapiCallId}</p>
        </div>
      )}

      <div className="flex items-center gap-3">
        {canTrigger && (
          <Button
            size="sm"
            onClick={handleTrigger}
            disabled={triggerCall.isPending}
            className="gap-1.5"
            data-testid="button-trigger-call"
          >
            <Phone className="w-4 h-4" />
            {triggerCall.isPending ? "Calling…" : "Trigger Call"}
          </Button>
        )}
        {canCancel && (
          <Button
            size="sm"
            variant="outline"
            onClick={handleCancel}
            disabled={updateCall.isPending}
            className="gap-1.5 text-muted-foreground"
            data-testid="button-cancel-call"
          >
            <X className="w-4 h-4" /> Cancel
          </Button>
        )}
      </div>
    </div>
  );
}
