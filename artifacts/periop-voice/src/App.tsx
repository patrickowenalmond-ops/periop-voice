import { useEffect, useRef, useState } from "react";
import { Switch, Route, useLocation, Router as WouterRouter, Redirect } from "wouter";
import { QueryClientProvider, useQueryClient } from "@tanstack/react-query";
import { ClerkProvider, SignIn, SignUp, useAuth, useClerk } from "@clerk/react";
import { publishableKeyFromHost } from "@clerk/react/internal";
import { shadcn } from "@clerk/themes";
import { Toaster } from "@/components/ui/toaster";
import { TooltipProvider } from "@/components/ui/tooltip";
import { queryClient } from "./lib/queryClient";
import NotFound from "@/pages/not-found";
import Dashboard from "@/pages/dashboard";
import Patients from "@/pages/patients";
import PatientDetail from "@/pages/patient-detail";
import ProceduresPage from "@/pages/procedures";
import ProcedureDetail from "@/pages/procedure-detail";
import CallsPage from "@/pages/calls";
import AlertsPage from "@/pages/alerts";
import CallRecordDetail from "@/pages/call-record-detail";
import TemplatesPage from "@/pages/templates";
import AdminUsers from "@/pages/admin-users";
import SettingsPage from "@/pages/settings";
import { AppShell } from "@/components/app-shell";

const clerkPubKey = publishableKeyFromHost(
  window.location.hostname,
  import.meta.env.VITE_CLERK_PUBLISHABLE_KEY,
);

const clerkProxyUrl = import.meta.env.VITE_CLERK_PROXY_URL;
const basePath = import.meta.env.BASE_URL.replace(/\/$/, "");

if (!clerkPubKey) {
  throw new Error("Missing VITE_CLERK_PUBLISHABLE_KEY");
}

const clerkAppearance = {
  theme: shadcn,
  cssLayerName: "clerk",
  options: {
    logoPlacement: "inside" as const,
    logoLinkUrl: basePath || "/",
    logoImageUrl: `${window.location.origin}${basePath}/logo.svg`,
  },
  variables: {
    colorPrimary: "hsl(215, 25%, 27%)",
    colorForeground: "hsl(222, 47%, 11%)",
    colorMutedForeground: "hsl(215.4, 16.3%, 46.9%)",
    colorDanger: "hsl(0, 84.2%, 60.2%)",
    colorBackground: "hsl(210, 33%, 99%)",
    colorInput: "hsl(214, 32%, 91%)",
    colorInputForeground: "hsl(222, 47%, 11%)",
    colorNeutral: "hsl(214, 32%, 91%)",
    fontFamily: "Inter, system-ui, sans-serif",
    borderRadius: "0.3rem",
  },
  elements: {
    rootBox: "w-full flex justify-center",
    cardBox: "bg-white rounded-xl w-[440px] max-w-full overflow-hidden shadow-md",
    card: "!shadow-none !border-0 !bg-transparent !rounded-none",
    footer: "!shadow-none !border-0 !bg-transparent !rounded-none",
    headerTitle: "text-[hsl(222,47%,11%)] font-semibold",
    headerSubtitle: "text-[hsl(215.4,16.3%,46.9%)]",
    socialButtonsBlockButtonText: "text-[hsl(222,47%,11%)]",
    formFieldLabel: "text-[hsl(222,47%,11%)] font-medium",
    footerActionLink: "text-[hsl(215,25%,27%)] hover:text-[hsl(215,25%,20%)]",
    footerActionText: "text-[hsl(215.4,16.3%,46.9%)]",
    dividerText: "text-[hsl(215.4,16.3%,46.9%)]",
  },
};

function InvalidateOnSignIn() {
  const { client } = useClerk();
  const qc = useQueryClient();
  const prev = useRef(0);

  useEffect(() => {
    const cur = (client as any)?.activeSessions?.length ?? 0;
    if (cur !== prev.current) {
      qc.invalidateQueries();
      prev.current = cur;
    }
  });

  return null;
}

function AuthPage({ mode }: { mode: "sign-in" | "sign-up" }) {
  return (
    <div className="min-h-screen flex flex-col items-center justify-center bg-background px-4">
      <div className="mb-8 text-center">
        <div className="flex items-center justify-center gap-2 mb-2">
          <img src={`${basePath}/logo.svg`} alt="PeriOp Voice" className="w-8 h-8" />
          <span className="text-xl font-semibold text-foreground">PeriOp Voice</span>
        </div>
        <p className="text-sm text-muted-foreground">AI-powered peri-operative call platform</p>
      </div>
      {mode === "sign-in" ? (
        <SignIn routing="path" path={`${basePath}/sign-in`} appearance={clerkAppearance} />
      ) : (
        <SignUp routing="path" path={`${basePath}/sign-up`} appearance={clerkAppearance} />
      )}
    </div>
  );
}

function Landing() {
  const [, setLocation] = useLocation();
  return (
    <div className="min-h-screen bg-background flex flex-col items-center justify-center px-4">
      <div className="max-w-lg text-center">
        <div className="flex items-center justify-center gap-3 mb-6">
          <img src={`${basePath}/logo.svg`} alt="PeriOp Voice" className="w-12 h-12" />
          <h1 className="text-3xl font-bold text-foreground">PeriOp Voice</h1>
        </div>
        <p className="text-muted-foreground mb-2 text-lg">
          AI-powered peri-operative call platform for ambulatory surgery centers
        </p>
        <p className="text-muted-foreground mb-10 text-sm">
          Automate pre-op history collection, surgical instruction delivery, and post-operative follow-up calls with clinical intelligence built in.
        </p>
        <div className="flex gap-3 justify-center">
          <button
            data-testid="button-sign-in"
            onClick={() => setLocation("/sign-in")}
            className="px-6 py-2.5 bg-primary text-primary-foreground rounded-md text-sm font-medium hover:opacity-90 transition"
          >
            Sign In
          </button>
          <button
            data-testid="button-sign-up"
            onClick={() => setLocation("/sign-up")}
            className="px-6 py-2.5 border border-border text-foreground rounded-md text-sm font-medium hover:bg-muted transition"
          >
            Request Access
          </button>
        </div>
      </div>
    </div>
  );
}

