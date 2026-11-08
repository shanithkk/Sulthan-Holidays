"use client";
import Link from "next/link";
import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { api, rupees, type Booking } from "@/lib/api";
import { useAuth } from "@/lib/auth";
import StatusBadge from "@/components/StatusBadge";

export default function AccountPage() {
  const { user, loading } = useAuth();
  const router = useRouter();
  const [bookings, setBookings] = useState<Booking[] | null>(null);
  const [error, setError] = useState("");

  useEffect(() => {
    if (loading) return;
    if (!user) return router.replace("/login?next=/account");
    api<Booking[]>("/bookings").then(setBookings).catch((e) => setError(e.message));
  }, [user, loading, router]);

  if (!user) return null;
  return (
    <div className="mx-auto max-w-4xl px-4 py-12">
      <h1 className="text-3xl font-extrabold">My bookings</h1>
      <p className="mt-1 text-leaf-800/80">
        {user.name} · {user.email}
        {user.phone ? ` · ${user.phone}` : ""}
      </p>
      {error && <p className="mt-6 rounded-lg bg-red-50 px-3 py-2 text-red-700">{error}</p>}
      {bookings && bookings.length === 0 && (
        <div className="glass mt-8 p-8 text-center">
          <p>You have no bookings yet.</p>
          <Link href="/packages" className="btn btn-primary mt-4">Browse packages</Link>
        </div>
      )}
      <div className="mt-8 space-y-4">
        {bookings?.map((b) => (
          <Link key={b.id} href={`/bookings/${b.id}`} className="glass flex flex-wrap items-center justify-between gap-3 p-5 transition hover:-translate-y-0.5">
            <div>
              <p className="font-bold">{b.title}</p>
              <p className="text-sm text-leaf-800/80">{b.reference} · {b.travel_date}</p>
            </div>
            <div className="flex items-center gap-3">
              <StatusBadge value={b.status} />
              <StatusBadge value={b.payment_status} />
              <span className="font-extrabold">{rupees(b.amount)}</span>
            </div>
          </Link>
        ))}
      </div>
    </div>
  );
}
