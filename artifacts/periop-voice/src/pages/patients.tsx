import { useState } from "react";
import { useListPatients, useCreatePatient, getListPatientsQueryKey } from "@workspace/api-client-react";
import { Link } from "wouter";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Skeleton } from "@/components/ui/skeleton";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Form, FormControl, FormDescription, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { useToast } from "@/hooks/use-toast";
import { useQueryClient } from "@tanstack/react-query";
import { Plus, Search, User } from "lucide-react";
import { formatters } from "@/lib/formatters";

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

export default function Patients() {
  const [search, setSearch] = useState("");
  const [showCreate, setShowCreate] = useState(false);
  const { toast } = useToast();
  const qc = useQueryClient();

  const { data: patients, isLoading } = useListPatients({ search: search || undefined, limit: 100 } as any);
  const createPatient = useCreatePatient();

  const form = useForm<PatientForm>({
    resolver: zodResolver(patientSchema),
    defaultValues: { firstName: "", lastName: "", dateOfBirth: "", phone: "", email: "", mrn: "", language: "en", notes: "" },
  });

  const onSubmit = (data: PatientForm) => {
    createPatient.mutate({ data } as any, {
      onSuccess: () => {
        toast({ title: "Patient created" });
        qc.invalidateQueries({ queryKey: getListPatientsQueryKey() });
        setShowCreate(false);
        form.reset();
      },
      onError: () => toast({ title: "Failed to create patient", variant: "destructive" }),
    });
  };

  return (
    <div className="p-6 max-w-6xl mx-auto">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-xl font-semibold text-foreground">Patients</h1>
          <p className="text-sm text-muted-foreground mt-0.5">{patients?.length ?? 0} patients</p>
        </div>
        <Button onClick={() => setShowCreate(true)} data-testid="button-create-patient" size="sm">
          <Plus className="w-4 h-4 mr-1.5" /> New Patient
        </Button>
      </div>

      <div className="relative mb-4">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
        <Input
          className="pl-9"
          placeholder="Search by name, MRN, or phone..."
          value={search}
          onChange={e => setSearch(e.target.value)}
          data-testid="input-search"
        />
      </div>

      <div className="bg-card border border-card-border rounded-lg overflow-hidden">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-border bg-muted/40">
              <th className="text-left px-4 py-2.5 font-medium text-muted-foreground text-xs uppercase tracking-wide">Patient</th>
              <th className="text-left px-4 py-2.5 font-medium text-muted-foreground text-xs uppercase tracking-wide">DOB</th>
              <th className="text-left px-4 py-2.5 font-medium text-muted-foreground text-xs uppercase tracking-wide">Phone</th>
              <th className="text-left px-4 py-2.5 font-medium text-muted-foreground text-xs uppercase tracking-wide">MRN</th>
              <th className="text-left px-4 py-2.5 font-medium text-muted-foreground text-xs uppercase tracking-wide">Language</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-border">
            {isLoading ? (
              Array.from({ length: 5 }).map((_, i) => (
                <tr key={i}><td colSpan={5} className="px-4 py-3"><Skeleton className="h-5 w-full" /></td></tr>
              ))
            ) : patients?.length === 0 ? (
              <tr><td colSpan={5} className="px-4 py-10 text-center text-muted-foreground">No patients found</td></tr>
            ) : (
              patients?.map(p => (
                <tr key={p.id} className="hover:bg-muted/20 transition-colors" data-testid={`row-patient-${p.id}`}>
                  <td className="px-4 py-3">
                    <Link href={`/patients/${p.id}`} className="flex items-center gap-2 group">
                      <div className="w-7 h-7 rounded-full bg-primary/10 flex items-center justify-center shrink-0">
                        <User className="w-3.5 h-3.5 text-primary" />
                      </div>
                      <span className="font-medium text-foreground group-hover:text-primary transition-colors">
                        {p.lastName}, {p.firstName}
                      </span>
                    </Link>
                  </td>
                  <td className="px-4 py-3 text-muted-foreground">{p.dateOfBirth ? formatters.date(p.dateOfBirth) : "—"}</td>
                  <td className="px-4 py-3 text-muted-foreground">{p.phone}</td>
                  <td className="px-4 py-3 text-muted-foreground">{p.mrn ?? "—"}</td>
                  <td className="px-4 py-3 text-muted-foreground uppercase text-xs">{p.language}</td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      <Dialog open={showCreate} onOpenChange={setShowCreate}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>New Patient</DialogTitle>
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
                <Button type="button" variant="outline" onClick={() => setShowCreate(false)}>Cancel</Button>
                <Button type="submit" disabled={createPatient.isPending} data-testid="button-submit-patient">
                  {createPatient.isPending ? "Creating..." : "Create Patient"}
                </Button>
              </DialogFooter>
            </form>
          </Form>
        </DialogContent>
      </Dialog>
    </div>
  );
}
