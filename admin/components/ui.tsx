"use client";
import { useEffect, useState } from "react";

const COLORS: Record<string, string> = {
  pending: "bg-amber-100 text-amber-800",
  new: "bg-amber-100 text-amber-800",
  unpaid: "bg-amber-100 text-amber-800",
  confirmed: "bg-leaf-100 text-leaf-800",
  paid: "bg-leaf-100 text-leaf-800",
  converted: "bg-leaf-100 text-leaf-800",
  contacted: "bg-sky-100 text-sky-800",
  submitted: "bg-sky-100 text-sky-800",
  cancelled: "bg-red-100 text-red-700",
  closed: "bg-zinc-200 text-zinc-700",
  refunded: "bg-zinc-200 text-zinc-700",
};

export function Badge({ value }: { value: string }) {
  return <span className={`rounded-full px-2.5 py-1 text-xs font-bold capitalize ${COLORS[value] ?? "bg-zinc-100"}`}>{value}</span>;
}

export function PageHeader({ title, children }: { title: string; children?: React.ReactNode }) {
  return (
    <div className="mb-5 flex flex-wrap items-center justify-between gap-3">
      <h1 className="text-2xl font-extrabold">{title}</h1>
      <div className="flex gap-2">{children}</div>
    </div>
  );
}

/** Loads data once on mount; returns data, error and a reload function. */
export function useLoad<T>(load: () => Promise<T>) {
  const [data, setData] = useState<T | null>(null);
  const [error, setError] = useState("");
  const [version, setVersion] = useState(0);
  useEffect(() => {
    let live = true;
    load()
      .then((d) => live && setData(d))
      .catch((e) => live && setError(e instanceof Error ? e.message : "Failed to load"));
    return () => {
      live = false;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [version]);
  return { data, error, setData, reload: () => setVersion((v) => v + 1) };
}

export function ErrorNote({ message }: { message: string }) {
  return message ? <p className="mb-4 rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700">{message}</p> : null;
}
