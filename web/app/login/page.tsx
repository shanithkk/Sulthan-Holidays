"use client";
import { useState } from "react";
import { useRouter } from "next/navigation";
import { api, type User } from "@/lib/api";
import { useAuth } from "@/lib/auth";
import GoogleButton from "@/components/GoogleButton";

type Session = { token: string; user: User };

export default function LoginPage() {
  const { signIn } = useAuth();
  const router = useRouter();
  const [mode, setMode] = useState<"login" | "register">("login");
  const [form, setForm] = useState({ name: "", email: "", phone: "", password: "" });
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const set = (k: keyof typeof form) => (e: React.ChangeEvent<HTMLInputElement>) =>
    setForm({ ...form, [k]: e.target.value });

  function done(s: Session) {
    signIn(s);
    // Only follow same-site relative paths.
    const next = new URLSearchParams(window.location.search).get("next");
    router.push(next && next.startsWith("/") && !next.startsWith("//") ? next : "/account");
  }

  async function run(fn: () => Promise<Session>) {
    setBusy(true);
    setError("");
    try {
      done(await fn());
    } catch (e) {
      setError(e instanceof Error ? e.message : "Something went wrong");
    } finally {
      setBusy(false);
    }
  }

  function submit(e: React.FormEvent) {
    e.preventDefault();
    run(() =>
      mode === "login"
        ? api<Session>("/auth/login", { method: "POST", json: { email: form.email, password: form.password } })
        : api<Session>("/auth/register", { method: "POST", json: form }),
    );
  }

  return (
    <div className="mx-auto max-w-md px-4 py-14">
      <div className="glass-strong p-8">
        <h1 className="text-2xl font-extrabold">{mode === "login" ? "Welcome back" : "Create your account"}</h1>
        <p className="mt-1 text-sm text-leaf-800/80">
          {mode === "login" ? "Sign in to book and track your trips." : "A mobile number is needed so our team can reach you."}
        </p>

        <div className="mt-6">
          <GoogleButton onToken={(t) => run(() => api<Session>("/auth/google", { method: "POST", json: { id_token: t } }))} />
          {!process.env.NEXT_PUBLIC_GOOGLE_CLIENT_ID && process.env.NODE_ENV !== "production" && (
            <p className="rounded-lg bg-amber-50 px-3 py-2 text-xs text-amber-800">
              Developer note: &quot;Continue with Google&quot; is hidden until NEXT_PUBLIC_GOOGLE_CLIENT_ID is set (see docs/SETUP.md, section 4).
            </p>
          )}
          {process.env.NEXT_PUBLIC_GOOGLE_CLIENT_ID && (
            <p className="mt-4 text-center text-xs text-leaf-800/60">or use your email</p>
          )}
        </div>

        <form onSubmit={submit} className="mt-6 space-y-4">
          {mode === "register" && (
            <>
              <div>
                <label className="label">Full name</label>
                <input className="field" required value={form.name} onChange={set("name")} autoComplete="name" />
              </div>
              <div>
                <label className="label">Mobile number</label>
                <input className="field" required inputMode="tel" placeholder="98765 43210" value={form.phone} onChange={set("phone")} autoComplete="tel" />
              </div>
            </>
          )}
          <div>
            <label className="label">Email</label>
            <input className="field" type="email" required value={form.email} onChange={set("email")} autoComplete="email" />
          </div>
          <div>
            <label className="label">Password</label>
            <input className="field" type="password" required minLength={8} value={form.password} onChange={set("password")}
              autoComplete={mode === "login" ? "current-password" : "new-password"} />
          </div>
          {error && <p className="rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700">{error}</p>}
          <button className="btn btn-primary w-full" disabled={busy}>
            {busy ? "Please wait…" : mode === "login" ? "Sign in" : "Create account"}
          </button>
        </form>

        <button className="mt-5 w-full text-center text-sm font-medium text-leaf-700 hover:underline"
          onClick={() => { setMode(mode === "login" ? "register" : "login"); setError(""); }}>
          {mode === "login" ? "New here? Create an account" : "Already have an account? Sign in"}
        </button>
      </div>
    </div>
  );
}
