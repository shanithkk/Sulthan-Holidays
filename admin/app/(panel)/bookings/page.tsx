"use client";
import { useState } from "react";
import { api, dateTime, rupees, type Booking } from "@/lib/api";
import { Badge, ErrorNote, PageHeader, useLoad } from "@/components/ui";

export default function BookingsPage() {
  const { data, error, reload } = useLoad(() => api<Booking[]>("/bookings"));
  const [msg, setMsg] = useState("");
  const [filter, setFilter] = useState("all");

  async function act(path: string, json?: unknown, confirmText?: string) {
    if (confirmText && !window.confirm(confirmText)) return;
    setMsg("");
    try {
      await api(path, { method: path.endsWith("/status") ? "PATCH" : "POST", json });
      setDlg(null);
      reload();
    } catch (e) {
      setMsg(e instanceof Error ? e.message : "Failed");
    }
  }

  // Confirm dialog (also used to ask for / change the advance later).
  const [dlg, setDlg] = useState<{ b: Booking; mode: "confirm" | "change"; choice: "25" | "0" | "custom"; custom: string } | null>(null);
  const quarter = (b: Booking) => Math.max(1, Math.ceil(b.amount * 0.25));

  function openDialog(b: Booking, mode: "confirm" | "change") {
    setMsg("");
    setDlg({ b, mode, choice: mode === "confirm" ? "25" : "25", custom: String(quarter(b)) });
  }

  async function submitDialog() {
    if (!dlg) return;
    const { b, choice, custom } = dlg;
    const amount = choice === "25" ? quarter(b) : choice === "0" ? 0 : Number(custom);
    if (!Number.isInteger(amount) || amount < 0 || amount > b.amount) {
      setMsg(`Advance must be a whole number between 0 and ${b.amount}`);
      return;
    }
    setDlg(null);
    if (dlg.mode === "confirm") await act(`/bookings/${b.id}/status`, { status: "confirmed", advance_amount: amount });
    else await act(`/bookings/${b.id}/advance`, { amount });
  }

  function refund(b: Booking) {
    const max = b.advance_amount ?? b.amount;
    const amount = Number(window.prompt(`Refund amount (max ${max})`, String(max)));
    if (!amount) return;
    const reason = window.prompt("Reason for refund");
    if (reason) act(`/bookings/${b.id}/refund`, { amount, reason });
  }

  const rows = data?.filter((b) => filter === "all" || b.status === filter || b.payment_status === filter);

  return (
    <>
      <PageHeader title="Bookings">
        <select className="field !w-auto" value={filter} onChange={(e) => setFilter(e.target.value)}>
          {["all", "pending", "confirmed", "cancelled", "submitted", "paid", "refunded"].map((f) => (
            <option key={f} value={f}>{f === "submitted" ? "payment to verify" : f}</option>
          ))}
        </select>
      </PageHeader>
      <ErrorNote message={error || msg} />
      {dlg && (
        <div className="fixed inset-0 z-50 grid place-items-center bg-black/60 p-4" onClick={() => setDlg(null)}>
          <div className="glass-strong w-full max-w-md space-y-4 p-6" onClick={(e) => e.stopPropagation()} role="dialog" aria-modal="true">
            <div>
              <h2 className="text-lg font-extrabold">{dlg.mode === "confirm" ? "Confirm booking" : "Advance"} {dlg.b.reference}</h2>
              <p className="text-sm">Total {rupees(dlg.b.amount)}. Choose what the customer pays online now.</p>
            </div>
            {([
              ["25", `Ask 25% advance (${rupees(quarter(dlg.b))})`],
              ["0", "No advance: customer pays nothing online"],
              ["custom", "Custom amount"],
            ] as const).map(([v, label]) => (
              <label key={v} className="flex items-center gap-2 text-sm font-medium">
                <input type="radio" name="adv" checked={dlg.choice === v} onChange={() => setDlg({ ...dlg, choice: v })} /> {label}
              </label>
            ))}
            {dlg.choice === "custom" && (
              <input className="field" type="number" min={0} max={dlg.b.amount} value={dlg.custom} onChange={(e) => setDlg({ ...dlg, custom: e.target.value })} />
            )}
            {msg && <p className="text-sm text-red-700">{msg}</p>}
            <div className="flex gap-2">
              <button className="btn btn-primary btn-sm" onClick={submitDialog}>{dlg.mode === "confirm" ? "Confirm booking" : "Save"}</button>
              <button className="btn btn-ghost btn-sm" onClick={() => setDlg(null)}>Cancel</button>
            </div>
          </div>
        </div>
      )}
      <div className="glass overflow-x-auto">
        <table className="tbl">
          <thead><tr><th>Booking</th><th>Customer</th><th>Trip</th><th>Amount</th><th>Status</th><th>Actions</th></tr></thead>
          <tbody>
            {rows?.map((b) => (
              <tr key={b.id}>
                <td><b>{b.reference}</b><br /><span className="text-xs">{dateTime(b.created_at)}</span></td>
                <td>{b.customer_name}<br /><a className="text-leaf-700 underline" href={`tel:${b.customer_phone}`}>{b.customer_phone}</a><br /><span className="text-xs">{b.customer_email}</span></td>
                <td>{b.title}<br /><span className="text-xs">{b.travel_date} → {b.end_date} · {b.people} pax{b.km != null ? ` · ${b.km} km` : ""}</span>{b.price_breakdown?.cars != null && <><br /><span className="text-xs">{b.price_breakdown.cars} car{b.price_breakdown.cars === 1 ? "" : "s"}{b.hotel ? ` · hotel ${b.price_breakdown.rooms} room(s) × ${b.price_breakdown.nights} night(s)` : " · no hotel"}{b.pickup ? ` · pickup: ${b.pickup_location ?? "-"}` : " · no pickup"}</span></>}{b.notes && <><br /><span className="text-xs italic">{b.notes}</span></>}</td>
                <td className="font-bold">{rupees(b.amount)}{b.advance_amount === 0 && <><br /><span className="text-xs font-normal">No advance · pay on trip</span></>}{b.advance_amount != null && b.advance_amount > 0 && <><br /><span className="text-xs font-normal">Advance {rupees(b.advance_amount)} · Balance {rupees(b.amount - b.advance_amount)}</span></>}{b.payment_reference && <><br /><span className="text-xs font-normal">UTR: {b.payment_reference}</span></>}</td>
                <td className="space-y-1"><Badge value={b.status} /><br /><Badge value={b.payment_status} /></td>
                <td>
                  <div className="flex flex-wrap gap-1.5">
                    {b.status === "pending" && <button className="btn btn-primary btn-sm" onClick={() => openDialog(b, "confirm")}>Confirm</button>}
                    {b.status === "confirmed" && (b.payment_status === "unpaid" || b.payment_status === "submitted") &&
                      <button className="btn btn-ghost btn-sm" onClick={() => openDialog(b, "change")}>{b.advance_amount ? "Change advance" : "Ask advance"}</button>}
                    {b.status === "confirmed" && (b.advance_amount ?? 0) > 0 && (b.payment_status === "unpaid" || b.payment_status === "submitted") &&
                      <button className="btn btn-ghost btn-sm" onClick={() => act(`/bookings/${b.id}/advance`, { amount: 0 }, `Remove the advance for ${b.reference}? The customer will not be asked to pay online.`)}>Remove advance</button>}
                    {(b.advance_amount ?? 0) > 0 && (b.payment_status === "unpaid" || b.payment_status === "submitted") && b.status === "confirmed" &&
                      <button className="btn btn-accent btn-sm" onClick={() => act(`/bookings/${b.id}/mark-paid`, undefined, `Mark the ${rupees(b.advance_amount ?? b.amount)} advance for ${b.reference} as received? Check the money is in the UPI account first.`)}>Mark paid</button>}
                    {b.payment_status === "paid" && <button className="btn btn-ghost btn-sm" onClick={() => refund(b)}>Refund</button>}
                    {b.status !== "cancelled" && <button className="btn btn-danger btn-sm" onClick={() => act(`/bookings/${b.id}/status`, { status: "cancelled" }, `Cancel ${b.reference}?`)}>Cancel</button>}
                  </div>
                </td>
              </tr>
            ))}
            {rows?.length === 0 && <tr><td colSpan={6} className="text-center">No bookings</td></tr>}
          </tbody>
        </table>
      </div>
    </>
  );
}
