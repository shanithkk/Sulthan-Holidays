"use client";
import { useState } from "react";
import { api, rupees, type Vehicle } from "@/lib/api";
import { Badge, ErrorNote, PageHeader, useLoad } from "@/components/ui";
import PhotoField from "@/components/PhotoField";

type Form = Omit<Vehicle, "id">;
const EMPTY: Form = {
  name: "", vehicle_type: "tavera", seats: 9, ac: true, photo_url: null, description: null,
  rate_per_km: 0, rate_per_day: 0, min_km: 0, driver_allowance: 0, night_charge: 0, active: true,
};
const NUMS: [keyof Form, string][] = [
  ["seats", "Seats"], ["rate_per_km", "Rate per km (₹)"], ["rate_per_day", "Rate per day (₹)"],
  ["min_km", "Minimum km / day"], ["driver_allowance", "Driver allowance / day (₹)"], ["night_charge", "Night charge / night (₹)"],
];

export default function VehiclesPage() {
  const { data, error, reload } = useLoad(() => api<Vehicle[]>("/vehicles"));
  const [editing, setEditing] = useState<{ id: string | null; form: Form } | null>(null);
  const [msg, setMsg] = useState("");
  const [busy, setBusy] = useState(false);

  async function save(e: React.FormEvent) {
    e.preventDefault();
    if (!editing) return;
    setBusy(true);
    setMsg("");
    try {
      const path = editing.id ? `/vehicles/${editing.id}` : "/vehicles";
      await api(path, { method: editing.id ? "PUT" : "POST", json: editing.form });
      setEditing(null);
      reload();
    } catch (err) {
      setMsg(err instanceof Error ? err.message : "Failed");
    } finally {
      setBusy(false);
    }
  }

  const set = (patch: Partial<Form>) => setEditing((s) => s && { ...s, form: { ...s.form, ...patch } });

  return (
    <>
      <PageHeader title="Vehicles">
        <button className="btn btn-primary btn-sm" onClick={() => setEditing({ id: null, form: EMPTY })}>Add vehicle</button>
      </PageHeader>
      <ErrorNote message={error || (editing ? "" : msg)} />

      {editing && (
        <form onSubmit={save} className="glass-strong mb-6 grid gap-4 p-5 sm:grid-cols-2 lg:grid-cols-3">
          <div className="lg:col-span-2"><label className="label">Name</label>
            <input className="field" required value={editing.form.name} onChange={(e) => set({ name: e.target.value })} /></div>
          <div><label className="label">Type</label>
            <select className="field" value={editing.form.vehicle_type} onChange={(e) => set({ vehicle_type: e.target.value })}>
              <option value="traveller">Traveller</option><option value="tavera">Tavera</option><option value="auto">Auto rickshaw</option>
            </select></div>
          {NUMS.map(([k, label]) => (
            <div key={k}><label className="label">{label}</label>
              <input className="field" type="number" min={0} required value={editing.form[k] as number} onChange={(e) => set({ [k]: Number(e.target.value) })} /></div>
          ))}
          <div className="lg:col-span-2"><PhotoField label="Photo" value={editing.form.photo_url} onChange={(v) => set({ photo_url: v })} /></div>
          <div className="flex items-end gap-6 pb-2 text-sm font-medium">
            <label className="flex items-center gap-2"><input type="checkbox" checked={editing.form.ac} onChange={(e) => set({ ac: e.target.checked })} /> AC</label>
            <label className="flex items-center gap-2"><input type="checkbox" checked={editing.form.active} onChange={(e) => set({ active: e.target.checked })} /> Visible on website</label>
          </div>
          <div className="sm:col-span-2 lg:col-span-3"><label className="label">Description</label>
            <textarea className="field" rows={2} value={editing.form.description ?? ""} onChange={(e) => set({ description: e.target.value || null })} /></div>
          <div className="flex items-center gap-3 sm:col-span-2 lg:col-span-3">
            <button className="btn btn-primary btn-sm" disabled={busy}>{busy ? "Saving…" : "Save"}</button>
            <button type="button" className="btn btn-ghost btn-sm" onClick={() => setEditing(null)}>Cancel</button>
            <span className="text-sm text-red-700">{msg}</span>
          </div>
        </form>
      )}

      <div className="glass overflow-x-auto">
        <table className="tbl">
          <thead><tr><th>Vehicle</th><th>Seats</th><th>Per km</th><th>Per day</th><th>Min km</th><th>Allowance</th><th>Night</th><th>Status</th><th /></tr></thead>
          <tbody>
            {data?.map((v) => (
              <tr key={v.id}>
                <td><b>{v.name}</b><br /><span className="text-xs capitalize">{v.vehicle_type} · {v.ac ? "AC" : "Non-AC"}</span></td>
                <td>{v.seats}</td><td>{rupees(v.rate_per_km)}</td><td>{rupees(v.rate_per_day)}</td><td>{v.min_km}</td>
                <td>{rupees(v.driver_allowance)}</td><td>{rupees(v.night_charge)}</td>
                <td><Badge value={v.active ? "confirmed" : "closed"} /></td>
                <td><button className="btn btn-ghost btn-sm" onClick={() => { const { id, ...form } = v; setEditing({ id, form }); window.scrollTo(0, 0); }}>Edit</button></td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </>
  );
}
