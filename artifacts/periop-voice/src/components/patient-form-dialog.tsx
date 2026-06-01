import { useEffect } from "react";
import {
  useCreatePatient,
  useUpdatePatient,
  getListPatientsQueryKey,
  getGetPatientQueryKey,
} from "@workspace/api-client-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Form, FormControl, FormDescription, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { useToast } from "@/hooks/use-toast";
import { useQueryClient } from "@tanstack/react-query";

const patientSchema = z.object({
  firstName: z.string().min(1, "Required"),
  lastName: z.string().min(1, "Required"),
  dateOfBirth: z.string().min(1, "Required"),
  phone: z.string().min(1, "Required"),
  email: z.string().email().optional().or(z.literal("")),
  mrn: z.string().optional(),
  language: z.string().optional(),
  notes: z.string().optional(),
});

type PatientForm = z.infer<typeof patientSchema>;

const emptyDefaults: PatientForm = {
  firstName: "",
  lastName: "",
  dateOfBirth: "",
  phone: "",
  email: "",
  mrn: "",
  language: "en",
  notes: "",
};

type EditablePatient = {
  id: number;
  firstName: string;
  lastName: string;
  dateOfBirth: string;
  phone: string;
  email?: string | null;
  mrn?: string | null;
  language?: string | null;
  notes?: string | null;
};

function toDateInput(value?: string | null): string {
  if (!value) return "";
  // dateOfBirth may arrive as an ISO datetime; keep just the date part for <input type="date">.
  return value.slice(0, 10);
}

export function PatientFormDialog({
  open,
  onOpenChange,
  onCreated,
  patient,
  onUpdated,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onCreated?: (patient: { id: number; firstName: string; lastName: string }) => void;
  patient?: EditablePatient;
  onUpdated?: (patient: { id: number; firstName: string; lastName: string }) => void;
}) {
  const { toast } = useToast();
  const qc = useQueryClient();
  const createPatient = useCreatePatient();
  const updatePatient = useUpdatePatient();
  const isEdit = !!patient;
  const pending = createPatient.isPending || updatePatient.isPending;

  const form = useForm<PatientForm>({
    resolver: zodResolver(patientSchema),
    defaultValues: emptyDefaults,
  });

  // Prefill only when the dialog opens (or the target patient changes), keyed on
  // patient.id rather than the object identity. The patient object comes from
  // React Query, so a background refetch must not reset fields mid-edit.
  useEffect(() => {
    if (open) {
      form.reset(
        patient
          ? {
              firstName: patient.firstName,
              lastName: patient.lastName,
              dateOfBirth: toDateInput(patient.dateOfBirth),
              phone: patient.phone,
              email: patient.email ?? "",
              mrn: patient.mrn ?? "",
              language: patient.language ?? "en",
              notes: patient.notes ?? "",
            }
          : emptyDefaults,
      );
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, patient?.id]);

  const onSubmit = (data: PatientForm) => {
    if (isEdit && patient) {
      updatePatient.mutate({ id: patient.id, data } as any, {
        onSuccess: (updated) => {
          toast({ title: "Patient updated" });
          qc.invalidateQueries({ queryKey: getListPatientsQueryKey() });
          qc.invalidateQueries({ queryKey: getGetPatientQueryKey(patient.id) });
          onOpenChange(false);
          onUpdated?.((updated as any) ?? patient);
        },
        onError: () => toast({ title: "Failed to update patient", variant: "destructive" }),
      });
      return;
    }
    createPatient.mutate({ data } as any, {
      onSuccess: (created) => {
        toast({ title: "Patient created" });
        qc.invalidateQueries({ queryKey: getListPatientsQueryKey() });
        onOpenChange(false);
        form.reset(emptyDefaults);
        onCreated?.(created as any);
      },
      onError: () => toast({ title: "Failed to create patient", variant: "destructive" }),
    });
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle>{isEdit ? "Edit Patient" : "New Patient"}</DialogTitle>
        </DialogHeader>
        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-3">
            <div className="grid grid-cols-2 gap-3">
              <FormField control={form.control} name="firstName" render={({ field }) => (
                <FormItem>
                  <FormLabel>First Name</FormLabel>
                  <FormControl><Input {...field} data-testid="input-first-name" /></FormControl>
                  <FormMessage />
                </FormItem>
              )} />
              <FormField control={form.control} name="lastName" render={({ field }) => (
                <FormItem>
                  <FormLabel>Last Name</FormLabel>
                  <FormControl><Input {...field} data-testid="input-last-name" /></FormControl>
                  <FormMessage />
                </FormItem>
              )} />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <FormField control={form.control} name="dateOfBirth" render={({ field }) => (
                <FormItem>
                  <FormLabel>Date of Birth</FormLabel>
                  <FormControl><Input type="date" {...field} data-testid="input-dob" /></FormControl>
                  <FormMessage />
                </FormItem>
              )} />
              <FormField control={form.control} name="phone" render={({ field }) => (
                <FormItem>
                  <FormLabel>Phone</FormLabel>
                  <FormControl><Input {...field} placeholder="e.g. 555 123 4567" data-testid="input-phone" /></FormControl>
                  <FormDescription>US numbers can omit the country code — +1 is added automatically. For other countries, include the + and country code.</FormDescription>
                  <FormMessage />
                </FormItem>
              )} />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <FormField control={form.control} name="email" render={({ field }) => (
                <FormItem>
                  <FormLabel>Email (optional)</FormLabel>
                  <FormControl><Input {...field} data-testid="input-email" /></FormControl>
                  <FormMessage />
                </FormItem>
              )} />
              <FormField control={form.control} name="mrn" render={({ field }) => (
                <FormItem>
                  <FormLabel>MRN (optional)</FormLabel>
                  <FormControl><Input {...field} data-testid="input-mrn" /></FormControl>
                  <FormMessage />
                </FormItem>
              )} />
            </div>
            <FormField control={form.control} name="notes" render={({ field }) => (
              <FormItem>
                <FormLabel>Notes (optional)</FormLabel>
                <FormControl><Input {...field} data-testid="input-notes" /></FormControl>
                <FormMessage />
              </FormItem>
            )} />
            <DialogFooter>
              <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>Cancel</Button>
              <Button type="submit" disabled={pending} data-testid="button-submit-patient">
                {pending ? "Saving..." : isEdit ? "Save Changes" : "Create Patient"}
              </Button>
            </DialogFooter>
          </form>
        </Form>
      </DialogContent>
    </Dialog>
  );
}
