import { useState } from "react";
import { Link, useNavigate, useSearchParams } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { ArrowLeft, Eye, EyeOff, KeyRound, CheckCircle } from "lucide-react";
export default function ResetPasswordPage() {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const token = searchParams.get("token") ?? "";
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState(null);
  const [done, setDone] = useState(false);
  const passwordsMismatch = confirmPassword.length > 0 && password !== confirmPassword;
  const canSubmit = token && password.length >= 8 && password === confirmPassword && !submitting;
  const handleSubmit = async e => {
    e.preventDefault();
    if (!canSubmit) return;
    setSubmitting(true);
    setError(null);
    try {
      const res = await fetch("/api/auth/reset-password", {
        method: "POST",
        headers: {
          "Content-Type": "application/json"
        },
        body: JSON.stringify({
          token,
          password
        })
      });
      const body = await res.json().catch(() => ({}));
      if (!res.ok) {
        throw new Error(body.error || "Something went wrong. Please try again.");
      }
      setDone(true);
      setTimeout(() => navigate("/login"), 2000);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Something went wrong. Please try again.");
    } finally {
      setSubmitting(false);
    }
  };
  return <div className="min-h-screen flex items-center justify-center bg-background p-6">
      <div className="w-full max-w-sm">
        <Link to="/login" className="inline-flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground mb-8 transition-colors">
          <ArrowLeft className="h-4 w-4" />Back to Login
        </Link>

        {!done ? <>
            <div className="w-14 h-14 rounded-2xl bg-primary/10 flex items-center justify-center mb-6">
              <KeyRound className="h-7 w-7 text-primary" />
            </div>
            <h1 className="text-2xl font-bold text-foreground">Set a new password</h1>
            <p className="text-muted-foreground text-sm mt-2">Choose a password you haven&apos;t used before. It must be at least 8 characters.</p>

            {!token ? <p className="text-sm text-destructive mt-6">This reset link is missing its token. Please request a new one from the Forgot Password page.</p> : <form className="mt-8 space-y-4" onSubmit={handleSubmit}>
                <div className="space-y-1.5">
                  <Label htmlFor="password">New password</Label>
                  <div className="relative">
                    <Input id="password" type={showPassword ? "text" : "password"} placeholder="At least 8 characters" value={password} onChange={e => setPassword(e.target.value)} className="h-10 pr-10" />
                    <button type="button" onClick={() => setShowPassword(!showPassword)} className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground">
                      {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                    </button>
                  </div>
                </div>
                <div className="space-y-1.5">
                  <Label htmlFor="confirmPassword">Confirm password</Label>
                  <div className="relative">
                    <Input id="confirmPassword" type={showConfirmPassword ? "text" : "password"} placeholder="Re-enter your password" value={confirmPassword} onChange={e => setConfirmPassword(e.target.value)} className="h-10 pr-10" />
                    <button type="button" onClick={() => setShowConfirmPassword(!showConfirmPassword)} className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground">
                      {showConfirmPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                    </button>
                  </div>
                  {passwordsMismatch && <p className="text-xs text-destructive">Passwords do not match.</p>}
                </div>
                {error && <p className="text-sm text-destructive">{error}</p>}
                <Button type="submit" disabled={!canSubmit} className="w-full td-gradient border-0 text-white h-10">
                  {submitting ? "Resetting..." : "Reset Password"}
                </Button>
              </form>}
          </> : <>
            <div className="w-14 h-14 rounded-2xl bg-emerald-100 dark:bg-emerald-900/30 flex items-center justify-center mb-6">
              <CheckCircle className="h-7 w-7 text-emerald-600" />
            </div>
            <h1 className="text-2xl font-bold text-foreground">Password reset</h1>
            <p className="text-muted-foreground text-sm mt-2">Your password has been updated. Redirecting you to login...</p>
          </>}
      </div>
    </div>;
}
