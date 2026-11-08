"use client";
import { useState } from "react";
import { api, imgUrl, type Trip } from "@/lib/api";
import { Badge, ErrorNote, PageHeader, useLoad } from "@/components/ui";
import PhotoField from "@/components/PhotoField";

type Form = Omit<Trip, "id">;
const EMPTY: Form = { title: "", label: "1 Day Trip", description: "", trip_date: null, sort_order: 0, active: true, photos: [], feedback: [] };
const LABELS = ["1 Day Trip", "2 Day Trip", "3 Day Trip", "4 Day Trip", "5 Day Trip"];

export default function TripsPage() {
  const { data, error, reload } = useLoad(() => api<Trip[]>("/trips"));
  const [editing, setEditing] = useState<{ id: string | null; form: Form } | null>(null);
  const [ok, setOk] = useState(false); // permission to show the guests' photos / words
  const [msg, setMsg] = useState("");
  const [busy, setBusy] = useState(false);

  const set = (patch: Partial<Form>) => setEditing((s) => s && { ...s, form: { ...s.form, ...patch } });
  const setPhoto = (i: number, patch: Partial<Form["photos"][number]>) =>
    editing && set({ photos: editing.form.photos.map((p, n) => (n === i ? { ...p, ...patch } : p)) });
  const setFb = (i: number, patch: Partial<Form["feedback"][number]>) =>
    editing && set({ feedback: editing.form.feedback.map((f, n) => (n === i ? { ...f, ...patch } : f)) });

  async function save(e: React.FormEvent) {
    e.preventDefault();
    if (!editing) return;
    setBusy(true);
    setMsg("");
    try {
      const f = editing.form;
      await api(editing.id ? `/trips/${editing.id}` : "/trips", {
        method: editing.id ? "PUT" : "POST",
        json: { ...f, photos: f.photos.filter((p) => p.url), feedback: f.feedback.filter((x) => x.body.trim()) },
      });
      setEditing(null);
      reload();
    } catch (err) {
      setMsg(err instanceof Error ? err.message : "Failed");
    } finally {
      setBusy(false);
    }
  }

  async function remove(t: Trip) {
    if (!window.confirm(`Delete "${t.title}" with all its photos and feedback? This cannot be undone.`)) return;
    try {
      await api(`/trips/${t.id}`, { method: "DELETE" });
      reload();
    } catch (err) {
      setMsg(err instanceof Error ? err.message : "Failed");
    }
  }

  return (
    <>
      <PageHeader title="Our travellers">
        <button className="btn btn-primary btn-sm" onClick={() => { setMsg(""); setOk(false); setEditing({ id: null, form: EMPTY }); }}>Add trip</button>
      </PageHeader>
      <ErrorNote message={error || (editing ? "" : msg)} />

      {editing && (
        <form onSubmit={save} className="glass-strong mb-6 space-y-5 p-5">
          <div className="grid gap-4 sm:grid-cols-2">
            <div><label className="label">Title (e.g. Family trip from Kochi)</label>
              <input className="field" required value={editing.form.title} onChange={(e) => set({ title: e.target.value })} /></div>
            <div><label className="label">Badge on the photo</label>
              <input className="field" list="trip-labels" placeholder="1 Day Trip" value={editing.form.label} onChange={(e) => set({ label: e.target.value })} />
              <datalist id="trip-labels">{LABELS.map((l) => <option key={l} value={l} />)}</datalist></div>
            <div className="sm:col-span-2"><label className="label">Short story (optional)</label>
              <textarea className="field" rows={2} maxLength={1000} value={editing.form.description} onChange={(e) => set({ description: e.target.value })} /></div>
            <div><label className="label">Trip date (optional)</label>
              <input className="field" type="date" value={editing.form.trip_date ?? ""} onChange={(e) => set({ trip_date: e.target.value || null })} /></div>
            <div><label className="label">Order (smaller shows first)</label>
              <input className="field" type="number" value={editing.form.sort_order} onChange={(e) => set({ sort_order: Number(e.target.value) })} /></div>
            <label className="flex items-center gap-2 text-sm font-medium"><input type="checkbox" checked={editing.form.active} onChange={(e) => set({ active: e.target.checked })} /> Visible on website</label>
          </div>

          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <h2 className="font-bold">Photos of the group ({editing.form.photos.length})</h2>
              <button type="button" className="btn btn-ghost btn-sm" onClick={() => set({ photos: [...editing.form.photos, { url: "", caption: null }] })}>Add photo</button>
            </div>
            {editing.form.photos.map((p, i) => (
              <div key={i} className="space-y-2 rounded-xl bg-white/40 p-3">
                <PhotoField label={`Photo ${i + 1}${i === 0 ? " (shown first)" : ""}`} value={p.url || null} onChange={(v) => setPhoto(i, { url: v ?? "" })} />
                <input className="field !py-1.5 text-xs" placeholder="Caption (optional)" value={p.caption ?? ""} onChange={(e) => setPhoto(i, { caption: e.target.value })} />
                <button type="button" className="btn btn-danger btn-sm" onClick={() => set({ photos: editing.form.photos.filter((_, n) => n !== i) })}>Remove photo</button>
              </div>
            ))}
          </div>

          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <h2 className="font-bold">Feedback from the guests ({editing.form.feedback.length})</h2>
              <button type="button" className="btn btn-ghost btn-sm" onClick={() => set({ feedback: [...editing.form.feedback, { author: null, body: "", rating: 5 }] })}>Add feedback</button>
            </div>
            {editing.form.feedback.map((f, i) => (
              <div key={i} className="space-y-2 rounded-xl bg-white/40 p-3">
                <textarea className="field" rows={3} maxLength={1000} placeholder="What they said (as received by call or WhatsApp)" value={f.body} onChange={(e) => setFb(i, { body: e.target.value })} />
                <div className="grid gap-2 sm:grid-cols-[1fr_140px_auto]">
                  <input className="field !py-1.5 text-xs" placeholder="Name to show, e.g. Anil, Kochi" value={f.author ?? ""} onChange={(e) => setFb(i, { author: e.target.value })} />
                  <select className="field !py-1.5 text-xs" value={f.rating ?? ""} onChange={(e) => setFb(i, { rating: e.target.value ? Number(e.target.value) : null })}>
                    <option value="">No rating</option>
                    {[5, 4, 3, 2, 1].map((n) => <option key={n} value={n}>{n} stars</option>)}
                  </select>
                  <button type="button" className="btn btn-danger btn-sm" onClick={() => set({ feedback: editing.form.feedback.filter((_, n) => n !== i) })}>Remove</button>
                </div>
              </div>
            ))}
          </div>

          <label className="flex items-start gap-2 rounded-xl bg-amber-50 p-3 text-sm text-amber-800">
            <input type="checkbox" className="mt-1" required checked={ok} onChange={(e) => setOk(e.target.checked)} />
            I have the guests&apos; permission to show these photos and feedback on the website. Only add real feedback you actually received.
          </label>

          <div className="flex items-center gap-3">
            <button className="btn btn-primary btn-sm" disabled={busy}>{busy ? "Saving…" : "Save trip"}</button>
            <button type="button" className="btn btn-ghost btn-sm" onClick={() => setEditing(null)}>Cancel</button>
            <span className="text-sm text-red-700">{msg}</span>
          </div>
        </form>
      )}

      <div className="glass overflow-x-auto">
        <table className="tbl">
          <thead><tr><th>Trip</th><th>Photos</th><th>Feedback</th><th>Status</th><th /></tr></thead>
          <tbody>
            {data?.map((t) => (
              <tr key={t.id}>
                <td><b>{t.title}</b><br /><span className="text-xs">{t.label}{t.trip_date ? ` · ${t.trip_date}` : ""}</span></td>
                <td>
                  <div className="flex gap-1">
                    {t.photos.slice(0, 4).map((p, i) => <div key={i} className="h-10 w-14 rounded-md bg-leaf-100 bg-cover bg-center" style={{ backgroundImage: `url(${imgUrl(p.url)})` }} />)}
                    <span className="self-center pl-1 text-xs">{t.photos.length}</span>
                  </div>
                </td>
                <td>{t.feedback.length}</td>
                <td><Badge value={t.active ? "confirmed" : "closed"} /></td>
                <td className="whitespace-nowrap">
                  <button className="btn btn-ghost btn-sm" onClick={() => { const { id, ...form } = t; setMsg(""); setOk(true); setEditing({ id, form }); window.scrollTo(0, 0); }}>Edit</button>{" "}
                  <button className="btn btn-danger btn-sm" onClick={() => remove(t)}>Delete</button>
                </td>
              </tr>
            ))}
            {data?.length === 0 && <tr><td colSpan={5} className="text-center">No trips yet. Add your first group photos and feedback.</td></tr>}
          </tbody>
        </table>
      </div>
    </>
  );
}
