const COLORS: Record<string, string> = {
  pending: "bg-amber-100 text-amber-800",
  confirmed: "bg-leaf-100 text-leaf-800",
  cancelled: "bg-red-100 text-red-700",
  unpaid: "bg-amber-100 text-amber-800",
  submitted: "bg-sky-100 text-sky-800",
  paid: "bg-leaf-100 text-leaf-800",
  refunded: "bg-zinc-200 text-zinc-700",
};

const LABELS: Record<string, string> = { submitted: "payment under check" };

export default function StatusBadge({ value }: { value: string }) {
  return (
    <span className={`rounded-full px-3 py-1 text-xs font-bold capitalize ${COLORS[value] ?? "bg-zinc-100"}`}>
      {LABELS[value] ?? value}
    </span>
  );
}
