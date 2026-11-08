"use client";
import { useState } from "react";
import { api, imgUrl, type Place } from "@/lib/api";
import { Badge, ErrorNote, PageHeader, useLoad } from "@/components/ui";
import PhotoField from "@/components/PhotoField";

type Form = Omit<Place, "id">;
const EMPTY: Form = { slug: "", name: "", description: "", sort_order: 100, active: true, photos: [] };
const slugify = (s: string) => s.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "");

export default function PlacesPage() {
  const { data, error, reload } = useLoad(() => api<Place[]>("/places"));
  const [editing, setEditing] = useState<{ id: string | null; form: Form } | null>(null);
  const [msg, setMsg] = useState("");
  const [busy, setBusy] = useState(false);

  const set = (patch: Partial<Form>) => setEditing((s) => s && { ...s, form: { ...s.form, ...patch } });
  const setPhoto = (i: number, patch: Partial<Form["photos"][number]>) =>
    editing && set({ photos: editing.form.photos.map((p, n) => (n === i ? { ...p, ...patch } : p)) });
  const move = (i: number, d: number) => {
    if (!editing) return;
    const a = [...editing.form.photos];
    const j = i + d;
    if (j < 0 || j >= a.length) return;
    [a[i], a[j]] = [a[j], a[i]];
    set({ photos: a });
  };

  async function save(e: React.FormEvent) {
    e.preventDefault();
    if (!editing) return;
    setBusy(true);
    setMsg("");
    try {
      const f = editing.form;
      const photos = f.photos.filter((p) => p.url);
      await api(editing.id ? `/places/${editing.id}` : "/places", {
        method: editing.id ? "PUT" : "POST",
        json: { ...f, slug: f.slug || slugify(f.name), photos },
      });
      setEditing(null);
      reload();
    } catch (err) {
      setMsg(err instanceof Error ? err.message : "Failed");
    } finally {
      setBusy(false);
    }
  }

  return (
    <>
      <PageHeader title="Places you will love">
        <button className="btn btn-primary btn-sm" onClick={() => { setMsg(""); setEditing({ id: null, form: EMPTY }); }}>Add place</button>
      </PageHeader>
      <ErrorNote message={error || (editing ? "" : msg)} />

      {editing && (
        <form onSubmit={save} className="glass-strong mb-6 space-y-4 p-5">
          <div className="grid gap-4 sm:grid-cols-2">
            <div><label className="label">Name</label>
              <input className="field" required value={editing.form.name} onChange={(e) => set({ name: e.target.value })} /></div>
            <div><label className="label">URL slug (blank = from name)</label>
              <input className="field" value={editing.form.slug} onChange={(e) => set({ slug: e.target.value })} /></div>
            <div className="sm:col-span-2"><label className="label">Short description</label>
              <textarea className="field" rows={2} maxLength={1000} value={editing.form.description} onChange={(e) => set({ description: e.target.value })} /></div>
            <div><label className="label">Order (smaller shows first)</label>
              <input className="field" type="number" value={editing.form.sort_order} onChange={(e) => set({ sort_order: Number(e.target.value) })} /></div>
            <label className="flex items-end gap-2 pb-2 text-sm font-medium"><input type="checkbox" checked={editing.form.active} onChange={(e) => set({ active: e.target.checked })} /> Visible on website</label>
          </div>

          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <h2 className="font-bold">Photos ({editing.form.photos.length})</h2>
              <button type="button" className="btn btn-ghost btn-sm" onClick={() => set({ photos: [...editing.form.photos, { url: "", caption: null, credit: null, source_url: null }] })}>Add photo</button>
            </div>
            {editing.form.photos.map((p, i) => (
              <div key={i} className="space-y-2 rounded-xl bg-white/40 p-3">
                <PhotoField label={`Photo ${i + 1}${i === 0 ? " (shown first)" : ""}`} value={p.url || null} onChange={(v) => setPhoto(i, { url: v ?? "" })} />
                <div className="grid gap-2 sm:grid-cols-2">
                  <input className="field !py-1.5 text-xs" placeholder="Caption (optional)" value={p.caption ?? ""} onChange={(e) => setPhoto(i, { caption: e.target.value })} />
                  <input className="field !py-1.5 text-xs" placeholder="Credit, e.g. Name, CC BY-SA 4.0 (blank if it is your own photo)" value={p.credit ?? ""} onChange={(e) => setPhoto(i, { credit: e.target.value })} />
                </div>
                <div className="flex gap-2">
                  <button type="button" className="btn btn-ghost btn-sm" onClick={() => move(i, -1)} disabled={i === 0}>Move up</button>
                  <button type="button" className="btn btn-ghost btn-sm" onClick={() => move(i, 1)} disabled={i === editing.form.photos.length - 1}>Move down</button>
                  <button type="button" className="btn btn-danger btn-sm" onClick={() => set({ photos: editing.form.photos.filter((_, n) => n !== i) })}>Remove</button>
                </div>
              </div>
            ))}
            <p className="text-xs text-leaf-800/70">Use photos you took or have the right to use. Photos from other sites usually need the author&apos;s credit.</p>
          </div>

          <div className="flex items-center gap-3">
            <button className="btn btn-primary btn-sm" disabled={busy}>{busy ? "Saving…" : "Save place"}</button>
            <button type="button" className="btn btn-ghost btn-sm" onClick={() => setEditing(null)}>Cancel</button>
            <span className="text-sm text-red-700">{msg}</span>
          </div>
        </form>
      )}

      <div className="glass overflow-x-auto">
        <table className="tbl">
          <thead><tr><th>Place</th><th>Photos</th><th>Order</th><th>Status</th><th /></tr></thead>
          <tbody>
            {data?.map((pl) => (
              <tr key={pl.id}>
                <td><b>{pl.name}</b><br /><span className="text-xs">{pl.description.slice(0, 70)}{pl.description.length > 70 ? "…" : ""}</span></td>
                <td>
                  <div className="flex gap-1">
                    {pl.photos.slice(0, 4).map((p, i) => (
                      <div key={i} className="h-10 w-14 rounded-md bg-leaf-100 bg-cover bg-center" style={{ backgroundImage: `url(${imgUrl(p.url)})` }} />
                    ))}
                    <span className="self-center pl-1 text-xs">{pl.photos.length}</span>
                  </div>
                </td>
                <td>{pl.sort_order}</td>
                <td><Badge value={pl.active ? "confirmed" : "closed"} /></td>
                <td><button className="btn btn-ghost btn-sm" onClick={() => { const { id, ...form } = pl; setMsg(""); setEditing({ id, form }); window.scrollTo(0, 0); }}>Edit</button></td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </>
  );
}
