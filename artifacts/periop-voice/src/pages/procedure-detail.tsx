import { useParams, Link } from "wouter";
import { useGetProcedure, useListScheduledCalls, useTriggerCall, useScheduleProcedureCalls, getListScheduledCallsQueryKey } from "@workspace/api-client-react";
import { Skeleton } from "@/components/ui/skeleton";
import { Button } from "@/components/ui/button";
import { formatters } from "@/lib/formatters";
import { CallTypeBadge, CallStatusBadge } from "@/components/status-badge";
import { ArrowLeft, Phone, Calendar, RefreshCw } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { useQueryClient } from "@tanstack/react-query";

export default function ProcedureDetail() {
  const { id } = useParams();
  const { toast } = useToast();
  const qc = useQueryClient();
  const procedureId = Number(id);

  const { data: procedure, isLoading } = useGetProcedure(procedureId);
  const { data: scheduledCalls, isLoading: callsLoading } = useListScheduledCalls(
    { procedureId } as any,
    { query: { queryKey: getListScheduledCallsQueryKey({ procedureId } as any) } }
  );
  const triggerCall = useTriggerCall();
  const scheduleCalls = useScheduleProcedureCalls();

  const handleTrigger = (callId: number) => {
    triggerCall.mutate({ id: callId } as any, {
      onSuccess: () => {
        toast({ title: "Call triggered" });
        qc.invalidateQueries({ queryKey: getListScheduledCallsQueryKey({ procedureId } as any) });
      },
      onError: () => toast({ title: "Failed to trigger call", variant: "destructive" }),
    });
  };

  const handleSchedule = () => {
    scheduleCalls.mutate({ procedureId } as any, {
      onSuccess: (calls) => {
        toast({ title: `${(calls as any[]).length} calls scheduled` });
        qc.invalidateQueries({ queryKey: getListScheduledCallsQueryKey({ procedureId } as any) });
      },
      onError: () => toast({ title: "Failed to schedule calls", variant: "destructive" }),
    });
  };

  if (isLoading) return <div className="p-6"><Skeleton className="h-40 w-full" /></div>;
  if (!procedure) return <div className="p-6 text-muted-foreground">Procedure not found</div>;

  return (
    <div className="p-6 max-w-4xl mx-auto">
      <div className="flex items-center gap-3 mb-6">
        <Link href="/procedures">
          <Button variant="ghost" size="sm" className="gap-1.5"><ArrowLeft className="w-4 h-4" /> Procedures</Button>
        </Link>
        <div className="flex-1">
          <h1 className="text-xl font-semibold text-foreground">{procedure.procedureName}</h1>
          <p className="text-sm text-muted-foreground">
            <Link href={`/patients/${procedure.patientId}`} className="hover:underline">
              {(procedure as any).patient?.firstName} {(procedure as any).patient?.lastName}
            </Link>
          </p>
        </div>
        <Button size="sm" variant="outline" onClick={handleSchedule} disabled={scheduleCalls.isPending} data-testid="button-schedule-calls">
          <RefreshCw className="w-4 h-4 mr-1.5" />
          {scheduleCalls.isPending ? "Scheduling..." : "Re-schedule Calls"}
        </Button>
      </div>

      <div className="grid grid-cols-2 md:grid-cols-3 gap-3 mb-6">
        {[
          ["Scheduled Date", procedure.scheduledDate ? formatters.datetime(procedure.scheduledDate) : "—"],
          ["Facility", procedure.facility ?? "—"],
          ["Surgeon", procedure.surgeon ?? "—"],
          ["Arrival Time", procedure.arrivalTime ?? "—"],
          ["Procedure Code", procedure.procedureCode ?? "—"],
          ["EHR ID", procedure.ehrProcedureId ?? "—"],
        ].map(([label, value]) => (
          <div key={label} className="bg-card border border-card-border rounded-lg p-3">
            <p className="text-xs text-muted-foreground mb-1">{label}</p>
            <p className="text-sm font-medium text-foreground">{value}</p>
          </div>
        ))}
      </div>

      {procedure.specialInstructions && (
        <div className="bg-amber-50 border border-amber-200 rounded-lg p-3 mb-6 text-sm text-amber-900">
          <strong>Special Instructions:</strong> {procedure.specialInstructions}
        </div>
      )}

      <div className="flex items-center justify-between mb-3">
        <h2 className="text-sm font-semibold text-foreground">Scheduled Calls</h2>
        <span className="text-xs text-muted-foreground">{scheduledCalls?.length ?? 0} calls</span>
      </div>

      <div className="bg-card border border-card-border rounded-lg overflow-hidden">
        {callsLoading ? (
          <div className="p-4 space-y-2">{Array.from({ length: 5 }).map((_, i) => <Skeleton key={i} className="h-10" />)}</div>
        ) : scheduledCalls?.length === 0 ? (
          <div className="px-4 py-10 text-center">
            <p className="text-sm text-muted-foreground mb-3">No calls scheduled yet</p>
            <Button size="sm" onClick={handleSchedule} data-testid="button-schedule-calls-empty">
              <Calendar className="w-4 h-4 mr-1.5" /> Schedule All Calls
            </Button>
          </div>
        ) : (
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-border bg-muted/40">
                <th className="text-left px-4 py-2.5 font-medium text-muted-foreground text-xs uppercase tracking-wide">Call Type</th>
                <th className="text-left px-4 py-2.5 font-medium text-muted-foreground text-xs uppercase tracking-wide">Scheduled At</th>
                <th className="text-left px-4 py-2.5 font-medium text-muted-foreground text-xs uppercase tracking-wide">Status</th>
                <th className="text-left px-4 py-2.5 font-medium text-muted-foreground text-xs uppercase tracking-wide">Attempts</th>
                <th className="text-right px-4 py-2.5 font-medium text-muted-foreground text-xs uppercase tracking-wide">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {scheduledCalls?.map(call => (
                <tr key={call.id} className="hover:bg-muted/20 transition-colors" data-testid={`row-scheduled-call-${call.id}`}>
                  <td className="px-4 py-2.5"><CallTypeBadge callType={call.callType} /></td>
                  <td className="px-4 py-2.5 text-muted-foreground">{formatters.datetime(call.scheduledAt)}</td>
                  <td className="px-4 py-2.5"><CallStatusBadge status={call.status} /></td>
                  <td className="px-4 py-2.5 text-muted-foreground">{call.attemptCount}</td>
                  <td className="px-4 py-2.5 text-right">
                    {call.status === "pending" && (
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() => handleTrigger(call.id)}
                        disabled={triggerCall.isPending}
                        data-testid={`button-trigger-call-${call.id}`}
                        className="h-7 text-xs"
                      >
                        <Phone className="w-3 h-3 mr-1" /> Trigger
                      </Button>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </div>
  );
}
