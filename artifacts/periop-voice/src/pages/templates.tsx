import { useState } from "react";
import { useListCallTemplates, useCreateCallTemplate, useUpdateCallTemplate, useDeleteCallTemplate, getListCallTemplatesQueryKey } from "@workspace/api-client-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Skeleton } from "@/components/ui/skeleton";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { useToast } from "@/hooks/use-toast";
import { useQueryClient } from "@tanstack/react-query";
import { Plus, Pencil, Trash2 } from "lucide-react";
import { formatters } from "@/lib/formatters";

const templateSchema = z.object({
  callType: z.string().min(1, "Required"),
  name: z.string().min(1, "Required"),
  systemPrompt: z.string().min(1, "Required"),
  questions: z.string().optional(),
  language: z.string().optional(),
  active: z.boolean().optional(),
});

type TemplateForm = z.infer<typeof templateSchema>;

export default function TemplatesPage() {
  const [showCreate, setShowCreate] = useState(false);
  const [editId, setEditId] = useState<number | null>(null);
  const { toast } = useToast();
  const qc = useQueryClient();

  const { data: templates, isLoading } = useListCallTemplates();
  const createTemplate = useCreateCallTemplate();
  const updateTemplate = useUpdateCallTemplate();
  const deleteTemplate = useDeleteCallTemplate();

  const form = useForm<TemplateForm>({
    resolver: zodResolver(templateSchema),
    defaultValues: { callType: "", name: "", systemPrompt: "", questions: "", language: "en", active: true },
  });

  const openEdit = (tpl: any) => {
    setEditId(tpl.id);
    form.reset({
      callType: tpl.callType,
      name: tpl.name,
      systemPrompt: tpl.systemPrompt,
      questions: tpl.questions ?? "",
      language: tpl.language ?? "en",
      active: tpl.active !== false,
    });
    setShowCreate(true);
  };

  const handleClose = () => {
    setShowCreate(false);
    setEditId(null);
    form.reset({ callType: "", name: "", systemPrompt: "", questions: "", language: "en", active: true });
  };

  const onSubmit = (data: TemplateForm) => {
    const mutate = editId ? updateTemplate : createTemplate;
    const payload = editId ? { id: editId, data } : { data };

    (mutate as any).mutate(payload as any, {
      onSuccess: () => {
        toast({ title: editId ? "Template updated" : "Template created" });
        qc.invalidateQueries({ queryKey: getListCallTemplatesQueryKey() });
        handleClose();
      },
      onError: () => toast({ title: "Failed to save template", variant: "destructive" }),
    });
  };

  const handleDelete = (id: number) => {
    if (!confirm("Delete this template?")) return;
    deleteTemplate.mutate({ id } as any, {
      onSuccess: () => {
        toast({ title: "Template deleted" });
        qc.invalidateQueries({ queryKey: getListCallTemplatesQueryKey() });
      },
      onError: () => toast({ title: "Failed to delete", variant: "destructive" }),
    });
  };

  return (
    <div className="p-6 max-w-5xl mx-auto">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-xl font-semibold text-foreground">Call Templates</h1>
          <p className="text-sm text-muted-foreground mt-0.5">AI call scripts by call type</p>
        </div>
        <Button onClick={() => setShowCreate(true)} data-testid="button-create-template" size="sm">
          <Plus className="w-4 h-4 mr-1.5" /> New Template
        </Button>
      </div>

      <div className="space-y-3">
        {isLoading ? (
          Array.from({ length: 3 }).map((_, i) => <Skeleton key={i} className="h-28 w-full rounded-lg" />)
        ) : templates?.length === 0 ? (
          <div className="bg-card border border-card-border rounded-lg px-4 py-12 text-center text-sm text-muted-foreground">
            No templates yet. Create one to configure your AI call scripts.
          </div>
        ) : (
          templates?.map(tpl => (
            <div key={tpl.id} className="bg-card border border-card-border rounded-lg p-4 flex items-start justify-between gap-4" data-testid={`template-${tpl.id}`}>
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 mb-1">
                  <span className="text-sm font-medium text-foreground">{tpl.name}</span>
                  <span className="text-xs px-1.5 py-0.5 rounded bg-blue-50 text-blue-700 border border-blue-100">
                    {formatters.callType(tpl.callType)}
                  </span>
                  <span className="text-xs text-muted-foreground uppercase">{tpl.language}</span>
                  {!(tpl as any).active && (
                    <span className="text-xs px-1.5 py-0.5 rounded bg-muted text-muted-foreground">Inactive</span>
                  )}
                </div>
                <p className="text-sm text-muted-foreground line-clamp-2">{tpl.systemPrompt}</p>
                {tpl.vapiAssistantId && (
                  <p className="text-xs text-muted-foreground mt-1">Vapi ID: {tpl.vapiAssistantId}</p>
                )}
              </div>
              <div className="flex gap-2 shrink-0">
                <Button size="sm" variant="ghost" onClick={() => openEdit(tpl)} className="h-7 w-7 p-0" data-testid={`button-edit-template-${tpl.id}`}>
                  <Pencil className="w-3.5 h-3.5" />
                </Button>
                <Button size="sm" variant="ghost" onClick={() => handleDelete(tpl.id)} className="h-7 w-7 p-0 text-destructive hover:text-destructive" data-testid={`button-delete-template-${tpl.id}`}>
                  <Trash2 className="w-3.5 h-3.5" />
                </Button>
              </div>
            </div>
          ))
        )}
      </div>

      <Dialog open={showCreate} onOpenChange={handleClose}>
        <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>{editId ? "Edit Template" : "New Call Template"}</DialogTitle>
          </DialogHeader>
          <Form {...form}>
            <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
              <div className="grid grid-cols-2 gap-3">
                <FormField control={form.control} name="callType" render={({ field }) => (
                  <FormItem>
                    <FormLabel>Call Type</FormLabel>
                    <Select onValueChange={field.onChange} value={field.value}>
                      <FormControl>
                        <SelectTrigger data-testid="select-call-type">
                          <SelectValue placeholder="Select type..." />
                        </SelectTrigger>
                      </FormControl>
                      <SelectContent>
                        <SelectItem value="pre_op_history">Pre-Op History</SelectItem>
                        <SelectItem value="pre_op_instructions">Pre-Op Instructions</SelectItem>
                        <SelectItem value="post_op_24h">24h Post-Op</SelectItem>
                        <SelectItem value="post_op_72h">72h Post-Op</SelectItem>
                        <SelectItem value="post_op_2wk">2-Week Follow-Up</SelectItem>
                      </SelectContent>
                    </Select>
                    <FormMessage />
                  </FormItem>
                )} />
                <FormField control={form.control} name="name" render={({ field }) => (
                  <FormItem>
                    <FormLabel>Template Name</FormLabel>
                    <FormControl><Input {...field} data-testid="input-template-name" /></FormControl>
                    <FormMessage />
                  </FormItem>
                )} />
              </div>
              <FormField control={form.control} name="systemPrompt" render={({ field }) => (
                <FormItem>
                  <FormLabel>System Prompt</FormLabel>
                  <FormControl><Textarea {...field} rows={6} placeholder="You are a friendly surgical care coordinator calling on behalf of..." data-testid="textarea-system-prompt" /></FormControl>
                  <FormMessage />
                </FormItem>
              )} />
              <FormField control={form.control} name="questions" render={({ field }) => (
                <FormItem>
                  <FormLabel>Questions / Script (optional)</FormLabel>
                  <FormControl><Textarea {...field} rows={4} placeholder="List the specific questions to ask the patient..." data-testid="textarea-questions" /></FormControl>
                  <FormMessage />
                </FormItem>
              )} />
              <div className="flex gap-3">
                <FormField control={form.control} name="language" render={({ field }) => (
                  <FormItem className="flex-1">
                    <FormLabel>Language</FormLabel>
                    <Select onValueChange={field.onChange} value={field.value}>
                      <FormControl>
                        <SelectTrigger data-testid="select-language">
                          <SelectValue />
                        </SelectTrigger>
                      </FormControl>
                      <SelectContent>
                        <SelectItem value="en">English</SelectItem>
                        <SelectItem value="es">Spanish</SelectItem>
                        <SelectItem value="zh">Chinese</SelectItem>
                        <SelectItem value="vi">Vietnamese</SelectItem>
                        <SelectItem value="ko">Korean</SelectItem>
                      </SelectContent>
                    </Select>
                  </FormItem>
                )} />
                <FormField control={form.control} name="active" render={({ field }) => (
                  <FormItem className="flex items-end gap-2 pb-0.5">
                    <FormLabel>Active</FormLabel>
                    <FormControl>
                      <Switch checked={field.value} onCheckedChange={field.onChange} data-testid="switch-active" />
                    </FormControl>
                  </FormItem>
                )} />
              </div>
              <DialogFooter>
                <Button type="button" variant="outline" onClick={handleClose}>Cancel</Button>
                <Button type="submit" disabled={createTemplate.isPending || updateTemplate.isPending} data-testid="button-submit-template">
                  {editId ? "Save Changes" : "Create Template"}
                </Button>
              </DialogFooter>
            </form>
          </Form>
        </DialogContent>
      </Dialog>
    </div>
  );
}
