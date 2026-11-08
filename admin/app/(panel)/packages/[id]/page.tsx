"use client";
import { use, useState } from "react";
import { useRouter } from "next/navigation";
import { api, type PackageDetail, type Vehicle } from "@/lib/api";
import { ErrorNote, PageHeader, useLoad } from "@/components/ui";
import PhotoField from "@/components/PhotoField";

type Form = Omit<PackageDetail, "id">;
const EMPTY: Form = {
  slug: "", title: "", category: "Family", summary: "", duration_days: 2, car_price: 0,
  hotel_price_per_room_night: 0, pickup_price: 0, persons_per_room: 2, vehicle_id: null, hotel_name: null, cover_image: null, includes: [], active: true, items: [],
};

export default function PackageEditPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  const isNew = id === "new";
  const pkg = useLoad(() => (isNew ? Promise.resolve(EMPTY) : api<PackageDetail>(`/packages/${id}`)));
  const vehicles = useLoad(() => api<Vehicle[]>("/vehicles"));
  if (pkg.error) return <ErrorNote message={pkg.error} />;
  if (!pkg.data || !vehicles.data) return <p>Loading…</p>;
  return <PackageForm id={isNew ? null : id} initial={pkg.data} vehicles={vehicles.data} />;
}

function PackageForm({ id, initial, vehicles }: { id: string | null; initial: Form; vehicles: Vehicle[] }) {
  const router = useRouter();
  const [f, setF] = useState<Form>(initial);
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const set = (patch: Partial<Form>) => setF((s) => ({ ...s, ...patch }));
  const setItem = (i: number, patch: Partial<Form["items"][number]>) =>
    set({ items: f.items.map((it, n) => (n === i ? { ...it, ...patch } : it)) });

  async function save(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError("");
    try {
      await api(id ? `/packages/${id}` : "/packages", { method: id ? "PUT" : "POST", json: f });
      router.push("/packages");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed");
      setBusy(false);
    }
  }

  return (
    <form onSubmit={save}>
      <PageHeader title={id ? "Edit package" : "New package"} />
      <div className="glass-strong grid gap-4 p-5 sm:grid-cols-2">
        <div><label className="label">Title</label><input className="field" required value={f.title} onChange={(e) => set({ title: e.target.value })} /></div>
        <div><label className="label">URL slug (letters, numbers, dashes)</label><input className="field" required value={f.slug} onChange={(e) => set({ slug: e.target.value })} /></div>
        <div><label className="label">Category</label><input className="field" required value={f.category} onChange={(e) => set({ category: e.target.value })} /></div>
        <div><label className="label">Duration (days)</label><input className="field" type="number" min={1} required value={f.duration_days} onChange={(e) => set({ duration_days: Number(e.target.value) })} /></div>
        <div><label className="label">Vehicle (the car price is for this vehicle)</label>
          <select className="field" required value={f.vehicle_id ?? ""} onChange={(e) => set({ vehicle_id: e.target.value || null })}>
            <option value="">Choose…</option>{vehicles.map((v) => <option key={v.id} value={v.id}>{v.name} ({v.seats} seats)</option>)}
          </select></div>
        <div><label className="label">Car price, per car for the whole trip (₹)</label><input className="field" type="number" min={0} required value={f.car_price} onChange={(e) => set({ car_price: Number(e.target.value) })} /></div>
        <div><label className="label">Hotel price per room per night (₹, 0 = no hotel option)</label><input className="field" type="number" min={0} required value={f.hotel_price_per_room_night} onChange={(e) => set({ hotel_price_per_room_night: Number(e.target.value) })} /></div>
        <div><label className="label">Persons per room</label><input className="field" type="number" min={1} required value={f.persons_per_room} onChange={(e) => set({ persons_per_room: Number(e.target.value) })} /></div>
        <div><label className="label">Pickup charge (₹, 0 = free)</label><input className="field" type="number" min={0} required value={f.pickup_price} onChange={(e) => set({ pickup_price: Number(e.target.value) })} /></div>
        <div><label className="label">Hotel / stay</label><input className="field" value={f.hotel_name ?? ""} onChange={(e) => set({ hotel_name: e.target.value || null })} /></div>
        <div className="sm:col-span-2"><PhotoField label="Cover photo" value={f.cover_image} onChange={(v) => set({ cover_image: v })} /></div>
        <div className="sm:col-span-2"><label className="label">Summary</label><textarea className="field" rows={2} required value={f.summary} onChange={(e) => set({ summary: e.target.value })} /></div>
        <div className="sm:col-span-2"><label className="label">Included (one per line)</label>
          <textarea className="field" rows={4} value={f.includes.join("\n")} onChange={(e) => set({ includes: e.target.value.split("\n").filter((l) => l.trim()) })} /></div>
        <label className="flex items-center gap-2 text-sm font-medium"><input type="checkbox" checked={f.active} onChange={(e) => set({ active: e.target.checked })} /> Visible on website</label>
      </div>

      <div className="glass-strong mt-5 space-y-4 p-5">
        <div className="flex items-center justify-between">
          <h2 className="font-bold">Day-by-day itinerary</h2>
          <button type="button" className="btn btn-ghost btn-sm" onClick={() => set({ items: [...f.items, { day_number: f.items.length + 1, title: "", description: "", places: "" }] })}>Add day</button>
        </div>
        {f.items.map((it, i) => (
          <div key={i} className="grid gap-3 rounded-xl bg-white/50 p-3 sm:grid-cols-[80px_1fr_1fr_auto]">
            <input className="field" type="number" min={1} aria-label="Day" value={it.day_number} onChange={(e) => setItem(i, { day_number: Number(e.target.value) })} />
            <input className="field" required placeholder="Title" value={it.title} onChange={(e) => setItem(i, { title: e.target.value })} />
            <input className="field" placeholder="Places (comma separated)" value={it.places} onChange={(e) => setItem(i, { places: e.target.value })} />
            <button type="button" className="btn btn-danger btn-sm" onClick={() => set({ items: f.items.filter((_, n) => n !== i) })}>Remove</button>
            <textarea className="field sm:col-span-4" rows={2} placeholder="Description" value={it.description} onChange={(e) => setItem(i, { description: e.target.value })} />
          </div>
        ))}
      </div>

      <ErrorNote message={error} />
      <div className="mt-5 flex gap-3">
        <button className="btn btn-primary" disabled={busy}>{busy ? "Saving…" : "Save package"}</button>
        <button type="button" className="btn btn-ghost" onClick={() => router.push("/packages")}>Cancel</button>
      </div>
    </form>
  );
}
