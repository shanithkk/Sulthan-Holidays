"use client";
import { useState } from "react";
import { usePathname, useRouter } from "next/navigation";
import { api, type Booking, type User } from "@/lib/api";
import { useAuth } from "@/lib/auth";

/**
 * Creates a booking. Sends signed-out visitors to sign in first, and asks Google-signed-in
 * users for the mobile number the booking needs. The server recomputes the price.
 */
export default function BookButton({
  payload,
  label = "Book now",
  disabled,
}: {
  payload: Record<string, unknown>;
  label?: string;
  disabled?: boolean;
}) {
  const { user, setUser } = useAuth();
  const router = useRouter();
  const path = usePathname();
  const [phone, setPhone] = useState("");
  const [askPhone, setAskPhone] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  async function book() {
    if (!user) return router.push(`/login?next=${encodeURIComponent(path)}`);
    setBusy(true);
    setError("");
    try {
      if (user.needs_phone) {
        if (!askPhone) return setAskPhone(true);
        setUser(await api<User>("/me", { method: "PATCH", json: { phone } }));
      }
      const b = await api<Booking>("/bookings", { method: "POST", json: payload });
      router.push(`/bookings/${b.id}`);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Something went wrong");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="space-y-3">
      {askPhone && user?.needs_phone && (
        <div>
          <label className="label">Your mobile number</label>
          <input className="field" inputMode="tel" placeholder="98765 43210" value={phone} onChange={(e) => setPhone(e.target.value)} />
        </div>
      )}
      {error && <p className="rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700">{error}</p>}
      <button className="btn btn-accent w-full" onClick={book} disabled={busy || disabled}>
        {busy ? "Please wait…" : user ? label : "Sign in to book"}
      </button>
    </div>
  );
}
