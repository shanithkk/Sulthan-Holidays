import Link from "next/link";

export default function Footer() {
  return (
    <footer className="mt-20 px-3 pb-6">
      <div className="glass mx-auto flex max-w-6xl flex-col gap-4 px-6 py-8 md:flex-row md:justify-between">
        <div>
          <p className="text-lg font-extrabold text-leaf-800">Sulthan Holidays</p>
          <p className="mt-1 max-w-sm text-sm text-leaf-800/80">
            Wayanad tour packages and vehicle hire. Local drivers, honest prices.
          </p>
        </div>
        <div className="flex gap-8 text-sm">
          <div className="flex flex-col gap-2">
            <Link href="/packages">Packages</Link>
            <Link href="/vehicles">Vehicles</Link>
            <Link href="/enquiry">Send an enquiry</Link>
          </div>
          <div className="flex flex-col gap-2">
            <Link href="/account">My bookings</Link>
            <Link href="/login">Sign in</Link>
            <Link href="/credits">Photo credits</Link>
          </div>
        </div>
      </div>
      <div className="mx-auto mt-3 flex max-w-6xl flex-col items-center justify-between gap-1 px-2 text-xs text-leaf-800/70 md:flex-row">
        <p>© {new Date().getFullYear()} Sulthan Holidays. All rights reserved.</p>
        <p>
          Photos used under their open licences (<Link href="/credits" className="underline">credits</Link>). Map data © OpenStreetMap contributors (ODbL).
        </p>
        <p>Developed by <span className="font-semibold">KK Technologies</span></p>
      </div>
    </footer>
  );
}
