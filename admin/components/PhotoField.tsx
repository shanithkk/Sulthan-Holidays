"use client";
import { useState } from "react";
import { imgUrl, uploadPhoto } from "@/lib/api";

/** Photo picker: upload a file from your computer, or paste an image URL. */
export default function PhotoField({
  label,
  value,
  onChange,
}: {
  label: string;
  value: string | null;
  onChange: (v: string | null) => void;
}) {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  async function pick(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    e.target.value = ""; // allow choosing the same file again
    if (!file) return;
    if (file.size > 5 * 1024 * 1024) return setError("Photo is too large (max 5 MB)");
    setBusy(true);
    setError("");
    try {
      onChange(await uploadPhoto(file));
    } catch (err) {
      setError(err instanceof Error ? err.message : "Upload failed");
    } finally {
      setBusy(false);
    }
  }

  const preview = imgUrl(value);
  return (
    <div>
      <label className="label">{label}</label>
      <div className="flex items-start gap-3">
        <div
          role="img"
          aria-label="Preview"
          className="grid h-20 w-28 shrink-0 place-items-center overflow-hidden rounded-xl border border-leaf-200 bg-leaf-50 bg-cover bg-center text-xs text-leaf-800/60"
          style={preview ? { backgroundImage: `url(${preview})` } : undefined}
        >
          {!preview && "No photo"}
        </div>
        <div className="min-w-0 flex-1 space-y-2">
          <div className="flex flex-wrap items-center gap-2">
            <label className={`btn btn-ghost btn-sm cursor-pointer ${busy ? "opacity-60" : ""}`}>
              {busy ? "Uploading…" : "Upload photo"}
              <input type="file" accept="image/jpeg,image/png,image/webp" className="hidden" disabled={busy} onChange={pick} />
            </label>
            {value && (
              <button type="button" className="btn btn-ghost btn-sm" onClick={() => onChange(null)}>
                Remove
              </button>
            )}
          </div>
          <input
            className="field !py-1.5 text-xs"
            placeholder="…or paste an image URL"
            value={value ?? ""}
            onChange={(e) => onChange(e.target.value || null)}
          />
          {error && <p className="text-xs text-red-700">{error}</p>}
        </div>
      </div>
    </div>
  );
}