function AppLoading() {
  return (
    <div className="min-h-screen bg-background flex items-center justify-center">
      <div className="flex flex-col items-center gap-3">
        <img src={`${basePath}/logo.svg`} alt="PeriOp Voice" className="w-10 h-10 opacity-60" />
        <div className="flex gap-1">
          <span className="w-1.5 h-1.5 rounded-full bg-primary/40 animate-bounce" style={{ animationDelay: "0ms" }} />
          <span className="w-1.5 h-1.5 rounded-full bg-primary/40 animate-bounce" style={{ animationDelay: "150ms" }} />
          <span className="w-1.5 h-1.5 rounded-full bg-primary/40 animate-bounce" style={{ animationDelay: "300ms" }} />
        </div>
      </div>
    </div>
  );
}

function ProtectedRoute({ children }: { children: React.ReactNode }) {
  const { isSignedIn, isLoaded } = useAuth();
  const [, setLocation] = useLocation();

  if (!isLoaded) return <AppLoading />;
  if (!isSignedIn) {
    setLocation("/");
    return null;
  }
  return <>{children}</>;
}

function AdminRoute({ children }: { children: React.ReactNode }) {
  const { isSignedIn, isLoaded } = useAuth();
  const [, setLocation] = useLocation();
  const [meData, setMeData] = useState<{ role?: string } | null>(null);
  const [meLoaded, setMeLoaded] = useState(false);

  useEffect(() => {
    if (!isSignedIn) return;
    fetch("/api/users/me")
      .then(r => r.ok ? r.json() : null)
      .then(data => { setMeData(data); setMeLoaded(true); })
      .catch(() => setMeLoaded(true));
  }, [isSignedIn]);

  if (!isLoaded || !meLoaded) return <AppLoading />;
  if (!isSignedIn) { setLocation("/"); return null; }
  if (meData?.role !== "admin") {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <div className="text-center">
          <p className="text-lg font-semibold text-foreground">Access Denied</p>
          <p className="text-sm text-muted-foreground mt-1">Admin access is required to view this page.</p>
        </div>
      </div>
    );
  }
  return <>{children}</>;
}

function Router() {
  const { isSignedIn, isLoaded } = useAuth();

  if (!isLoaded) return <AppLoading />;

  return (
    <Switch>
      <Route path="/sign-in/*?" component={() => <AuthPage mode="sign-in" />} />
      <Route path="/sign-up/*?" component={() => <AuthPage mode="sign-up" />} />

      <Route path="/" component={() =>
        isSignedIn ? <Redirect to="/dashboard" /> : <Landing />
      } />

      <Route path="/dashboard" component={() =>
        <ProtectedRoute><AppShell><Dashboard /></AppShell></ProtectedRoute>
      } />
      <Route path="/patients" component={() =>
        <ProtectedRoute><AppShell><Patients /></AppShell></ProtectedRoute>
      } />
      <Route path="/patients/:id" component={() =>
        <ProtectedRoute><AppShell><PatientDetail /></AppShell></ProtectedRoute>
      } />
      <Route path="/procedures" component={() =>
        <ProtectedRoute><AppShell><ProceduresPage /></AppShell></ProtectedRoute>
      } />
      <Route path="/procedures/:id" component={() =>
        <ProtectedRoute><AppShell><ProcedureDetail /></AppShell></ProtectedRoute>
      } />
      <Route path="/calls" component={() =>
        <ProtectedRoute><AppShell><CallsPage /></AppShell></ProtectedRoute>
      } />
      <Route path="/alerts" component={() =>
        <ProtectedRoute><AppShell><AlertsPage /></AppShell></ProtectedRoute>
      } />
      <Route path="/call-records/:id" component={() =>
        <ProtectedRoute><AppShell><CallRecordDetail /></AppShell></ProtectedRoute>
      } />
      <Route path="/templates" component={() =>
        <ProtectedRoute><AppShell><TemplatesPage /></AppShell></ProtectedRoute>
      } />
      <Route path="/admin/users" component={() =>
        <AdminRoute><AppShell><AdminUsers /></AppShell></AdminRoute>
      } />
      <Route path="/settings" component={() =>
        <ProtectedRoute><AppShell><SettingsPage /></AppShell></ProtectedRoute>
      } />

      <Route component={NotFound} />
    </Switch>
  );
}

function App() {
  return (
    <ClerkProvider
      publishableKey={clerkPubKey}
      proxyUrl={clerkProxyUrl}
      routerPush={(to) => window.history.pushState(null, "", to)}
      routerReplace={(to) => window.history.replaceState(null, "", to)}
      appearance={clerkAppearance}
    >
      <QueryClientProvider client={queryClient}>
        <TooltipProvider>
          <WouterRouter base={basePath}>
            <InvalidateOnSignIn />
            <Router />
          </WouterRouter>
          <Toaster />
        </TooltipProvider>
      </QueryClientProvider>
    </ClerkProvider>
  );
}

export default App;
