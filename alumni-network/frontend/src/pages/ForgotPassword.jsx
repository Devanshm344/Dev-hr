import { useState } from "react";
import { Link } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { ArrowLeft, Mail, CheckCircle, KeyRound } from "lucide-react";
export default function ForgotPasswordPage() {
  const [sent, setSent] = useState(false);
  const [email, setEmail] = useState("");
  const [resetUrl, setResetUrl] = useState(null);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState(null);
  const handleSubmit = async e => {
    e.preventDefault();
    setSubmitting(true);
    setError(null);
    try {
      const res = await fetch("/api/auth/forgot-password", {
        method: "POST",
        headers: {
          "Content-Type": "application/json"
        },
        body: JSON.stringify({
          email
        })
      });
      const body = await res.json().catch(() => ({}));
      if (!res.ok) {
        throw new Error(body.error || "Something went wrong. Please try again.");
      }
      setResetUrl(body.resetUrl ?? null);
      setSent(true);
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

        {!sent ? <>
            <div className="w-14 h-14 rounded-2xl bg-primary/10 flex items-center justify-center mb-6">
              <Mail className="h-7 w-7 text-primary" />
            </div>
            <h1 className="text-2xl font-bold text-foreground">Forgot your password?</h1>
            <p className="text-muted-foreground text-sm mt-2">Enter your email address and we&apos;ll generate a link to reset your password.</p>
            <form className="mt-8 space-y-4" onSubmit={handleSubmit}>
              <div className="space-y-1.5">
                <Label htmlFor="email">Email address</Label>
                <Input id="email" type="email" placeholder="you@example.com" value={email} onChange={e => setEmail(e.target.value)} required className="h-10" />
              </div>
              {error && <p className="text-sm text-destructive">{error}</p>}
              <Button type="submit" disabled={submitting} className="w-full td-gradient border-0 text-white h-10">
                {submitting ? "Sending..." : "Send Reset Link"}
              </Button>
            </form>
          </> : <>
            <div className="w-14 h-14 rounded-2xl bg-emerald-100 dark:bg-emerald-900/30 flex items-center justify-center mb-6">
              <CheckCircle className="h-7 w-7 text-emerald-600" />
            </div>
            <h1 className="text-2xl font-bold text-foreground">Reset link ready</h1>
            <p className="text-muted-foreground text-sm mt-2">
              If an active account exists for <span className="font-medium text-foreground">{email}</span>, a reset link has been generated below.
            </p>

            {resetUrl ? <div className="mt-6 p-4 rounded-lg bg-secondary border border-border space-y-3">
                <div className="flex items-center gap-2 text-xs font-semibold text-foreground">
                  <KeyRound className="h-3.5 w-3.5" />
                  Development mode: email delivery isn&apos;t configured yet
                </div>
                <p className="text-xs text-muted-foreground">
                  In production this link would be emailed to you. For now, use it directly — it expires in 1 hour and can only be used once.
                </p>
                <a href={resetUrl} className="block text-xs font-medium text-primary hover:underline break-all bg-background rounded-md border border-border p-2">
                  {resetUrl}
                </a>
                <Button asChild className="w-full td-gradient border-0 text-white h-9 text-sm">
                  <a href={resetUrl}>Continue to Reset Password</a>
                </Button>
              </div> : <div className="mt-6 p-4 rounded-lg bg-secondary border border-border">
                <p className="text-xs text-muted-foreground">
                  Didn&apos;t receive a link? Check that the email matches an approved alumni account, or{" "}
                  <button onClick={() => setSent(false)} className="text-primary hover:underline font-medium">try again</button>.
                </p>
              </div>}

            <Button className="mt-6 w-full" variant="outline" asChild><Link to="/login">Back to Login</Link></Button>
          </>}
      </div>
    </div>;
}
