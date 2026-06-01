import { useMemo, useState } from "react";
import { Link } from "wouter";
import { useGetDashboardCalendar } from "@workspace/api-client-react";
import type { CalendarProcedure, CalendarCall } from "@workspace/api-client-react";
import { Skeleton } from "@/components/ui/skeleton";
import { Button } from "@/components/ui/button";
import { formatters } from "@/lib/formatters";
import { cn } from "@/lib/utils";
import { ChevronLeft, ChevronRight, CalendarDays, Plus } from "lucide-react";
import { ProcedureFormDialog } from "@/components/procedure-form-dialog";

const CALL_ORDER = ["pre_op_history", "pre_op_instructions", "post_op_24h", "post_op_72h", "post_op_2wk"] as const;

const STATUS_DOT: Record<string, { dot: string; label: string }> = {
  completed: { dot: "bg-emerald-500", label: "Completed" },
  in_progress: { dot: "bg-blue-500", label: "In progress" },
  pending: { dot: "bg-slate-300", label: "Pending" },
  no_answer: { dot: "bg-amber-500", label: "No answer" },
  failed: { dot: "bg-red-500", label: "Failed" },
  cancelled: { dot: "bg-gray-200 ring-1 ring-inset ring-gray-300", label: "Cancelled" },
};

const LEGEND: { status: string }[] = [
  { status: "completed" },
  { status: "pending" },
  { status: "in_progress" },
  { status: "no_answer" },
  { status: "failed" },
];

const DAY_NAMES = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];

function startOfWeek(d: Date): Date {
  const s = new Date(d);
  s.setHours(0, 0, 0, 0);
  s.setDate(s.getDate() - s.getDay());
  return s;
}

