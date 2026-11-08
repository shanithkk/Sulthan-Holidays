"use client";
import { api, dateTime, type AuditRow } from "@/lib/api";
import { ErrorNote, PageHeader, useLoad } from "@/components/ui";

export default function AuditPage() {
  const { data, error } = useLoad(() => api<AuditRow[]>("/audit"));
  return (
    <>
      <PageHeader title="Audit log" />
      <ErrorNote message={error} />
      <div className="glass overflow-x-auto">
        <table className="tbl">
          <thead><tr><th>When</th><th>Who</th><th>Action</th><th>Details</th></tr></thead>
          <tbody>
            {data?.map((a) => (
              <tr key={a.id}>
                <td className="whitespace-nowrap">{dateTime(a.created_at)}</td>
                <td>{a.staff_name ?? "-"}</td>
                <td><b>{a.action}</b> {a.entity}</td>
                <td className="font-mono text-xs">{JSON.stringify(a.details)}</td>
              </tr>
            ))}
            {data?.length === 0 && <tr><td colSpan={4} className="text-center">Nothing recorded yet</td></tr>}
          </tbody>
        </table>
      </div>
    </>
  );
}
