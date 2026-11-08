import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { BedDouble, Car, Check } from "lucide-react";
import { serverGet, type PackageDetail } from "@/lib/api";
import PackageBooking from "@/components/PackageBooking";
import WayanadMap from "@/components/WayanadMap";
import { photosForPlaces } from "@/lib/photos";

type Props = { params: Promise<{ slug: string }> };

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { slug } = await params;
  const p = await serverGet<PackageDetail>(`/packages/${slug}`);
  return p ? { title: `${p.title} | Sulthan Holidays`, description: p.summary } : { title: "Package" };
}

export default async function PackagePage({ params }: Props) {
  const { slug } = await params;
  const p = await serverGet<PackageDetail>(`/packages/${slug}`);
  if (!p) notFound();

  return (
    <div className="mx-auto max-w-6xl px-4 py-12">
      <p className="text-sm font-bold uppercase tracking-widest text-leaf-600">{p.category}</p>
      <h1 className="mt-1 text-3xl font-extrabold md:text-5xl">{p.title}</h1>
      <p className="mt-3 max-w-2xl text-lg text-leaf-800/85">{p.summary}</p>

      <div className="mt-10 grid gap-8 lg:grid-cols-[1fr_380px]">
        <div className="space-y-6">
          <div className="glass flex flex-wrap gap-6 p-5 text-sm">
            {p.vehicle_name && <span className="flex items-center gap-2"><Car size={18} className="text-leaf-600" />{p.vehicle_name}</span>}
            {p.hotel_name && <span className="flex items-center gap-2"><BedDouble size={18} className="text-leaf-600" />{p.hotel_name}</span>}
          </div>

          {p.includes.length > 0 && (
            <div className="glass p-6">
              <h2 className="text-lg font-bold">What is included</h2>
              <ul className="mt-3 grid gap-2 sm:grid-cols-2">
                {p.includes.map((i) => (
                  <li key={i} className="flex items-center gap-2 text-sm"><Check size={16} className="text-leaf-600" />{i}</li>
                ))}
              </ul>
            </div>
          )}

          <div className="glass p-6">
            <h2 className="text-lg font-bold">Itinerary</h2>
            <ol className="mt-4 space-y-6 border-l-2 border-leaf-300 pl-6">
              {p.items.map((d) => {
                const photos = photosForPlaces(d.places);
                return (
                  <li key={d.day_number} className="relative">
                    <span className="absolute -left-[2.15rem] grid h-7 w-7 place-items-center rounded-full bg-leaf-600 text-xs font-bold text-white">
                      {d.day_number}
                    </span>
                    <h3 className="font-bold">{d.title}</h3>
                    <p className="text-sm text-leaf-800/85">{d.description}</p>
                    {d.places && <p className="mt-1 text-xs font-semibold text-leaf-600">{d.places}</p>}
                    {photos.length > 0 && (
                      <div className="mt-3 grid grid-cols-2 gap-3 sm:grid-cols-3">
                        {photos.map((ph) => (
                          <figure key={ph.src} className="overflow-hidden rounded-xl">
                            <div role="img" aria-label={ph.title} className="h-28 bg-leaf-100 bg-cover bg-center" style={{ backgroundImage: `url(${ph.src})` }} />
                            <figcaption className="bg-leaf-50/80 px-2 py-1 text-xs font-medium">{ph.title}</figcaption>
                          </figure>
                        ))}
                      </div>
                    )}
                  </li>
                );
              })}
            </ol>
          </div>

          <div className="glass p-6">
            <h2 className="text-lg font-bold">Where you will go</h2>
            <WayanadMap
              className="mx-auto mt-3 max-h-80 w-full"
              labels
              highlight={p.items.flatMap((d) => d.places.split(",").map((s) => s.trim()).filter(Boolean))}
            />
            <p className="mt-2 text-center text-xs text-leaf-800/70">Wayanad district. Positions are approximate.</p>
          </div>
        </div>

        <aside className="lg:sticky lg:top-24 lg:self-start">
          <PackageBooking p={p} />
          <p className="mt-4 text-center text-sm">
            Questions? <Link className="font-semibold text-leaf-700 underline" href={`/enquiry?package=${p.id}`}>Send an enquiry</Link>
          </p>
        </aside>
      </div>
    </div>
  );
}
