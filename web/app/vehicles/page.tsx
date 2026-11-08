import type { Metadata } from "next";
import { serverGet, type Vehicle } from "@/lib/api";
import { VehicleCard } from "@/components/Cards";
import VehicleBooking from "@/components/VehicleBooking";

export const metadata: Metadata = {
  title: "Vehicle Hire in Wayanad | Sulthan Holidays",
  description: "Hire a Tempo Traveller, Tavera or auto rickshaw with a local driver in Wayanad. See your fare instantly.",
};

export default async function VehiclesPage() {
  const vehicles = await serverGet<Vehicle[]>("/vehicles");
  return (
    <div className="mx-auto max-w-6xl px-4 py-12">
      <h1 className="text-3xl font-extrabold md:text-4xl">Vehicle hire</h1>
      <p className="mt-2 text-leaf-800/80">Choose a vehicle, enter your trip and see the fare right away.</p>
      {vehicles === null && <p className="glass mt-8 p-6">We could not load vehicles right now. Please try again shortly.</p>}
      <div className="mt-8 grid gap-6 lg:grid-cols-2">
        {vehicles?.map((v) => (
          <div key={v.id} className="grid gap-4 sm:grid-cols-[220px_1fr]">
            <VehicleCard v={v} />
            <VehicleBooking v={v} />
          </div>
        ))}
      </div>
    </div>
  );
}
