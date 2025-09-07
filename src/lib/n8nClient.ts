// src/lib/n8nClient.ts
/* ---------- Paths / ENV ---------- */
const BASE = String(import.meta.env.VITE_N8N_BASE_URL || 'http://localhost:5701').replace(/\/$/, '');
const P_START         = String(import.meta.env.VITE_N8N_PAYMENT_START      || '/webhook/payment-test/start');
// YENİ: İptal/iade için yeni endpoint yolu eklendi. .env dosyanıza VITE_N8N_CANCEL_REFUND_START olarak ekleyebilirsiniz.
const P_CANCEL_REFUND = String(import.meta.env.VITE_N8N_CANCEL_REFUND_START || '/webhook/payment-test/cancel-refund-test');
// YENİ: Bank Regression testleri için endpoint
const P_BANK_REGRESSION = String(import.meta.env.VITE_N8N_BANK_REGRESSION_START || '/webhook/banka/regresyon');
const P_PROGRESS      = String(import.meta.env.VITE_N8N_PAYMENT_PROGRESS || '/webhook/payment-test/progress');
const P_CANCEL_REFUND_PROGRESS = String(import.meta.env.VITE_N8N_CANCEL_REFUND_PROGRESS || '/webhook/payment-test/cancel-refund/progress');
const P_BANK_REGRESSION_PROGRESS = String(import.meta.env.VITE_N8N_BANK_REGRESSION_PROGRESS || '/webhook/regresyon/progress');
const P_EVENTS        = String(import.meta.env.VITE_N8N_EVENTS           || '/webhook/payment-test/events');
const P_CANCEL_REFUND_EVENTS = String(import.meta.env.VITE_N8N_CANCEL_REFUND_EVENTS || '/webhook/payment-test/cancel-refund/events');
const P_BANK_REGRESSION_EVENTS = String(import.meta.env.VITE_N8N_BANK_REGRESSION_EVENTS || '/webhook/regresyon/events');
const P_TEST_CARDS    = String(import.meta.env.VITE_N8N_TEST_CARDS       || '/webhook/query/get-cards');
const P_CANDIDATES    = String(import.meta.env.VITE_N8N_CANDIDATES       || '/webhook/payment-test/candidates');
const P_DASHBOARD     = String(import.meta.env.VITE_N8N_DASHBOARD        || '/webhook/dashboard/metrics');
const BASIC_RAW       = String(import.meta.env.VITE_N8N_BASIC || ''); // "user:pass"

import type { RunData, StartPayload } from '@/types/n8n'; // DEĞİŞTİRİLDİ: StartPayload tipi artık n8n.ts'den gelecek

/* ---------- Headers ---------- */
function buildHeaders(extra?: HeadersInit): HeadersInit {
  const auth = BASIC_RAW ? { Authorization: 'Basic ' + btoa(BASIC_RAW) } : {};
  return {
    Accept: 'application/json',
    'Content-Type': 'application/json',
    ...auth,
    ...(extra || {}),
  };
}

/* ---------- Low-level fetch helpers ---------- */
async function req<T>(path: string, init?: RequestInit): Promise<T> {
  const res = await fetch(`${BASE}${path}`, {
    credentials: 'omit',
    headers: buildHeaders(init?.headers),
    ...init,
  });
  if (!res.ok) {
    let msg = '';
    try { msg = await res.text(); } catch {}
    throw new Error(`HTTP ${res.status} ${res.statusText} @ ${path}\n${msg}`);
  }
  // YENİ: Boş cevapları handle etmek için eklendi
  const text = await res.text();
  return text ? (JSON.parse(text) as T) : ({} as T);
}

/** Boş/JSON olmayan gövdeyi tolere eden güvenli GET JSON */
async function getJSON<T>(path: string, query?: Record<string, any>, signal?: AbortSignal): Promise<T> {
  const url = new URL(`${BASE}${path}`);
  if (query) {
    Object.entries(query).forEach(([k, v]) => {
      if (v !== undefined && v !== null) {
        // RunKey'i encode etmeden ekle
        url.searchParams.set(k, String(v));
      }
    });
  }
  const res = await fetch(url.toString(), { method: 'GET', headers: buildHeaders(), signal, credentials: 'omit' });

  if (!res.ok) {
    let msg = '';
    try { msg = await res.text(); } catch {}
    throw new Error(`HTTP ${res.status} ${res.statusText} @ GET ${path}\n${msg}`);
  }
  
  const hasBody = res.status !== 204 && res.status !== 205;
  const text = hasBody ? await res.text().catch(() => '') : '';

  if (!text) {
    return {} as T;
  }

  try {
    return JSON.parse(text) as T;
  } catch {
    return {} as T;
  }
}

