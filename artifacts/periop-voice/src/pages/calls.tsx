import { useState } from "react";
import { useListScheduledCalls, useTriggerCall, useUpdateScheduledCall, getListScheduledCallsQueryKey } from "@workspace/api-client-react";
import { Link } from "wouter";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Skeleton } from "@/components/ui/skeleton";
import { formatters } from "@/lib/formatters";
import { CallTypeBadge, CallStatusBadge } from "@/components/status-badge";
import { Phone, X } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { useQueryClient } from "@tanstack/react-query";

export default function CallsPage() {
  const [status, setStatus] = useState<string>("all");
  const [callType, setCallType] = useState<string>("all");
  const { toast } = useToast();
  const qc = useQueryClient();

  const queryParams: Record<string, unknown> = { limit: 100 };
  if (status !== "all") queryParams.status = status;
  if (callType !== "all") queryParams.callType = callType;

  const { data: calls, isLoading } = useListScheduledCalls(queryParams as any, {
    query: { queryKey: getListScheduledCallsQueryKey(queryParams as any) },
  });

  const triggerCall = useTriggerCall();
  const updateCall = useUpdateScheduledCall();

  const handleTrigger = (id: number) => {
    triggerCall.mutate({ id } as any, {
      onSuccess: () => {
        toast({ title: "Call triggered" });
        qc.invalidateQueries({ queryKey: getListScheduledCallsQueryKey(queryParams as any) });
      },
      onError: () => toast({ title: "Failed to trigger", variant: "destructive" }),
    });
  };

  const handleCancel = (id: number) => {
    if (!confirm("Cancel this scheduled call?")) return;
    updateCall.mutate({ id, data: { status: "cancelled" } } as any, {
      onSuccess: () => {
        toast({ title: "Call cancelled" });
        qc.invalidateQueries({ queryKey: getListScheduledCallsQueryKey(queryParams as any) });
      },
      onError: () => toast({ title: "Failed to cancel", variant: "destructive" }),
    });
  };

  return (
    <div className="p-6 max-w-7xl mx-auto">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-xl font-semibold text-foreground">Call Queue</h1>
          <p className="text-sm text-muted-foreground mt-0.5">{calls?.length ?? 0} calls</p>
        </div>
      </div>

      <div className="flex gap-3 mb-4">
        <Select value={status} onValueChange={setStatus}>
          <SelectTrigger className="w-40" data-testid="select-status">
            <SelectValue placeholder="Status" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Statuses</SelectItem>
            <SelectItem value="pending">Pending</SelectItem>
            <SelectItem value="in_progress">In Progress</SelectItem>
            <SelectItem value="completed">Completed</SelectItem>
            <SelectItem value="failed">Failed</SelectItem>
            <SelectItem value="no_answer">No Answer</SelectItem>
            <SelectItem value="cancelled">Cancelled</SelectItem>
          </SelectContent>
        </Select>

        <Select value={callType} onValueChange={setCallType}>
          <SelectTrigger className="w-48" data-testid="select-call-type">
            <SelectValue placeholder="Call Type" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Types</SelectItem>
            <SelectItem value="pre_op_history">Pre-Op History</SelectItem>
            <SelectItem value="pre_op_instructions">Pre-Op Instructions</SelectItem>
            <SelectItem value="post_op_24h">24h Post-Op</SelectItem>
            <SelectItem value="post_op_72h">72h Post-Op</SelectItem>
            <SelectItem value="post_op_2wk">2-Week Follow-Up</SelectItem>
          </SelectContent>
        </Select>
      </div>

      <div className="bg-card border border-card-border rounded-lg overflow-hidden">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-border bg-muted/40">
              <th className="text-left px-4 py-2.5 font-medium text-muted-foreground text-xs uppercase tracking-wide">Patient</th>
              <th className="text-left px-4 py-2.5 font-medium text-muted-foreground text-xs uppercase tracking-wide">Type</th>
              <th className="text-left px-4 py-2.5 font-medium text-muted-foreground text-xs uppercase tracking-wide">Scheduled</th>
              <th className="text-left px-4 py-2.5 font-medium text-muted-foreground text-xs uppercase tracking-wide">Status</th>
              <th className="text-left px-4 py-2.5 font-medium text-muted-foreground text-xs uppercase tracking-wide">Attempts</th>
              <th className="text-right px-4 py-2.5 font-medium text-muted-foreground text-xs uppercase tracking-wide">Actions</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-border">
            {isLoading ? (
              Array.from({ length: 6 }).map((_, i) => (
                <tr key={i}><td colSpan={6} className="px-4 py-3"><Skeleton className="h-5 w-full" /></td></tr>
              ))
            ) : calls?.length === 0 ? (
              <tr><td colSpan={6} className="px-4 py-10 text-center text-muted-foreground">No calls found</td></tr>
            ) : (
              calls?.map(call => (
                <tr key={call.id} className="hover:bg-muted/20 transition-colors" data-testid={`row-call-${call.id}`}>
                  <td className="px-4 py-2.5">
                    <Link href={`/patients/${call.patientId}`} className="font-medium text-foreground hover:text-primary transition-colors">
                      {(call as any).patient?.firstName} {(call as any).patient?.lastName}
                    </Link>
                  </td>
                  <td className="px-4 py-2.5"><CallTypeBadge callType={call.callType} /></td>
                  <td className="px-4 py-2.5 text-muted-foreground">{formatters.datetime(call.scheduledAt)}</td>
                  <td className="px-4 py-2.5"><CallStatusBadge status={call.status} /></td>
                  <td className="px-4 py-2.5 text-muted-foreground">{call.attemptCount}</td>
                  <td className="px-4 py-2.5 text-right flex items-center justify-end gap-2">
                    {call.status === "pending" && (
                      <>
                        <Button size="sm" variant="outline" onClick={() => handleTrigger(call.id)} disabled={triggerCall.isPending} className="h-7 text-xs" data-testid={`button-trigger-${call.id}`}>
                          <Phone className="w-3 h-3 mr-1" /> Call
                        </Button>
                        <Button size="sm" variant="ghost" onClick={() => handleCancel(call.id)} disabled={updateCall.isPending} className="h-7 text-xs text-muted-foreground" data-testid={`button-cancel-${call.id}`}>
                          <X className="w-3 h-3" />
                        </Button>
                      </>
                    )}
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
