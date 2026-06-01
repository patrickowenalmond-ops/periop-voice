import { useEffect, useState } from "react";
import {
  useCreateProcedure,
  useUpdateProcedure,
  useScheduleProcedureCalls,
  getListProceduresQueryKey,
  getGetProcedureQueryKey,
  getGetDashboardCalendarQueryKey,
  useListPatients,
} from "@workspace/api-client-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { useToast } from "@/hooks/use-toast";
import { useQueryClient } from "@tanstack/react-query";
import { UserPlus } from "lucide-react";
import { PatientFormDialog } from "@/components/patient-form-dialog";

const procedureSchema = z.object({
  patientId: z.string().min(1, "Required"),
  procedureName: z.string().min(1, "Required"),
  scheduledDate: z.string().min(1, "Required"),
  facility: z.string().optional(),
  surgeon: z.string().optional(),
  arrivalTime: z.string().optional(),
  specialInstructions: z.string().optional(),
});

type ProcedureForm = z.infer<typeof procedureSchema>;

function toDateTimeLocal(d: Date): string {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  const hh = String(d.getHours()).padStart(2, "0");
  const mm = String(d.getMinutes()).padStart(2, "0");
  return `${y}-${m}-${day}T${hh}:${mm}`;
}

const emptyDefaults: ProcedureForm = {
  patientId: "",
  procedureName: "",
  scheduledDate: "",
  facility: "",
  surgeon: "",
  arrivalTime: "",
  specialInstructions: "",
};

type EditableProcedure = {
  id: number;
  patientId: number;
  procedureName: string;
  scheduledDate: string;
  facility?: string | null;
  surgeon?: string | null;
  arrivalTime?: string | null;
  specialInstructions?: string | null;
};

