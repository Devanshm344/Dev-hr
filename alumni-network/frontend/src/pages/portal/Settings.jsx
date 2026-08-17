import { useEffect, useState } from "react";
import { PageHeader } from "@/components/ui-custom";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Switch } from "@/components/ui/switch";
import { Separator } from "@/components/ui/separator";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Bell, Shield, Palette, Globe, Save, CheckCircle, Eye, EyeOff } from "lucide-react";
import { useTheme } from "next-themes";
const notifSettings = [{
  label: "Email Notifications",
  desc: "Receive notifications via email",
  key: "email"
}, {
  label: "New Messages",
  desc: "Notify when you receive a new message",
  key: "messages"
}, {
  label: "Event Reminders",
  desc: "Reminders for upcoming events",
  key: "events"
}, {
  label: "Request Updates",
  desc: "Status updates for your service requests",
  key: "requests"
}, {
  label: "New Benefits",
  desc: "Alerts when new benefits are added",
  key: "benefits"
}, {
  label: "Forum Replies",
  desc: "Notify when someone replies to your posts",
  key: "forum"
}, {
  label: "Announcements",
  desc: "Important announcements from HR",
  key: "announcements"
}];
const privacySettings = [{
  label: "Show my profile in alumni directory",
  desc: "Other alumni can find and view your profile",
  key: "show_in_directory"
}, {
  label: "Allow connection requests",
  desc: "Let other alumni send you connection requests",
  key: "allow_connection_requests"
}, {
  label: "Show my online status",
  desc: "Display when you're active on the portal",
  key: "show_online_status"
}, {
  label: "Share activity with community",
  desc: "Show your forum posts and event attendance",
  key: "share_activity"
}];
export default function SettingsPage() {
  const {
    theme,
    setTheme
  } = useTheme();
  const [notifs, setNotifs] = useState({});
  const [notifsLoading, setNotifsLoading] = useState(true);
  const [notifsSaving, setNotifsSaving] = useState(false);
  const [notifsSaved, setNotifsSaved] = useState(false);
  const [privacy, setPrivacy] = useState({});
  const [privacyLoading, setPrivacyLoading] = useState(true);
  const [privacySaving, setPrivacySaving] = useState(false);
  const [privacySaved, setPrivacySaved] = useState(false);
  const [pwForm, setPwForm] = useState({
    current: "",
    next: "",
    confirm: ""
  });
  const [pwSaving, setPwSaving] = useState(false);
  const [pwError, setPwError] = useState(null);
  const [pwSuccess, setPwSuccess] = useState(false);
  const [showCurrentPw, setShowCurrentPw] = useState(false);
  const [showNewPw, setShowNewPw] = useState(false);
  const [showConfirmPw, setShowConfirmPw] = useState(false);
  useEffect(() => {
    fetch("/api/settings/notification-prefs").then(res => res.json()).then(data => setNotifs(data.prefs ?? {})).finally(() => setNotifsLoading(false));
    fetch("/api/settings/privacy").then(res => res.json()).then(data => setPrivacy(data.privacy ?? {})).finally(() => setPrivacyLoading(false));
  }, []);
  const saveNotifs = async () => {
    setNotifsSaving(true);
    try {
      const res = await fetch("/api/settings/notification-prefs", {
        method: "PUT",
        headers: {
          "Content-Type": "application/json"
        },
        body: JSON.stringify(notifs)
      });
      if (res.ok) {
        setNotifsSaved(true);
        setTimeout(() => setNotifsSaved(false), 2500);
      }
    } finally {
      setNotifsSaving(false);
    }
  };
  const savePrivacy = async () => {
    setPrivacySaving(true);
    try {
      const res = await fetch("/api/settings/privacy", {
        method: "PUT",
        headers: {
          "Content-Type": "application/json"
        },
        body: JSON.stringify(privacy)
      });
      if (res.ok) {
        setPrivacySaved(true);
        setTimeout(() => setPrivacySaved(false), 2500);
      }
    } finally {
      setPrivacySaving(false);
    }
  };
  const changePassword = async () => {
    setPwError(null);
    setPwSuccess(false);
    if (!pwForm.current || !pwForm.next || !pwForm.confirm) {
      setPwError("All fields are required.");
      return;
    }
    if (pwForm.next !== pwForm.confirm) {
      setPwError("New password and confirmation don't match.");
      return;
    }
    setPwSaving(true);
    try {
      const res = await fetch("/api/auth/change-password", {
        method: "POST",
        headers: {
          "Content-Type": "application/json"
        },
        body: JSON.stringify({
          currentPassword: pwForm.current,
          newPassword: pwForm.next,
          confirmPassword: pwForm.confirm
        })
      });
      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        throw new Error(body.error || "Something went wrong.");
      }
      setPwForm({
        current: "",
        next: "",
        confirm: ""
      });
      setPwSuccess(true);
      setTimeout(() => setPwSuccess(false), 3000);
    } catch (err) {
      setPwError(err instanceof Error ? err.message : "Something went wrong.");
    } finally {
      setPwSaving(false);
    }
  };
  return <>
      <PageHeader title="Settings" description="Manage your account preferences and privacy." breadcrumbs={[{
      label: "Portal"
    }, {
      label: "Settings"
    }]} />

      <div className="max-w-2xl">
        <Tabs defaultValue="notifications">
          <TabsList className="grid grid-cols-4 w-full mb-6">
            <TabsTrigger value="notifications" className="text-xs gap-1.5"><Bell className="h-3.5 w-3.5" /><span className="hidden sm:block">Notifications</span></TabsTrigger>
            <TabsTrigger value="security" className="text-xs gap-1.5"><Shield className="h-3.5 w-3.5" /><span className="hidden sm:block">Security</span></TabsTrigger>
            <TabsTrigger value="appearance" className="text-xs gap-1.5"><Palette className="h-3.5 w-3.5" /><span className="hidden sm:block">Appearance</span></TabsTrigger>
            <TabsTrigger value="privacy" className="text-xs gap-1.5"><Globe className="h-3.5 w-3.5" /><span className="hidden sm:block">Privacy</span></TabsTrigger>
          </TabsList>

          <TabsContent value="notifications">
            <Card className="border-border">
              <CardHeader><CardTitle className="text-base">Notification Preferences</CardTitle></CardHeader>
              <CardContent className="space-y-4">
                {notifsLoading && <p className="text-sm text-muted-foreground">Loading...</p>}
                {!notifsLoading && notifSettings.map(s => <div key={s.key}>
                    <div className="flex items-center justify-between">
                      <div>
                        <p className="text-sm font-medium text-foreground">{s.label}</p>
                        <p className="text-xs text-muted-foreground mt-0.5">{s.desc}</p>
                      </div>
                      <Switch checked={notifs[s.key] ?? false} onCheckedChange={v => setNotifs(n => ({
                    ...n,
                    [s.key]: v
                  }))} />
                    </div>
                    <Separator className="mt-4" />
                  </div>)}
                <div className="flex items-center gap-3">
                  <Button className="td-gradient border-0 text-white gap-2" onClick={saveNotifs} disabled={notifsSaving || notifsLoading}>
                    <Save className="h-4 w-4" />{notifsSaving ? "Saving..." : "Save Preferences"}
                  </Button>
                  {notifsSaved && <span className="text-sm text-emerald-600 flex items-center gap-1"><CheckCircle className="h-4 w-4" />Saved</span>}
                </div>
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="security">
            <Card className="border-border">
              <CardHeader><CardTitle className="text-base">Security Settings</CardTitle></CardHeader>
              <CardContent className="space-y-6">
                <div className="space-y-4">
                  <h3 className="text-sm font-semibold text-foreground">Change Password</h3>
                  <div className="space-y-3">
                    <div className="space-y-1.5"><Label>Current Password</Label>
                      <div className="relative">
                        <Input type={showCurrentPw ? "text" : "password"} placeholder="••••••••" className="pr-10" value={pwForm.current} onChange={e => setPwForm(f => ({
                        ...f,
                        current: e.target.value
                      }))} />
                        <button type="button" onClick={() => setShowCurrentPw(v => !v)} className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground" tabIndex={-1}>
                          {showCurrentPw ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                        </button>
                      </div>
                    </div>
                    <div className="space-y-1.5"><Label>New Password</Label>
                      <div className="relative">
                        <Input type={showNewPw ? "text" : "password"} placeholder="••••••••" className="pr-10" value={pwForm.next} onChange={e => setPwForm(f => ({
                        ...f,
                        next: e.target.value
                      }))} />
                        <button type="button" onClick={() => setShowNewPw(v => !v)} className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground" tabIndex={-1}>
                          {showNewPw ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                        </button>
                      </div>
                    </div>
                    <div className="space-y-1.5"><Label>Confirm New Password</Label>
                      <div className="relative">
                        <Input type={showConfirmPw ? "text" : "password"} placeholder="••••••••" className="pr-10" value={pwForm.confirm} onChange={e => setPwForm(f => ({
                        ...f,
                        confirm: e.target.value
                      }))} />
                        <button type="button" onClick={() => setShowConfirmPw(v => !v)} className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground" tabIndex={-1}>
                          {showConfirmPw ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                        </button>
                      </div>
                    </div>
                  </div>
                  {pwError && <p className="text-sm text-destructive">{pwError}</p>}
                  {pwSuccess && <p className="text-sm text-emerald-600 flex items-center gap-1"><CheckCircle className="h-4 w-4" />Password updated successfully.</p>}
                  <Button variant="outline" onClick={changePassword} disabled={pwSaving}>{pwSaving ? "Updating..." : "Update Password"}</Button>
                </div>
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="appearance">
            <Card className="border-border">
              <CardHeader><CardTitle className="text-base">Appearance</CardTitle></CardHeader>
              <CardContent className="space-y-6">
                <div className="space-y-3">
                  <Label>Theme</Label>
                  <div className="grid grid-cols-3 gap-3">
                    {[{
                    value: "light",
                    label: "Light",
                    bg: "bg-white",
                    border: "border-slate-200"
                  }, {
                    value: "dark",
                    label: "Dark",
                    bg: "bg-slate-900",
                    border: "border-slate-700"
                  }, {
                    value: "system",
                    label: "System",
                    bg: "bg-gradient-to-r from-white to-slate-900",
                    border: "border-slate-400"
                  }].map(t => <button key={t.value} onClick={() => setTheme(t.value)} className={`p-3 rounded-lg border-2 transition-all ${theme === t.value ? "border-primary" : "border-border"}`}>
                        <div className={`h-12 rounded-md ${t.bg} ${t.border} border mb-2`} />
                        <p className="text-xs font-medium text-foreground">{t.label}</p>
                      </button>)}
                  </div>
                </div>
                <Separator />
                <div className="space-y-1.5">
                  <Label>Language</Label>
                  <Select defaultValue="en">
                    <SelectTrigger className="w-full"><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="en">English (US)</SelectItem>
                      <SelectItem value="es">Español</SelectItem>
                      <SelectItem value="fr">Français</SelectItem>
                    </SelectContent>
                  </Select>
                  <p className="text-xs text-muted-foreground">Translations aren&apos;t available yet — this portal is English-only for now.</p>
                </div>
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="privacy">
            <Card className="border-border">
              <CardHeader><CardTitle className="text-base">Privacy Settings</CardTitle></CardHeader>
              <CardContent className="space-y-4">
                {privacyLoading && <p className="text-sm text-muted-foreground">Loading...</p>}
                {!privacyLoading && privacySettings.map(s => <div key={s.key}>
                    <div className="flex items-center justify-between">
                      <div>
                        <p className="text-sm font-medium text-foreground">{s.label}</p>
                        <p className="text-xs text-muted-foreground mt-0.5">{s.desc}</p>
                      </div>
                      <Switch checked={privacy[s.key] ?? false} onCheckedChange={v => setPrivacy(p => ({
                    ...p,
                    [s.key]: v
                  }))} />
                    </div>
                    <Separator className="mt-4" />
                  </div>)}
                <div className="flex items-center gap-3">
                  <Button className="td-gradient border-0 text-white gap-2" onClick={savePrivacy} disabled={privacySaving || privacyLoading}>
                    <Save className="h-4 w-4" />{privacySaving ? "Saving..." : "Save Settings"}
                  </Button>
                  {privacySaved && <span className="text-sm text-emerald-600 flex items-center gap-1"><CheckCircle className="h-4 w-4" />Saved</span>}
                </div>
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>
      </div>
    </>;
}
