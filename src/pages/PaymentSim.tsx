// src/pages/PaymentSim.tsx
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  longPollEvents,
  N8nEventItem,
  startPayment,
} from '../lib/n8nClient';

type EnvOpt = 'stb' | 'prp';
type CardSelectionMode = 'automatic' | 'manual';

type ManualCard = {
  creditCardNo: string;
  expireDateMonth: string;
  expireDateYear: string;
  cvcNo: string;
};

const DEFAULT_MANUAL_CARD: ManualCard = {
  creditCardNo: '4508034508034509',
  expireDateMonth: '12',
  expireDateYear: '26',
  cvcNo: '000',
};

export default function PaymentSim() {
  // ---- Form State ----
  const [env, setEnv] = useState<EnvOpt>('stb');
  const [cardMode, setCardMode] = useState<CardSelectionMode>('automatic');

  const [manualCards, setManualCards] = useState<ManualCard[]>([DEFAULT_MANUAL_CARD]);

  const [applicationName, setApplicationName] = useState('SENSAT');
  const [applicationPassword, setApplicationPassword] = useState('H0287TA5K30P8DSJ');
  const [secureCode, setSecureCode] = useState('H0287TA5K30P8DSJ');
  const [transactionId, setTransactionId] = useState('00812142049000018727');
  const [transactionDateTime, setTransactionDateTime] = useState('20210812142051000');

  const [paymentType, setPaymentType] = useState<'creditcard' | 'debitcard' | 'prepaidcard'>(
    'creditcard',
  );
  const [threeDOperation, setThreeDOperation] = useState(false);
  const [installmentNumber, setInstallmentNumber] = useState(0);

  const [channelId, setChannelId] = useState('999134');
  const [segment, setSegment] = useState('X');
  const [userId, setUserId] = useState('5315236097');
  const [userName, setUserName] = useState('TPAY');

  const [amount, setAmount] = useState('10.20');
  const [msisdn, setMsisdn] = useState('5315236097');

  const [runMode] = useState<'payment-only' | 'all'>('payment-only');

  // ---- Run / Events State ----
  const [runKey, setRunKey] = useState<string | null>(null);
  const [cursor, setCursor] = useState(0);
  const [status, setStatus] = useState<'idle' | 'running' | 'completed' | 'error'>('idle');
  const [events, setEvents] = useState<N8nEventItem[]>([]);
  const [error, setError] = useState<string | null>(null);

  const abortRef = useRef<AbortController | null>(null);

  const normMsisdn = (x: string) => {
  let d = (x || '').replace(/\D+/g, '');
  if (d.startsWith('0')) d = '90' + d.slice(1);
  if (!d.startsWith('90')) d = '90' + d;
  return d;
};

const payload = {
  env,
  channelId,
  segment,
  userId,
  userName,
  cardSelectionMode: cardMode,
  ...(cardMode === 'manual'
    ? {
        manualCards: manualCards.map(c => ({
          ccno: c.creditCardNo.replace(/\s+/g, ''),
          e_month: c.expireDateMonth,
          e_year: c.expireDateYear,
          cvv: c.cvcNo,
        })),
      }
    : {}),
  application: {
    applicationName,
    applicationPassword,
    secureCode,
    transactionId,
    transactionDateTime,
  },
  payment: {
    paymentType,
    threeDOperation,
    installmentNumber,
    options: {
      includeMsisdnInOrderID: false,
      checkCBBLForMsisdn: true,
      checkCBBLForCard: true,
      checkFraudStatus: false,
    },
  },
  products: [{ amount, msisdn: normMsisdn(msisdn) }],
  runMode,
};

  // ---- Actions ----
  const handleStart = useCallback(async () => {
    setError(null);
    setEvents([]);
    setCursor(0);
    setStatus('running');

    abortRef.current?.abort();
    abortRef.current = new AbortController();

    try {
      const res = await startPayment(payload, abortRef.current.signal);
      setRunKey(res.runKey);
    } catch (e: any) {
      setStatus('error');
      setError(e?.message || 'Başlatma başarısız');
    }
  }, [payload]);

  const stopStream = useCallback(() => {
    abortRef.current?.abort();
    abortRef.current = null;
    // status'ü running bırakabiliriz; kullanıcı tekrar devam edebilir.
  }, []);

  // ---- Long-poll loop ----
  useEffect(() => {
    if (!runKey) return;
    let cancelled = false;

    const loop = async () => {
      while (!cancelled) {
        try {
          if (!abortRef.current) break;
          const res = await longPollEvents(runKey, cursor, 25, abortRef.current.signal);

          if (res.events?.length) {
            setEvents((prev) => [...prev, ...res.events]);
          }
          setCursor(res.nextCursor ?? cursor);

          if (res.status === 'completed' || res.status === 'error') {
            setStatus(res.status);
            break;
          }

          // küçük bir nefes
          await sleep(200);
        } catch (e: any) {
          if (e?.name === 'AbortError') break;
          setError(e?.message || 'Event akışında hata');
          setStatus('error');
          break;
        }
      }
    };

    loop();

    return () => {
      cancelled = true;
    };
  }, [runKey, cursor]);

  // ---- Helpers ----
  const addManualCard = () =>
    setManualCards((x) => [
      ...x,
      { creditCardNo: '', expireDateMonth: '', expireDateYear: '', cvcNo: '' },
    ]);
  const removeManualCard = (idx: number) =>
    setManualCards((x) => x.filter((_, i) => i !== idx));
  const updateManualCard = (idx: number, key: keyof ManualCard, val: string) =>
    setManualCards((x) => x.map((c, i) => (i === idx ? { ...c, [key]: val } : c)));

  return (
    <div style={styles.wrap}>
      <div style={styles.left}>
        <h2 style={styles.h2}>Payment Simulator</h2>

        <section style={styles.section}>
          <h3 style={styles.h3}>Environment</h3>
          <div style={styles.row}>
            <label style={styles.label}>Env</label>
            <select value={env} onChange={(e) => setEnv(e.target.value as EnvOpt)} style={styles.input}>
              <option value="stb">stb</option>
              <option value="prp">prp</option>
            </select>
          </div>
        </section>

        <section style={styles.section}>
          <h3 style={styles.h3}>User & Channel</h3>
          <div style={styles.grid2}>
            <Field label="Channel" value={channelId} onChange={setChannelId} />
            <Field label="Segment" value={segment} onChange={setSegment} />
            <Field label="User ID" value={userId} onChange={setUserId} />
            <Field label="User Name" value={userName} onChange={setUserName} />
          </div>
        </section>

        <section style={styles.section}>
          <h3 style={styles.h3}>Application</h3>
          <div style={styles.grid2}>
            <Field label="Name" value={applicationName} onChange={setApplicationName} />
            <Field label="Password" value={applicationPassword} onChange={setApplicationPassword} type="password" />
            <Field label="Secure Code" value={secureCode} onChange={setSecureCode} type="password" />
            <Field label="Transaction ID" value={transactionId} onChange={setTransactionId} />
            <Field label="Transaction DateTime" value={transactionDateTime} onChange={setTransactionDateTime} />
          </div>
        </section>

        <section style={styles.section}>
          <h3 style={styles.h3}>Payment</h3>
          <div style={styles.grid2}>
            <div style={styles.row}>
              <label style={styles.label}>Type</label>
              <select
                value={paymentType}
                onChange={(e) => setPaymentType(e.target.value as any)}
                style={styles.input}
              >
                <option value="creditcard">creditcard</option>
                <option value="debitcard">debitcard</option>
                <option value="prepaidcard">prepaidcard</option>
              </select>
            </div>
            <Field
              label="Installments"
              value={String(installmentNumber)}
              onChange={(v) => setInstallmentNumber(Number(v || 0))}
            />
            <div style={styles.row}>
              <label style={styles.label}>3D Operation</label>
              <input
                type="checkbox"
                checked={threeDOperation}
                onChange={(e) => setThreeDOperation(e.target.checked)}
              />
            </div>
          </div>
        </section>

        <section style={styles.section}>
          <h3 style={styles.h3}>Product</h3>
          <div style={styles.grid2}>
            <Field label="Amount" value={amount} onChange={setAmount} />
            <Field label="MSISDN" value={msisdn} onChange={setMsisdn} />
          </div>
        </section>

        <section style={styles.section}>
          <h3 style={styles.h3}>Cards</h3>
          <div style={styles.row}>
            <label style={styles.label}>Mode</label>
            <select
              value={cardMode}
              onChange={(e) => setCardMode(e.target.value as CardSelectionMode)}
              style={styles.input}
            >
              <option value="automatic">automatic (DB’den 10)</option>
              <option value="manual">manual</option>
            </select>
          </div>

          {cardMode === 'manual' && (
            <>
              {manualCards.map((c, i) => (
                <div key={i} style={styles.card}>
                  <div style={styles.grid2}>
                    <Field label="Card Number" value={c.creditCardNo} onChange={(v) => updateManualCard(i, 'creditCardNo', v)} />
                    <Field label="CVC" value={c.cvcNo} onChange={(v) => updateManualCard(i, 'cvcNo', v)} />
                    <Field label="Exp Month" value={c.expireDateMonth} onChange={(v) => updateManualCard(i, 'expireDateMonth', v)} />
                    <Field label="Exp Year" value={c.expireDateYear} onChange={(v) => updateManualCard(i, 'expireDateYear', v)} />
                  </div>
                  <div style={{ textAlign: 'right', marginTop: 6 }}>
                    <button onClick={() => removeManualCard(i)} style={styles.btnGhost}>
                      Remove
                    </button>
                  </div>
                </div>
              ))}
              <button onClick={addManualCard} style={styles.btnGhost}>
                + Add Card
              </button>
            </>
          )}
        </section>

        <div style={{ display: 'flex', gap: 8 }}>
          <button onClick={handleStart} style={styles.btnPrimary}>
            Start Simulation
          </button>
          <button onClick={stopStream} style={styles.btn}>
            Stop Stream
          </button>
          <button
            onClick={() => {
              setRunKey(null);
              setStatus('idle');
              setCursor(0);
              setEvents([]);
              setError(null);
            }}
            style={styles.btn}
          >
            Reset
          </button>
        </div>

        {error && <p style={styles.err}>⚠️ {error}</p>}
        <p style={styles.meta}>RunKey: {runKey ?? '—'} | Status: {status}</p>
      </div>

      <div style={styles.right}>
        <h3 style={styles.h3}>Live Events</h3>
        <EventList items={events} />
      </div>
    </div>
  );
}

