"use client";
import { useEffect, useState } from "react";
import { api, rupees, type Vehicle } from "@/lib/api";
import BookButton from "./BookButton";

type Fare = { days: number; billable_km: number; km_charge: number; driver_allowance: number; night_charge: number; total: number };
const today = () => new Date().toISOString().slice(0, 10);

export default function VehicleBooking({ v }: { v: Vehicle }) {
  const [date, setDate] = useState("");
  const [days, setDays] = useState(1);
  const [km, setKm] = useState(v.min_km);
  const [night, setNight] = useState(false);
  const [people, setPeople] = useState(1);
  const [fare, setFare] = useState<Fare | null>(null);
  const [error, setError] = useState("");

  // Live fare from the server (so the shown price is always the one we charge).
  useEffect(() => {
    const t = setTimeout(() => {
      api<Fare>("/vehicles/quote", { method: "POST", json: { vehicle_id: v.id, days, km, night } })
        .then((f) => { setFare(f); setError(""); })
        .catch((e) => { setFare(null); setError(e.message); });
    }, 250);
    return () => clearTimeout(t);
  }, [v.id, days, km, night]);

  const num = (set: (n: number) => void, min: number, max: number) => (e: React.ChangeEvent<HTMLInputElement>) =>
    set(Math.min(max, Math.max(min, Number(e.target.value) || min)));

  return (
    <div className="glass-strong space-y-3 p-5">
      <div className="grid grid-cols-2 gap-3">
        <div className="col-span-2">
          <label className="label">Pickup date</label>
          <input className="field" type="date" min={today()} value={date} onChange={(e) => setDate(e.target.value)} />
        </div>
        <div>
          <label className="label">Days</label>
          <input className="field" type="number" value={days} onChange={num(setDays, 1, 30)} />
        </div>
        <div>
          <label className="label">Estimated km</label>
          <input className="field" type="number" value={km} onChange={num(setKm, 0, 5000)} />
        </div>
        <div>
          <label className="label">Passengers</label>
          <input className="field" type="number" value={people} onChange={num(setPeople, 1, v.seats)} />
        </div>
        <label className="mt-6 flex items-center gap-2 text-sm font-medium">
          <input type="checkbox" checked={night} onChange={(e) => setNight(e.target.checked)} /> Night halt
        </label>
      </div>

      {error && <p className="text-sm text-red-700">{error}</p>}
      {fare && (
        <div className="space-y-1 rounded-xl bg-leaf-50/80 p-3 text-sm">
          <Row k={`${fare.billable_km} km × ${rupees(v.rate_per_km)}`} v={fare.km_charge} />
          <Row k={`Driver allowance (${fare.days} d)`} v={fare.driver_allowance} />
          {night && <Row k="Night charge" v={fare.night_charge} />}
          <div className="flex justify-between border-t border-leaf-200 pt-2 text-base font-extrabold">
            <span>Estimated fare</span><span>{rupees(fare.total)}</span>
          </div>
          <p className="text-xs text-leaf-800/70">Minimum {v.min_km} km per day. Tolls and parking are extra.</p>
        </div>
      )}

      <BookButton
        disabled={!date || !fare}
        payload={{ kind: "vehicle", vehicle_id: v.id, travel_date: date, days, km, night, people }}
      />
    </div>
  );
}

function Row({ k, v }: { k: string; v: number }) {
  return <div className="flex justify-between"><span>{k}</span><span>{rupees(v)}</span></div>;
}
