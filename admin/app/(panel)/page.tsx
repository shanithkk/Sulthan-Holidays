"use client";
import Link from "next/link";
import { api, rupees, type Stats } from "@/lib/api";
import { ErrorNote, PageHeader, useLoad } from "@/components/ui";

export default function Dashboard() {
  const { data: s, error } = useLoad(() => api<Stats>("/stats"));
  const cards = s && [
    { label: "New enquiries", value: s.new_enquiries, href: "/enquiries" },
    { label: "Pending bookings", value: s.pending_bookings, href: "/bookings" },
    { label: "Payments to verify", value: s.awaiting_payment_check, href: "/bookings" },
    { label: "Confirmed bookings", value: s.confirmed_bookings, href: "/bookings" },
    { label: "Revenue (paid)", value: rupees(s.revenue_paid), href: "/bookings" },
    { label: "Active packages", value: s.active_packages, href: "/packages" },
    { label: "Active vehicles", value: s.active_vehicles, href: "/vehicles" },
  ];
  return (
    <>
      <PageHeader title="Dashboard" />
      <ErrorNote message={error} />
      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        {cards?.map((c) => (
          <Link key={c.label} href={c.href} className="glass p-5 transition hover:-translate-y-0.5">
            <p className="text-sm font-semibold text-leaf-700">{c.label}</p>
            <p className="mt-2 text-3xl font-extrabold">{c.value}</p>
          </Link>
        ))}
      </div>
    </>
  );
}
