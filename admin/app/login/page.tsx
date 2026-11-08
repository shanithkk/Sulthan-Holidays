"use client";
import { useState } from "react";
import { useRouter } from "next/navigation";
import { Leaf } from "lucide-react";
import { api, tokenStore } from "@/lib/api";

export default function LoginPage() {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError("");
    try {
      const r = await api<{ token: string }>("/auth/login", { method: "POST", json: { email, password } });
      tokenStore.set(r.token);
      router.push("/");
    } catch (err) {
      setError(err instanceof Error && err.message !== "Please sign in" ? err.message : "Wrong email or password");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="grid min-h-screen place-items-center px-4">
      <form onSubmit={submit} className="glass-strong w-full max-w-sm space-y-4 p-8">
        <div className="flex items-center gap-2 text-lg font-extrabold text-leaf-800">
          <span className="grid h-9 w-9 place-items-center rounded-full bg-leaf-600 text-white"><Leaf size={18} /></span>
          Sulthan Holidays Admin
        </div>
        <div>
          <label className="label">Email</label>
          <input className="field" type="email" required autoComplete="username" value={email} onChange={(e) => setEmail(e.target.value)} />
        </div>
        <div>
          <label className="label">Password</label>
          <input className="field" type="password" required autoComplete="current-password" value={password} onChange={(e) => setPassword(e.target.value)} />
        </div>
        {error && <p className="rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700">{error}</p>}
        <button className="btn btn-primary w-full" disabled={busy}>{busy ? "Signing in…" : "Sign in"}</button>
      </form>
    </div>
  );
}
