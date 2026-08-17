import { useEffect, useRef, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Checkbox } from "@/components/ui/checkbox";
import { Badge } from "@/components/ui/badge";
import { ChevronLeft, ChevronRight, Check, Upload, Plus, Trash2, User, Briefcase, Users, GraduationCap, Gift, FileCheck, Eye, EyeOff } from "lucide-react";
import { cn } from "@/lib/utils";
import { allCountries } from "country-region-data";
const steps = [{
  id: 1,
  title: "Personal Info",
  icon: User
}, {
  id: 2,
  title: "Professional",
  icon: Briefcase
}, {
  id: 3,
  title: "Family",
  icon: Users
}, {
  id: 4,
  title: "Alumni Info",
  icon: GraduationCap
}, {
  id: 5,
  title: "Benefits",
  icon: Gift
}, {
  id: 6,
  title: "Terms",
  icon: FileCheck
}];
const currentYear = new Date().getFullYear();
const years = Array.from({
  length: 20
}, (_, i) => currentYear - i);
const isValidLinkedinUrl = value => {
  if (!value.trim()) return true;
  try {
    const url = new URL(value);
    return (url.protocol === "http:" || url.protocol === "https:") && url.hostname.includes(".");
  } catch {
    return false;
  }
};
export default function RegisterPage() {
  const [step, setStep] = useState(1);
  const [submitted, setSubmitted] = useState(false);
  const [selectedBenefits, setSelectedBenefits] = useState([]);
  const [availableBenefits, setAvailableBenefits] = useState([]);
  const [registrationsOpen, setRegistrationsOpen] = useState(true);
  const [checkingSettings, setCheckingSettings] = useState(true);
  useEffect(() => {
    fetch("/api/benefits?active=true").then(res => res.json()).then(data => setAvailableBenefits(data.benefits ?? [])).catch(() => {});
    fetch("/api/system-settings/public").then(res => res.json()).then(data => setRegistrationsOpen(data.allowNewRegistrations !== false)).catch(() => {}).finally(() => setCheckingSettings(false));
  }, []);
  const [family, setFamily] = useState([{
    name: "",
    relationship: "",
    career: ""
  }]);
  const navigate = useNavigate();
  const [firstName, setFirstName] = useState("");
  const [lastName, setLastName] = useState("");
  const [email, setEmail] = useState("");
  const [phone, setPhone] = useState("");
  const [linkedin, setLinkedin] = useState("");
  const [country, setCountry] = useState("");
  const [state, setState] = useState("");
  const regionsForCountry = allCountries.find(([name]) => name === country)?.[2] ?? [];
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  const [professionalStatus, setProfessionalStatus] = useState("");
  const [employer, setEmployer] = useState("");
  const [designation, setDesignation] = useState("");
  const [industry, setIndustry] = useState("");
  const [exitedYear, setExitedYear] = useState("");
  const [rolesHeld, setRolesHeld] = useState("");
  const [achievements, setAchievements] = useState("");
  const [agreedTerms, setAgreedTerms] = useState(false);
  const [agreedComms, setAgreedComms] = useState(false);
  const [photoFile, setPhotoFile] = useState(null);
  const [photoPreview, setPhotoPreview] = useState(null);
  const [photoError, setPhotoError] = useState(null);
  const photoInputRef = useRef(null);
  const [resumeFile, setResumeFile] = useState(null);
  const [resumeError, setResumeError] = useState(null);
  const resumeInputRef = useRef(null);
  const [submitting, setSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState(null);
  const progress = (step - 1) / (steps.length - 1) * 100;
  const toggleBenefit = id => {
    setSelectedBenefits(prev => prev.includes(id) ? prev.filter(b => b !== id) : [...prev, id]);
  };
  const handlePhotoSelect = file => {
    if (!file) return;
    if (file.type !== "image/jpeg") {
      setPhotoError("Only JPEG (.jpg/.jpeg) files are accepted.");
      return;
    }
    setPhotoError(null);
    setPhotoFile(file);
    setPhotoPreview(prev => {
      if (prev) URL.revokeObjectURL(prev);
      return URL.createObjectURL(file);
    });
  };
  const ALLOWED_RESUME_TYPES = ["application/pdf", "application/msword", "application/vnd.openxmlformats-officedocument.wordprocessingml.document"];
  const handleResumeSelect = file => {
    if (!file) return;
    if (!ALLOWED_RESUME_TYPES.includes(file.type)) {
      setResumeError("Only PDF, DOC, or DOCX files are accepted.");
      return;
    }
    setResumeError(null);
    setResumeFile(file);
  };
  const handleSubmit = async () => {
    setSubmitting(true);
    setSubmitError(null);
    try {
      const formData = new FormData();
      formData.append("firstName", firstName);
      formData.append("lastName", lastName);
      formData.append("email", email);
      formData.append("phone", phone);
      formData.append("linkedin", linkedin);
      formData.append("country", country);
      formData.append("state", state);
      formData.append("password", password);
      formData.append("professionalStatus", professionalStatus);
      formData.append("employer", employer);
      formData.append("designation", designation);
      formData.append("industry", industry);
      formData.append("exitedYear", exitedYear);
      formData.append("rolesHeld", rolesHeld);
      formData.append("achievements", achievements);
      formData.append("familyMembers", JSON.stringify(family));
      formData.append("selectedBenefits", JSON.stringify(selectedBenefits));
      formData.append("agreedTerms", String(agreedTerms));
      formData.append("agreedComms", String(agreedComms));
      if (photoFile) formData.append("photo", photoFile);
      if (resumeFile) formData.append("resume", resumeFile);
      const res = await fetch("/api/register", {
        method: "POST",
        body: formData
      });
      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        throw new Error(body.error || "Something went wrong. Please try again.");
      }
      setSubmitted(true);
    } catch (err) {
      setSubmitError(err instanceof Error ? err.message : "Something went wrong. Please try again.");
    } finally {
      setSubmitting(false);
    }
  };
  const isStepValid = (() => {
    switch (step) {
      case 1:
        return firstName.trim() !== "" && lastName.trim() !== "" && /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email) && phone.trim() !== "" && country.trim() !== "" && password.length >= 8 && password === confirmPassword && isValidLinkedinUrl(linkedin);
      case 2:
        return professionalStatus !== "" && industry !== "";
      case 4:
        return exitedYear !== "";
      case 5:
        return selectedBenefits.length > 0;
      case 6:
        return agreedTerms;
      default:
        return true;
    }
  })();
  if (!checkingSettings && !registrationsOpen) {
    return <div className="min-h-screen flex items-center justify-center bg-background p-6">
        <div className="max-w-md w-full text-center">
          <h1 className="text-2xl font-bold text-foreground">Registrations Currently Closed</h1>
          <p className="mt-3 text-muted-foreground">We&apos;re not accepting new alumni registrations at this time. Please check back later.</p>
          <Button className="mt-6 td-gradient border-0 text-white" asChild><Link to="/">Back to Home</Link></Button>
        </div>
      </div>;
  }
  if (submitted) {
    return <div className="min-h-screen flex items-center justify-center bg-background p-6">
        <div className="max-w-md w-full text-center">
          <div className="w-20 h-20 rounded-full bg-emerald-100 dark:bg-emerald-900/30 flex items-center justify-center mx-auto mb-6">
            <Check className="h-10 w-10 text-emerald-600" />
          </div>
          <h1 className="text-2xl font-bold text-foreground">Registration Submitted Successfully!</h1>
          <p className="mt-3 text-muted-foreground">Your registration is pending HR approval. You&apos;ll receive an email once your account is approved.</p>
          <div className="mt-6 p-4 rounded-lg bg-blue-50 dark:bg-blue-950/30 border border-blue-200 dark:border-blue-800">
            <p className="text-sm text-blue-700 dark:text-blue-300 font-medium">What happens next?</p>
            <ul className="mt-2 space-y-1 text-sm text-blue-600 dark:text-blue-400">
              <li>• HR review: 2-3 business days</li>
              <li>• Email confirmation sent upon approval</li>
              <li>• Access portal with approved benefits</li>
            </ul>
          </div>
          <Button className="mt-6 td-gradient border-0 text-white" asChild><Link to="/login">Go to Login</Link></Button>
        </div>
      </div>;
  }
  return <div className="min-h-screen bg-background">
      {/* Header */}
      <div className="sticky top-0 z-30 bg-white/95 dark:bg-slate-900/95 backdrop-blur border-b border-border">
        <div className="max-w-4xl mx-auto px-4 py-4 flex items-center justify-between">
          <Link to="/" className="flex items-center gap-2">
            <img src="/logo.png" alt="TechDemocracy" className="w-8 h-8" />
            <span className="font-bold text-foreground text-sm">TechDemocracy</span>
          </Link>
          <div className="text-right">
            <p className="text-xs text-muted-foreground">Step {step} of {steps.length}</p>
            <p className="text-sm font-semibold text-foreground">{steps[step - 1].title}</p>
          </div>
        </div>
        <div className="h-1 bg-secondary overflow-hidden">
            <div className="h-full bg-primary transition-all duration-500" style={{
          width: `${progress}%`
        }} />
          </div>
      </div>

      <div className="max-w-4xl mx-auto px-4 py-8">
        {/* Steps indicator */}
        <div className="hidden md:flex items-center justify-center mb-8">
          {steps.map((s, i) => <div key={s.id} className="flex items-center">
              <div className={cn("flex flex-col items-center gap-1 cursor-default", i > 0 && "ml-2")}>
                <div className={cn("w-9 h-9 rounded-full flex items-center justify-center border-2 transition-all", step > s.id ? "bg-primary border-primary text-primary-foreground" : step === s.id ? "border-primary text-primary bg-primary/10" : "border-border text-muted-foreground")}>
                  {step > s.id ? <Check className="h-4 w-4" /> : <s.icon className="h-4 w-4" />}
                </div>
                <span className={cn("text-xs whitespace-nowrap", step === s.id ? "text-primary font-medium" : "text-muted-foreground")}>{s.title}</span>
              </div>
              {i < steps.length - 1 && <div className={cn("w-12 h-0.5 mb-5 mx-1", step > s.id ? "bg-primary" : "bg-border")} />}
            </div>)}
        </div>

        {/* Form area */}
        <div className="bg-card rounded-xl border border-border p-6 md:p-8 slide-up">
          {step === 1 && <div>
              <h2 className="text-xl font-bold text-foreground mb-6">Personal Information</h2>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
                <div className="md:col-span-2">
                  <Label>Profile Picture</Label>
                  <div className="mt-2 flex items-center gap-4">
                    <div className="w-16 h-16 rounded-full bg-secondary border-2 border-dashed border-border flex items-center justify-center overflow-hidden">
                      {photoPreview ? <img src={photoPreview} alt="Profile preview" className="w-full h-full object-cover" /> : <User className="h-7 w-7 text-muted-foreground" />}
                    </div>
                    <div>
                      <input ref={photoInputRef} type="file" accept="image/jpeg" className="hidden" onChange={e => handlePhotoSelect(e.target.files?.[0])} />
                      <Button type="button" variant="outline" size="sm" className="gap-2" onClick={() => photoInputRef.current?.click()}>
                        <Upload className="h-4 w-4" />{photoFile ? "Change Photo" : "Upload Photo"}
                      </Button>
                      <p className="text-xs text-muted-foreground mt-1.5">JPEG (.jpg/.jpeg) only</p>
                      {photoFile && !photoError && <p className="text-xs text-emerald-600 mt-0.5">{photoFile.name}</p>}
                      {photoError && <p className="text-xs text-destructive mt-0.5">{photoError}</p>}
                    </div>
                  </div>
                </div>
                <div className="space-y-1.5"><Label>First Name *</Label><Input placeholder="John" value={firstName} onChange={e => setFirstName(e.target.value)} /></div>
                <div className="space-y-1.5"><Label>Last Name *</Label><Input placeholder="Doe" value={lastName} onChange={e => setLastName(e.target.value)} /></div>
                <div className="space-y-1.5"><Label>Email Address *</Label><Input type="email" placeholder="john.doe@example.com" value={email} onChange={e => setEmail(e.target.value)} /></div>
                <div className="space-y-1.5"><Label>Phone Number *</Label><Input placeholder="+1 (555) 000-0000" value={phone} onChange={e => setPhone(e.target.value)} /></div>
                <div className="space-y-1.5">
                  <Label>LinkedIn Profile URL</Label>
                  <Input placeholder="https://linkedin.com/in/yourprofile" value={linkedin} onChange={e => setLinkedin(e.target.value)} />
                  {!isValidLinkedinUrl(linkedin) && <p className="text-xs text-destructive mt-0.5">Enter a full URL, e.g. https://linkedin.com/in/yourprofile</p>}
                </div>
                <div className="md:col-span-2">
                  <Label>Location</Label>
                  <div className="mt-2 grid grid-cols-1 sm:grid-cols-2 gap-3">
                    <select className="w-full h-10 px-3 rounded-md border border-input bg-background text-sm focus:outline-none focus:ring-2 focus:ring-ring" value={country} onChange={e => {
                    setCountry(e.target.value);
                    setState("");
                  }}>
                      <option value="">Select country *</option>
                      {allCountries.map(([name]) => <option key={name} value={name}>{name}</option>)}
                    </select>
                    <select className="w-full h-10 px-3 rounded-md border border-input bg-background text-sm focus:outline-none focus:ring-2 focus:ring-ring disabled:opacity-50" value={state} onChange={e => setState(e.target.value)} disabled={regionsForCountry.length === 0}>
                      <option value="">{regionsForCountry.length === 0 ? "Select country first" : "Select state / region"}</option>
                      {regionsForCountry.map(([name]) => <option key={name} value={name}>{name}</option>)}
                    </select>
                  </div>
                </div>
                <div className="space-y-1.5">
                  <Label>Password *</Label>
                  <div className="relative">
                    <Input type={showPassword ? "text" : "password"} placeholder="At least 8 characters" value={password} onChange={e => setPassword(e.target.value)} className="pr-10" />
                    <button type="button" onClick={() => setShowPassword(v => !v)} className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground">
                      {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                    </button>
                  </div>
                  {password.length > 0 && password.length < 8 && <p className="text-xs text-destructive">Password must be at least 8 characters.</p>}
                </div>
                <div className="space-y-1.5">
                  <Label>Confirm Password *</Label>
                  <div className="relative">
                    <Input type={showConfirmPassword ? "text" : "password"} placeholder="Re-enter your password" value={confirmPassword} onChange={e => setConfirmPassword(e.target.value)} className="pr-10" />
                    <button type="button" onClick={() => setShowConfirmPassword(v => !v)} className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground">
                      {showConfirmPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                    </button>
                  </div>
                  {confirmPassword.length > 0 && password !== confirmPassword && <p className="text-xs text-destructive">Passwords do not match.</p>}
                </div>
              </div>
            </div>}

          {step === 2 && <div>
              <h2 className="text-xl font-bold text-foreground mb-6">Professional Information</h2>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
                <div className="space-y-1.5">
                  <Label>Professional Status *</Label>
                  <select className="w-full h-10 px-3 rounded-md border border-input bg-background text-sm focus:outline-none focus:ring-2 focus:ring-ring" value={professionalStatus} onChange={e => setProfessionalStatus(e.target.value)}>
                    <option value="">Select status</option>
                    <option>Currently Employed</option>
                    <option>Self-Employed / Freelancer</option>
                    <option>Job Seeker</option>
                    <option>Student</option>
                    <option>Retired</option>
                  </select>
                </div>
                <div className="space-y-1.5"><Label>Current Employer</Label><Input placeholder="Company name" value={employer} onChange={e => setEmployer(e.target.value)} /></div>
                <div className="space-y-1.5"><Label>Designation / Title</Label><Input placeholder="e.g., Senior Engineer" value={designation} onChange={e => setDesignation(e.target.value)} /></div>
                <div className="space-y-1.5">
                  <Label>Industry *</Label>
                  <select className="w-full h-10 px-3 rounded-md border border-input bg-background text-sm focus:outline-none focus:ring-2 focus:ring-ring" value={industry} onChange={e => setIndustry(e.target.value)}>
                    <option value="">Select industry</option>
                    <option>Technology</option>
                    <option>Finance</option>
                    <option>Healthcare</option>
                    <option>Consulting</option>
                    <option>Education</option>
                    <option>E-Commerce</option>
                    <option>Other</option>
                  </select>
                </div>
                <div className="md:col-span-2 space-y-1.5">
                  <Label>Resume Upload</Label>
                  <input ref={resumeInputRef} type="file" accept=".pdf,.doc,.docx" className="hidden" onChange={e => handleResumeSelect(e.target.files?.[0])} />
                  <div className="border-2 border-dashed border-border rounded-lg p-6 text-center hover:border-primary/50 transition-colors cursor-pointer" onClick={() => resumeInputRef.current?.click()} onDragOver={e => e.preventDefault()} onDrop={e => {
                e.preventDefault();
                handleResumeSelect(e.dataTransfer.files?.[0]);
              }}>
                    <Upload className="h-8 w-8 text-muted-foreground mx-auto mb-2" />
                    <p className="text-sm text-muted-foreground">Drag and drop your resume, or <span className="text-primary font-medium">browse</span></p>
                    <p className="text-xs text-muted-foreground mt-1">PDF, DOC, DOCX up to 10MB</p>
                    {resumeFile && !resumeError && <p className="text-xs text-emerald-600 mt-2">{resumeFile.name}</p>}
                    {resumeError && <p className="text-xs text-destructive mt-2">{resumeError}</p>}
                  </div>
                </div>
              </div>
            </div>}

          {step === 3 && <div>
              <h2 className="text-xl font-bold text-foreground mb-6">Family Information</h2>
              <div className="space-y-4">
                {family.map((member, i) => <div key={i} className="p-4 rounded-lg border border-border bg-secondary/20">
                    <div className="flex items-center justify-between mb-3">
                      <p className="text-sm font-medium text-foreground">Family Member {i + 1}</p>
                      {family.length > 1 && <Button variant="ghost" size="icon" className="h-8 w-8 text-destructive hover:text-destructive" onClick={() => setFamily(f => f.filter((_, j) => j !== i))}>
                          <Trash2 className="h-4 w-4" />
                        </Button>}
                    </div>
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                      <div className="space-y-1.5"><Label>Full Name</Label><Input placeholder="Name" value={member.name} onChange={e => setFamily(f => f.map((m, j) => j === i ? {
                    ...m,
                    name: e.target.value
                  } : m))} /></div>
                      <div className="space-y-1.5">
                        <Label>Relationship</Label>
                        <select className="w-full h-10 px-3 rounded-md border border-input bg-background text-sm focus:outline-none focus:ring-2 focus:ring-ring" value={member.relationship} onChange={e => setFamily(f => f.map((m, j) => j === i ? {
                    ...m,
                    relationship: e.target.value
                  } : m))}>
                          <option value="">Select</option>
                          <option>Spouse/Partner</option><option>Child</option><option>Parent</option><option>Sibling</option>
                        </select>
                      </div>
                      <div className="space-y-1.5">
                        <Label>Career Status</Label>
                        <select className="w-full h-10 px-3 rounded-md border border-input bg-background text-sm focus:outline-none focus:ring-2 focus:ring-ring" value={member.career} onChange={e => setFamily(f => f.map((m, j) => j === i ? {
                    ...m,
                    career: e.target.value
                  } : m))}>
                          <option value="">Select</option>
                          <option>Employed</option><option>Self-Employed</option><option>Student</option><option>Homemaker</option><option>Retired</option>
                        </select>
                      </div>
                    </div>
                  </div>)}
                <Button variant="outline" className="gap-2" onClick={() => setFamily(f => [...f, {
              name: "",
              relationship: "",
              career: ""
            }])}>
                  <Plus className="h-4 w-4" />Add Family Member
                </Button>
              </div>
            </div>}

          {step === 4 && <div>
              <h2 className="text-xl font-bold text-foreground mb-6">Alumni Information</h2>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
                <div className="space-y-1.5">
                  <Label>Exited Year *</Label>
                  <select className="w-full h-10 px-3 rounded-md border border-input bg-background text-sm focus:outline-none focus:ring-2 focus:ring-ring" value={exitedYear} onChange={e => setExitedYear(e.target.value)}>
                    <option value="">Select year</option>
                    {years.map(y => <option key={y}>{y}</option>)}
                  </select>
                </div>
                <div className="md:col-span-2 space-y-1.5">
                  <Label>Roles Held at TechDemocracy</Label>
                  <textarea className="w-full h-28 px-3 py-2 rounded-md border border-input bg-background text-sm focus:outline-none focus:ring-2 focus:ring-ring resize-none" placeholder="e.g., Software Engineer (2018-2020), Senior Engineer (2020-2022)" value={rolesHeld} onChange={e => setRolesHeld(e.target.value)} />
                </div>
                <div className="md:col-span-2 space-y-1.5">
                  <Label>Notable Achievements (optional)</Label>
                  <textarea className="w-full h-24 px-3 py-2 rounded-md border border-input bg-background text-sm focus:outline-none focus:ring-2 focus:ring-ring resize-none" placeholder="Awards, certifications, key projects..." value={achievements} onChange={e => setAchievements(e.target.value)} />
                </div>
              </div>
            </div>}

          {step === 5 && <div>
              <h2 className="text-xl font-bold text-foreground mb-2">Select Your Benefits</h2>
              <p className="text-muted-foreground text-sm mb-6">Choose at least one benefit. HR will review and approve your selections.</p>
              {selectedBenefits.length === 0 && <div className="mb-4 p-3 rounded-lg bg-amber-50 dark:bg-amber-950/20 border border-amber-200 dark:border-amber-800 text-amber-700 dark:text-amber-400 text-sm">
                  Please select at least one benefit to continue.
                </div>}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                {availableBenefits.map(b => <div key={b.id} onClick={() => toggleBenefit(b.id)} className={cn("p-4 rounded-lg border cursor-pointer transition-all hover:border-primary/50", selectedBenefits.includes(b.id) ? "border-primary bg-primary/5" : "border-border hover:bg-secondary/50")}>
                    <div className="flex items-start gap-3">
                      <Checkbox checked={selectedBenefits.includes(b.id)} className="mt-0.5" />
                      <div className="min-w-0">
                        <p className="text-sm font-medium text-foreground">{b.title}</p>
                        <p className="text-xs text-muted-foreground mt-0.5 truncate">{b.description}</p>
                        <Badge variant="secondary" className="mt-1.5 text-[10px] h-4">{b.category}</Badge>
                      </div>
                    </div>
                  </div>)}
              </div>
              <p className="text-xs text-muted-foreground mt-4">{selectedBenefits.length} benefit{selectedBenefits.length !== 1 ? "s" : ""} selected</p>
            </div>}

          {step === 6 && <div>
              <h2 className="text-xl font-bold text-foreground mb-6">Terms & Conditions</h2>
              <div className="prose prose-sm max-w-none text-muted-foreground">
                <div className="h-64 overflow-y-auto p-4 rounded-lg border border-border bg-secondary/20 text-sm space-y-4">
                  <p className="font-semibold text-foreground">TechDemocracy Alumni Network — Terms & Conditions</p>
                  <p>By registering for the TechDemocracy Alumni Network (&quot;Network&quot;), you agree to the following terms and conditions. Please read these terms carefully before completing your registration.</p>
                  <p className="font-medium text-foreground">1. Eligibility</p>
                  <p>Membership is open to former employees of TechDemocracy who have completed at least one year of continuous service. All registrations are subject to HR approval.</p>
                  <p className="font-medium text-foreground">2. Use of the Portal</p>
                  <p>The portal is intended for professional networking, career development, and accessing alumni benefits. Misuse, harassment, or any conduct deemed inappropriate by TechDemocracy may result in suspension or termination of access.</p>
                  <p className="font-medium text-foreground">3. Data Privacy</p>
                  <p>Your personal information will be processed in accordance with our Privacy Policy. We collect, use, and store data necessary to provide alumni services. You consent to this processing by registering.</p>
                  <p className="font-medium text-foreground">4. Benefits</p>
                  <p>Benefits are subject to availability and HR approval. TechDemocracy reserves the right to modify, add, or remove benefits at any time without prior notice.</p>
                  <p className="font-medium text-foreground">5. Intellectual Property</p>
                  <p>All content on this portal, including logos, text, and designs, is the property of TechDemocracy and may not be used without written permission.</p>
                </div>
              </div>
              {!agreedTerms && <div className="mt-6 p-3 rounded-lg bg-amber-50 dark:bg-amber-950/20 border border-amber-200 dark:border-amber-800 text-amber-700 dark:text-amber-400 text-sm">
                  Please agree to the Terms &amp; Conditions to submit your registration.
                </div>}
              <div className="mt-6 space-y-3">
                <div className="flex items-start gap-3">
                  <Checkbox id="terms" className="mt-0.5" checked={agreedTerms} onCheckedChange={checked => setAgreedTerms(checked === true)} />
                  <Label htmlFor="terms" className="font-normal text-sm cursor-pointer text-muted-foreground">
                    I have read and agree to the <span className="text-primary">Terms & Conditions</span> and <span className="text-primary">Privacy Policy</span>
                  </Label>
                </div>
                <div className="flex items-start gap-3">
                  <Checkbox id="comms" className="mt-0.5" checked={agreedComms} onCheckedChange={checked => setAgreedComms(checked === true)} />
                  <Label htmlFor="comms" className="font-normal text-sm cursor-pointer text-muted-foreground">
                    I agree to receive communications from TechDemocracy regarding alumni events, benefits, and updates
                  </Label>
                </div>
              </div>
            </div>}

          {/* Navigation */}
          {!isStepValid && step !== 5 && step !== 6 && <p className="mt-6 text-sm text-amber-700 dark:text-amber-400">Please complete all required fields to continue.</p>}
          {submitError && <p className="mt-6 text-sm text-destructive">{submitError}</p>}
          <div className="flex items-center justify-between mt-8 pt-6 border-t border-border">
            <Button variant="outline" onClick={() => step > 1 ? setStep(s => s - 1) : navigate("/login")} className="gap-2">
              <ChevronLeft className="h-4 w-4" />{step === 1 ? "Back to Login" : "Previous"}
            </Button>
            <div className="flex items-center gap-2">
              <span className="text-sm text-muted-foreground hidden sm:block">{step} / {steps.length}</span>
              {step < steps.length ? <Button onClick={() => setStep(s => s + 1)} disabled={!isStepValid} className="td-gradient border-0 text-white gap-2">
                  Next<ChevronRight className="h-4 w-4" />
                </Button> : <Button onClick={handleSubmit} disabled={!isStepValid || submitting} className="td-gradient border-0 text-white gap-2">
                  {submitting ? "Submitting..." : "Submit Registration"}<Check className="h-4 w-4" />
                </Button>}
            </div>
          </div>
        </div>
      </div>
    </div>;
}
