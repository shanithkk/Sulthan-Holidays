"use client";
import { useState } from "react";
import { api } from "@/lib/api";
import { useAuth } from "@/lib/auth";

export default function EnquiryPage() {
  const { user } = useAuth();
  // What the visitor typed; anything untouched falls back to their account details.
  const [typed, setTyped] = useState<Partial<Record<"name" | "phone" | "email" | "travel_date" | "message", string>>>({});
  const [people, setPeople] = useState(2);
  const form = {
    name: typed.name ?? user?.name ?? "",
    phone: typed.phone ?? user?.phone ?? "",
    email: typed.email ?? user?.email ?? "",
    travel_date: typed.travel_date ?? "",
    message: typed.message ?? "",
    people,
  };
  const setForm = (f: typeof form) => {
    const { people: p, ...rest } = f;
    setPeople(p);
    setTyped(rest);
  };
  const [state, setState] = useState<"idle" | "busy" | "done">("idle");
  const [error, setError] = useState("");

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setState("busy");
    setError("");
    try {
      const packageId = new URLSearchParams(window.location.search).get("package");
      await api("/enquiries", {
        method: "POST",
        json: { ...form, email: form.email || null, travel_date: form.travel_date || null, package_id: packageId },
      });
      setState("done");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Something went wrong");
      setState("idle");
    }
  }

  if (state === "done")
    return (
      <div className="mx-auto max-w-lg px-4 py-20">
        <div className="glass-strong p-8 text-center">
          <h1 className="text-2xl font-extrabold">Thank you!</h1>
          <p className="mt-2">Our team will call you on {form.phone} shortly.</p>
        </div>
      </div>
    );

  return (
    <div className="mx-auto max-w-xl px-4 py-12">
      <div className="glass-strong p-8">
        <h1 className="text-2xl font-extrabold">Send an enquiry</h1>
        <p className="mt-1 text-sm text-leaf-800/80">Tell us your plan and we will call you back with the best price.</p>
        <form onSubmit={submit} className="mt-6 grid gap-4 sm:grid-cols-2">
          <div><label className="label">Name</label>
            <input className="field" required value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} /></div>
          <div><label className="label">Mobile number</label>
            <input className="field" required inputMode="tel" value={form.phone} onChange={(e) => setForm({ ...form, phone: e.target.value })} /></div>
          <div><label className="label">Email (optional)</label>
            <input className="field" type="email" value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} /></div>
          <div><label className="label">Travel date (optional)</label>
            <input className="field" type="date" value={form.travel_date} onChange={(e) => setForm({ ...form, travel_date: e.target.value })} /></div>
          <div><label className="label">People</label>
            <input className="field" type="number" min={1} max={100} value={form.people}
              onChange={(e) => setForm({ ...form, people: Math.max(1, Number(e.target.value) || 1) })} /></div>
          <div className="sm:col-span-2"><label className="label">Message</label>
            <textarea className="field" rows={4} maxLength={2000} value={form.message} onChange={(e) => setForm({ ...form, message: e.target.value })} /></div>
          {error && <p className="rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700 sm:col-span-2">{error}</p>}
          <button className="btn btn-primary sm:col-span-2" disabled={state === "busy"}>{state === "busy" ? "Sending…" : "Send enquiry"}</button>
        </form>
      </div>
    </div>
  );
}
