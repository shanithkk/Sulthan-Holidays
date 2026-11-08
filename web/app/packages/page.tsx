import type { Metadata } from "next";
import { serverGet, type Package } from "@/lib/api";
import { PackageCard } from "@/components/Cards";
import Paged from "@/components/Paged";

export const metadata: Metadata = {
  title: "Wayanad Tour Packages | Sulthan Holidays",
  description: "Honeymoon, family and adventure tour packages in Wayanad with vehicle, stay and guide.",
};

export default async function PackagesPage() {
  const packages = await serverGet<Package[]>("/packages");
  return (
    <div className="mx-auto max-w-6xl px-4 py-12">
      <h1 className="text-3xl font-extrabold md:text-4xl">Tour packages</h1>
      <p className="mt-2 text-leaf-800/80">Pick a ready-made trip. The price is for the car; add a hotel and pickup if you need them.</p>
      {packages === null && <p className="glass mt-8 p-6">We could not load packages right now. Please try again shortly.</p>}
      <div className="mt-8">
        <Paged
          label="packages"
          pageSize={6}
          gridClass="gap-6 sm:grid-cols-2 lg:grid-cols-3"
          items={(packages ?? []).map((p) => <PackageCard key={p.id} p={p} />)}
        />
      </div>
    </div>
  );
}
