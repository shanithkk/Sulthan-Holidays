import Link from "next/link";
import { MapPin, Quote, ShieldCheck, Sparkles, Star, Wallet } from "lucide-react";
import { serverGet, type Package, type Place, type Trip, type Vehicle } from "@/lib/api";
import { PackageCard, VehicleCard } from "@/components/Cards";
import WayanadMap from "@/components/WayanadMap";
import PhotoGallery, { type GalleryItem } from "@/components/PhotoGallery";
import Paged from "@/components/Paged";

const perks = [
  { icon: MapPin, title: "Local Wayanad experts", text: "Drivers and guides who know every hairpin bend." },
  { icon: Wallet, title: "Clear prices", text: "See the fare before you book. No surprise charges." },
  { icon: ShieldCheck, title: "Verified vehicles", text: "Clean, insured and well-maintained vehicles." },
  { icon: Sparkles, title: "Made for you", text: "Honeymoon, family or adventure: we plan it your way." },
];

export default async function Home() {
  const [packages, vehicles, places, trips] = await Promise.all([
    serverGet<Package[]>("/packages"),
    serverGet<Vehicle[]>("/vehicles"),
    serverGet<Place[]>("/places"),
    serverGet<Trip[]>("/trips"),
  ]);
  // Past trips as gallery tiles: "1 Day Trip" / "3 Day Trip" badge, photos, and the feedback staff added.
  const tripItems: GalleryItem[] = (trips ?? []).map((t) => ({
    id: t.id,
    name: t.title,
    description: t.description,
    badge: t.label || undefined,
    photos: t.photos.map((p) => ({ url: p.url, caption: p.caption, credit: null, source_url: null })),
    quotes: t.feedback.map((f) => ({ text: f.body, by: f.author, rating: f.rating })),
  }));
  // Every feedback note, as its own card in the "What our travellers say" section.
  const feedback = (trips ?? []).flatMap((t) =>
    t.feedback.map((f) => ({ ...f, trip: [t.label, t.title].filter(Boolean).join(" · ") })),
  );

  return (
    <>
      <section className="relative overflow-hidden px-4 pb-16 pt-14 md:pt-24">
        <div className="pointer-events-none absolute -left-24 top-0 h-80 w-80 rounded-full bg-leaf-300/50 blur-3xl" />
        <div className="pointer-events-none absolute -right-24 top-20 h-80 w-80 rounded-full bg-sun-400/30 blur-3xl" />
        <div className="relative mx-auto max-w-6xl">
          <div className="glass-strong max-w-2xl p-8 md:p-12">
            <p className="text-sm font-bold uppercase tracking-widest text-leaf-600">Wayanad, Kerala</p>
            <h1 className="mt-3 text-4xl font-extrabold leading-tight md:text-6xl">
              Mist, waterfalls and <span className="text-leaf-600">green hills</span>, planned for you.
            </h1>
            <p className="mt-5 text-lg text-leaf-800/85">
              Ready-made tour packages and comfortable vehicles with local drivers. Book online in minutes.
            </p>
            <div className="mt-8 flex flex-wrap gap-3">
              <Link href="/packages" className="btn btn-primary">Explore packages</Link>
              <Link href="/vehicles" className="btn btn-ghost">Hire a vehicle</Link>
            </div>
          </div>
        </div>
      </section>

      <section className="mx-auto max-w-6xl px-4">
        <div className="flex items-end justify-between">
          <h2 className="text-2xl font-extrabold md:text-3xl">Popular packages</h2>
          <Link href="/packages" className="text-sm font-semibold text-leaf-700 hover:underline">View all</Link>
        </div>
        {packages && packages.length > 0 ? (
          <div className="mt-6">
            <Paged
              label="packages"
              pageSize={3}
              gridClass="gap-6 sm:grid-cols-2 lg:grid-cols-3"
              items={packages.map((p) => <PackageCard key={p.id} p={p} />)}
            />
          </div>
        ) : (
          <p className="glass mt-6 p-6">Packages are being updated. Please check back soon or send us an enquiry.</p>
        )}
      </section>

      <section className="mx-auto mt-16 max-w-6xl px-4">
        <h2 className="text-2xl font-extrabold md:text-3xl">Places you will love</h2>
        <div className="mt-6 grid gap-6 lg:grid-cols-[1fr_380px]">
          {places && places.length > 0 ? (
            <PhotoGallery places={places} />
          ) : (
            <p className="glass p-6">Photos are coming soon.</p>
          )}
          <div className="glass-strong p-4">
            <WayanadMap labels className="w-full" />
            <p className="mt-1 text-center text-xs text-leaf-800/70">Wayanad and its main spots (approximate)</p>
          </div>
        </div>
      </section>

      <section className="mx-auto mt-16 max-w-6xl px-4">
        <h2 className="text-2xl font-extrabold md:text-3xl">Our vehicles</h2>
        <div className="mt-6 grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
          {vehicles?.map((v) => <VehicleCard key={v.id} v={v} />)}
        </div>
      </section>

      {tripItems.length > 0 && (
        <section className="mx-auto mt-16 max-w-6xl px-4">
          <h2 className="text-2xl font-extrabold md:text-3xl">Our happy travellers</h2>
          <p className="mt-1 text-leaf-800/80">Real trips with Sulthan Holidays. Tap a photo to see more.</p>
          <div className="mt-6">
            <PhotoGallery places={tripItems} label="trips" />
          </div>
        </section>
      )}

      {feedback.length > 0 && (
        <section className="mx-auto mt-16 max-w-6xl px-4">
          <h2 className="text-2xl font-extrabold md:text-3xl">What our travellers say</h2>
          <div className="mt-6">
            <Paged
              label="feedback"
              pageSize={3}
              gridClass="gap-6 md:grid-cols-3"
              items={feedback.map((f, i) => (
                <figure key={i} className="glass flex flex-col p-5">
                  <Quote size={22} className="text-leaf-600" />
                  <blockquote className="mt-2 flex-1 text-sm italic">{f.body}</blockquote>
                  <figcaption className="mt-4 text-sm">
                    <span className="font-bold">{f.author ?? "A happy traveller"}</span>
                    {f.rating && (
                      <span className="mt-1 flex text-sun-500" aria-label={`${f.rating} out of 5`}>
                        {Array.from({ length: f.rating }, (_, s) => <Star key={s} size={14} fill="currentColor" />)}
                      </span>
                    )}
                    <span className="mt-1 block text-xs text-leaf-800/70">{f.trip}</span>
                  </figcaption>
                </figure>
              ))}
            />
          </div>
        </section>
      )}

      <section className="mx-auto mt-16 max-w-6xl px-4">
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          {perks.map(({ icon: Icon, title, text }) => (
            <div key={title} className="glass p-5">
              <Icon className="text-leaf-600" />
              <h3 className="mt-3 font-bold">{title}</h3>
              <p className="mt-1 text-sm text-leaf-800/80">{text}</p>
            </div>
          ))}
        </div>
      </section>
    </>
  );
}
