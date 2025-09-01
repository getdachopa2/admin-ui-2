// src/pages/KartDurumRaporu.tsx
import { useMemo, useRef, useState } from 'react';
import { listTestCards, type TestCardRow } from '@/lib/n8nClient';
import { maskPan } from '@/utils/card';

const BANKS = ['134','046','064','067','015','111','032','012','010','205'] as const;

type AnyRow = TestCardRow & {
  ccno_masked?: string;
  ccno_last4?: string;
  expire?: string;
  e_month?: string;
  e_year?: string;
  ccno?: string;
};

export default function KartDurumRaporu() {
  const [all, setAll] = useState<TestCardRow[]>([]);
  const [loading, setLoading] = useState(false);
  const [err, setErr] = useState<string|null>(null);

  const [selBanks, setSelBanks] = useState<string[]>([]);
  const [status, setStatus] = useState<'all'|'1'|'0'>('all');
  const [q,     setQ]     = useState('');

  // tek seferlik manuel fetch için controller tut
  const abortRef = useRef<AbortController|null>(null);

  async function fetchReport() {
    // varsa önceki isteği iptal et
    abortRef.current?.abort();
    const ac = new AbortController();
    abortRef.current = ac;

    setLoading(true);
    setErr(null);
    try {
      const data = await listTestCards(ac.signal);

      // gelen payload'ı diziye normalize et
      const rows =
        Array.isArray(data) ? data
        : Array.isArray((data as any)?.items) ? (data as any).items
        : Array.isArray((data as any)?.data)  ? (data as any).data
        : [];
      setAll(rows as TestCardRow[]);
    } catch (e: any) {
      // kullanıcı iptal ettiyse/hot-reload cleanup'ı geldiyse hata göstermeyelim
      if (e?.name === 'AbortError') return;
      setErr(e?.message || 'Veri alınamadı');
    } finally {
      if (abortRef.current === ac) setLoading(false);
    }
  }

  const filtered = useMemo(() => {
    const last4 = q.trim();
    const src = Array.isArray(all) ? all : [];
    return src.filter(r => {
      if (selBanks.length && !selBanks.includes(String(r.bank_code))) return false;
      if (status !== 'all' && String(r.status) !== status) return false;
      if (last4 && !String(r.ccno).endsWith(last4)) return false;
      return true;
    });
  }, [all, selBanks, status, q]);

  const stats = useMemo(() => {
    const tot = filtered.length;
    const act = filtered.filter(r => r.status === 1).length;
    const pas = tot - act;
    return { tot, act, pas };
  }, [filtered]);

  return (
    <div className="space-y-4">
      <div className="card p-4">
        <div className="mb-2 flex items-center justify-between">
          <div className="text-lg font-semibold">Kart Durum Raporu</div>
          <button className="btn" onClick={fetchReport} disabled={loading}>
            {loading ? 'Yükleniyor…' : 'Raporu Çek'}
          </button>
        </div>

        <div className="grid gap-3 md:grid-cols-4">
          {/* Banka filtresi */}
          <div>
            <div className="mb-1 text-xs text-neutral-400">Banka Kodu</div>
            <div className="flex flex-wrap gap-2">
              {BANKS.map(b => {
                const on = selBanks.includes(b);
                return (
                  <button
                    key={b}
                    className={`chip ${on ? 'bg-emerald-500/15 text-emerald-300 border-emerald-500/30' : ''}`}
                    onClick={() =>
                      setSelBanks(on ? selBanks.filter(x => x !== b) : [...selBanks, b])
                    }
                  >
                    {b}
                  </button>
                );
              })}
              {selBanks.length>0 && (
                <button className="chip" onClick={() => setSelBanks([])}>Temizle</button>
              )}
            </div>
          </div>

          {/* Status filtresi */}
          <label className="block">
            <div className="mb-1 text-xs text-neutral-400">Status</div>
            <select className="input" value={status} onChange={(e)=> setStatus(e.target.value as any)}>
              <option value="all">Tümü</option>
              <option value="1">Aktif (1)</option>
              <option value="0">Pasif (0)</option>
            </select>
          </label>

          {/* Son 4 hane arama */}
          <label className="block">
            <div className="mb-1 text-xs text-neutral-400">Son 4 (hızlı filtre)</div>
            <input
              className="input"
              value={q}
              onChange={(e)=> setQ(e.target.value.replace(/\D+/g,''))}
              placeholder="ör. 4509"
            />
          </label>

          {/* Özet */}
          <div className="grid grid-cols-3 gap-2">
            <Stat label="Toplam" value={String(stats.tot)} />
            <Stat label="Aktif" value={String(stats.act)} />
            <Stat label="Pasif" value={String(stats.pas)} />
          </div>
        </div>
      </div>

      <div className="card overflow-hidden">
        <div className="flex items-center justify-between border-b border-base-800 p-3">
          <div className="font-medium">Kartlar</div>
          <div className="flex items-center gap-2">
            <button
              className="btn-outline"
              onClick={() => exportCSV(filtered)}
              disabled={!filtered.length}
            >
              CSV Dışa Aktar
            </button>
          </div>
        </div>

        {loading ? (
          <div className="p-4 text-sm text-base-400">Yükleniyor…</div>
        ) : err ? (
          <div className="p-4 text-sm text-red-400">Hata: {err}</div>
        ) : (
          <div className="overflow-x-auto">
            <table className="min-w-full text-left text-sm">
              <thead className="bg-neutral-900/60 text-neutral-400">
                <tr>
                  <Th>#</Th>
                  <Th>Banka</Th>
                  <Th>Kart</Th>
                  <Th>SKT</Th>
                  <Th>Status</Th>
                </tr>
              </thead>
              <tbody>
                {filtered.map((r, i) => (
                  <tr key={`${r.bank_code}-${r.ccno}-${i}`} className="border-t border-base-800 hover:bg-base-900/40">
                    <Td>{i+1}</Td>
                    <Td>{r.bank_code}</Td>
                    <Td>{panText(r as AnyRow)}</Td>
                    <Td>{expText(r as AnyRow)}</Td>
                    <Td>
                      <span className={`rounded-full px-2 py-0.5 text-xs ${
                        r.status === 1 ? 'bg-emerald-500/15 text-emerald-300' : 'bg-red-500/15 text-red-300'
                      }`}>
                        {r.status === 1 ? 'Aktif' : 'Pasif'}
                      </span>
                    </Td>
                  </tr>
                ))}
                {!filtered.length && (
                  <tr><Td colSpan={5}><div className="p-4 text-sm text-base-400">Kayıt bulunamadı.</div></Td></tr>
                )}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}

/* --- küçük yardımcılar --- */
function Th(props: React.PropsWithChildren<React.ThHTMLAttributes<HTMLTableCellElement>>) {
  return <th className="px-3 py-2 text-xs font-medium uppercase tracking-wide" {...props} />;
}
function Td(props: React.PropsWithChildren<React.TdHTMLAttributes<HTMLTableCellElement>>) {
  return <td className="px-3 py-2 align-middle" {...props} />;
}
function Stat({ label, value }: {label: string; value: string}) {
  return (
    <div className="rounded-xl border border-base-800 bg-base-900 p-2 text-center">
      <div className="text-[10px] uppercase tracking-wider text-base-500">{label}</div>
      <div className="text-sm font-semibold">{value}</div>
    </div>
  );
}

function exportCSV(rows: TestCardRow[]) {
  const header = ['bank_code','pan_masked','exp','status'];
const body = (rows as AnyRow[]).map(r => [
    r.bank_code,
    panText(r),
    expText(r),
    r.status
  ]);;
  const csv = [header, ...body].map(a => a.join(',')).join('\n');
  const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url; a.download = 'kart_durum_raporu.csv'; a.click();
  URL.revokeObjectURL(url);
}


function panText(r: AnyRow) {
  if (r.ccno) return maskPan(String(r.ccno)); // maskele
  if (r.ccno_masked) return String(r.ccno_masked);
  if (r.ccno_last4) return `•••• ${String(r.ccno_last4)}`;
  // en son eldeki ccno üstünden maskele
  return "••••";
}

// SKT birleştir – API expire veriyorsa onu kullan
function expText(r: AnyRow) {
  if (r.expire) return String(r.expire);
  const mm = (r.e_month ?? '').toString().padStart(2, '0');
  const yy = (r.e_year ?? '').toString();
  const yy2 = yy.slice(-2);
  return mm && yy2 ? `${mm}/${yy2}` : '—';
}
