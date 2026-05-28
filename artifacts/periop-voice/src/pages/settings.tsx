import { useGetMe, getGetMeQueryKey } from "@workspace/api-client-react";
import { UserProfile } from "@clerk/react";
import { Skeleton } from "@/components/ui/skeleton";
import { useQuery } from "@tanstack/react-query";

interface VapiConfig {
  webhookUrl: string | null;
  isLive: boolean;
  webhookSecretConfigured: boolean;
}

function useVapiConfig() {
  return useQuery<VapiConfig>({
    queryKey: ["vapi-config"],
    queryFn: async () => {
      const res = await fetch("/api/vapi/config");
      if (!res.ok) throw new Error("Failed to fetch Vapi config");
      return res.json() as Promise<VapiConfig>;
    },
    staleTime: 60_000,
  });
}

function StatusDot({ ok }: { ok: boolean }) {
  return (
    <span
      className={`inline-block w-2 h-2 rounded-full mr-1.5 ${ok ? "bg-green-500" : "bg-amber-400"}`}
    />
  );
}

export default function SettingsPage() {
  const { data: me, isLoading } = useGetMe({ query: { queryKey: getGetMeQueryKey() } });
  const { data: vapiConfig, isLoading: vapiLoading } = useVapiConfig();

  return (
    <div className="p-6 max-w-4xl mx-auto">
      <div className="mb-6">
        <h1 className="text-xl font-semibold text-foreground">Settings</h1>
        <p className="text-sm text-muted-foreground mt-0.5">Account and profile settings</p>
      </div>

      {isLoading ? (
        <Skeleton className="h-40 w-full rounded-lg" />
      ) : me && (
        <div className="bg-card border border-card-border rounded-lg p-4 mb-6">
          <h2 className="text-sm font-semibold text-foreground mb-3">Your Account</h2>
          <dl className="space-y-2">
            {[
              ["Email", me.email],
              ["Name", [me.firstName, me.lastName].filter(Boolean).join(" ") || "—"],
              ["Role", me.role?.charAt(0).toUpperCase() + me.role?.slice(1)],
              ["Status", (me as any).active ? "Active" : "Inactive"],
            ].map(([label, value]) => (
              <div key={label} className="flex justify-between text-sm">
                <dt className="text-muted-foreground">{label}</dt>
                <dd className="text-foreground font-medium">{value}</dd>
              </div>
            ))}
          </dl>
        </div>
      )}

      <div className="bg-card border border-card-border rounded-lg p-4 mb-6">
        <h2 className="text-sm font-semibold text-foreground mb-1">Vapi Integration</h2>
        <p className="text-xs text-muted-foreground mb-3">
          Configure this webhook URL in your Vapi dashboard so call results are delivered automatically.
        </p>

        {vapiLoading ? (
          <Skeleton className="h-20 w-full rounded" />
        ) : vapiConfig ? (
          <div className="space-y-3">
            <div className="space-y-1">
              <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide">Webhook URL</p>
              {vapiConfig.webhookUrl ? (
                <div className="flex items-center gap-2">
                  <code className="text-xs bg-muted px-2 py-1.5 rounded font-mono break-all flex-1">
                    {vapiConfig.webhookUrl}
                  </code>
                  <button
                    className="text-xs text-primary hover:underline shrink-0"
                    onClick={() => navigator.clipboard.writeText(vapiConfig.webhookUrl!)}
                  >
                    Copy
                  </button>
                </div>
              ) : (
                <p className="text-xs text-muted-foreground italic">Domain not available</p>
              )}
              <p className="text-xs text-muted-foreground mt-1">
                In your Vapi dashboard → <strong>Assistant → Server URL</strong>, paste the URL above.
              </p>
            </div>

            <div className="border-t border-border pt-3 space-y-2">
              <div className="flex items-center justify-between text-sm">
                <span className="text-muted-foreground">Vapi credentials</span>
                <span className="font-medium flex items-center">
                  <StatusDot ok={vapiConfig.isLive} />
                  {vapiConfig.isLive ? "Configured" : "Missing"}
                </span>
              </div>
              <div className="flex items-center justify-between text-sm">
                <span className="text-muted-foreground">Webhook secret</span>
                <span className="font-medium flex items-center">
                  <StatusDot ok={vapiConfig.webhookSecretConfigured} />
                  {vapiConfig.webhookSecretConfigured ? "Set" : "Not set (optional)"}
                </span>
              </div>
            </div>

            {!vapiConfig.isLive && (
              <p className="text-xs text-amber-600 dark:text-amber-400 bg-amber-50 dark:bg-amber-950/30 border border-amber-200 dark:border-amber-800 rounded px-2 py-1.5">
                Set <code>VAPI_API_KEY</code>, <code>VAPI_PHONE_NUMBER_ID</code>, and <code>VAPI_ASSISTANT_ID</code> in the Replit Secrets panel to enable live calls.
              </p>
            )}
          </div>
        ) : (
          <p className="text-xs text-muted-foreground">Unable to load Vapi configuration.</p>
        )}
      </div>

      <div className="bg-card border border-card-border rounded-lg overflow-hidden">
        <UserProfile />
      </div>
    </div>
  );
}
