export const API = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:8080/api/admin";

const KEY = "sh_admin_token";
export const tokenStore = {
  get: () => (typeof window === "undefined" ? null : localStorage.getItem(KEY)),
  set: (t: string) => localStorage.setItem(KEY, t),
  clear: () => localStorage.removeItem(KEY),
};

export class ApiError extends Error {
  constructor(message: string, public status: number) {
    super(message);
  }
}

export async function api<T>(path: string, init: RequestInit & { json?: unknown } = {}): Promise<T> {
  const headers = new Headers(init.headers);
  const token = tokenStore.get();
  if (token) headers.set("authorization", `Bearer ${token}`);
  if (init.json !== undefined) {
    headers.set("content-type", "application/json");
    init.body = JSON.stringify(init.json);
  }
  let res: Response;
  try {
    res = await fetch(`${API}${path}`, { ...init, headers, cache: "no-store" });
  } catch {
    throw new ApiError("Cannot reach the server", 0);
  }
  const data = await res.json().catch(() => ({}));
  if (res.status === 401 && token) {
    // Session expired: back to the login screen.
    tokenStore.clear();
    if (typeof window !== "undefined") window.location.assign("/login");
  }
  if (!res.ok) throw new ApiError(data.error ?? "Something went wrong", res.status);
  return data as T;
}

/** Uploaded photos are stored as "/api/media/<id>"; the API server (not this app) serves them. */
export const imgUrl = (src: string | null): string | null =>
  src && src.startsWith("/api/media/") ? `${new URL(API).origin}${src}` : src;

/** Upload a photo file; returns the stored path ("/api/media/<id>"). */
export async function uploadPhoto(file: File): Promise<string> {
  const token = tokenStore.get();
  let res: Response;
  try {
    res = await fetch(`${API}/media?filename=${encodeURIComponent(file.name)}`, {
      method: "POST",
      headers: token ? { authorization: `Bearer ${token}` } : {},
      body: file,
    });
  } catch {
    throw new ApiError("Cannot reach the server", 0);
  }
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new ApiError(data.error ?? "Upload failed", res.status);
  return data.url as string;
}

export const rupees = (n: number) => `₹${n.toLocaleString("en-IN")}`;
export const dateTime = (s: string) =>
  new Date(s).toLocaleString("en-IN", { dateStyle: "medium", timeStyle: "short" });

export type Staff = { id: string; name: string; email: string; role: string };
export type Booking = {
  id: string; reference: string; kind: string; title: string | null; travel_date: string; end_date: string;
  people: number; km: number | null; amount: number; status: string; payment_status: string; notes: string | null;
  customer_name: string; customer_email: string; customer_phone: string | null; created_at: string;
  payment_reference: string | null;
  advance_amount: number | null;
  hotel: boolean; pickup: boolean; pickup_location: string | null;
  price_breakdown: { cars?: number; rooms?: number; nights?: number; car_total?: number; hotel_total?: number; pickup_total?: number } | null;
};
export type Enquiry = {
  id: string; name: string; phone: string; email: string | null; people: number; travel_date: string | null;
  message: string | null; status: string; subject: string | null; created_at: string;
};
export type Vehicle = {
  id: string; name: string; vehicle_type: string; seats: number; ac: boolean; photo_url: string | null;
  description: string | null; rate_per_km: number; rate_per_day: number; min_km: number;
  driver_allowance: number; night_charge: number; active: boolean;
};
export type PackageRow = {
  id: string; slug: string; title: string; category: string; summary: string; duration_days: number;
  car_price: number; hotel_price_per_room_night: number; pickup_price: number; persons_per_room: number;
  vehicle_id: string | null; hotel_name: string | null; cover_image: string | null;
  includes: string[]; active: boolean;
};
export type PackageDetail = PackageRow & {
  items: { day_number: number; title: string; description: string; places: string }[];
};
export type PlacePhoto = { url: string; caption: string | null; credit: string | null; source_url: string | null };
export type Place = {
  id: string; slug: string; name: string; description: string; sort_order: number; active: boolean;
  photos: PlacePhoto[];
};
export type Trip = {
  id: string; title: string; label: string; description: string; trip_date: string | null;
  sort_order: number; active: boolean;
  photos: { url: string; caption: string | null }[];
  feedback: { author: string | null; body: string; rating: number | null }[];
};
export type Stats = {
  new_enquiries: number; pending_bookings: number; confirmed_bookings: number; awaiting_payment_check: number;
  revenue_paid: number; active_packages: number; active_vehicles: number;
};
export type AuditRow = {
  id: string; staff_name: string | null; action: string; entity: string; entity_id: string | null;
  details: Record<string, unknown>; created_at: string;
};
