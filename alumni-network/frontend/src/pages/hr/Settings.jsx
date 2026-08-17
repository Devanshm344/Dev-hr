import { useEffect, useState } from "react";
import { PageHeader } from "@/components/ui-custom";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/switch";
import { Separator } from "@/components/ui/separator";
import { Save, Bell, Check } from "lucide-react";
export default function HRSettings() {
  const [prefs, setPrefs] = useState({
    registrationAlert: true,
    benefitRequestAlert: true
  });
  const [prefsLoading, setPrefsLoading] = useState(true);
  const [prefsSaving, setPrefsSaving] = useState(false);
  const [prefsSaved, setPrefsSaved] = useState(false);
  useEffect(() => {
    fetch("/api/settings/staff-notification-prefs").then(res => res.json()).then(data => setPrefs(data.prefs)).catch(() => {}).finally(() => setPrefsLoading(false));
  }, []);
  const savePrefs = async () => {
    setPrefsSaving(true);
    setPrefsSaved(false);
    try {
      await fetch("/api/settings/staff-notification-prefs", {
        method: "PUT",
        headers: {
          "Content-Type": "application/json"
        },
        body: JSON.stringify(prefs)
      });
      setPrefsSaved(true);
      setTimeout(() => setPrefsSaved(false), 2500);
    } finally {
      setPrefsSaving(false);
    }
  };
  return <>
      <PageHeader title="HR Settings" description="Configure HR portal preferences and workflow settings." breadcrumbs={[{
      label: "HR Portal"
    }, {
      label: "Settings"
    }]} />

      <div className="max-w-2xl">
        <Card className="border-border">
          <CardHeader><CardTitle className="text-base">HR Notification Settings</CardTitle></CardHeader>
          <CardContent className="space-y-4">
            {prefsLoading ? <p className="text-sm text-muted-foreground">Loading...</p> : <>
                <div>
                  <div className="flex items-center justify-between">
                    <div><p className="text-sm font-medium text-foreground">New Registration Alert</p><p className="text-xs text-muted-foreground mt-0.5">Notify when a new registration is submitted</p></div>
                    <Switch checked={prefs.registrationAlert} onCheckedChange={v => setPrefs(p => ({
                  ...p,
                  registrationAlert: v
                }))} />
                  </div>
                  <Separator className="mt-4" />
                </div>
                <div>
                  <div className="flex items-center justify-between">
                    <div><p className="text-sm font-medium text-foreground">Benefit Request Alert</p><p className="text-xs text-muted-foreground mt-0.5">Notify for new benefit requests requiring review</p></div>
                    <Switch checked={prefs.benefitRequestAlert} onCheckedChange={v => setPrefs(p => ({
                  ...p,
                  benefitRequestAlert: v
                }))} />
                  </div>
                  <Separator className="mt-4" />
                </div>
                <div className="flex items-center gap-3">
                  <Button className="td-gradient border-0 text-white gap-2" onClick={savePrefs} disabled={prefsSaving}>
                    <Save className="h-4 w-4" />{prefsSaving ? "Saving..." : "Save"}
                  </Button>
                  {prefsSaved && <span className="text-sm text-emerald-600 flex items-center gap-1"><Check className="h-4 w-4" />Saved</span>}
                </div>
              </>}
          </CardContent>
        </Card>
      </div>
    </>;
}
