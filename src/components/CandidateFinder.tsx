import { useEffect, useRef, useState, useMemo } from 'react';
import { listCandidates, type CandidateRow } from '@/lib/n8nClient';

export default function CandidateFinder({
  action,
  channelId,
  onPick,
}: {
  action: 'cancel' | 'refund';
  channelId: string;
  onPick: (row: CandidateRow) => void;
}) {
  const [rows, setRows] = useState<CandidateRow[]>([]);
  const [loading, setLoading] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  const today = new Date();
  const toISO = (d: Date) => d.toISOString().slice(0, 10);
  const yest = new Date(today.getFullYear(), today.getMonth(), today.getDate() - 1);

  const [from, setFrom] = useState(
    action === 'cancel' ? toISO(today) : toISO(new Date(today.getFullYear(), today.getMonth(), today.getDate() - 7)),
  );
  const [to, setTo] = useState(action === 'cancel' ? toISO(today) : toISO(yest));
  const [limit, setLimit] = useState(50);

  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(15);

  const abortRef = useRef<AbortController | null>(null);

  async function run() {
    if (!channelId) {
      setErr('Channel ID gerekli');
      return;
    }
    abortRef.current?.abort();
    const ac = new AbortController();
    abortRef.current = ac;

    setLoading(true);
    setErr(null);
    try {
      const data = await listCandidates({ action, channelId, from, to, limit }, ac.signal);
      setRows(Array.isArray(data) ? data : []);
      setPage(1);
    } catch (e: any) {
      if (e?.name !== 'AbortError') setErr(e?.message || 'Kayıtlar alınamadı');
    } finally {
      if (abortRef.current === ac) setLoading(false);
    }
  }

  useEffect(() => {
    run();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const total = rows.length;
  const totalPages = Math.max(1, Math.ceil(total / pageSize));
  const safePage = Math.min(Math.max(1, page), totalPages);
  const start = (safePage - 1) * pageSize;
  const paged = useMemo(() => rows.slice(start, start + pageSize), [rows, start, pageSize]);

  const isSuccess = (v: CandidateRow['success']) =>
    (typeof v === 'boolean' && v) || String(v).toLowerCase() === 'true';

  return (
    <div className="space-y-3">
      {/* Compact form grid */}
      <div className="grid gap-2 grid-cols-2 md:grid-cols-3 lg:grid-cols-6 text-xs">
        <div>
          <div className="mb-1 text-neutral-500">Aksiyon</div>
          <div className="px-2 py-1 bg-neutral-800 rounded text-center">{action}</div>
        </div>
        <div>
          <div className="mb-1 text-neutral-500">Channel</div>
          <div className="px-2 py-1 bg-neutral-800 rounded text-center font-mono">{channelId}</div>
        </div>
        <div>
          <div className="mb-1 text-neutral-500">From</div>
          <input type="date" className="w-full px-2 py-1 bg-neutral-800 border border-neutral-700 rounded text-xs" value={from} onChange={(e) => setFrom(e.target.value)} />
        </div>
        <div>
          <div className="mb-1 text-neutral-500">To</div>
          <input type="date" className="w-full px-2 py-1 bg-neutral-800 border border-neutral-700 rounded text-xs" value={to} onChange={(e) => setTo(e.target.value)} />
        </div>
        <div>
          <div className="mb-1 text-neutral-500">Limit</div>
          <input
            type="number"
            className="w-full px-2 py-1 bg-neutral-800 border border-neutral-700 rounded text-xs"
            value={String(limit)}
            onChange={(e) => setLimit(Number(e.target.value) || 0)}
            min={1}
            max={500}
          />
        </div>
        <div>
          <div className="mb-1 text-neutral-500">Sayfa</div>
          <select className="w-full px-2 py-1 bg-neutral-800 border border-neutral-700 rounded text-xs" value={pageSize} onChange={(e) => setPageSize(Number(e.target.value))}>
            {[10, 15, 20, 30, 50].map((n) => (
              <option key={n} value={n}>
                {n}
              </option>
            ))}
          </select>
        </div>
      </div>

      <div className="flex items-center gap-2 flex-wrap">
        <button className="btn text-xs px-3 py-1" onClick={run} disabled={loading}>
          {loading ? 'Yükleniyor…' : 'Getir'}
        </button>
        {err && <div className="text-xs text-red-400">{err}</div>}
        <div className="ml-auto text-xs text-base-400">
          Toplam: <span className="font-medium text-base-200">{total}</span>
        </div>
      </div>

      <div className="rounded-2xl border border-base-800 overflow-hidden">
        <div className="flex items-center justify-between border-b border-base-800 p-3">
          <div className="font-medium">Adaylar</div>
          <div className="text-xs text-base-400">
            Sayfa {safePage}/{totalPages}
          </div>
        </div>

        <div className="max-h-64 overflow-auto">
          {/* Desktop Table View */}
          <div className="hidden md:block">
            <table className="min-w-full text-left text-xs">
              <thead className="sticky top-0 z-10 bg-neutral-900/90 backdrop-blur text-neutral-400">
                <tr>
                  <Th>#</Th>
                  <Th>paymentId</Th>
                  <Th>amount</Th>
                  <Th>app</Th>
                  <Th>success</Th>
                  <Th></Th>
                </tr>
              </thead>
              <tbody>
                {paged.map((r, i) => (
                  <tr key={`${r.paymentId}-${i}`} className="border-t border-base-800 hover:bg-base-900/40">
                    <Td className="text-neutral-400">{start + i + 1}</Td>
                    <Td className="font-mono text-blue-300">{r.paymentId}</Td>
                    <Td className="text-amber-300">{r.amount}</Td>
                    <Td className="text-green-300">{r.app}</Td>
                    <Td>
                      <span
                        className={`rounded-full px-1.5 py-0.5 text-xs ${
                          isSuccess(r.success)
                            ? 'bg-emerald-500/15 text-emerald-300'
                            : 'bg-amber-500/15 text-amber-300'
                        }`}
                      >
                        {String(r.success)}
                      </span>
                    </Td>
                    <Td>
                      <button className="btn-outline text-xs px-2 py-1" onClick={() => onPick(r)}>
                        Seç
                      </button>
                    </Td>
                  </tr>
                ))}
                {!paged.length && (
                  <tr>
                    <Td colSpan={6}>
                      <div className="p-4 text-sm text-base-400 text-center">Kayıt bulunamadı.</div>
                    </Td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>

          {/* Mobile Card View */}
          <div className="md:hidden space-y-2">
            {paged.map((r, i) => (
              <div key={`${r.paymentId}-${i}`} className="bg-neutral-900/50 border border-neutral-800 rounded-lg p-3">
                <div className="flex items-center justify-between mb-2">
                  <span className="text-xs text-neutral-400">#{start + i + 1}</span>
                  <span
                    className={`rounded-full px-1.5 py-0.5 text-xs ${
                      isSuccess(r.success)
                        ? 'bg-emerald-500/15 text-emerald-300'
                        : 'bg-amber-500/15 text-amber-300'
                    }`}
                  >
                    {String(r.success)}
                  </span>
                </div>
                <div className="space-y-1 text-xs">
                  <div className="flex justify-between">
                    <span className="text-neutral-400">Payment ID:</span>
                    <span className="font-mono text-blue-300">{r.paymentId}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-neutral-400">Amount:</span>
                    <span className="text-amber-300">{r.amount}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-neutral-400">App:</span>
                    <span className="text-green-300">{r.app}</span>
                  </div>
                </div>
                <button 
                  className="btn-outline text-xs px-3 py-1 w-full mt-2" 
                  onClick={() => onPick(r)}
                >
                  Seç
                </button>
              </div>
            ))}
            {!paged.length && (
              <div className="p-4 text-sm text-base-400 text-center">Kayıt bulunamadı.</div>
            )}
          </div>
        </div>

        <div className="flex items-center justify-between border-t border-base-800 p-3 text-sm">
          <div className="text-xs text-base-400">
            {start + 1}-{Math.min(start + pageSize, total)} / {total}
          </div>
          <div className="flex items-center gap-2">
            <button className="btn-outline" onClick={() => setPage(1)} disabled={safePage <= 1}>
              « İlk
            </button>
            <button className="btn-outline" onClick={() => setPage((p) => Math.max(1, p - 1))} disabled={safePage <= 1}>
              ‹ Önceki
            </button>
            <button
              className="btn-outline"
              onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
              disabled={safePage >= totalPages}
            >
              Sonraki ›
            </button>
            <button
              className="btn-outline"
              onClick={() => setPage(totalPages)}
              disabled={safePage >= totalPages}
            >
              Son »
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

function Th(props: React.PropsWithChildren<React.ThHTMLAttributes<HTMLTableCellElement>>) {
  return <th className="px-3 py-2 text-xs font-medium uppercase tracking-wide" {...props} />;
}
function Td(props: React.PropsWithChildren<React.TdHTMLAttributes<HTMLTableCellElement>>) {
  return <td className="px-3 py-2 align-middle" {...props} />;
}