function toISODate(d: Date): string {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

function addDays(d: Date, n: number): Date {
  const r = new Date(d);
  r.setDate(r.getDate() + n);
  return r;
}

function sameDay(a: Date, b: Date): boolean {
  return a.getFullYear() === b.getFullYear() && a.getMonth() === b.getMonth() && a.getDate() === b.getDate();
}

function timeOf(dateStr: string): string {
  return new Date(dateStr).toLocaleTimeString("en-US", { hour: "numeric", minute: "2-digit" });
}

function CallDots({ calls }: { calls: CalendarCall[] }) {
  const ordered = [...calls].sort(
    (a, b) => CALL_ORDER.indexOf(a.callType as (typeof CALL_ORDER)[number]) - CALL_ORDER.indexOf(b.callType as (typeof CALL_ORDER)[number]),
  );
  const completed = ordered.filter(c => c.status === "completed").length;

  if (ordered.length === 0) {
    return <span className="text-[10px] text-muted-foreground">No calls</span>;
  }

  return (
    <div className="flex items-center justify-between gap-1.5">
      <div className="flex items-center gap-1">
        {ordered.map(c => {
          const meta = STATUS_DOT[c.status] ?? STATUS_DOT.pending;
          return (
            <span
              key={c.id}
              className={cn("h-2 w-2 rounded-full", meta.dot)}
              title={`${formatters.callType(c.callType)} — ${meta.label}`}
            />
          );
        })}
      </div>
      <span className="text-[10px] font-medium text-muted-foreground tabular-nums shrink-0">
        {completed}/{ordered.length}
      </span>
    </div>
  );
}

function ProcedureCard({ proc }: { proc: CalendarProcedure }) {
  const patient = (proc as CalendarProcedure & { patient?: { firstName: string; lastName: string } }).patient;
  const name = patient ? `${patient.firstName} ${patient.lastName}` : "Unknown patient";

  return (
    <Link
      href={`/patients/${proc.patientId}`}
      data-testid={`calendar-proc-${proc.id}`}
      className="block rounded-md border border-border bg-card px-2 py-1.5 hover:border-primary/50 hover:bg-muted/40 transition-colors"
    >
      <div className="flex items-center justify-between gap-1">
        <span className="text-[10px] font-medium text-muted-foreground tabular-nums">{timeOf(proc.scheduledDate)}</span>
      </div>
      <p className="text-xs font-semibold text-foreground truncate leading-tight">{name}</p>
      <p className="text-[11px] text-muted-foreground truncate leading-tight mb-1.5">{proc.procedureName}</p>
      <CallDots calls={proc.calls} />
    </Link>
  );
}

export function WeekCalendar() {
  const [weekStart, setWeekStart] = useState<Date>(() => startOfWeek(new Date()));
  const [scheduleDate, setScheduleDate] = useState<Date | null>(null);
  const { data, isLoading } = useGetDashboardCalendar({ weekStart: toISODate(weekStart) });

  const today = new Date();
  const weekEnd = addDays(weekStart, 6);

  const openSchedule = (date: Date) => {
    const d = new Date(date);
    d.setHours(8, 0, 0, 0);
    setScheduleDate(d);
  };

  const days = useMemo(() => {
    const buckets: { date: Date; procedures: CalendarProcedure[] }[] = Array.from({ length: 7 }, (_, i) => ({
      date: addDays(weekStart, i),
      procedures: [],
    }));
    for (const proc of data ?? []) {
      const d = new Date(proc.scheduledDate);
      const idx = Math.round((new Date(d.getFullYear(), d.getMonth(), d.getDate()).getTime() - weekStart.getTime()) / 86_400_000);
      if (idx >= 0 && idx < 7) buckets[idx].procedures.push(proc);
    }
    return buckets;
  }, [data, weekStart]);

  const total = data?.length ?? 0;

  const rangeLabel = `${weekStart.toLocaleDateString("en-US", { month: "short", day: "numeric" })} – ${weekEnd.toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" })}`;

  return (
    <div className="bg-card border border-card-border rounded-lg">
      <div className="px-4 py-3 border-b border-border flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-2 min-w-0">
          <CalendarDays className="w-4 h-4 text-muted-foreground shrink-0" />
          <h2 className="text-sm font-semibold text-foreground">Procedure Calendar</h2>
          <span className="text-xs text-muted-foreground truncate">· {rangeLabel}</span>
          {!isLoading && (
            <span className="text-xs text-muted-foreground hidden sm:inline">· {total} procedure{total === 1 ? "" : "s"}</span>
          )}
        </div>
        <div className="flex items-center gap-1">
          <Button variant="outline" size="sm" className="h-7 px-2" onClick={() => setWeekStart(w => addDays(w, -7))} data-testid="calendar-prev" aria-label="Previous week">
            <ChevronLeft className="w-4 h-4" />
          </Button>
          <Button variant="outline" size="sm" className="h-7 px-2.5 text-xs" onClick={() => setWeekStart(startOfWeek(new Date()))} data-testid="calendar-today">
            Today
          </Button>
          <Button variant="outline" size="sm" className="h-7 px-2" onClick={() => setWeekStart(w => addDays(w, 7))} data-testid="calendar-next" aria-label="Next week">
            <ChevronRight className="w-4 h-4" />
          </Button>
        </div>
      </div>

      {/* Legend */}
      <div className="px-4 py-2 border-b border-border flex flex-wrap items-center gap-x-4 gap-y-1">
        {LEGEND.map(({ status }) => {
          const meta = STATUS_DOT[status];
          return (
            <span key={status} className="inline-flex items-center gap-1.5 text-[11px] text-muted-foreground">
              <span className={cn("h-2 w-2 rounded-full", meta.dot)} />
              {meta.label}
            </span>
          );
        })}
      </div>

      {/* Week grid */}
      <div className="overflow-x-auto">
        <div className="grid grid-cols-7 min-w-[760px]">
          {days.map(({ date, procedures }) => {
            const isToday = sameDay(date, today);
            return (
              <div key={date.toISOString()} className="group/day border-r border-border last:border-r-0 min-h-[160px] flex flex-col">
                <div className={cn("relative px-2 py-1.5 text-center border-b border-border", isToday ? "bg-primary/10" : "bg-muted/30")}>
                  <p className="text-[10px] uppercase tracking-wide text-muted-foreground font-medium">{DAY_NAMES[date.getDay()]}</p>
                  <p className={cn("text-sm font-semibold tabular-nums", isToday ? "text-primary" : "text-foreground")}>{date.getDate()}</p>
                  <button
                    type="button"
                    onClick={() => openSchedule(date)}
                    data-testid={`calendar-add-${toISODate(date)}`}
                    aria-label={`Schedule procedure on ${date.toLocaleDateString("en-US", { weekday: "long", month: "long", day: "numeric" })}`}
                    title="Schedule procedure"
                    className="absolute top-1 right-1 inline-flex h-5 w-5 items-center justify-center rounded-md text-muted-foreground opacity-0 group-hover/day:opacity-100 focus:opacity-100 hover:bg-primary hover:text-primary-foreground transition-opacity"
                  >
                    <Plus className="h-3.5 w-3.5" />
                  </button>
                </div>
                <div className="p-1.5 space-y-1.5 flex-1">
                  {isLoading ? (
                    <Skeleton className="h-14 rounded-md" />
                  ) : (
                    procedures.map(proc => <ProcedureCard key={proc.id} proc={proc} />)
                  )}
                  {!isLoading && (
                    <button
                      type="button"
                      onClick={() => openSchedule(date)}
                      data-testid={`calendar-add-cell-${toISODate(date)}`}
                      className={cn(
                        "flex w-full items-center justify-center gap-1 rounded-md border border-dashed border-border/60 py-1.5 text-[11px] text-muted-foreground opacity-70 transition-colors hover:border-primary/40 hover:bg-muted/40 hover:text-foreground hover:opacity-100 focus:border-primary/40 focus:text-foreground focus:opacity-100",
                        procedures.length === 0 && "h-full min-h-[80px]",
                      )}
                      aria-label={`Schedule procedure on ${date.toLocaleDateString("en-US", { weekday: "long", month: "long", day: "numeric" })}`}
                    >
                      <Plus className="h-3 w-3" /> Add
                    </button>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      </div>

      <ProcedureFormDialog
        open={scheduleDate !== null}
        onOpenChange={(o) => { if (!o) setScheduleDate(null); }}
        defaultDate={scheduleDate ?? undefined}
      />
    </div>
  );
}
