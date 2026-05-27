import { useGetMe, getGetMeQueryKey } from "@workspace/api-client-react";
import { UserProfile } from "@clerk/react";
import { Skeleton } from "@/components/ui/skeleton";

export default function SettingsPage() {
  const { data: me, isLoading } = useGetMe({ query: { queryKey: getGetMeQueryKey() } });

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

      <div className="bg-card border border-card-border rounded-lg overflow-hidden">
        <UserProfile />
      </div>
    </div>
  );
}
