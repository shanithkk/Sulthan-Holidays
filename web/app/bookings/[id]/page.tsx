"use client";
import { use, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { QRCodeSVG } from "qrcode.react";
import { api, rupees, type Booking } from "@/lib/api";
import { useAuth } from "@/lib/auth";
import StatusBadge from "@/components/StatusBadge";
import { Breakdown } from "@/components/PackageBooking";

type Pay = {
  amount: number;
  reference: string;
  payment_status: string;
  payee: string;
  upi_id: string | null;
  upi_url: string | null;
};

export default function BookingPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  const { user, loading } = useAuth();
  const router = useRouter();
  const [b, setB] = useState<Booking | null>(null);
  const [pay, setPay] = useState<Pay | null>(null);
  const [utr, setUtr] = useState("");
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);

  const [version, setVersion] = useState(0); // bump to reload after submitting the UTR

  useEffect(() => {
    if (loading) return;
    if (!user) return router.replace(`/login?next=/bookings/${id}`);
    let live = true;
    // Payment details exist only once staff have confirmed the booking.
    api<Booking>(`/bookings/${id}`)
      .then(async (booking) => {
        const due = booking.status === "confirmed" && (booking.advance_amount ?? 0) > 0;
        const payment = due ? await api<Pay>(`/bookings/${id}/payment`) : null;
        if (!live) return;
        setB(booking);
        setPay(payment);
      })
      .catch((e) => live && setError(e instanceof Error ? e.message : "Could not load booking"));
    return () => {
      live = false;
    };
  }, [user, loading, id, router, version]);

  async function submitUtr(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError("");
    try {
      await api(`/bookings/${id}/payment-reference`, { method: "POST", json: { reference: utr } });
      setVersion((v) => v + 1);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Something went wrong");
    } finally {
      setBusy(false);
    }
  }

  if (error && !b) return <p className="mx-auto max-w-lg px-4 py-20 text-center">{error}</p>;
  if (!b) return <p className="px-4 py-20 text-center">Loading…</p>;
  const canPay = !!pay && b.status === "confirmed" && (b.payment_status === "unpaid" || b.payment_status === "submitted");

  return (
    <div className="mx-auto max-w-3xl px-4 py-12">
      <div className="glass-strong p-6 md:p-8">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <p className="text-sm font-semibold text-leaf-600">Booking {b.reference}</p>
            <h1 className="text-2xl font-extrabold">{b.title}</h1>
            <p className="mt-1 text-sm">{b.travel_date}{b.end_date !== b.travel_date ? ` to ${b.end_date}` : ""} · {b.people} {b.people === 1 ? "person" : "people"}</p>
          </div>
          <div className="flex gap-2"><StatusBadge value={b.status} /><StatusBadge value={b.payment_status} /></div>
        </div>
        <p className="mt-6 text-sm">Total fare</p>
        <p className="text-4xl font-extrabold text-leaf-700">{rupees(b.amount)}</p>

        {b.price_breakdown?.cars != null && (
          <div className="mt-4">
            <Breakdown q={b.price_breakdown} />
            {b.pickup && b.pickup_location && <p className="mt-2 text-sm">Pickup from: <b>{b.pickup_location}</b></p>}
          </div>
        )}

        {b.status === "confirmed" && b.advance_amount === 0 && (
          <p className="mt-6 rounded-xl bg-leaf-100 p-4 text-sm font-medium">
            Your booking is confirmed. <b>No advance is needed</b>: you pay the full amount as agreed with our team.
          </p>
        )}
        {b.advance_amount != null && b.advance_amount > 0 && (
          <p className="mt-1 text-sm">
            Advance <b>{rupees(b.advance_amount)}</b> · Balance <b>{rupees(b.amount - b.advance_amount)}</b> (paid later, as agreed with our team)
          </p>
        )}

        {b.status === "pending" && (
          <p className="mt-6 rounded-xl bg-amber-50 p-4 text-sm">
            <b>Waiting for confirmation.</b> Our team will check availability and confirm your booking. You will then see the
            advance amount and a QR code to pay here. No payment is needed until then.
          </p>
        )}
        {b.status === "cancelled" && b.payment_status !== "refunded" && <p className="mt-6 rounded-xl bg-red-50 p-4 text-sm">This booking was cancelled.</p>}
        {b.payment_status === "paid" && <p className="mt-6 rounded-xl bg-leaf-100 p-4 font-medium">Advance received. Thank you! Your trip is confirmed. The balance is paid later as agreed with our team.</p>}
        {b.payment_status === "refunded" && <p className="mt-6 rounded-xl bg-zinc-100 p-4">This booking was refunded.</p>}

        {canPay && pay && (
          <div className="mt-8 grid gap-6 border-t border-leaf-200 pt-6 md:grid-cols-[220px_1fr]">
            <div className="text-center">
              {pay.upi_url ? (
                <div className="inline-block rounded-2xl bg-white p-3 shadow">
                  <QRCodeSVG value={pay.upi_url} size={190} />
                </div>
              ) : (
                <p className="rounded-xl bg-amber-50 p-4 text-sm">Online payment details are not set up yet. Our team will contact you.</p>
              )}
              {pay.upi_id && <p className="mt-2 text-xs">UPI: <b>{pay.upi_id}</b></p>}
            </div>
            <div>
              <h2 className="font-bold">Pay the advance by UPI</h2>
              <ol className="mt-2 list-decimal space-y-1 pl-5 text-sm">
                <li>Scan the QR with any UPI app (GPay, PhonePe, Paytm).</li>
                <li>Pay exactly {rupees(pay.amount)}.</li>
                <li>Enter the UPI transaction ID below so we can verify it.</li>
              </ol>
              <form onSubmit={submitUtr} className="mt-4 space-y-3">
                <input className="field" required maxLength={60} placeholder="UPI transaction ID (UTR)" value={utr} onChange={(e) => setUtr(e.target.value)} />
                {error && <p className="text-sm text-red-700">{error}</p>}
                <button className="btn btn-primary" disabled={busy}>
                  {b.payment_status === "submitted" ? "Update transaction ID" : "I have paid"}
                </button>
              </form>
              {b.payment_status === "submitted" && <p className="mt-3 text-sm text-sky-800">We received your transaction ID and are verifying the payment.</p>}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
