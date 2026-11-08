"use client";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { Bell, CalendarCheck, Car, Images, LayoutDashboard, Leaf, LogOut, Map, ScrollText, Users } from "lucide-react";
import { api, tokenStore, type Staff } from "@/lib/api";

const nav = [
  { href: "/", label: "Dashboard", icon: LayoutDashboard },
  { href: "/bookings", label: "Bookings", icon: CalendarCheck },
  { href: "/enquiries", label: "Enquiries", icon: Bell },
  { href: "/packages", label: "Packages", icon: Map },
  { href: "/vehicles", label: "Vehicles", icon: Car },
  { href: "/places", label: "Places", icon: Images },
  { href: "/trips", label: "Our travellers", icon: Users },
  { href: "/audit", label: "Audit log", icon: ScrollText },
];

export default function PanelLayout({ children }: { children: React.ReactNode }) {
  const router = useRouter();
  const path = usePathname();
  const [staff, setStaff] = useState<Staff | null>(null);

  useEffect(() => {
    if (!tokenStore.get()) {
      router.replace("/login");
      return;
    }
    api<Staff>("/me").then(setStaff).catch(() => router.replace("/login"));
  }, [router]);

  if (!staff) return <p className="grid min-h-screen place-items-center">Loading…</p>;

  return (
    <div className="mx-auto flex min-h-screen max-w-[1400px] gap-5 p-4">
      <aside className="glass-strong sticky top-4 hidden h-[calc(100vh-2rem)] w-60 shrink-0 flex-col p-4 md:flex">
        <div className="flex items-center gap-2 px-2 pb-4 font-extrabold text-leaf-800">
          <span className="grid h-8 w-8 place-items-center rounded-full bg-leaf-600 text-white"><Leaf size={16} /></span>
          Admin
        </div>
        <nav className="flex flex-1 flex-col gap-1">
          {nav.map(({ href, label, icon: Icon }) => {
            const active = href === "/" ? path === "/" : path.startsWith(href);
            return (
              <Link key={href} href={href}
                className={`flex items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-semibold ${active ? "bg-leaf-600 text-white" : "hover:bg-white/70"}`}>
                <Icon size={18} /> {label}
              </Link>
            );
          })}
        </nav>
        <div className="border-t border-leaf-200 pt-3 text-sm">
          <p className="font-semibold">{staff.name}</p>
          <p className="truncate text-xs text-leaf-800/70">{staff.email}</p>
          <button className="btn btn-ghost btn-sm mt-3 w-full" onClick={() => { tokenStore.clear(); router.replace("/login"); }}>
            <LogOut size={14} /> Sign out
          </button>
        </div>
      </aside>
      <div className="min-w-0 flex-1">
        <nav className="glass mb-4 flex gap-2 overflow-x-auto p-2 md:hidden">
          {nav.map(({ href, label }) => (
            <Link key={href} href={href} className={`whitespace-nowrap rounded-full px-3 py-1.5 text-sm font-semibold ${path === href ? "bg-leaf-600 text-white" : ""}`}>{label}</Link>
          ))}
        </nav>
        {children}
      </div>
    </div>
  );
}