export function ProcedureFormDialog({
  open,
  onOpenChange,
  defaultDate,
  onCreated,
  procedure,
  onUpdated,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  defaultDate?: Date;
  onCreated?: () => void;
  procedure?: EditableProcedure;
  onUpdated?: () => void;
}) {
  const { toast } = useToast();
  const qc = useQueryClient();
  const [showNewPatient, setShowNewPatient] = useState(false);
  const [extraPatients, setExtraPatients] = useState<{ id: number; firstName: string; lastName: string }[]>([]);
  const isEdit = !!procedure;

  const { data: patients } = useListPatients({ limit: 200 } as any);
  const createProcedure = useCreateProcedure();
  const updateProcedure = useUpdateProcedure();
  const scheduleCalls = useScheduleProcedureCalls();

  // Merge any just-created patient(s) into the options so the auto-selected
  // patient shows immediately, before the list query refetch catches up.
  const patientOptions = (() => {
    const byId = new Map<number, { id: number; firstName: string; lastName: string }>();
    for (const p of patients ?? []) byId.set(p.id, p);
    for (const p of extraPatients) byId.set(p.id, p);
    return Array.from(byId.values()).sort((a, b) =>
      `${a.lastName}${a.firstName}`.localeCompare(`${b.lastName}${b.firstName}`),
    );
  })();

  const form = useForm<ProcedureForm>({
    resolver: zodResolver(procedureSchema),
    defaultValues: emptyDefaults,
  });

  // Prefill on open. In edit mode, populate from the procedure (keyed on its
  // stable id so a background refetch can't wipe in-progress edits). In create
  // mode, prefill the date if one was supplied (e.g. a tapped calendar day).
  useEffect(() => {
    if (open) {
      if (procedure) {
        form.reset({
          patientId: String(procedure.patientId),
          procedureName: procedure.procedureName,
          scheduledDate: procedure.scheduledDate ? toDateTimeLocal(new Date(procedure.scheduledDate)) : "",
          facility: procedure.facility ?? "",
          surgeon: procedure.surgeon ?? "",
          arrivalTime: procedure.arrivalTime ?? "",
          specialInstructions: procedure.specialInstructions ?? "",
        });
      } else {
        form.reset({
          ...emptyDefaults,
          scheduledDate: defaultDate ? toDateTimeLocal(defaultDate) : "",
        });
      }
      setExtraPatients([]);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, defaultDate, procedure?.id]);

  const onSubmit = (data: ProcedureForm) => {
    if (isEdit && procedure) {
      // patientId is not editable via the update API; omit it.
      const { patientId: _patientId, ...rest } = data;
      updateProcedure.mutate(
        { id: procedure.id, data: { ...rest, scheduledDate: new Date(data.scheduledDate).toISOString() } } as any,
        {
          onSuccess: () => {
            toast({ title: "Procedure updated" });
            qc.invalidateQueries({ queryKey: getListProceduresQueryKey() });
            qc.invalidateQueries({ queryKey: getGetProcedureQueryKey(procedure.id) });
            qc.invalidateQueries({ queryKey: getGetDashboardCalendarQueryKey() });
            onOpenChange(false);
            onUpdated?.();
          },
          onError: () => toast({ title: "Failed to update procedure", variant: "destructive" }),
        }
      );
      return;
    }
    createProcedure.mutate(
      { data: { ...data, patientId: Number(data.patientId), scheduledDate: new Date(data.scheduledDate).toISOString() } } as any,
      {
        onSuccess: (proc) => {
          toast({ title: "Procedure created" });
          qc.invalidateQueries({ queryKey: getListProceduresQueryKey() });
          qc.invalidateQueries({ queryKey: getGetDashboardCalendarQueryKey() });
          scheduleCalls.mutate({ procedureId: (proc as any).id } as any, {
            onSuccess: () => {
              toast({ title: "Calls auto-scheduled" });
              qc.invalidateQueries({ queryKey: getGetDashboardCalendarQueryKey() });
            },
            onError: () =>
              toast({
                title: "Procedure created, but call scheduling failed",
                description: "Open the procedure to schedule its calls manually.",
                variant: "destructive",
              }),
          });
          onOpenChange(false);
          form.reset(emptyDefaults);
          onCreated?.();
        },
        onError: () => toast({ title: "Failed to create procedure", variant: "destructive" }),
      }
    );
  };

  return (
    <>
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg">
        <DialogHeader><DialogTitle>{isEdit ? "Edit Procedure" : "New Procedure"}</DialogTitle></DialogHeader>
        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-3">
            <FormField control={form.control} name="patientId" render={({ field }) => (
              <FormItem>
                <div className="flex items-center justify-between">
                  <FormLabel>Patient</FormLabel>
                  {!isEdit && (
                    <button
                      type="button"
                      onClick={() => setShowNewPatient(true)}
                      data-testid="button-new-patient-inline"
                      className="inline-flex items-center gap-1 text-xs font-medium text-primary hover:underline"
                    >
                      <UserPlus className="h-3 w-3" /> New patient
                    </button>
                  )}
                </div>
                <Select onValueChange={field.onChange} value={field.value} disabled={isEdit}>
                  <FormControl>
                    <SelectTrigger data-testid="select-patient">
                      <SelectValue placeholder="Select patient..." />
                    </SelectTrigger>
                  </FormControl>
                  <SelectContent>
                    {patientOptions.map(p => (
                      <SelectItem key={p.id} value={String(p.id)}>{p.lastName}, {p.firstName}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <FormMessage />
              </FormItem>
            )} />
            <FormField control={form.control} name="procedureName" render={({ field }) => (
              <FormItem>
                <FormLabel>Procedure Name</FormLabel>
                <FormControl><Input {...field} data-testid="input-procedure-name" placeholder="e.g. Total Knee Arthroplasty" /></FormControl>
                <FormMessage />
              </FormItem>
            )} />
            <div className="grid grid-cols-2 gap-3">
              <FormField control={form.control} name="scheduledDate" render={({ field }) => (
                <FormItem>
                  <FormLabel>Scheduled Date/Time</FormLabel>
                  <FormControl><Input type="datetime-local" {...field} data-testid="input-scheduled-date" /></FormControl>
                  <FormMessage />
                </FormItem>
              )} />
              <FormField control={form.control} name="arrivalTime" render={({ field }) => (
                <FormItem>
                  <FormLabel>Arrival Time</FormLabel>
                  <FormControl><Input {...field} placeholder="e.g. 6:00 AM" data-testid="input-arrival-time" /></FormControl>
                  <FormMessage />
                </FormItem>
              )} />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <FormField control={form.control} name="facility" render={({ field }) => (
                <FormItem>
                  <FormLabel>Facility</FormLabel>
                  <FormControl><Input {...field} data-testid="input-facility" /></FormControl>
                  <FormMessage />
                </FormItem>
              )} />
              <FormField control={form.control} name="surgeon" render={({ field }) => (
                <FormItem>
                  <FormLabel>Surgeon</FormLabel>
                  <FormControl><Input {...field} data-testid="input-surgeon" /></FormControl>
                  <FormMessage />
                </FormItem>
              )} />
            </div>
            <FormField control={form.control} name="specialInstructions" render={({ field }) => (
              <FormItem>
                <FormLabel>Special Instructions</FormLabel>
                <FormControl><Input {...field} data-testid="input-special-instructions" /></FormControl>
                <FormMessage />
              </FormItem>
            )} />
            <DialogFooter>
              <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>Cancel</Button>
              <Button type="submit" disabled={createProcedure.isPending || updateProcedure.isPending} data-testid="button-submit-procedure">
                {isEdit
                  ? (updateProcedure.isPending ? "Saving..." : "Save Changes")
                  : (createProcedure.isPending ? "Creating..." : "Create & Schedule Calls")}
              </Button>
            </DialogFooter>
          </form>
        </Form>
      </DialogContent>
    </Dialog>

    <PatientFormDialog
      open={showNewPatient}
      onOpenChange={setShowNewPatient}
      onCreated={(patient) => {
        setExtraPatients((prev) => [...prev.filter((p) => p.id !== patient.id), patient]);
        form.setValue("patientId", String(patient.id), { shouldValidate: true });
        toast({ title: "Patient added", description: `${patient.firstName} ${patient.lastName} selected.` });
      }}
    />
    </>
  );
}
