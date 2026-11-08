"use client";
import { useState } from "react";
import { api, dateTime, type Enquiry } from "@/lib/api";
import { Badge, ErrorNote, PageHeader, useLoad } from "@/components/ui";

const STATUSES = ["new", "contacted", "converted", "closed"];

export default function EnquiriesPage() {
  const { data, error, reload } = useLoad(() => api<Enquiry[]>("/enquiries"));
  const [msg, setMsg] = useState("");

  async function setStatus(id: string, status: string) {
    setMsg("");
    try {
      await api(`/enquiries/${id}/status`, { method: "PATCH", json: { status } });
      reload();
    } catch (e) {
      setMsg(e instanceof Error ? e.message : "Failed");
    }
  }

  return (
    <>
      <PageHeader title="Enquiries" />
      <ErrorNote message={error || msg} />
      <div className="glass overflow-x-auto">
        <table className="tbl">
          <thead><tr><th>Received</th><th>Contact</th><th>About</th><th>Message</th><th>Status</th></tr></thead>
          <tbody>
            {data?.map((e) => (
              <tr key={e.id}>
                <td className="whitespace-nowrap">{dateTime(e.created_at)}</td>
                <td><b>{e.name}</b><br /><a className="text-leaf-700 underline" href={`tel:${e.phone}`}>{e.phone}</a>{e.email && <><br /><span className="text-xs">{e.email}</span></>}</td>
                <td>{e.subject ?? "General"}<br /><span className="text-xs">{e.people} pax{e.travel_date ? ` · ${e.travel_date}` : ""}</span></td>
                <td className="max-w-xs whitespace-pre-wrap">{e.message}</td>
                <td>
                  <Badge value={e.status} />
                  <select className="field mt-2 !py-1 text-xs" value={e.status} onChange={(ev) => setStatus(e.id, ev.target.value)}>
                    {STATUSES.map((s) => <option key={s}>{s}</option>)}
                  </select>
                </td>
              </tr>
            ))}
            {data?.length === 0 && <tr><td colSpan={5} className="text-center">No enquiries yet</td></tr>}
          </tbody>
        </table>
      </div>
    </>
  );
}
