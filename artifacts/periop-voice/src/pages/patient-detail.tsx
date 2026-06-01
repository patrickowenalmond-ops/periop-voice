import { useState } from "react";
import { useParams, Link } from "wouter";
import {
  useGetPatient,
  useGetPatientTimeline,
  getGetPatientTimelineQueryKey,
  useDeletePatient,
  useListProcedures,
  getListProceduresQueryKey,
} from "@workspace/api-client-react";
import { Skeleton } from "@/components/ui/skeleton";
import { Button } from "@/components/ui/button";
import { formatters } from "@/lib/formatters";
import { CallTypeBadge } from "@/components/status-badge";
import { PatientFormDialog } from "@/components/patient-form-dialog";
import { ProcedureFormDialog } from "@/components/procedure-form-dialog";
import { ArrowLeft, AlertTriangle, Clock, Pencil, Trash2, Phone, Mail, Calendar, Globe, IdCard, FileText, Stethoscope, ChevronRight } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { useLocation } from "wouter";

function initials(first?: string, last?: string): string {
  return `${(first?.[0] ?? "").toUpperCase()}${(last?.[0] ?? "").toUpperCase()}` || "?";
}

function ageFromDob(dob?: string | null): string | null {
  if (!dob) return null;
  const d = new Date(dob);
  if (Number.isNaN(d.getTime())) return null;
  const now = new Date();
  let age = now.getFullYear() - d.getFullYear();
  const m = now.getMonth() - d.getMonth();
  if (m < 0 || (m === 0 && now.getDate() < d.getDate())) age--;
  return age >= 0 && age < 150 ? `${age} yrs` : null;
}

function InfoRow({ icon: Icon, label, value }: { icon: React.ElementType; label: string; value: React.ReactNode }) {
  return (
    <div className="flex items-start gap-3 py-2.5">
      <Icon className="w-4 h-4 text-muted-foreground mt-0.5 shrink-0" />
      <div className="min-w-0 flex-1">
        <p className="text-[11px] uppercase tracking-wide text-muted-foreground font-medium">{label}</p>
        <p className="text-sm text-foreground font-medium break-words">{value}</p>
      </div>
    </div>
  );
}

