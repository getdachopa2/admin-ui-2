import type { ReactNode } from "react";

export default function StepSummary({
  fields,
  tableData,
  flags,
  showTable = false,
}: {
  fields: Record<string, string>;
  tableData: Array<{ id: number; bank: string; pan: string; exp: string; mode: string }>;
  flags?: Record<string, boolean>;
  showTable?: boolean;
}) {
  return (
    <div className="space-y-3">
      {/* Combined field grid */}
      <div className="grid grid-cols-1 gap-2 sm:grid-cols-3">
        {/* Regular fields */}
        {Object.entries(fields).map(([k, v]) => (
          <div key={k} className="rounded-xl border border-neutral-800 bg-neutral-900 p-2">
            <div className="text-[9px] uppercase tracking-wider text-neutral-500">{k}</div>
            <div className="mt-1 break-all text-xs text-neutral-200">{v}</div>
          </div>
        ))}
        
        {/* Boolean flags */}
        {flags && Object.entries(flags).map(([k, on]) => (
          <div key={k} className="rounded-xl border border-neutral-800 bg-neutral-900 p-2">
            <div className="text-[9px] uppercase tracking-wider text-neutral-500">{k}</div>
            <div className="mt-1 text-xs text-neutral-200">{on ? "Açık" : "Kapalı"}</div>
          </div>
        ))}
      </div>

      {/* Table */}
      {showTable && tableData.length > 0 && (
        <div className="rounded-2xl border border-neutral-800">
          <div className="flex items-center justify-between border-b border-neutral-800 p-2">
            <div className="font-medium text-sm">Teste Girecek Kartlar</div>
            <div className="text-xs text-neutral-400">(DB'den doldurulacak — önizleme)</div>
          </div>
          <div className="overflow-x-auto">
            <table className="min-w-full text-left text-xs">
              <thead className="bg-neutral-900/60 text-neutral-400">
                <tr>
                  <Th>#</Th>
                  <Th>Banka</Th>
                  <Th>Kart</Th>
                  <Th>Son K.T.</Th>
                  <Th>Mod</Th>
                </tr>
              </thead>
              <tbody>
                {tableData.map((r) => (
                  <tr key={r.id} className="border-t border-neutral-800 hover:bg-neutral-900/40">
                    <Td>{r.id}</Td>
                    <Td>{r.bank}</Td>
                    <Td>{r.pan}</Td>
                    <Td>{r.exp}</Td>
                    <Td>
                      <span
                        className={`rounded-full px-2 py-0.5 text-xs ${
                          r.mode === "AUTO" ? "bg-emerald-500/15 text-emerald-300" : "bg-sky-500/15 text-sky-300"
                        }`}
                      >
                        {r.mode}
                      </span>
                    </Td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
}

function Th({ children }: { children: ReactNode }) {
  return <th className="px-2 py-1 text-xs font-medium uppercase tracking-wide">{children}</th>;
}
function Td({ children }: { children: ReactNode }) {
  return <td className="px-2 py-1 align-middle text-xs">{children}</td>;
}