"use client";
import Link from "next/link";
import { api, rupees, type PackageRow } from "@/lib/api";
import { Badge, ErrorNote, PageHeader, useLoad } from "@/components/ui";

export default function PackagesPage() {
  const { data, error } = useLoad(() => api<PackageRow[]>("/packages"));
  return (
    <>
      <PageHeader title="Packages">
        <Link href="/packages/new" className="btn btn-primary btn-sm">Add package</Link>
      </PageHeader>
      <ErrorNote message={error} />
      <div className="glass overflow-x-auto">
        <table className="tbl">
          <thead><tr><th>Package</th><th>Category</th><th>Days</th><th>Car</th><th>Hotel / room / night</th><th>Pickup</th><th>Status</th><th /></tr></thead>
          <tbody>
            {data?.map((p) => (
              <tr key={p.id}>
                <td><b>{p.title}</b><br /><span className="text-xs">/{p.slug}</span></td>
                <td>{p.category}</td><td>{p.duration_days}</td><td>{rupees(p.car_price)}</td>
                <td>{p.hotel_price_per_room_night > 0 ? rupees(p.hotel_price_per_room_night) : "No hotel option"}</td>
                <td>{p.pickup_price > 0 ? rupees(p.pickup_price) : "Free"}</td>
                <td><Badge value={p.active ? "confirmed" : "closed"} /></td>
                <td><Link href={`/packages/${p.id}`} className="btn btn-ghost btn-sm">Edit</Link></td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </>
  );
}
