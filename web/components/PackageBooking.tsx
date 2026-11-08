"use client";
import { useEffect, useState } from "react";
import { api, rupees, type PackageDetail, type PackageQuote } from "@/lib/api";
import BookButton from "./BookButton";

const today = () => new Date().toISOString().slice(0, 10);

/**
 * Price = car + hotel (optional) + pickup (optional). Cars and rooms follow the group size.
 * The breakdown always comes from the server so what is shown is what is charged.
 */
export default function PackageBooking({ p }: { p: PackageDetail }) {
  const [date, setDate] = useState("");
  const [people, setPeople] = useState(2);
  const [hotel, setHotel] = useState(false);
  const [pickup, setPickup] = useState(false);
  const [where, setWhere] = useState("");
  const [quote, setQuote] = useState<PackageQuote | null>(null);
  const [error, setError] = useState("");

  const hotelOffered = p.hotel_price_per_room_night > 0 && p.duration_days > 1;
  const wantHotel = hotel && hotelOffered;

  useEffect(() => {
    const t = setTimeout(() => {
      api<PackageQuote>("/packages/quote", { method: "POST", json: { package_id: p.id, people, hotel: wantHotel, pickup } })
        .then((q) => { setQuote(q); setError(""); })
        .catch((e) => { setQuote(null); setError(e.message); });
    }, 250);
    return () => clearTimeout(t);
  }, [p.id, people, wantHotel, pickup]);

  const valid = date !== "" && !!quote && (!pickup || where.trim() !== "");

  return (
    <div className="glass-strong space-y-4 p-6">
      <div>
        <p className="text-sm text-leaf-800/80">Car + driver from</p>
        <p className="text-3xl font-extrabold text-leaf-700">{rupees(p.car_price)}</p>
        <p className="text-xs text-leaf-800/70">
          for the whole trip, per {p.vehicle_name ?? "car"}. Not charged per person.
        </p>
      </div>

      <div>
        <label className="label">Travel date</label>
        <input className="field" type="date" min={today()} value={date} onChange={(e) => setDate(e.target.value)} />
      </div>
      <div>
        <label className="label">Total persons</label>
        <input className="field" type="number" min={1} max={100} value={people}
          onChange={(e) => setPeople(Math.min(100, Math.max(1, Number(e.target.value) || 1)))} />
        {p.vehicle_seats && (
          <p className="mt-1 text-xs text-leaf-800/70">
            {p.vehicle_name} seats {p.vehicle_seats}. A bigger group needs more than one car.
          </p>
        )}
      </div>

      {hotelOffered && (
        <label className="flex items-start gap-2 text-sm font-medium">
          <input type="checkbox" className="mt-1" checked={hotel} onChange={(e) => setHotel(e.target.checked)} />
          <span>
            I need a hotel
            <span className="block text-xs font-normal text-leaf-800/70">
              {rupees(p.hotel_price_per_room_night)} per room per night, {p.persons_per_room} persons per room
            </span>
          </span>
        </label>
      )}

      <label className="flex items-start gap-2 text-sm font-medium">
        <input type="checkbox" className="mt-1" checked={pickup} onChange={(e) => setPickup(e.target.checked)} />
        <span>
          I need pickup
          <span className="block text-xs font-normal text-leaf-800/70">
            {p.pickup_price > 0 ? `${rupees(p.pickup_price)} extra` : "Free"}
          </span>
        </span>
      </label>
      {pickup && (
        <div>
          <label className="label">Pickup location</label>
          <input className="field" maxLength={200} placeholder="Railway station, airport, address…" value={where}
            onChange={(e) => setWhere(e.target.value)} />
        </div>
      )}

      {error && <p className="text-sm text-red-700">{error}</p>}
      {quote && <Breakdown q={quote} vehicle={p.vehicle_name} />}

      <BookButton
        disabled={!valid}
        payload={{
          kind: "package", package_id: p.id, travel_date: date, people,
          hotel: wantHotel, pickup, pickup_location: pickup ? where : null,
        }}
      />
    </div>
  );
}

export function Breakdown({ q, vehicle }: { q: Partial<PackageQuote>; vehicle?: string | null }) {
  const row = (k: string, v: number) => (
    <div className="flex justify-between gap-3"><span>{k}</span><span className="font-semibold">{rupees(v)}</span></div>
  );
  return (
    <div className="space-y-1 rounded-xl bg-leaf-50/80 p-3 text-sm">
      {row(`${q.cars} × ${vehicle ?? "car"} (${rupees(q.car_price ?? 0)} each)`, q.car_total ?? 0)}
      {q.hotel && row(`Hotel: ${q.rooms} room${q.rooms === 1 ? "" : "s"} × ${q.nights} night${q.nights === 1 ? "" : "s"}`, q.hotel_total ?? 0)}
      {q.pickup && row("Pickup", q.pickup_total ?? 0)}
      <div className="flex justify-between border-t border-leaf-200 pt-2 text-base font-extrabold">
        <span>Total for {q.people} {q.people === 1 ? "person" : "persons"}</span><span>{rupees(q.total ?? 0)}</span>
      </div>
    </div>
  );
}