// ---- Small Components ----
function Field({
  label,
  value,
  onChange,
  type = 'text',
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
  type?: string;
}) {
  return (
    <div style={styles.row}>
      <label style={styles.label}>{label}</label>
      <input
        style={styles.input}
        type={type}
        value={value}
        onChange={(e) => onChange(e.target.value)}
      />
    </div>
  );
}

function EventList({ items }: { items: N8nEventItem[] }) {
  if (!items.length) {
    return <div style={styles.empty}>Henüz event yok…</div>;
  }
  return (
    <div style={{ display: 'grid', gap: 8 }}>
      {items.map((e) => (
        <div key={e.seq} style={{ ...styles.event, borderLeft: `4px solid ${statusColor(e.status)}` }}>
          <div style={styles.eventTop}>
            <strong>{e.name}</strong>
            <span style={{ color: '#777' }}>{new Date(e.time).toLocaleString()}</span>
          </div>
          <div style={{ color: statusColor(e.status), fontWeight: 600, marginBottom: 4 }}>
            {e.status.toUpperCase()}
          </div>
          {e.message && <div style={{ whiteSpace: 'pre-wrap' }}>{e.message}</div>}
          {(e.request || e.response) && (
            <details style={styles.details}>
              <summary>Payload</summary>
              {e.request && (
                <>
                  <div style={styles.subtle}>Request</div>
                  <pre style={styles.pre}>{JSON.stringify(e.request, null, 2)}</pre>
                </>
              )}
              {e.response && (
                <>
                  <div style={styles.subtle}>Response</div>
                  <pre style={styles.pre}>{JSON.stringify(e.response, null, 2)}</pre>
                </>
              )}
            </details>
          )}
        </div>
      ))}
    </div>
  );
}

