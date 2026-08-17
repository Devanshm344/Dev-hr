import { useEffect, useState } from "react";
import { PageHeader } from "@/components/ui-custom";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Separator } from "@/components/ui/separator";
import { Switch } from "@/components/ui/switch";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Badge } from "@/components/ui/badge";
import { Save, Globe, Server } from "lucide-react";
export default function SystemSettings() {
  const [settings, setSettings] = useState(null);
  const [saved, setSaved] = useState(null);
  const [status, setStatus] = useState(null);
  const load = () => {
    fetch("/api/admin/system-settings").then(res => res.json()).then(data => setSettings(data.settings)).catch(() => {});
  };
  useEffect(() => {
    load();
    fetch("/api/admin/system-status").then(res => res.json()).then(setStatus).catch(() => {});
  }, []);
  const patch = async (fields, flash) => {
    setSettings(s => s ? {
      ...s,
      ...fields
    } : s);
    const res = await fetch("/api/admin/system-settings", {
      method: "PATCH",
      headers: {
        "Content-Type": "application/json"
      },
      body: JSON.stringify(fields)
    });
    if (res.ok) {
      const data = await res.json();
      setSettings(data.settings);
      setSaved(flash);
      setTimeout(() => setSaved(null), 2000);
    } else {
      load();
    }
  };
  if (!settings) return null;
  return <>
      <PageHeader title="System Settings" description="Configure global system settings and integrations." breadcrumbs={[{
      label: "Admin Portal"
    }, {
      label: "System Settings"
    }]} />

      <div className="max-w-3xl">
        <Tabs defaultValue="general">
          <TabsList className="grid grid-cols-2 w-full mb-6">
            <TabsTrigger value="general" className="text-xs gap-1.5"><Globe className="h-3.5 w-3.5" />General</TabsTrigger>
            <TabsTrigger value="system" className="text-xs gap-1.5"><Server className="h-3.5 w-3.5" />System</TabsTrigger>
          </TabsList>

          <TabsContent value="general">
            <Card className="border-border">
              <CardHeader><CardTitle className="text-base">General Configuration</CardTitle></CardHeader>
              <CardContent className="space-y-5">
                <div className="space-y-1.5"><Label>Portal Name</Label><Input value={settings.portalName} onChange={e => setSettings(s => s && {
                  ...s,
                  portalName: e.target.value
                })} /></div>
                <div className="space-y-1.5"><Label>Organization Name</Label><Input value={settings.organizationName} onChange={e => setSettings(s => s && {
                  ...s,
                  organizationName: e.target.value
                })} /></div>
                <div className="space-y-1.5"><Label>Support Email</Label><Input value={settings.supportEmail} onChange={e => setSettings(s => s && {
                  ...s,
                  supportEmail: e.target.value
                })} /></div>
                <div className="space-y-1.5">
                  <Label>Default Time Zone</Label>
                  <select className="w-full h-10 px-3 rounded-md border border-input bg-background text-sm focus:outline-none focus:ring-2 focus:ring-ring" value={settings.defaultTimezone} onChange={e => setSettings(s => s && {
                  ...s,
                  defaultTimezone: e.target.value
                })}>
                    <option value="America/New_York">America/New_York (EST)</option>
                    <option value="America/Los_Angeles">America/Los_Angeles (PST)</option>
                    <option value="UTC">UTC</option>
                  </select>
                </div>
                <Separator />
                <div className="flex items-center justify-between">
                  <div><p className="text-sm font-medium text-foreground">Enable Public Landing Page</p><p className="text-xs text-muted-foreground">Show the public alumni landing page</p></div>
                  <Switch checked={settings.enablePublicLandingPage} onCheckedChange={v => setSettings(s => s && {
                  ...s,
                  enablePublicLandingPage: v
                })} />
                </div>
                <div className="flex items-center justify-between">
                  <div><p className="text-sm font-medium text-foreground">Allow New Registrations</p><p className="text-xs text-muted-foreground">Accept new alumni registration submissions</p></div>
                  <Switch checked={settings.allowNewRegistrations} onCheckedChange={v => setSettings(s => s && {
                  ...s,
                  allowNewRegistrations: v
                })} />
                </div>
                <div className="flex items-center justify-between">
                  <div><p className="text-sm font-medium text-foreground">Show Alumni Stats on Landing Page</p><p className="text-xs text-muted-foreground">Display member count and stats publicly</p></div>
                  <Switch checked={settings.showAlumniStatsOnLanding} onCheckedChange={v => setSettings(s => s && {
                  ...s,
                  showAlumniStatsOnLanding: v
                })} />
                </div>
                <div className="flex items-center gap-3">
                  <Button className="td-gradient border-0 text-white gap-2" onClick={() => patch({
                  portalName: settings.portalName,
                  organizationName: settings.organizationName,
                  supportEmail: settings.supportEmail,
                  defaultTimezone: settings.defaultTimezone,
                  enablePublicLandingPage: settings.enablePublicLandingPage,
                  allowNewRegistrations: settings.allowNewRegistrations,
                  showAlumniStatsOnLanding: settings.showAlumniStatsOnLanding
                }, "General settings saved")}>
                    <Save className="h-4 w-4" />Save Settings
                  </Button>
                  {saved === "General settings saved" && <span className="text-xs text-emerald-600">Saved ✓</span>}
                </div>
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="system">
            <Card className="border-border">
              <CardHeader>
                <div className="flex items-center justify-between">
                  <CardTitle className="text-base">System Status</CardTitle>
                  {status && <Badge className={`border-0 ${status.webApplication.operational && status.database.operational ? "bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-400" : "bg-red-100 text-red-700"}`}>
                      {status.webApplication.operational && status.database.operational ? "All Systems Operational" : "Issue Detected"}
                    </Badge>}
                </div>
              </CardHeader>
              <CardContent className="space-y-4">
                {!status && <p className="text-sm text-muted-foreground">Checking system status...</p>}
                {status && <>
                    <div className="flex items-center justify-between p-3 rounded-lg border border-border bg-secondary/20">
                      <div className="flex items-center gap-3">
                        <div className={`w-2 h-2 rounded-full ${status.webApplication.operational ? "bg-emerald-500" : "bg-red-500"}`} />
                        <span className="text-sm font-medium text-foreground">Web Application</span>
                      </div>
                      <Badge variant="secondary" className="text-[10px] text-emerald-700 bg-emerald-100 dark:bg-emerald-900/30 dark:text-emerald-400">operational</Badge>
                    </div>
                    <div className="flex items-center justify-between p-3 rounded-lg border border-border bg-secondary/20">
                      <div className="flex items-center gap-3">
                        <div className={`w-2 h-2 rounded-full ${status.database.operational ? "bg-emerald-500" : "bg-red-500"}`} />
                        <span className="text-sm font-medium text-foreground">Database</span>
                      </div>
                      <Badge variant="secondary" className={`text-[10px] ${status.database.operational ? "text-emerald-700 bg-emerald-100 dark:bg-emerald-900/30 dark:text-emerald-400" : "text-red-700 bg-red-100"}`}>
                        {status.database.operational ? "operational" : "down"}
                      </Badge>
                    </div>
                    <div className="flex items-center justify-between p-3 rounded-lg border border-border bg-secondary/20">
                      <span className="text-sm font-medium text-foreground">CPU Usage (host)</span>
                      <span className="text-xs text-muted-foreground">{status.cpu}%</span>
                    </div>
                    <div className="flex items-center justify-between p-3 rounded-lg border border-border bg-secondary/20">
                      <span className="text-sm font-medium text-foreground">Memory Usage (host)</span>
                      <span className="text-xs text-muted-foreground">{status.memory}%</span>
                    </div>
                  </>}
                <Separator />
                <div className="space-y-3">
                  <h3 className="text-sm font-semibold text-foreground">Maintenance Mode</h3>
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="text-sm text-foreground">Enable Maintenance Mode</p>
                      <p className="text-xs text-muted-foreground">Blocks alumni/HR/admin portals and the public site for everyone except admins</p>
                    </div>
                    <Switch checked={settings.maintenanceMode} onCheckedChange={v => patch({
                    maintenanceMode: v
                  }, v ? "Maintenance mode enabled" : "Maintenance mode disabled")} />
                  </div>
                  {saved?.includes("Maintenance") && <span className="text-xs text-emerald-600">{saved} ✓</span>}
                </div>
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>
      </div>
    </>;
}
