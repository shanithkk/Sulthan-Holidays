/** Photos are from Wikimedia Commons. Licences require showing the author, so the footer lists them. */
export type Photo = { src: string; title: string; author: string; licence: string; file: string };

const c = (file: string) => `https://commons.wikimedia.org/wiki/File:${encodeURIComponent(file.replace(/ /g, "_"))}`;

export const PHOTOS = {
  traveller: { src: "/images/vehicles/traveller.jpg", title: "Force Traveller", author: "Biswarup Ganguly", licence: "CC BY 3.0", file: "Force Motors - Traveller 26 - Agra 2014-05-14 4222.JPG" },
  tavera: { src: "/images/vehicles/tavera.jpg", title: "Chevrolet Tavera", author: "Premnath Kudva", licence: "CC BY-SA 3.0", file: "2004IndiaTavera278.jpg" },
  auto: { src: "/images/vehicles/auto.jpg", title: "Auto rickshaw, Kerala", author: "Christopher Michel", licence: "CC BY 2.0", file: "Passenger auto travel in Kerala.jpg" },
  pookode: { src: "/images/places/pookode.jpg", title: "Pookode Lake", author: "Ingo Mehling", licence: "CC BY-SA 4.0", file: "Wayanad - Pookode Lake - 1.jpg" },
  chembra: { src: "/images/places/chembra.jpg", title: "Chembra Peak", author: "Ravi Dwivedi", licence: "CC BY-SA 4.0", file: "Chembra Peak Heart Lake.jpg" },
  tea: { src: "/images/places/tea.jpg", title: "Tea plantation, Vythiri", author: "Athulvis", licence: "CC BY-SA 4.0", file: "Tea plantation in Vythiri 10.jpg" },
  banasura: { src: "/images/places/banasura.jpg", title: "Banasura Sagar Dam", author: "Athulvis", licence: "CC BY-SA 4.0", file: "Banasura sagar dam 22.jpg" },
  edakkal: { src: "/images/places/edakkal.jpg", title: "Edakkal Caves", author: "Ingo Mehling", licence: "CC BY-SA 4.0", file: "Edakkal Caves - Petroglyphs - 4.jpg" },
  soochipara: { src: "/images/places/soochipara.jpg", title: "Soochipara Falls", author: "Arunkumar003prpc", licence: "CC BY-SA 4.0", file: "Soochipara falls.jpg" },
  lakkidi: { src: "/images/places/lakkidi.jpg", title: "Lakkidi view point", author: "Vinayaraj", licence: "CC BY-SA 4.0", file: "Lakkidi view point - vinnila2k24 (15).jpg" },
  thirunelli: { src: "/images/places/thirunelli.jpg", title: "Thirunelli Temple", author: "RajeshUnuppally", licence: "CC0", file: "Thirunelli Temple.JPG" },
  kuruva: { src: "/images/places/kuruva.jpg", title: "Kuruva Island", author: "Challiyan", licence: "CC0", file: "Kuruva islands wayanad.jpg" },
  meenmutty: { src: "/images/places/meenmutty.jpg", title: "Meenmutty Falls", author: "Anantharamvanchiprakash", licence: "Public domain", file: "Meenmutty Falls Wayanad.JPG" },
  muthanga: { src: "/images/places/muthanga.jpg", title: "Muthanga Wildlife Sanctuary", author: "Kir360", licence: "CC BY 3.0", file: "Muthanga Wildlife Sanctuary.JPG" },
} satisfies Record<string, Photo>;

export const photoUrl = (p: Photo) => c(p.file);

/** Place names used in package itineraries -> photo. Matching is by keyword. */
const PLACE_KEYS: [string, keyof typeof PHOTOS][] = [
  ["pookode", "pookode"], ["chembra", "chembra"], ["banasura", "banasura"], ["edakkal", "edakkal"],
  ["soochipara", "soochipara"], ["lakkidi", "lakkidi"], ["chain tree", "lakkidi"], ["thirunelli", "thirunelli"],
  ["kuruva", "kuruva"], ["meenmutty", "meenmutty"], ["muthanga", "muthanga"],
];

/** Photos for the places listed in an itinerary (unique, in order). */
export function photosForPlaces(placesText: string): Photo[] {
  const out: Photo[] = [];
  for (const raw of placesText.split(",")) {
    const name = raw.trim().toLowerCase();
    const hit = PLACE_KEYS.find(([k]) => name.includes(k));
    if (hit && !out.includes(PHOTOS[hit[1]])) out.push(PHOTOS[hit[1]]);
  }
  return out;
}

export function vehiclePhoto(type: string, fallback: string | null): string | null {
  return fallback ?? (type in PHOTOS ? PHOTOS[type as "traveller" | "tavera" | "auto"].src : null);
}
