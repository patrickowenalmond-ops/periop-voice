import { useGetDashboardSummary, useGetCallsToday, useGetRecentActivity } from "@workspace/api-client-react";
import { Skeleton } from "@/components/ui/skeleton";
import { Link } from "wouter";
import { formatters } from "@/lib/formatters";
import { CallStatusBadge, CallTypeBadge } from "@/components/status-badge";
import { Phone, Bell, Users, CheckCircle, Activity, Calendar, PhoneCall, AlertTriangle } from "lucide-react";

function StatCard({ label, value, icon: Icon, sub, className }: { label: string; value: string | number; icon: React.ElementType; sub?: string; className?: string }) {
  return (
    <div className={`bg-card border border-card-border rounded-lg p-4 ${className ?? ""}`}>
      <div className="flex items-start justify-between">
        <div>
          <p className="text-xs text-muted-foreground font-medium uppercase tracking-wide">{label}</p>
          <p className="text-2xl font-bold text-foreground mt-1" data-testid={`stat-${label.toLowerCase().replace(/\s/g, "-")}`}>{value}</p>
          {sub && <p className="text-xs text-muted-foreground mt-0.5">{sub}</p>}
        </div>
        <div className="p-2 bg-muted rounded-md">
          <Icon className="w-4 h-4 text-muted-foreground" />
        </div>
      </div>
    </div>
  );
}

export default function Dashboard() {
  const { data: summary, isLoading: sumLoading } = useGetDashboardSummary();
  const { data: callsToday, isLoading: callsLoading } = useGetCallsToday();
  const { data: activity, isLoading: actLoading } = useGetRecentActivity({ limit: 15 });

  return (
    <div className="p-6 max-w-7xl mx-auto">
      <div className="mb-6">
        <h1 className="text-xl font-semibold text-foreground">Dashboard</h1>
        <p className="text-sm text-muted-foreground mt-0.5">Peri-operative call operations overview</p>
      </div>

      {/* Stats grid */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 mb-6">
        {sumLoading ? (
          Array.from({ length: 8 }).map((_, i) => <Skeleton key={i} className="h-20 rounded-lg" />)
        ) : (
          <>
            <StatCard label="Pending Today" value={summary?.pendingCallsToday ?? 0} icon={Phone} />
            <StatCard label="Active Now" value={summary?.activeCallsNow ?? 0} icon={PhoneCall} />
            <StatCard label="Completed Today" value={summary?.completedToday ?? 0} icon={CheckCircle} />
            <StatCard label="Completion Rate" value={`${Math.round((summary?.callCompletionRate ?? 0) * 100)}%`} icon={Activity} />
            <StatCard label="Unresolved Alerts" value={summary?.unresolvedAlerts ?? 0} icon={Bell} className={summary?.criticalAlerts ? "border-red-200 bg-red-50" : ""} />
            <StatCard label="Critical Alerts" value={summary?.criticalAlerts ?? 0} icon={AlertTriangle} className={summary?.criticalAlerts ? "border-red-200 bg-red-50" : ""} />
            <StatCard label="Total Patients" value={summary?.totalPatients ?? 0} icon={Users} />
            <StatCard label="Procedures This Week" value={summary?.proceduresThisWeek ?? 0} icon={Calendar} />
          </>
        )}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        {/* Today's call queue */}
        <div className="bg-card border border-card-border rounded-lg">
          <div className="px-4 py-3 border-b border-border flex items-center justify-between">
            <h2 className="text-sm font-semibold text-foreground">Today's Call Queue</h2>
            <Link href="/calls" className="text-xs text-primary hover:underline">View all</Link>
          </div>
          <div className="divide-y divide-border">
            {callsLoading ? (
              Array.from({ length: 4 }).map((_, i) => <div key={i} className="px-4 py-3"><Skeleton className="h-10" /></div>)
            ) : callsToday?.length === 0 ? (
              <div className="px-4 py-8 text-center text-sm text-muted-foreground">No calls scheduled today</div>
            ) : (
              callsToday?.slice(0, 8).map(call => (
                <div key={call.id} className="px-4 py-2.5 flex items-center justify-between hover:bg-muted/30 transition-colors" data-testid={`call-today-${call.id}`}>
                  <div className="min-w-0 mr-3">
                    <p className="text-sm font-medium text-foreground truncate">
                      {(call as any).patient?.firstName} {(call as any).patient?.lastName}
                    </p>
                    <p className="text-xs text-muted-foreground">{formatters.datetime(call.scheduledAt)}</p>
                  </div>
                  <div className="flex items-center gap-2 shrink-0">
                    <CallTypeBadge callType={call.callType} />
                    <CallStatusBadge status={call.status} />
                  </div>
                </div>
              ))
            )}
          </div>
        </div>

        {/* Recent activity */}
        <div className="bg-card border border-card-border rounded-lg">
          <div className="px-4 py-3 border-b border-border flex items-center justify-between">
            <h2 className="text-sm font-semibold text-foreground">Recent Call Activity</h2>
            <Link href="/calls" className="text-xs text-primary hover:underline">View all</Link>
          </div>
          <div className="divide-y divide-border">
            {actLoading ? (
              Array.from({ length: 4 }).map((_, i) => <div key={i} className="px-4 py-3"><Skeleton className="h-10" /></div>)
            ) : activity?.length === 0 ? (
              <div className="px-4 py-8 text-center text-sm text-muted-foreground">No recent call activity</div>
            ) : (
              activity?.slice(0, 8).map(record => (
                <Link
                  key={record.id}
                  href={`/call-records/${record.id}`}
                  data-testid={`activity-record-${record.id}`}
                  className="px-4 py-2.5 flex items-center justify-between hover:bg-muted/30 transition-colors block"
                >
                  <div className="min-w-0 mr-3">
                    <p className="text-sm font-medium text-foreground truncate">
                      {(record as any).patient?.firstName} {(record as any).patient?.lastName}
                    </p>
                    <p className="text-xs text-muted-foreground">{formatters.datetime(record.startedAt)}</p>
                  </div>
                  <div className="flex items-center gap-2 shrink-0">
                    <CallTypeBadge callType={record.callType} />
                    {(record as any).hasFlags && (
                      <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-xs font-medium bg-red-50 text-red-700 border border-red-100">
                        <AlertTriangle className="w-3 h-3" /> Flags
                      </span>
                    )}
                  </div>
                </Link>
              ))
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
