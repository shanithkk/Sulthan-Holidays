import type { Metadata } from "next";
import { PHOTOS, photoUrl } from "@/lib/photos";
import { serverGet, type Place } from "@/lib/api";

export const metadata: Metadata = { title: "Photo credits | Sulthan Holidays" };

export default async function CreditsPage() {
  const places = await serverGet<Place[]>("/places");
  const credited = (places ?? []).flatMap((pl) =>
    pl.photos.filter((ph) => ph.credit).map((ph) => ({ place: pl.name, credit: ph.credit as string, href: ph.source_url })),
  );
  return (
    <div className="mx-auto max-w-3xl px-4 py-12">
      <h1 className="text-3xl font-extrabold">Photo credits</h1>
      <p className="mt-2 text-leaf-800/80">
        Photos are from Wikimedia Commons and used under the licences shown. The Wayanad district outline is from
        OpenStreetMap (© OpenStreetMap contributors, ODbL).
      </p>
      <div className="glass mt-6 divide-y divide-leaf-100">
        {Object.values(PHOTOS).map((p) => (
          <div key={p.src} className="flex flex-wrap items-center justify-between gap-2 px-5 py-3 text-sm">
            <span className="font-semibold">{p.title}</span>
            <span>
              {p.author} ·{" "}
              <a className="text-leaf-700 underline" href={photoUrl(p)} target="_blank" rel="noopener noreferrer">
                {p.licence}
              </a>
            </span>
          </div>
        ))}
        {credited.map((c, i) => (
          <div key={i} className="flex flex-wrap items-center justify-between gap-2 px-5 py-3 text-sm">
            <span className="font-semibold">{c.place}</span>
            {c.href ? (
              <a className="text-leaf-700 underline" href={c.href} target="_blank" rel="noopener noreferrer">{c.credit}</a>
            ) : (
              <span>{c.credit}</span>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}
