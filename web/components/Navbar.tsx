"use client";
import Link from "next/link";
import { useState } from "react";
import { Leaf, Menu, X } from "lucide-react";
import { useAuth } from "@/lib/auth";
import ThemeToggle from "./ThemeToggle";

const links = [
  { href: "/packages", label: "Packages" },
  { href: "/vehicles", label: "Vehicles" },
  { href: "/enquiry", label: "Enquiry" },
];

export default function Navbar() {
  const { user, loading, signOut } = useAuth();
  const [open, setOpen] = useState(false);

  return (
    <header className="sticky top-3 z-40 px-3">
      <nav className="glass mx-auto flex max-w-6xl items-center justify-between px-5 py-3">
        <Link href="/" className="flex items-center gap-2 text-lg font-extrabold text-leaf-800">
          <span className="grid h-9 w-9 place-items-center rounded-full bg-leaf-600 text-white">
            <Leaf size={18} />
          </span>
          Sulthan Holidays
        </Link>

        <div className="hidden items-center gap-6 md:flex">
          {links.map((l) => (
            <Link key={l.href} href={l.href} className="font-medium text-leaf-800 hover:text-leaf-500">
              {l.label}
            </Link>
          ))}
          <ThemeToggle />
          {!loading &&
            (user ? (
              <>
                <Link href="/account" className="font-medium text-leaf-800 hover:text-leaf-500">
                  My bookings
                </Link>
                <button onClick={signOut} className="btn btn-ghost !py-2">
                  Sign out
                </button>
              </>
            ) : (
              <Link href="/login" className="btn btn-primary !py-2">
                Sign in
              </Link>
            ))}
        </div>

        <div className="flex items-center gap-2 md:hidden">
          <ThemeToggle />
          <button onClick={() => setOpen(!open)} aria-label="Menu" className="p-1">
            {open ? <X /> : <Menu />}
          </button>
        </div>
      </nav>

      {open && (
        <div className="glass-strong mx-auto mt-2 flex max-w-6xl flex-col gap-3 p-5 md:hidden" onClick={() => setOpen(false)}>
          {links.map((l) => (
            <Link key={l.href} href={l.href} className="font-medium">
              {l.label}
            </Link>
          ))}
          {user ? (
            <>
              <Link href="/account" className="font-medium">My bookings</Link>
              <button onClick={signOut} className="btn btn-ghost">Sign out</button>
            </>
          ) : (
            <Link href="/login" className="btn btn-primary">Sign in</Link>
          )}
        </div>
      )}
    </header>
  );
}
