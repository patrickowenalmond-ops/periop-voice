import { useState } from "react";
import { useListAlerts, useAcknowledgeAlert, getListAlertsQueryKey } from "@workspace/api-client-react";
import { Link } from "wouter";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Skeleton } from "@/components/ui/skeleton";
import { formatters } from "@/lib/formatters";
import { SeverityBadge } from "@/components/status-badge";
import { CheckCheck } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { useQueryClient } from "@tanstack/react-query";

export default function AlertsPage() {
  const [severity, setSeverity] = useState<string>("all");
  const [acknowledged, setAcknowledged] = useState<string>("unresolved");
  const { toast } = useToast();
  const qc = useQueryClient();

  const queryParams: Record<string, unknown> = { limit: 100 };
  if (severity !== "all") queryParams.severity = severity;
  if (acknowledged !== "all") queryParams.acknowledged = acknowledged === "resolved";

  const { data: alerts, isLoading } = useListAlerts(queryParams as any, {
    query: { queryKey: getListAlertsQueryKey(queryParams as any) },
  });

  const acknowledge = useAcknowledgeAlert();

  const handleAcknowledge = (id: number) => {
    acknowledge.mutate({ id } as any, {
      onSuccess: () => {
        toast({ title: "Alert acknowledged" });
        qc.invalidateQueries({ queryKey: getListAlertsQueryKey(queryParams as any) });
        qc.invalidateQueries({ queryKey: getListAlertsQueryKey({ acknowledged: false } as any) });
      },
      onError: () => toast({ title: "Failed to acknowledge", variant: "destructive" }),
    });
  };

  return (
    <div className="p-6 max-w-6xl mx-auto">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-xl font-semibold text-foreground">Clinical Alerts</h1>
          <p className="text-sm text-muted-foreground mt-0.5">{alerts?.length ?? 0} alerts</p>
        </div>
      </div>

      <div className="flex gap-3 mb-4">
        <Select value={acknowledged} onValueChange={setAcknowledged}>
          <SelectTrigger className="w-44" data-testid="select-acknowledged">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="unresolved">Unresolved</SelectItem>
            <SelectItem value="resolved">Resolved</SelectItem>
            <SelectItem value="all">All Alerts</SelectItem>
          </SelectContent>
        </Select>

        <Select value={severity} onValueChange={setSeverity}>
          <SelectTrigger className="w-36" data-testid="select-severity">
            <SelectValue placeholder="Severity" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Severities</SelectItem>
            <SelectItem value="critical">Critical</SelectItem>
            <SelectItem value="high">High</SelectItem>
            <SelectItem value="medium">Medium</SelectItem>
            <SelectItem value="low">Low</SelectItem>
          </SelectContent>
        </Select>
      </div>

      <div className="space-y-2">
        {isLoading ? (
          Array.from({ length: 4 }).map((_, i) => <Skeleton key={i} className="h-20 w-full rounded-lg" />)
        ) : alerts?.length === 0 ? (
          <div className="bg-card border border-card-border rounded-lg px-4 py-12 text-center text-muted-foreground">
            No alerts found
          </div>
        ) : (
          alerts?.map(alert => {
            const ack = (alert as any).acknowledged === true;
            return (
              <div
                key={alert.id}
                data-testid={`alert-${alert.id}`}
                className={`bg-card border rounded-lg p-4 flex items-start justify-between gap-4 ${ack ? "opacity-60 border-card-border" : alert.severity === "critical" ? "border-red-200" : alert.severity === "high" ? "border-orange-200" : "border-card-border"}`}
              >
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 mb-1">
                    <SeverityBadge severity={alert.severity} />
                    <span className="text-xs text-muted-foreground font-medium">{alert.category}</span>
                    <span className="text-xs text-muted-foreground">·</span>
                    <Link href={`/patients/${alert.patientId}`} className="text-xs text-primary hover:underline">
                      {(alert as any).patient?.firstName} {(alert as any).patient?.lastName}
                    </Link>
                  </div>
                  <p className="text-sm text-foreground font-medium">{alert.description}</p>
                  {alert.recommendedAction && (
                    <p className="text-xs text-muted-foreground mt-1">Recommended: {alert.recommendedAction}</p>
                  )}
                  <p className="text-xs text-muted-foreground mt-1">{formatters.datetime(alert.createdAt)}</p>
                </div>
                <div className="flex items-center gap-2 shrink-0">
                  <Link href={`/call-records/${alert.callRecordId}`} className="text-xs text-primary hover:underline">
                    View call
                  </Link>
                  {!ack && (
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() => handleAcknowledge(alert.id)}
                      disabled={acknowledge.isPending}
                      data-testid={`button-acknowledge-${alert.id}`}
                      className="h-7 text-xs"
                    >
                      <CheckCheck className="w-3 h-3 mr-1" /> Acknowledge
                    </Button>
                  )}
                </div>
              </div>
            );
          })
        )}
      </div>
    </div>
  );
}