// ---- Utils / Styles ----
function sleep(ms: number) {
  return new Promise((r) => setTimeout(r, ms));
}

function statusColor(s: string) {
  switch (s) {
    case 'success':
      return '#22c55e';
    case 'error':
      return '#ef4444';
    case 'running':
      return '#f59e0b';
    default:
      return '#6b7280';
  }
}

const styles: Record<string, React.CSSProperties> = {
  wrap: {
    display: 'grid',
    gridTemplateColumns: 'minmax(380px, 520px) 1fr',
    gap: 16,
    padding: 16,
  },
  left: {
    display: 'grid',
    gap: 16,
    alignContent: 'start',
  },
  right: {
    padding: 12,
    border: '1px solid #e5e7eb',
    borderRadius: 12,
    maxHeight: 'calc(100vh - 48px)',
    overflow: 'auto',
  },
  h2: { margin: 0 },
  h3: { margin: '0 0 8px 0' },
  section: {
    border: '1px solid #e5e7eb',
    borderRadius: 12,
    padding: 12,
    display: 'grid',
    gap: 8,
  },
  grid2: {
    display: 'grid',
    gridTemplateColumns: '1fr 1fr',
    gap: 8,
  },
  row: {
    display: 'grid',
    gridTemplateColumns: '140px 1fr',
    alignItems: 'center',
    gap: 8,
  },
  label: { fontSize: 12, color: '#374151' },
  input: {
    width: '100%',
    padding: '8px 10px',
    borderRadius: 8,
    border: '1px solid #d1d5db',
    fontSize: 14,
  },
  card: {
    border: '1px dashed #d1d5db',
    borderRadius: 10,
    padding: 10,
    marginBottom: 8,
  },
  btnPrimary: {
    padding: '10px 14px',
    borderRadius: 10,
    border: '1px solid #0ea5e9',
    background: '#0ea5e9',
    color: 'white',
    fontWeight: 600,
    cursor: 'pointer',
  },
  btn: {
    padding: '10px 14px',
    borderRadius: 10,
    border: '1px solid #d1d5db',
    background: 'white',
    cursor: 'pointer',
  },
  btnGhost: {
    padding: '6px 10px',
    borderRadius: 8,
    border: '1px dashed #d1d5db',
    background: 'transparent',
    cursor: 'pointer',
  },
  err: { color: '#ef4444', fontWeight: 600 },
  meta: { color: '#6b7280', fontSize: 12 },
  empty: {
    padding: 12,
    color: '#6b7280',
    border: '1px dashed #e5e7eb',
    borderRadius: 10,
    textAlign: 'center',
  },
  event: {
    background: 'white',
    border: '1px solid #e5e7eb',
    borderRadius: 10,
    padding: 10,
  },
  eventTop: {
    display: 'flex',
    justifyContent: 'space-between',
    marginBottom: 6,
  },
  details: {
    marginTop: 8,
  },
  subtle: {
    color: '#6b7280',
    fontSize: 12,
    marginTop: 6,
  },
  pre: {
    background: '#f9fafb',
    padding: 8,
    borderRadius: 8,
    overflow: 'auto',
    fontSize: 12,
  },
};
