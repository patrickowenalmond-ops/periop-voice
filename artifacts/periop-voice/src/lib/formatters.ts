export const formatters = {
  date: (dateStr: string) => {
    return new Date(dateStr).toLocaleDateString("en-US", {
      month: "short",
      day: "numeric",
      year: "numeric"
    });
  },
  datetime: (dateStr: string) => {
    return new Date(dateStr).toLocaleString("en-US", {
      month: "short",
      day: "numeric",
      hour: "numeric",
      minute: "2-digit"
    });
  },
  duration: (seconds: number) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins}:${secs.toString().padStart(2, "0")}`;
  },
  callType: (type: string) => {
    const map: Record<string, string> = {
      pre_op_history: "Pre-Op History",
      pre_op_instructions: "Pre-Op Instructions",
      post_op_24h: "24h Post-Op",
      post_op_72h: "72h Post-Op",
      post_op_2wk: "2-Week Follow-Up",
    };
    return map[type] || type;
  },
  callStatus: (status: string) => {
    const map: Record<string, { label: string, color: string }> = {
      pending: { label: "Pending", color: "bg-slate-100 text-slate-700" },
      in_progress: { label: "In Progress", color: "bg-blue-100 text-blue-700" },
      completed: { label: "Completed", color: "bg-emerald-100 text-emerald-700" },
      failed: { label: "Failed", color: "bg-red-100 text-red-700" },
      no_answer: { label: "No Answer", color: "bg-amber-100 text-amber-700" },
      cancelled: { label: "Cancelled", color: "bg-gray-100 text-gray-600" },
    };
    return map[status] || { label: status, color: "bg-gray-100 text-gray-700" };
  },
  severity: (severity: string) => {
    const map: Record<string, { label: string, color: string }> = {
      critical: { label: "Critical", color: "bg-red-100 text-red-800 border-red-200" },
      high: { label: "High", color: "bg-orange-100 text-orange-800 border-orange-200" },
      medium: { label: "Medium", color: "bg-yellow-100 text-yellow-800 border-yellow-200" },
      low: { label: "Low", color: "bg-blue-100 text-blue-800 border-blue-200" },
    };
    return map[severity] || { label: severity, color: "bg-slate-100 text-slate-800 border-slate-200" };
  }
};