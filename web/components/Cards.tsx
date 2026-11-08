import Link from "next/link";
import { Car, Clock, Snowflake, Users } from "lucide-react";
import { imgUrl, rupees, type Package, type Vehicle } from "@/lib/api";
import { vehiclePhoto } from "@/lib/photos";

const COVERS: Record<string, string> = {
  Honeymoon: "from-rose-200 via-leaf-200 to-leaf-400",
  Adventure: "from-amber-200 via-leaf-300 to-leaf-600",
  Family: "from-sky-200 via-leaf-200 to-leaf-500",
};

export function PackageCard({ p }: { p: Package }) {
  return (
    <Link href={`/packages/${p.slug}`} className="glass group block overflow-hidden transition hover:-translate-y-1">
      <div
        className={`relative h-44 bg-gradient-to-br ${COVERS[p.category] ?? "from-leaf-200 to-leaf-500"} bg-cover bg-center`}
        style={p.cover_image ? { backgroundImage: `url(${imgUrl(p.cover_image)})` } : undefined}
      >
        <span className="glass absolute left-3 top-3 !rounded-full px-3 py-1 text-xs font-semibold">{p.category}</span>
      </div>
      <div className="p-5">
        <h3 className="text-lg font-bold group-hover:text-leaf-600">{p.title}</h3>
        <p className="mt-1 line-clamp-2 text-sm text-leaf-800/80">{p.summary}</p>
        <div className="mt-4 flex items-center justify-between">
          <span className="flex items-center gap-1 text-sm text-leaf-800/80">
            <Clock size={15} /> {p.duration_days} {p.duration_days === 1 ? "day" : "days"}
          </span>
          <span className="text-right font-extrabold text-leaf-700">
            <span className="block text-xs font-medium text-leaf-800/70">Car + driver from</span>
            {rupees(p.car_price)}
          </span>
        </div>
      </div>
    </Link>
  );
}

export function VehicleCard({ v }: { v: Vehicle }) {
  const photo = imgUrl(vehiclePhoto(v.vehicle_type, v.photo_url));
  return (
    <div className="glass overflow-hidden">
      <div
        role="img"
        aria-label={v.name}
        className="grid h-44 place-items-center bg-gradient-to-br from-leaf-100 to-leaf-300 bg-cover bg-center"
        style={photo ? { backgroundImage: `url(${photo})` } : undefined}
      >
        {!photo && <Car size={56} className="text-leaf-700/70" />}
      </div>
      <div className="p-5">
        <h3 className="font-bold">{v.name}</h3>
        <div className="mt-2 flex gap-4 text-sm text-leaf-800/80">
          <span className="flex items-center gap-1"><Users size={15} /> {v.seats} seats</span>
          <span className="flex items-center gap-1"><Snowflake size={15} /> {v.ac ? "AC" : "Non-AC"}</span>
        </div>
        <p className="mt-3 text-sm font-semibold text-leaf-700">{rupees(v.rate_per_km)} / km</p>
      </div>
    </div>
  );
}
