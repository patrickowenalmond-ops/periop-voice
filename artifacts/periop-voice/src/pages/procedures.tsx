import { useState } from "react";
import { useListProcedures } from "@workspace/api-client-react";
import { Link } from "wouter";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { Plus, Calendar, User } from "lucide-react";
import { formatters } from "@/lib/formatters";
import { ProcedureFormDialog } from "@/components/procedure-form-dialog";

export default function ProceduresPage() {
  const [showCreate, setShowCreate] = useState(false);

  const { data: procedures, isLoading } = useListProcedures({ limit: 100 } as any);

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

      <ProcedureFormDialog open={showCreate} onOpenChange={setShowCreate} />
    </div>
  );
}
