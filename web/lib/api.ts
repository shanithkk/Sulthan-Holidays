export const API = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:8080/api";

export type Package = {
  id: string;
  slug: string;
  title: string;
  category: string;
  summary: string;
  duration_days: number;
  /** Price of one car for the whole trip. */
  car_price: number;
  /** Per room per night. 0 = no hotel option. */
  hotel_price_per_room_night: number;
  pickup_price: number;
  persons_per_room: number;
  vehicle_id: string | null;
  hotel_name: string | null;
  cover_image: string | null;
  includes: string[];
};
export type PackageDetail = Package & {
  vehicle_name: string | null;
  vehicle_seats: number | null;
  items: { day_number: number; title: string; description: string; places: string }[];
};
export type PlacePhoto = { url: string; caption: string | null; credit: string | null; source_url: string | null };
export type Place = { id: string; slug: string; name: string; description: string; photos: PlacePhoto[] };
export type Trip = {
  id: string;
  title: string;
  label: string;
  description: string;
  trip_date: string | null;
  photos: { url: string; caption: string | null }[];
  feedback: { author: string | null; body: string; rating: number | null }[];
};
export type PackageQuote = {
  people: number;
  cars: number;
  car_price: number;
  car_total: number;
  hotel: boolean;
  rooms: number;
  nights: number;
  hotel_price_per_room_night: number;
  hotel_total: number;
  pickup: boolean;
  pickup_total: number;
  total: number;
};
export type Vehicle = {
  id: string;
  name: string;
  vehicle_type: "traveller" | "tavera" | "auto";
  seats: number;
  ac: boolean;
  photo_url: string | null;
  description: string | null;
  rate_per_km: number;
  rate_per_day: number;
  min_km: number;
  driver_allowance: number;
  night_charge: number;
};
export type Booking = {
  id: string;
  reference: string;
  kind: "package" | "vehicle";
  title: string | null;
  travel_date: string;
  end_date: string;
  people: number;
  amount: number;
  status: "pending" | "confirmed" | "cancelled";
  payment_status: "unpaid" | "submitted" | "paid" | "refunded";
  /** Set by staff when they confirm; the customer pays only this online. */
  advance_amount: number | null;
  hotel: boolean;
  pickup: boolean;
  pickup_location: string | null;
  price_breakdown: Partial<PackageQuote> | null;
};
export type User = { id: string; name: string; email: string; phone: string | null; needs_phone: boolean };

export class ApiError extends Error {
  constructor(message: string, public status: number) {
    super(message);
  }
}

const TOKEN_KEY = "sh_token";
export const tokenStore = {
  get: () => (typeof window === "undefined" ? null : localStorage.getItem(TOKEN_KEY)),
  set: (t: string) => localStorage.setItem(TOKEN_KEY, t),
  clear: () => localStorage.removeItem(TOKEN_KEY),
};

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
    throw new ApiError("Cannot reach the server. Please try again.", 0);
  }
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new ApiError(data.error ?? "Something went wrong", res.status);
  return data as T;
}

/** For server components (public catalogue, good for SEO). Returns null if the API is down. */
export async function serverGet<T>(path: string): Promise<T | null> {
  try {
    const res = await fetch(`${API}${path}`, { cache: "no-store" });
    return res.ok ? ((await res.json()) as T) : null;
  } catch {
    return null;
  }
}

/** Photos uploaded in the admin panel are stored as "/api/media/<id>" and served by the API. */
export const imgUrl = (src: string | null): string | null =>
  src && src.startsWith("/api/media/") ? `${new URL(API).origin}${src}` : src;
// Photos shipped with the site (/images/...) are served by the website itself, so they need no change.

export const rupees = (n: number) => `₹${n.toLocaleString("en-IN")}`;