export type N8nStartResponse = { runKey: string };

/* -------- long-poll /events types -------- */
export type N8nEventItem = {
  seq: number;
  time: string;
  name: string;
  status: 'running' | 'success' | 'error' | string;
  message?: string;
  request?: any;
  response?: any;
};

export type N8nEventsResponse = {
  runKey: string;
  status: 'running' | 'completed' | 'error';
  nextCursor: number;
  events: N8nEventItem[];
  endTime?: string | null;
};

/* ---------- API ---------- */
export async function startPayment(body: StartPayload, signal?: AbortSignal) {
  return req<N8nStartResponse>(P_START, { method: 'POST', body: JSON.stringify(body), signal });
}

// YENİ: Sadece iptal/iade işlemleri için ayrı bir başlangıç fonksiyonu
export async function startCancelOrRefund(body: StartPayload, signal?: AbortSignal) {
    return req<N8nStartResponse>(P_CANCEL_REFUND, { method: 'POST', body: JSON.stringify(body), signal });
}

export async function startBankRegression(body: any, signal?: AbortSignal) {
    console.log('Calling bank regression endpoint:', P_BANK_REGRESSION);
    console.log('With payload:', JSON.stringify(body, null, 2));
    
    try {
        const response = await req<N8nStartResponse>(P_BANK_REGRESSION, { method: 'POST', body: JSON.stringify(body), signal });
        console.log('Bank regression API response:', response);
        return response;
    } catch (error) {
        console.error('Bank regression API error:', error);
        throw error;
    }
}

export async function getProgress(runKey: string, flow: 'payment' | 'cancelRefund' | 'bankRegression' = 'payment') {
  const path = flow === 'payment' ? P_PROGRESS : 
               flow === 'cancelRefund' ? P_CANCEL_REFUND_PROGRESS :
               P_BANK_REGRESSION_PROGRESS;
  console.log(`[getProgress] Flow: ${flow}, Path: ${path}, RunKey: ${runKey}`);
  return getJSON<RunData>(path, { runKey });
}

export async function longPollEvents(runKey: string, cursor = 0, waitSec = 25, signal?: AbortSignal, flow: 'payment' | 'cancelRefund' | 'bankRegression' = 'payment') {
  const eventsPath = flow === 'payment' ? P_EVENTS : 
                     flow === 'cancelRefund' ? P_CANCEL_REFUND_EVENTS :
                     P_BANK_REGRESSION_EVENTS;
  console.log(`[longPollEvents] Flow: ${flow}, Path: ${eventsPath}, URL: ${BASE}${eventsPath}, RunKey: ${runKey}`);
  const res = await getJSON<Partial<N8nEventsResponse>>(eventsPath, { runKey, cursor, waitSec }, signal);
  return {
    runKey,
    status: (res?.status as any) || 'running',
    nextCursor: typeof res?.nextCursor === 'number' ? res!.nextCursor : cursor,
    events: Array.isArray(res?.events) ? (res!.events as N8nEventItem[]) : [],
    endTime: res?.endTime ?? null,
  } as N8nEventsResponse;
}

/* ---------- Test Card & Candidate Types (bunlar types/n8n.ts'e taşınabilir) ---------- */
export type TestCardRow = {
  bank_code: string;
  ccno: string;
  e_month: string;
  e_year: string;
  status: 0 | 1;
  id?: number;
};

export async function listTestCards(signal?: AbortSignal) {
  const out = await getJSON<any>(P_TEST_CARDS, undefined, signal);
  return Array.isArray(out) ? out
      : Array.isArray(out?.items) ? out.items
      : Array.isArray(out?.data)  ? out.data
      : [];
}

export type CandidateRow = {
  paymentId: string;
  orderId: string;
  amount: number | string;
  app: string;
  channelId: string;
  issuerBankCode: string;
  resultCode: string | number;
  createdAt: string;
  success: boolean | string;
};

export async function listCandidates(
  params: { action: 'cancel' | 'refund'; channelId: string; from?: string; to?: string; limit?: number },
  signal?: AbortSignal,
) {
  return getJSON<CandidateRow[]>(
    P_CANDIDATES,
    { action: params.action, channelId: params.channelId, from: params.from, to: params.to, limit: params.limit },
    signal,
  );
}

export async function getDashboardMetrics(params: { today: string; yesterday: string }, signal?: AbortSignal) {
  return req<any>(P_DASHBOARD, { 
    method: 'POST', 
    body: JSON.stringify(params), 
    signal 
  });
}