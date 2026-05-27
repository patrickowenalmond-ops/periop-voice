import { useState } from "react";
import { useListProcedures, useCreateProcedure, useScheduleProcedureCalls, getListProceduresQueryKey, useListPatients } from "@workspace/api-client-react";
import { Link } from "wouter";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Skeleton } from "@/components/ui/skeleton";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { useToast } from "@/hooks/use-toast";
import { useQueryClient } from "@tanstack/react-query";
import { Plus, Calendar, User } from "lucide-react";
import { formatters } from "@/lib/formatters";

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

export default function ProceduresPage() {
  const [showCreate, setShowCreate] = useState(false);
  const { toast } = useToast();
  const qc = useQueryClient();

  const { data: procedures, isLoading } = useListProcedures({ limit: 100 } as any);
  const { data: patients } = useListPatients({ limit: 200 } as any);
  const createProcedure = useCreateProcedure();
  const scheduleCalls = useScheduleProcedureCalls();

  const form = useForm<ProcedureForm>({
    resolver: zodResolver(procedureSchema),
    defaultValues: { patientId: "", procedureName: "", scheduledDate: "", facility: "", surgeon: "", arrivalTime: "", specialInstructions: "" },
  });

  const onSubmit = (data: ProcedureForm) => {
    createProcedure.mutate(
      { data: { ...data, patientId: Number(data.patientId), scheduledDate: new Date(data.scheduledDate).toISOString() } } as any,
      {
        onSuccess: (proc) => {
          toast({ title: "Procedure created" });
          qc.invalidateQueries({ queryKey: getListProceduresQueryKey() });
          scheduleCalls.mutate({ procedureId: (proc as any).id } as any, {
            onSuccess: () => toast({ title: "Calls auto-scheduled" }),
          });
          setShowCreate(false);
          form.reset();
        },
        onError: () => toast({ title: "Failed to create procedure", variant: "destructive" }),
      }
    );
  };

  return (
    <div className="p-6 max-w-6xl mx-auto">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-xl font-semibold text-foreground">Procedures</h1>
          <p className="text-sm text-muted-foreground mt-0.5">{procedures?.length ?? 0} procedures</p>
        </div>
        <Button onClick={() => setShowCreate(true)} data-testid="button-create-procedure" size="sm">
          <Plus className="w-4 h-4 mr-1.5" /> New Procedure
        </Button>
      </div>

      <div className="bg-card border border-card-border rounded-lg overflow-hidden">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-border bg-muted/40">
              <th className="text-left px-4 py-2.5 font-medium text-muted-foreground text-xs uppercase tracking-wide">Patient</th>
              <th className="text-left px-4 py-2.5 font-medium text-muted-foreground text-xs uppercase tracking-wide">Procedure</th>
              <th className="text-left px-4 py-2.5 font-medium text-muted-foreground text-xs uppercase tracking-wide">Scheduled</th>
              <th className="text-left px-4 py-2.5 font-medium text-muted-foreground text-xs uppercase tracking-wide">Facility</th>
              <th className="text-left px-4 py-2.5 font-medium text-muted-foreground text-xs uppercase tracking-wide">Surgeon</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-border">
            {isLoading ? (
              Array.from({ length: 5 }).map((_, i) => (
                <tr key={i}><td colSpan={5} className="px-4 py-3"><Skeleton className="h-5 w-full" /></td></tr>
              ))
            ) : procedures?.length === 0 ? (
              <tr><td colSpan={5} className="px-4 py-10 text-center text-muted-foreground">No procedures found</td></tr>
            ) : (
              procedures?.map(proc => (
                <tr key={proc.id} className="hover:bg-muted/20 transition-colors" data-testid={`row-procedure-${proc.id}`}>
                  <td className="px-4 py-3">
                    <div className="flex items-center gap-2">
                      <User className="w-3.5 h-3.5 text-muted-foreground" />
                      <Link href={`/patients/${proc.patientId}`} className="text-foreground hover:text-primary transition-colors">
                        {(proc as any).patient?.firstName} {(proc as any).patient?.lastName}
                      </Link>
                    </div>
                  </td>
                  <td className="px-4 py-3">
                    <Link href={`/procedures/${proc.id}`} className="font-medium text-foreground hover:text-primary transition-colors">
                      {proc.procedureName}
                    </Link>
                  </td>
                  <td className="px-4 py-3 text-muted-foreground">
                    <div className="flex items-center gap-1.5">
                      <Calendar className="w-3 h-3" />
                      {formatters.datetime(proc.scheduledDate)}
                    </div>
                  </td>
                  <td className="px-4 py-3 text-muted-foreground">{proc.facility ?? "—"}</td>
                  <td className="px-4 py-3 text-muted-foreground">{proc.surgeon ?? "—"}</td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      <Dialog open={showCreate} onOpenChange={setShowCreate}>
        <DialogContent className="max-w-lg">
          <DialogHeader><DialogTitle>New Procedure</DialogTitle></DialogHeader>
          <Form {...form}>
            <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-3">
              <FormField control={form.control} name="patientId" render={({ field }) => (
                <FormItem>
                  <FormLabel>Patient</FormLabel>
                  <Select onValueChange={field.onChange} value={field.value}>
                    <FormControl>
                      <SelectTrigger data-testid="select-patient">
                        <SelectValue placeholder="Select patient..." />
                      </SelectTrigger>
                    </FormControl>
                    <SelectContent>
                      {patients?.map(p => (
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
                <Button type="button" variant="outline" onClick={() => setShowCreate(false)}>Cancel</Button>
                <Button type="submit" disabled={createProcedure.isPending} data-testid="button-submit-procedure">
                  {createProcedure.isPending ? "Creating..." : "Create & Schedule Calls"}
                </Button>
              </DialogFooter>
            </form>
          </Form>
        </DialogContent>
      </Dialog>
    </div>
  );
}
