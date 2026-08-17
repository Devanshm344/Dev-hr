import { useState } from "react";
import { Navigate, Outlet } from "react-router-dom";
import { Server } from "lucide-react";
import { Sidebar } from "@/components/sidebar";
import { Navbar } from "@/components/navbar";
import AssistantWidget from "@/components/assistant-widget";
import { CurrentUserProvider, useCurrentUser } from "@/lib/current-user-context";
import { StaffUserProvider, useCurrentStaff } from "@/lib/current-staff-context";
import { useSystemSettings } from "@/hooks/use-system-settings";
const portalLabels = {
  hr: "HR Portal",
  admin: "Admin Portal"
};
function MaintenanceScreen({
  portalName
}) {
  return <div className="min-h-screen flex items-center justify-center bg-background px-4">
      <div className="text-center max-w-md">
        <div className="w-14 h-14 rounded-full bg-primary/10 flex items-center justify-center mx-auto mb-5">
          <Server className="h-7 w-7 text-primary" />
        </div>
        <h1 className="text-2xl font-bold text-foreground mb-2">Under Maintenance</h1>
        <p className="text-muted-foreground">
          {portalName} is currently undergoing scheduled maintenance. Please check back shortly.
        </p>
      </div>
    </div>;
}
function LoadingScreen() {
  return <div className="min-h-screen flex items-center justify-center bg-background">
      <div className="h-8 w-8 rounded-full border-2 border-primary border-t-transparent animate-spin" />
    </div>;
}
function AlumniNavbar({
  onMenuClick
}) {
  const {
    user,
    loading
  } = useCurrentUser();
  return <Navbar onMenuClick={onMenuClick} userName={loading ? "Loading..." : user?.fullName ?? "Alumni Member"} userEmail={loading ? "" : user?.email ?? ""} userAvatar={user?.profilePhotoPath ?? undefined} portalLabel="Alumni Portal" portal="alumni" />;
}
function StaffNavbar({
  onMenuClick,
  portal
}) {
  const {
    user,
    loading
  } = useCurrentStaff();
  return <Navbar onMenuClick={onMenuClick} userName={loading ? "Loading..." : user?.fullName ?? "Staff Member"} userEmail={loading ? "" : user?.email ?? ""} portalLabel={portalLabels[portal]} portal={portal} />;
}
function AlumniGate({
  children
}) {
  const {
    user,
    loading: userLoading
  } = useCurrentUser();
  const {
    settings,
    loading: settingsLoading
  } = useSystemSettings();
  if (userLoading || settingsLoading) return <LoadingScreen />;
  if (settings?.maintenanceMode) return <MaintenanceScreen portalName={settings.portalName} />;
  if (!user) return <Navigate to="/login" replace />;
  return <>{children}</>;
}
function StaffGate({
  portal,
  children
}) {
  const {
    user,
    loading: userLoading
  } = useCurrentStaff();
  const {
    settings,
    loading: settingsLoading
  } = useSystemSettings();
  if (userLoading || settingsLoading) return <LoadingScreen />;
  if (settings?.maintenanceMode && user?.role !== "admin") return <MaintenanceScreen portalName={settings.portalName} />;
  if (!user || user.role !== portal) return <Navigate to="/login" replace />;
  return <>{children}</>;
}
export function PortalLayout({
  portal
}) {
  const [mobileOpen, setMobileOpen] = useState(false);
  const shell = <div className="flex h-screen overflow-hidden bg-background">
      <Sidebar portal={portal} mobileOpen={mobileOpen} onMobileClose={() => setMobileOpen(false)} />
      <div className="flex-1 flex flex-col min-w-0 overflow-hidden">
        {portal === "alumni" ? <AlumniNavbar onMenuClick={() => setMobileOpen(true)} /> : <StaffNavbar onMenuClick={() => setMobileOpen(true)} portal={portal} />}
        <main className="flex-1 overflow-y-auto p-4 md:p-6 lg:p-8">
          <Outlet />
        </main>
      </div>
      <AssistantWidget />
    </div>;
  if (portal === "alumni") {
    return <CurrentUserProvider>
        <AlumniGate>{shell}</AlumniGate>
      </CurrentUserProvider>;
  }
  return <StaffUserProvider>
      <StaffGate portal={portal}>{shell}</StaffGate>
    </StaffUserProvider>;
}
