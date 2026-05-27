import { useParams, Link } from "wouter";
import { useGetPatient, useGetPatientTimeline, getGetPatientTimelineQueryKey, useDeletePatient } from "@workspace/api-client-react";
import { Skeleton } from "@/components/ui/skeleton";
import { Button } from "@/components/ui/button";
import { formatters } from "@/lib/formatters";
import { CallTypeBadge } from "@/components/status-badge";
import { ArrowLeft, Phone, AlertTriangle, Clock } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { useLocation } from "wouter";

export default function PatientDetail() {
  const { id } = useParams();
  const [, setLocation] = useLocation();
  const { toast } = useToast();

  const patientId = Number(id);
  const { data: patient, isLoading } = useGetPatient(patientId);
  const { data: timeline, isLoading: timelineLoading } = useGetPatientTimeline(patientId, {
    query: { queryKey: getGetPatientTimelineQueryKey(patientId) },
  });
  const deletePatient = useDeletePatient();

  const handleDelete = () => {
    if (!confirm("Delete this patient and all their records?")) return;
    deletePatient.mutate({ id: patientId } as any, {
      onSuccess: () => { toast({ title: "Patient deleted" }); setLocation("/patients"); },
      onError: () => toast({ title: "Failed to delete", variant: "destructive" }),
    });
  };

  if (isLoading) return <div className="p-6"><Skeleton className="h-40 w-full" /></div>;
  if (!patient) return <div className="p-6 text-muted-foreground">Patient not found</div>;

  return (
    <div className="p-6 max-w-4xl mx-auto">
      <div className="flex items-center gap-3 mb-6">
        <Link href="/patients">
          <Button variant="ghost" size="sm" className="gap-1.5">
            <ArrowLeft className="w-4 h-4" /> Patients
          </Button>
        </Link>
        <div className="flex-1">
          <h1 className="text-xl font-semibold text-foreground">{patient.firstName} {patient.lastName}</h1>
          <p className="text-sm text-muted-foreground">MRN: {patient.mrn ?? "—"}</p>
        </div>
        <Button variant="outline" size="sm" onClick={handleDelete} className="text-destructive hover:text-destructive" data-testid="button-delete-patient">
          Delete
        </Button>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-6">
        <div className="bg-card border border-card-border rounded-lg p-4">
          <h2 className="text-sm font-semibold text-foreground mb-3">Demographics</h2>
          <dl className="space-y-2">
            {[
              ["Date of Birth", patient.dateOfBirth ? formatters.date(patient.dateOfBirth) : "—"],
              ["Phone", patient.phone],
              ["Email", patient.email ?? "—"],
              ["Language", patient.language?.toUpperCase() ?? "EN"],
              ["EHR ID", patient.ehrPatientId ?? "—"],
            ].map(([label, value]) => (
              <div key={label} className="flex justify-between text-sm">
                <dt className="text-muted-foreground">{label}</dt>
                <dd className="text-foreground font-medium">{value}</dd>
              </div>
            ))}
          </dl>
        </div>

        {patient.notes && (
          <div className="bg-card border border-card-border rounded-lg p-4">
            <h2 className="text-sm font-semibold text-foreground mb-3">Notes</h2>
            <p className="text-sm text-muted-foreground whitespace-pre-wrap">{patient.notes}</p>
          </div>
        )}
      </div>

      <div className="flex items-center justify-between mb-3">
        <h2 className="text-sm font-semibold text-foreground">Call Timeline</h2>
        <Link href={`/procedures?patientId=${patientId}`} className="text-xs text-primary hover:underline">
          View procedures
        </Link>
      </div>

      <div className="bg-card border border-card-border rounded-lg overflow-hidden">
        {timelineLoading ? (
          <div className="p-4 space-y-2">{Array.from({ length: 3 }).map((_, i) => <Skeleton key={i} className="h-12" />)}</div>
        ) : timeline?.length === 0 ? (
          <div className="px-4 py-10 text-center text-sm text-muted-foreground">No call records yet</div>
        ) : (
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-border bg-muted/40">
                <th className="text-left px-4 py-2.5 font-medium text-muted-foreground text-xs uppercase tracking-wide">Type</th>
                <th className="text-left px-4 py-2.5 font-medium text-muted-foreground text-xs uppercase tracking-wide">Date</th>
                <th className="text-left px-4 py-2.5 font-medium text-muted-foreground text-xs uppercase tracking-wide">Outcome</th>
                <th className="text-left px-4 py-2.5 font-medium text-muted-foreground text-xs uppercase tracking-wide">Duration</th>
                <th className="text-left px-4 py-2.5 font-medium text-muted-foreground text-xs uppercase tracking-wide">Flags</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {timeline?.map(record => (
                <tr key={record.id} className="hover:bg-muted/20 transition-colors" data-testid={`row-timeline-${record.id}`}>
                  <td className="px-4 py-2.5"><CallTypeBadge callType={record.callType} /></td>
                  <td className="px-4 py-2.5 text-muted-foreground">{formatters.datetime(record.startedAt)}</td>
                  <td className="px-4 py-2.5 text-foreground capitalize">{record.outcome ?? "—"}</td>
                  <td className="px-4 py-2.5 text-muted-foreground flex items-center gap-1">
                    <Clock className="w-3 h-3" />
                    {record.durationSeconds ? formatters.duration(record.durationSeconds) : "—"}
                  </td>
                  <td className="px-4 py-2.5">
                    <Link href={`/call-records/${record.id}`}>
                      {(record as any).hasFlags ? (
                        <span className="inline-flex items-center gap-1 text-xs text-red-600 hover:underline">
                          <AlertTriangle className="w-3 h-3" /> View
                        </span>
                      ) : (
                        <span className="text-xs text-muted-foreground hover:underline">View</span>
                      )}
                    </Link>
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