export default function PatientDetail() {
  const { id } = useParams();
  const [, setLocation] = useLocation();
  const { toast } = useToast();
  const [showEdit, setShowEdit] = useState(false);
  const [editProcedureId, setEditProcedureId] = useState<number | null>(null);

  const patientId = Number(id);
  const { data: patient, isLoading } = useGetPatient(patientId);
  const { data: procedures, isLoading: proceduresLoading } = useListProcedures(
    { patientId } as any,
    { query: { queryKey: getListProceduresQueryKey({ patientId } as any) } },
  );
  const { data: timeline, isLoading: timelineLoading } = useGetPatientTimeline(patientId, {
    query: { queryKey: getGetPatientTimelineQueryKey(patientId) },
  });
  const deletePatient = useDeletePatient();

  const editingProcedure = procedures?.find((p) => p.id === editProcedureId) ?? null;

  const handleDelete = () => {
    if (!confirm("Delete this patient and all their records?")) return;
    deletePatient.mutate({ id: patientId } as any, {
      onSuccess: () => { toast({ title: "Patient deleted" }); setLocation("/patients"); },
      onError: () => toast({ title: "Failed to delete", variant: "destructive" }),
    });
  };

  if (isLoading) return <div className="p-6 max-w-4xl mx-auto"><Skeleton className="h-40 w-full rounded-lg" /></div>;
  if (!patient) return <div className="p-6 text-muted-foreground">Patient not found</div>;

  const age = ageFromDob(patient.dateOfBirth);

  return (
    <div className="p-6 max-w-4xl mx-auto">
      <Link href="/patients">
        <Button variant="ghost" size="sm" className="gap-1.5 mb-4 -ml-2 text-muted-foreground">
          <ArrowLeft className="w-4 h-4" /> Patients
        </Button>
      </Link>

      {/* Profile header */}
      <div className="bg-card border border-card-border rounded-lg p-5 mb-4">
        <div className="flex items-start gap-4">
          <div className="w-14 h-14 rounded-full bg-primary/10 text-primary flex items-center justify-center text-lg font-semibold shrink-0">
            {initials(patient.firstName, patient.lastName)}
          </div>
          <div className="flex-1 min-w-0">
            <h1 className="text-xl font-semibold text-foreground truncate">{patient.firstName} {patient.lastName}</h1>
            <div className="flex flex-wrap items-center gap-x-3 gap-y-1 mt-1 text-sm text-muted-foreground">
              {age && <span>{age}</span>}
              <span>MRN: {patient.mrn ?? "—"}</span>
              <span className="inline-flex items-center gap-1"><Phone className="w-3.5 h-3.5" />{patient.phone}</span>
            </div>
          </div>
          <div className="flex items-center gap-2 shrink-0">
            <Button variant="outline" size="sm" onClick={() => setShowEdit(true)} className="gap-1.5" data-testid="button-edit-patient">
              <Pencil className="w-3.5 h-3.5" /> Edit
            </Button>
            <Button variant="outline" size="sm" onClick={handleDelete} className="gap-1.5 text-destructive hover:text-destructive" data-testid="button-delete-patient">
              <Trash2 className="w-3.5 h-3.5" /> Delete
            </Button>
          </div>
        </div>
      </div>

      {/* Details */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-6">
        <div className="bg-card border border-card-border rounded-lg p-4">
          <h2 className="text-sm font-semibold text-foreground mb-1">Demographics & Contact</h2>
          <div className="divide-y divide-border">
            <InfoRow icon={Calendar} label="Date of Birth" value={patient.dateOfBirth ? formatters.date(patient.dateOfBirth) : "—"} />
            <InfoRow icon={Phone} label="Phone" value={patient.phone} />
            <InfoRow icon={Mail} label="Email" value={patient.email ?? "—"} />
            <InfoRow icon={Globe} label="Language" value={patient.language?.toUpperCase() ?? "EN"} />
            <InfoRow icon={IdCard} label="MRN" value={patient.mrn ?? "—"} />
            <InfoRow icon={IdCard} label="EHR ID" value={patient.ehrPatientId ?? "—"} />
          </div>
        </div>

        <div className="bg-card border border-card-border rounded-lg p-4">
          <h2 className="text-sm font-semibold text-foreground mb-1 flex items-center gap-1.5"><FileText className="w-4 h-4 text-muted-foreground" /> Notes</h2>
          {patient.notes ? (
            <p className="text-sm text-muted-foreground whitespace-pre-wrap pt-2">{patient.notes}</p>
          ) : (
            <p className="text-sm text-muted-foreground/70 italic pt-2">No notes yet. Use Edit to add notes.</p>
          )}
        </div>
      </div>

      <div className="flex items-center justify-between mb-3">
        <h2 className="text-sm font-semibold text-foreground flex items-center gap-1.5">
          <Stethoscope className="w-4 h-4 text-muted-foreground" /> Procedures
        </h2>
        <span className="text-xs text-muted-foreground">{procedures?.length ?? 0} total</span>
      </div>

      <div className="space-y-2 mb-6">
        {proceduresLoading ? (
          Array.from({ length: 2 }).map((_, i) => <Skeleton key={i} className="h-20 rounded-lg" />)
        ) : procedures?.length === 0 ? (
          <div className="bg-card border border-card-border rounded-lg px-4 py-8 text-center text-sm text-muted-foreground">
            No procedures scheduled for this patient.
          </div>
        ) : (
          procedures?.map((proc) => (
            <div key={proc.id} className="bg-card border border-card-border rounded-lg p-4" data-testid={`card-procedure-${proc.id}`}>
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0">
                  <Link href={`/procedures/${proc.id}`} className="text-sm font-semibold text-foreground hover:underline inline-flex items-center gap-1">
                    {proc.procedureName} <ChevronRight className="w-3.5 h-3.5 text-muted-foreground" />
                  </Link>
                  <div className="flex flex-wrap items-center gap-x-3 gap-y-1 mt-1.5 text-xs text-muted-foreground">
                    <span className="inline-flex items-center gap-1">
                      <Calendar className="w-3.5 h-3.5" />
                      {proc.scheduledDate ? formatters.datetime(proc.scheduledDate) : "—"}
                    </span>
                    {proc.facility && <span>{proc.facility}</span>}
                    {proc.surgeon && <span>Dr. {proc.surgeon}</span>}
                    {proc.arrivalTime && <span>Arrive {proc.arrivalTime}</span>}
                  </div>
                  {proc.specialInstructions && (
                    <p className="text-xs text-amber-800 bg-amber-50 border border-amber-200 rounded px-2 py-1 mt-2">
                      {proc.specialInstructions}
                    </p>
                  )}
                </div>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setEditProcedureId(proc.id)}
                  className="gap-1.5 shrink-0"
                  data-testid={`button-edit-procedure-${proc.id}`}
                >
                  <Pencil className="w-3.5 h-3.5" /> Edit
                </Button>
              </div>
            </div>
          ))
        )}
      </div>

      <div className="flex items-center justify-between mb-3">
        <h2 className="text-sm font-semibold text-foreground">Call Timeline</h2>
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

      <PatientFormDialog
        open={showEdit}
        onOpenChange={setShowEdit}
        patient={patient as any}
      />

      <ProcedureFormDialog
        open={editProcedureId !== null}
        onOpenChange={(o) => { if (!o) setEditProcedureId(null); }}
        procedure={editingProcedure as any}
      />
    </div>
  );
}
