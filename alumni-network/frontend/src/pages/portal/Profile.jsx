import { useEffect, useState } from "react";
import { PageHeader, StatusBadge, EmptyState } from "@/components/ui-custom";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Separator } from "@/components/ui/separator";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Edit, Mail, Phone, Linkedin, Briefcase, Users, Plus, Trash2, Camera } from "lucide-react";
import { useCurrentUser } from "@/lib/current-user-context";
import { allCountries } from "country-region-data";
function ProfileContent() {
  const {
    user,
    loading,
    updateUser,
    updatePhoto
  } = useCurrentUser();
  const [editing, setEditing] = useState(false);
  const [saving, setSaving] = useState(false);
  const [uploadingPhoto, setUploadingPhoto] = useState(false);
  const [photoError, setPhotoError] = useState(null);
  const [form, setForm] = useState({
    firstName: "",
    lastName: "",
    phone: "",
    linkedinUrl: "",
    country: "",
    state: "",
    employer: "",
    designation: "",
    industry: "",
    professionalStatus: "",
    rolesHeld: "",
    achievements: ""
  });
  const [family, setFamily] = useState([]);
  useEffect(() => {
    if (user) {
      setForm({
        firstName: user.firstName ?? "",
        lastName: user.lastName ?? "",
        phone: user.phone ?? "",
        linkedinUrl: user.linkedinUrl ?? "",
        country: user.country ?? "",
        state: user.state ?? "",
        employer: user.employer ?? "",
        designation: user.designation ?? "",
        industry: user.industry ?? "",
        professionalStatus: user.professionalStatus ?? "",
        rolesHeld: user.rolesHeld ?? "",
        achievements: user.achievements ?? ""
      });
      setFamily(user.familyMembers ?? []);
    }
  }, [user]);
  const handleSave = async () => {
    setSaving(true);
    const updated = await updateUser({
      ...form,
      familyMembers: family
    });
    setSaving(false);
    if (updated) setEditing(false);
  };
  const handlePhotoChange = async e => {
    const file = e.target.files?.[0];
    e.target.value = "";
    if (!file) return;
    setPhotoError(null);
    setUploadingPhoto(true);
    const {
      error
    } = await updatePhoto(file);
    setUploadingPhoto(false);
    if (error) setPhotoError(error);
  };
  const initials = (user?.fullName ?? "").split(" ").map(n => n[0]).join("").slice(0, 2).toUpperCase();
  const regionsForCountry = allCountries.find(([name]) => name === form.country)?.[2] ?? [];
  if (loading || !user) {
    return <p className="text-sm text-muted-foreground">Loading your profile...</p>;
  }
  return <>
      <PageHeader title="My Profile" description="Manage your personal and professional information." breadcrumbs={[{
      label: "Portal"
    }, {
      label: "My Profile"
    }]}>
        <Button onClick={() => editing ? handleSave() : setEditing(true)} disabled={saving} variant={editing ? "default" : "outline"} className={editing ? "td-gradient border-0 text-white" : ""} size="sm">
          <Edit className="h-4 w-4 mr-2" />{editing ? saving ? "Saving..." : "Save Changes" : "Edit Profile"}
        </Button>
      </PageHeader>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Left column */}
        <div className="space-y-6">
          <Card className="border-border text-center">
            <CardContent className="pt-8 pb-6">
              <div className="relative h-24 w-24 mx-auto">
                <Avatar className="h-24 w-24">
                  <AvatarImage src={user.profilePhotoPath ?? undefined} />
                  <AvatarFallback className="text-2xl bg-primary text-primary-foreground">{initials || "?"}</AvatarFallback>
                </Avatar>
                {editing && <label className="absolute inset-0 rounded-full flex items-center justify-center bg-black/50 opacity-0 hover:opacity-100 transition-opacity cursor-pointer">
                    {uploadingPhoto ? <span className="text-white text-[10px]">Uploading...</span> : <Camera className="h-6 w-6 text-white" />}
                    <input type="file" accept="image/jpeg" className="hidden" onChange={handlePhotoChange} disabled={uploadingPhoto} />
                  </label>}
              </div>
              {photoError && <p className="text-xs text-destructive mt-2">{photoError}</p>}
              <h2 className="mt-4 font-bold text-xl text-foreground">{user.fullName}</h2>
              <p className="text-muted-foreground text-sm">{user.designation || "Designation not set"}</p>
              <p className="text-muted-foreground text-xs mt-1">{user.employer || "Employer not set"}</p>
              <StatusBadge status={user.status} className="mt-3" />
              <Separator className="my-4" />
              <div className="space-y-2 text-sm">
                <div className="flex items-center gap-2 text-muted-foreground"><Mail className="h-4 w-4 shrink-0" /><span className="truncate text-xs">{user.email}</span></div>
                <div className="flex items-center gap-2 text-muted-foreground"><Phone className="h-4 w-4 shrink-0" /><span className="text-xs">{user.phone}</span></div>
                {user.linkedinUrl && <div className="flex items-center gap-2 text-primary"><Linkedin className="h-4 w-4 shrink-0" /><a href={user.linkedinUrl} target="_blank" rel="noreferrer" className="text-xs hover:underline truncate">{user.linkedinUrl}</a></div>}
              </div>
            </CardContent>
          </Card>

          <Card className="border-border">
            <CardHeader className="pb-3"><CardTitle className="text-sm font-semibold flex items-center gap-2"><Briefcase className="h-3.5 w-3.5" />TechDemocracy Tenure</CardTitle></CardHeader>
            <CardContent className="text-sm space-y-2">
              <p className="text-muted-foreground text-xs">Joined {user.joiningMonth} {user.joiningYear}</p>
              {user.achievements && <p className="text-xs text-foreground">{user.achievements}</p>}
              {!user.achievements && <p className="text-xs text-muted-foreground">No achievements added yet.</p>}
            </CardContent>
          </Card>
        </div>

        {/* Right column */}
        <div className="lg:col-span-2">
          <Tabs defaultValue="personal">
            <TabsList className="grid grid-cols-3 w-full mb-6">
              <TabsTrigger value="personal" className="text-xs">Personal</TabsTrigger>
              <TabsTrigger value="professional" className="text-xs">Professional</TabsTrigger>
              <TabsTrigger value="family" className="text-xs">Family</TabsTrigger>
            </TabsList>

            <TabsContent value="personal">
              <Card className="border-border">
                <CardHeader><CardTitle className="text-base">Personal Details</CardTitle></CardHeader>
                <CardContent className="grid grid-cols-1 md:grid-cols-2 gap-5">
                  <div className="space-y-1.5">
                    <Label className="text-xs text-muted-foreground">First Name</Label>
                    {editing ? <Input value={form.firstName} onChange={e => setForm(f => ({
                    ...f,
                    firstName: e.target.value
                  }))} className="h-9" /> : <p className="text-sm font-medium text-foreground">{user.firstName}</p>}
                  </div>
                  <div className="space-y-1.5">
                    <Label className="text-xs text-muted-foreground">Last Name</Label>
                    {editing ? <Input value={form.lastName} onChange={e => setForm(f => ({
                    ...f,
                    lastName: e.target.value
                  }))} className="h-9" /> : <p className="text-sm font-medium text-foreground">{user.lastName}</p>}
                  </div>
                  <div className="space-y-1.5">
                    <Label className="text-xs text-muted-foreground">Email</Label>
                    <p className="text-sm font-medium text-foreground">{user.email}</p>
                  </div>
                  <div className="space-y-1.5">
                    <Label className="text-xs text-muted-foreground">Phone</Label>
                    {editing ? <Input value={form.phone} onChange={e => setForm(f => ({
                    ...f,
                    phone: e.target.value
                  }))} className="h-9" /> : <p className="text-sm font-medium text-foreground">{user.phone}</p>}
                  </div>
                  <div className="space-y-1.5">
                    <Label className="text-xs text-muted-foreground">LinkedIn</Label>
                    {editing ? <Input value={form.linkedinUrl} onChange={e => setForm(f => ({
                    ...f,
                    linkedinUrl: e.target.value
                  }))} className="h-9" placeholder="https://linkedin.com/in/..." /> : <p className="text-sm font-medium text-foreground truncate">{user.linkedinUrl || "Not provided"}</p>}
                  </div>
                  <div className="space-y-1.5">
                    <Label className="text-xs text-muted-foreground">Country</Label>
                    {editing ? <select className="w-full h-9 px-3 rounded-md border border-input bg-background text-sm focus:outline-none focus:ring-2 focus:ring-ring" value={form.country} onChange={e => setForm(f => ({
                    ...f,
                    country: e.target.value,
                    state: ""
                  }))}>
                        <option value="">Select country</option>
                        {allCountries.map(([name]) => <option key={name} value={name}>{name}</option>)}
                      </select> : <p className="text-sm font-medium text-foreground">{user.country || "Not provided"}</p>}
                  </div>
                  <div className="space-y-1.5">
                    <Label className="text-xs text-muted-foreground">State / Region</Label>
                    {editing ? <select className="w-full h-9 px-3 rounded-md border border-input bg-background text-sm focus:outline-none focus:ring-2 focus:ring-ring disabled:opacity-50" value={form.state} onChange={e => setForm(f => ({
                    ...f,
                    state: e.target.value
                  }))} disabled={regionsForCountry.length === 0}>
                        <option value="">{regionsForCountry.length === 0 ? "Select country first" : "Select state / region"}</option>
                        {regionsForCountry.map(([name]) => <option key={name} value={name}>{name}</option>)}
                      </select> : <p className="text-sm font-medium text-foreground">{user.state || "Not provided"}</p>}
                  </div>
                </CardContent>
              </Card>
            </TabsContent>

            <TabsContent value="professional">
              <Card className="border-border">
                <CardHeader><CardTitle className="text-base">Professional Details</CardTitle></CardHeader>
                <CardContent className="grid grid-cols-1 md:grid-cols-2 gap-5">
                  <div className="space-y-1.5">
                    <Label className="text-xs text-muted-foreground">Current Employer</Label>
                    {editing ? <Input value={form.employer} onChange={e => setForm(f => ({
                    ...f,
                    employer: e.target.value
                  }))} className="h-9" /> : <p className="text-sm font-medium text-foreground">{user.employer || "Not provided"}</p>}
                  </div>
                  <div className="space-y-1.5">
                    <Label className="text-xs text-muted-foreground">Designation</Label>
                    {editing ? <Input value={form.designation} onChange={e => setForm(f => ({
                    ...f,
                    designation: e.target.value
                  }))} className="h-9" /> : <p className="text-sm font-medium text-foreground">{user.designation || "Not provided"}</p>}
                  </div>
                  <div className="space-y-1.5">
                    <Label className="text-xs text-muted-foreground">Industry</Label>
                    {editing ? <Input value={form.industry} onChange={e => setForm(f => ({
                    ...f,
                    industry: e.target.value
                  }))} className="h-9" /> : <p className="text-sm font-medium text-foreground">{user.industry}</p>}
                  </div>
                  <div className="space-y-1.5">
                    <Label className="text-xs text-muted-foreground">Professional Status</Label>
                    {editing ? <Input value={form.professionalStatus} onChange={e => setForm(f => ({
                    ...f,
                    professionalStatus: e.target.value
                  }))} className="h-9" /> : <p className="text-sm font-medium text-foreground">{user.professionalStatus}</p>}
                  </div>
                  <div className="space-y-1.5">
                    <Label className="text-xs text-muted-foreground">TechDemocracy Joining Year</Label>
                    <p className="text-sm font-medium text-foreground">{user.joiningMonth} {user.joiningYear}</p>
                  </div>
                  <div className="space-y-1.5 md:col-span-2">
                    <Label className="text-xs text-muted-foreground">Roles at TechDemocracy</Label>
                    {editing ? <textarea className="w-full h-20 px-3 py-2 rounded-md border border-input bg-background text-sm focus:outline-none focus:ring-2 focus:ring-ring resize-none" value={form.rolesHeld} onChange={e => setForm(f => ({
                    ...f,
                    rolesHeld: e.target.value
                  }))} /> : <p className="text-sm font-medium text-foreground">{user.rolesHeld || "Not provided"}</p>}
                  </div>
                  <div className="space-y-1.5 md:col-span-2">
                    <Label className="text-xs text-muted-foreground">Achievements</Label>
                    {editing ? <textarea className="w-full h-20 px-3 py-2 rounded-md border border-input bg-background text-sm focus:outline-none focus:ring-2 focus:ring-ring resize-none" value={form.achievements} onChange={e => setForm(f => ({
                    ...f,
                    achievements: e.target.value
                  }))} /> : <p className="text-sm font-medium text-foreground">{user.achievements || "Not provided"}</p>}
                  </div>
                </CardContent>
              </Card>
            </TabsContent>

            <TabsContent value="family">
              <Card className="border-border">
                <CardHeader className="flex-row items-center justify-between">
                  <CardTitle className="text-base">Family Members</CardTitle>
                  {editing && <Button size="sm" variant="outline" className="gap-1.5 h-8" onClick={() => setFamily(f => [...f, {
                  name: "",
                  relationship: "",
                  career: ""
                }])}>
                      <Plus className="h-3.5 w-3.5" />Add Member
                    </Button>}
                </CardHeader>
                <CardContent className="space-y-4">
                  {family.length === 0 && !editing && <EmptyState icon={Users} title="No family members added" description="Family details you provide will appear here." />}
                  {family.map((f, i) => <div key={i} className="p-4 rounded-lg border border-border bg-secondary/20">
                      {editing ? <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                          <Input placeholder="Name" value={f.name} onChange={e => setFamily(arr => arr.map((m, j) => j === i ? {
                      ...m,
                      name: e.target.value
                    } : m))} className="h-9" />
                          <Input placeholder="Relationship" value={f.relationship} onChange={e => setFamily(arr => arr.map((m, j) => j === i ? {
                      ...m,
                      relationship: e.target.value
                    } : m))} className="h-9" />
                          <div className="flex gap-2">
                            <Input placeholder="Career / Company" value={f.career} onChange={e => setFamily(arr => arr.map((m, j) => j === i ? {
                        ...m,
                        career: e.target.value
                      } : m))} className="h-9" />
                            <Button variant="ghost" size="icon" className="h-9 w-9 shrink-0 text-destructive" onClick={() => setFamily(arr => arr.filter((_, j) => j !== i))}>
                              <Trash2 className="h-4 w-4" />
                            </Button>
                          </div>
                        </div> : <div className="flex items-center justify-between">
                          <div className="flex items-center gap-3">
                            <div className="w-9 h-9 rounded-full bg-secondary flex items-center justify-center text-xs font-bold text-muted-foreground">{f.name[0] ?? "?"}</div>
                            <div>
                              <p className="text-sm font-medium text-foreground">{f.name}</p>
                              <p className="text-xs text-muted-foreground">{f.relationship}</p>
                            </div>
                          </div>
                          {f.career && <Badge variant="secondary" className="text-xs">{f.career}</Badge>}
                        </div>}
                    </div>)}
                </CardContent>
              </Card>
            </TabsContent>
          </Tabs>
        </div>
      </div>
    </>;
}
export default function ProfilePage() {
  return <>
      <ProfileContent />
    </>;
}
