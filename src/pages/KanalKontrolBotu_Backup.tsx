// src/pages/KanalKontrolBotu.tsx
import React, { useEffect, useMemo, useState } from "react";
import Modal from "@/components/Modal";
import { IndeterminateBar, SolidProgress, RateLimitProgress } from "@/components/ProgressBar";
import CodeBlock from "@/components/CodeBlock";
import { useProgress } from "@/hooks/useProgress";
import { useRateLimit } from "@/hooks/useRateLimit";
import { startPayment } from "@/lib/n8nClient";
import { StartPayload } from "@/types/n8n";
import Wizard from "@/components/wizard/Wizard";
import { saveRun, type SavedRun } from "@/lib/runsStore";

/* ---------- helpers ---------- */
function randDigits(n: number) {
  let s = "";
  while (s.length < n) s += Math.floor(Math.random() * 10);
  if (s[0] === "0") s = "1" + s.slice(1);
  return s.slice(0, n);
}
function nowStamp() {
  const d = new Date();
  const p = (x: number) => (x < 10 ? `0${x}` : `${x}`);
  return `${d.getFullYear()}${p(d.getMonth() + 1)}${p(d.getDate())}${p(d.getHours())}${p(d.getMinutes())}${p(d.getSeconds())}`;
}

/* ---------- types ---------- */
type ScenarioKey = "token" | "payment" | "cancel" | "refund" | "all";
type AppState = {
  applicationName: string;
  applicationPassword: string;
  secureCode: string;
  transactionId: string;
  transactionDateTime: string;
};

/* ---------- highlight extractor (global özet için) ---------- */
type Highlight = {
  TOKEN?: string | null;
  HASHDATA?: string | null;
  SESSIONID?: string | null;
  PAYMENTID?: string | null;
  ORDERID?: string | null;
};
function extractHighlights(steps: Array<{ request?: any; response?: any; name: string }>): Highlight {
  const h: Highlight = {};
  for (const s of steps) {
    const req = (s.request ?? {}) as any;
    const res = (s.response ?? {}) as any;
    if (h.TOKEN && h.PAYMENTID && h.ORDERID) break;
  }
  return h;
}

/* ---------- Senaryo tespiti + chip üretimi ---------- */
type BlockType = "request" | "response";

function scenarioOfStepName(name: string): "token" | "payment" | "cancel" | "refund" | "other" {
  const t = (name || "").toLowerCase();
  if (/token|card\s*token|hash/.test(t)) return "token";
  if (/refund|iade/.test(t)) return "refund";
  if (/cancel|void|iptal/.test(t)) return "cancel";
  if (/payment|pay|ödeme/.test(t)) return "payment";
  return "other";
}

const SCENARIO_LABEL: Record<ReturnType<typeof scenarioOfStepName>, string> = {
  token: "Token Alma",
  payment: "Ödeme",
  cancel: "İptal",
  refund: "İade",
  other: "Diğer",
};

const normKey = (k: string) => k.toLowerCase().replace(/[_\-\s]/g, "");
function deepPick(obj: unknown, keys: string[]): string | null {
  if (obj == null) return null;
  const wanted = keys.map(normKey);
  const stack: any[] = [obj];
  while (stack.length) {
    const cur = stack.pop();
    if (typeof cur !== "object") continue;
    for (const [k, v] of Object.entries(cur as Record<string, any>)) {
      if (wanted.includes(normKey(k))) {
        if (v == null) continue;
        const val = typeof v === "object" ? JSON.stringify(v) : String(v);
        if (val !== "undefined" && val !== "null" && val !== "") return val;
      }
      if (v && typeof v === "object") stack.push(v);
    }
  }
  return null;
}
function pickFromXml(xml: string, tags: string[]): string | null {
  const txt = (xml || "").toString();
  for (const tag of tags) {
    const re = new RegExp(`<\\s*${tag}\\s*>\\s*([^<]+)\\s*<\\s*/\\s*${tag}\\s*>`, "i");
    const m = txt.match(re);
    if (m?.[1]) return m[1];
  }
  return null;
}

function chipsForStep(
  s: { name: string; request?: unknown; response?: unknown },
  block: BlockType,
): Array<{ label: string; value: string | null }> {
  const req = s.request as any;
  const res = s.response as any;
  const scen = scenarioOfStepName(s.name);
  const isXmlRes = typeof res === "string" && (res as string).trim().startsWith("<");

  const findOrderId = (src: any) =>
    typeof src === "string"
      ? pickFromXml(src, ["ORDER_ID", "ORDERID"])
      : deepPick(src, ["orderId", "ORDER_ID", "ORDERID"]);
  const findPaymentId = (src: any) =>
    typeof src === "string"
      ? pickFromXml(src, ["PAYMENT_ID", "PAYMENTID"])
      : deepPick(src, ["paymentId", "PAYMENT_ID", "PAYMENTID"]);
  const findToken = (src: any) =>
    typeof src === "string"
      ? pickFromXml(src, ["TOKEN", "CARDTOKEN"])
      : deepPick(src, ["token", "cardToken"]);
  const findHash = (src: any) => deepPick(src, ["hashData", "HASHDATA"]);

  const chips: Array<{ label: string; value: string | null }> = [];

  if (scen === "token") {
    if (block === "request") chips.push({ label: "HASHDATA", value: findHash(req) });
    else chips.push({ label: "TOKEN", value: findToken(res) });
  } else if (scen === "payment") {
    if (block === "request") {
      chips.push({ label: "ORDERID", value: findOrderId(req) });
      chips.push({ label: "PAYMENTID", value: findPaymentId(req) });
    } else {
      chips.push({ label: "ORDER_ID", value: isXmlRes ? pickFromXml(res, ["ORDER_ID", "ORDERID"]) : findOrderId(res) });
      chips.push({ label: "PAYMENT_ID", value: isXmlRes ? pickFromXml(res, ["PAYMENT_ID", "PAYMENTID"]) : findPaymentId(res) });
    }
  } else if (scen === "cancel" || scen === "refund") {
    if (block === "request") {
      chips.push({ label: "PAYMENT_ID", value: findPaymentId(req) });
    } else {
      chips.push({ label: "ORDER_ID", value: isXmlRes ? pickFromXml(res, ["ORDER_ID", "ORDERID"]) : findOrderId(res) });
    }
  }

  return chips.filter((c) => c.value);
}

function ChipInline({ label, value }: { label: string; value?: string | null }) {
  if (!value) return null;
  return (
    <span
      className="rounded-full border border-emerald-500/40 bg-emerald-500/10 px-2 py-0.5 text-[10px] text-emerald-300 break-all whitespace-pre-wrap"
      title={String(value)}
    >
      {label}: <span className="font-mono">{String(value)}</span>
    </span>
  );
}

// paymentId çekmek için helper
function getPaymentIdFromStep(s: any): string | null {
  const res = s?.response;
  if (!res) return null;
  if (typeof res === "string") {
    const m = res.match(/<\s*(PAYMENT_ID|PAYMENTID)\s*>\s*([^<]+)\s*<\s*\/\s*(PAYMENT_ID|PAYMENTID)\s*>/i);
    return m?.[2] || null;
  }
  return deepPick(res, ["paymentId", "PAYMENT_ID", "PAYMENTID"]);
}

/* =================================================================== */
export default function KanalKontrolBotu() {
  const SAVE_LOCAL = import.meta.env.VITE_SAVE_LOCAL_RUNS === "true"; // default: false

  // Wizard modal
  const [wizardOpen, setWizardOpen] = useState(false);
  const [step, setStep] = useState(1 as 1 | 2 | 3 | 4 | 5 | 6);

  // Step 1 — senaryo
  const [scenarios, setScenarios] = useState<ScenarioKey[]>(["payment"]);
  // UI akışını sadeleştiren bayraklar:
  const hasPayment = useMemo(
    () => scenarios.includes("payment") || scenarios.includes("all"),
    [scenarios],
  );
  const hasCancel = useMemo(() => scenarios.includes("cancel"), [scenarios]);
  const hasRefund = useMemo(() => scenarios.includes("refund"), [scenarios]);
  const selectedAction = useMemo<"payment" | "cancel" | "refund">(
    () => (hasCancel ? "cancel" : hasRefund ? "refund" : "payment"),
    [hasCancel, hasRefund],
  );

  // Step 2 — ortam & kanal
  const [env, setEnv] = useState<"STB" | "PRP">("STB");
  const [channelId, setChannelId] = useState("999134");

  // Step 3 — application
  const [app, setApp] = useState<AppState>({
    applicationName: "",
    applicationPassword: "",
    secureCode: "",
    transactionId: "",
    transactionDateTime: "",
  });

  // Step 4 — kart/test
  const [mode, setMode] = useState<"automatic" | "manual">("automatic");
  const [cardCount, setCardCount] = useState<number>(10);
  const [bankCode, setBankCode] = useState("");
  const [manualCards, setManualCards] = useState<
    Array<{ ccno: string; e_month: string; e_year: string; cvv: string; bank_code?: string }>
  >([]);
  const addCard = () =>
    setManualCards((cs) => [...cs, { ccno: "", e_month: "", e_year: "", cvv: "", bank_code: bankCode || undefined }]);
  const updCard = (i: number, k: keyof (typeof manualCards)[number], v: string) =>
    setManualCards((cs) => cs.map((c, idx) => (idx === i ? { ...c, [k]: v } : c)));
  const delCard = (i: number) => setManualCards((cs) => cs.filter((_, idx) => idx !== i));

  // Candidate (cancel/refund)
  const [pickedCandidate, setPickedCandidate] = useState<{ paymentId: string } | null>(null);

  // Step 5 — ödeme bilgileri
  const [payment, setPayment] = useState<PaymentState>({
    userId: "",
    userName: "",
    threeDOperation: false,
    installmentNumber: 0,
    amount: 10,
    msisdn: "5303589836",
    paymentType: "CREDITCARD",
    options: {
      includeMsisdnInOrderID: false,
      checkCBBLForMsisdn: true,
      checkCBBLForCard: true,
      checkFraudStatus: false,
    },
  });

  // Çalıştırma / progress
  const [runKey, setRunKey] = useState<string | null>(null);
  const { data: prog, error: progErr } = useProgress(runKey, 25, 2000);
  const steps = prog?.steps ?? [];
  const running = prog?.status === "running";
  const highlights = extractHighlights(steps);

  // Ticker: sunucudan event gelmeden hemen görünsün diye ilk yerel step
  const [echoSteps, setEchoSteps] = useState<
    Array<{ time: string; name: string; status: string; message?: string }>
  >([]);
  useEffect(() => {
    if (!runKey) return;
    setEchoSteps([
      {
        time: new Date().toISOString(),
        name: "Akış başlatıldı",
        status: "running",
        message: `Simülasyon isteği alındı. Ortam: ${env}.`,
      },
    ]);
  }, [runKey, env]);

  const liveSteps = useMemo(() => [...echoSteps, ...steps], [echoSteps, steps]);
  const listSteps = useMemo(() => (running ? liveSteps : steps), [running, liveSteps, steps]);

  /* ---------- yalnızca HTTP içeren step'ler (rapor için) ---------- */
  const httpSteps = useMemo(
    () => steps.filter((s) => s && (s.request != null || s.response != null)),
    [steps],
  );

  /* ---------- PAYLOAD ---------- */
  const payload = useMemo<StartPayload>(
    () => ({
      env: env === "STB" ? "stb" : "prp",
      channelId,
      segment: "X",
      application: { ...app },
      userId: payment.userId,
      userName: payment.userName,

      // 3D şimdilik kapalı sabit
      payment: {
        paymentType: payment.paymentType.toLowerCase() as "creditcard" | "debitcard" | "prepaidcard",
        threeDOperation: false,
        installmentNumber: payment.installmentNumber,
        options: { ...payment.options },
      },

      products: [{ amount: payment.amount, msisdn: normalizeMsisdn(payment.msisdn) }],

      // payment'ta kart seçimi
      cardSelectionMode: mode,
      manualCards: mode === "manual" ? manualCards : undefined,
      cardCount: mode === "manual" ? manualCards.length : cardCount,

      // Aksiyon & runMode — son n8n akışına göre:
      // - Sadece ödeme: action=payment, runMode=payment-only
      // - Ödeme + (iptal|iade): action=cancel/refund, runMode=all (paymentRef varsa onu kullanır; yoksa yeni payment’tan devam eder)
      // - Sadece (iptal|iade): action=cancel/refund, runMode=all (paymentRef zorunlu)
      ...(() => {
        const paymentRef = pickedCandidate?.paymentId
          ? { paymentRef: { paymentId: pickedCandidate.paymentId } }
          : {};
        if (hasCancel || hasRefund) {
          return { action: hasCancel ? ("cancel" as const) : ("refund" as const), runMode: "all" as const, ...paymentRef };
        }
        return { action: "payment" as const, runMode: "payment-only" as const };
      })(),
    }),
    [env, channelId, app, payment, mode, manualCards, cardCount, hasCancel, hasRefund, pickedCandidate],
  );

  async function onStart() {
    if (!(hasPayment || hasCancel || hasRefund)) {
      alert("En az bir senaryo seçin.");
      return;
    }
    // Sadece cancel/refund varsa ve candidate seçilmemişse uyar.
    if (!hasPayment && (hasCancel || hasRefund) && !pickedCandidate?.paymentId) {
      const which = hasCancel ? "CANCEL" : "REFUND";
      alert(`${which} için önce bir paymentId seçin (Aday Bul).`);
      return;
    }
    try {
      const res = await startPayment(payload);
      setRunKey(res.runKey);
      setWizardOpen(false);
    } catch (e) {
      alert("Start error: " + (e as Error).message);
    }
  }

  // Koşu tamamlanınca son 5'e kaydet — flag ile
  React.useEffect(() => {
    if (!SAVE_LOCAL) return;
    if (!runKey || !prog || (prog.status !== "completed" && prog.status !== "error")) return;
    const toSave: SavedRun = {
      runKey,
      savedAt: new Date().toISOString(),
      data: {
        status: prog.status,
        startTime: prog.startTime,
        endTime: prog.endTime ?? null,
        steps: prog.steps,
        result: prog.result,
        params: { env, channelId, app, payment },
      },
    };
    saveRun(toSave);
  }, [prog?.status]); // eslint-disable-line

  /* ----- Senaryoya göre grupla (accordion üst başlıkları) ----- */
  const groupedByScenario = useMemo(() => {
    const map = new Map<string, typeof httpSteps>();
    for (const s of httpSteps) {
      const key = scenarioOfStepName(s.name);
      const k = SCENARIO_LABEL[key];
      const arr = map.get(k) || [];
      arr.push(s);
      map.set(k, arr);
    }
    return Array.from(map.entries()); // [label, steps[]]
  }, [httpSteps]);

  // İptal tetikle modal state:
  const [cancelModalOpen, setCancelModalOpen] = useState(false);
  const [cancelPaymentId, setCancelPaymentId] = useState<string | null>(null);

  return (
    <div className="space-y-6">
      {/* Üst kart */}
      <div className="card p-6">
        <h1 className="mb-2 text-2xl font-bold tracking-tight text-base-100">Kanal Kontrol Botu</h1>
        <p className="max-w-3xl text-sm leading-6 text-base-300">
          Token / ödeme / iptal / iade akışlarını sihirbazla tetikle. Adımlar canlı raporlanır; tamamlanınca
          request/response blokları görünür.
        </p>
        <div className="mt-4">
          <button
            className="btn"
            onClick={() => {
              setStep(1);
              setWizardOpen(true);
            }}
          >
            Sihirbazı Aç
          </button>
        </div>
      </div>

      {/* Progress Panel */}
      {runKey && (
        <>
          <div className="card p-6">
            <div className="flex items-center justify-between">
              <div className="text-sm text-base-400">
                Run Key: <code className="rounded bg-base-800 px-1 text-base-100">{runKey}</code>
              </div>
              <div className="w-56">{running ? <IndeterminateBar /> : <SolidProgress value={100} />}</div>
            </div>
            {progErr && <div className="mt-2 text-sm text-red-400">Hata: {progErr}</div>}

            {/* Koşarken ticker */}
            {running && <LiveTicker steps={liveSteps} />}

            {/* Adımlar — her zaman göster */}
            <div className="mt-4">
              <div className="mb-2 font-medium">Adımlar</div>
              <ul className="max-h-80 space-y-2 overflow-auto">
                {listSteps.map((s, i) => (
                  <li key={`${s.time}-${i}`} className="text-sm">
                    <div className="flex items-center gap-2">
                      <span
                        className={`inline-block h-2 w-2 rounded-full ${
                          s.status === "success"
                            ? "bg-emerald-500"
                            : s.status === "error"
                            ? "bg-red-500"
                            : "bg-amber-500"
                        }`}
                      />
                      <span className="font-medium">{s.name}</span>
                      {s.message && <span className="text-base-400">— {s.message}</span>}
                    </div>
                    <div className="ml-4 text-xs text-base-500">{new Date(s.time).toLocaleString()}</div>
                  </li>
                ))}
                {!listSteps.length && <li className="text-sm text-base-500">Henüz step oluşmadı…</li>}
              </ul>
            </div>
          </div>

          {/* Rapor (accordion) */}
          <div className="card p-6">
            <div className="mb-2 font-medium">Rapor</div>

            {running && !prog?.result && (
              <div className="rounded-xl border border-base-800 bg-base-900 p-4 text-sm text-base-400">
                Koşu sürüyor… Rapor hazır olduğunda burada görünecek.
              </div>
            )}

            {/* ANA ACCORDION: Senaryo başlıkları */}
            <div className="space-y-3">
              {groupedByScenario.map(([label, items]) => {
                const last = items[items.length - 1];
                const dot =
                  last?.status === "success" ? "bg-emerald-500" : last?.status === "error" ? "bg-red-500" : "bg-amber-500";
                return (
                  <details key={label} className="rounded-xl border border-base-800 bg-base-900">
                    <summary className="flex cursor-pointer list-none items-center gap-2 px-3 py-2">
                      <span className={`inline-block h-2 w-2 rounded-full ${dot}`} />
                      <div className="font-medium">{label}</div>
                      <span className="ml-2 rounded bg-base-800 px-2 py-0.5 text-xs text-base-400">{items.length}</span>
                    </summary>

                    {/* İçerik: Bu senaryodaki tüm http istekleri */}
                    <div className="divide-y divide-base-800">
                      {items.map((s, idx) => (
                        <div key={idx} className="p-3">
                          <div className="mb-2 flex items-center justify-between text-xs text-base-400">
                            <span>{new Date(s.time).toLocaleString()}</span>
                            <span
                              className={`rounded-full px-2 py-0.5 ${
                                s.status === "success"
                                  ? "bg-emerald-500/15 text-emerald-300"
                                  : s.status === "error"
                                  ? "bg-red-500/15 text-red-300"
                                  : "bg-amber-500/15 text-amber-300"
                              }`}
                            >
                              {s.status}
                            </span>
                          </div>

                          {s.request !== undefined && (
                            <div className="mb-2">
                              <div className="mb-1 flex items-center gap-2 text-[11px] text-base-500">
                                <span>REQUEST</span>
                                {chipsForStep(s, "request").map((c) => (
                                  <ChipInline key={c.label + c.value} label={c.label} value={c.value ?? undefined} />
                                ))}
                              </div>
                              <CodeBlock value={s.request} lang="json" />
                            </div>
                          )}

                          {s.response !== undefined && (
                            <div>
                              <div className="mb-1 flex items-center gap-2 text-[11px] text-base-500">
                                <span>RESPONSE</span>
                                {chipsForStep(s, "response").map((c) => (
                                  <ChipInline key={c.label + c.value} label={c.label} value={c.value ?? undefined} />
                                ))}

                                {/* ödeme response'larında iptal tetikle */}
                                {scenarioOfStepName(s.name) === "payment" &&
                                  (() => {
                                    const pid = getPaymentIdFromStep(s);
                                    return pid ? (
                                      <button
                                        className="ml-auto btn-outline"
                                        onClick={() => {
                                          setCancelPaymentId(pid);
                                          setCancelModalOpen(true);
                                        }}
                                        title="Bu ödeme için iptal akışını başlat"
                                      >
                                        İptal tetikle
                                      </button>
                                    ) : null;
                                  })()}
                              </div>
                              <CodeBlock
                                value={typeof s.response === "string" ? s.response : s.response ?? {}}
                                lang={
                                  typeof s.response === "string" && (s.response as string).trim().startsWith("<")
                                    ? "xml"
                                    : "json"
                                }
                              />
                            </div>
                          )}
                        </div>
                      ))}
                    </div>
                  </details>
                );
              })}

              {!httpSteps.length && (
                <div className="rounded-xl border border-base-800 bg-base-900 p-3 text-sm text-base-400">
                  Gösterilecek HTTP isteği yok.
                </div>
              )}
            </div>
          </div>
        </>
      )}

      {/* Wizard */}
      <Modal open={wizardOpen} onClose={() => setWizardOpen(false)} title={`Wizard — ${STEP_LABELS[step - 1]}`}>
        <StepBar step={step} labels={STEP_LABELS} />

        {/* Step 1 — Senaryo */}
        {step === 1 && (
          <section className="space-y-3">
            <div className="text-sm text-base-300">Çalıştırılacak senaryoyu seçin.</div>
            <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
              {(["token", "payment", "cancel", "refund", "all"] as ScenarioKey[]).map((k) => (
                <label
                  key={k}
                  className={`group flex cursor-pointer items-center justify-between rounded-xl border p-3 ${
                    scenarios.includes(k)
                      ? "border-emerald-500/50 bg-emerald-500/10"
                      : "border-base-800 bg-base-900 hover:border-base-700"
                  }`}
                  title={SCENARIOS[k].tip}
                >
                  <span className="text-sm">{SCENARIOS[k].label}</span>
                  <input
                    type="checkbox"
                    checked={scenarios.includes(k)}
                    onChange={(e) => toggleScenario(k, e.target.checked, scenarios, setScenarios, k === "all")}
                  />
                </label>
              ))}
            </div>
            <div className="mt-6 flex justify-between">
              <button className="btn-outline" onClick={() => setWizardOpen(false)}>
                Geri
              </button>
              <button className="btn" onClick={() => setStep(2)}>
                İleri
              </button>
            </div>
          </section>
        )}

        {/* Step 2 — Ortam & Kanal */}
        {step === 2 && (
          <section className="space-y-4">
            <div className="grid gap-3 md:grid-cols-2">
              <label className="block">
                <div className="mb-1 text-sm">Ortam</div>
                <select className="input" value={env} onChange={(e) => setEnv(e.target.value as any)}>
                  <option value="STB">STB</option>
                  <option value="PRP">PRP</option>
                </select>
              </label>

              <Field label="Channel ID" value={channelId} onChange={setChannelId} />
            </div>

            <div className="mt-6 flex justify-between">
              <button className="btn-outline" onClick={() => setStep(1)}>
                Geri
              </button>
              <button className="btn" onClick={() => setStep(3)}>
                İleri
              </button>
            </div>
          </section>
        )}

        {/* Step 3 — Application Bilgileri */}
        {step === 3 && (
          <section className="space-y-4">
            <div className="flex flex-wrap items-center gap-2">
              <span className="text-xs text-base-400">Hazır Application:</span>
              <button
                className="chip"
                onClick={() =>
                  setApp({
                    applicationName: "PAYCELLTEST",
                    applicationPassword: "",
                    secureCode: "",
                    transactionId: "",
                    transactionDateTime: "",
                  })
                }
              >
                PAYCELLTEST
              </button>
              <button
                className="chip"
                onClick={() =>
                  setApp({
                    applicationName: "SENSAT",
                    applicationPassword: "H0287TA5K30P8DSJ",
                    secureCode: "H0287TA5K30P8DSJ",
                    transactionId: "00812142049000018727",
                    transactionDateTime: "20210812142051000",
                  })
                }
              >
                SENSAT
              </button>
              <button
                className="chip"
                onClick={() =>
                  setApp({
                    applicationName: "",
                    applicationPassword: "",
                    secureCode: "",
                    transactionId: "",
                    transactionDateTime: "",
                  })
                }
              >
                Temizle
              </button>
            </div>

            <div className="grid gap-3 md:grid-cols-2">
              <Field label="applicationName" value={app.applicationName} onChange={(v) => setApp((a) => ({ ...a, applicationName: v }))} />
              <Field label="applicationPassword" value={app.applicationPassword} onChange={(v) => setApp((a) => ({ ...a, applicationPassword: v }))} />
              <Field label="secureCode" value={app.secureCode} onChange={(v) => setApp((a) => ({ ...a, secureCode: v }))} />
              <Field label="transactionId" value={app.transactionId} onChange={(v) => setApp((a) => ({ ...a, transactionId: v }))} />
              <Field label="transactionDateTime" value={app.transactionDateTime} onChange={(v) => setApp((a) => ({ ...a, transactionDateTime: v }))} />
            </div>

            <div className="mt-6 flex justify-between">
              <button className="btn-outline" onClick={() => setStep(2)}>
                Geri
              </button>
              <button className="btn" onClick={() => setStep(4)}>
                İleri
              </button>
            </div>
          </section>
        )}

        {/* Step 4 — Kart/Test +/ veya Aday Bul (kombine görünüm) */}
        {step === 4 && (
          <section className="space-y-6">
            {/* Ödeme + (iptal|iade) birlikteyse: ÜSTTE adaylar */}
            {hasPayment && (hasCancel || hasRefund) && (
              <>
                <div className="text-sm text-base-300">
                  {hasCancel ? "Cancel" : "Refund"} için uygun işlemler listelenir. Satır seçince paymentId formu dolacak (opsiyonel).
                </div>
                <CandidateFinder
                  action={hasCancel ? "cancel" : "refund"}
                  channelId={channelId}
                  onPick={(r) => setPickedCandidate({ paymentId: r.paymentId })}
                />
                {pickedCandidate?.paymentId ? (
                  <div className="rounded-xl border border-emerald-700/40 bg-emerald-700/10 p-3 text-sm text-emerald-300">
                    Seçilen paymentId: <span className="font-mono">{pickedCandidate.paymentId}</span>
                  </div>
                ) : (
                  <div className="rounded-xl border border-base-800 bg-base-900 p-3 text-sm text-base-400">
                    Henüz bir satır seçilmedi. Seçmezsen yeni oluşturulacak ödeme üzerinden devam edilir.
                  </div>
                )}
                <div className="border-t border-base-800" />
              </>
            )}

            {/* Kart seçimi bloğu: ödeme varsa veya genel görünüm */}
            {(hasPayment || (!hasPayment && !(hasCancel || hasRefund))) && (
              <div className="space-y-4">
                <div className="grid items-end gap-3 md:grid-cols-3">
                  <Field label="Kart Adedi" type="number" value={String(cardCount)} onChange={(v) => setCardCount(Number(v) || 0)} />
                  <label className="flex items-center gap-2">
                    <input type="radio" checked={mode === "automatic"} onChange={() => setMode("automatic")} />
                    <span>Automatic (DB'den random 10)</span>
                  </label>
                  <label className="flex items-center gap-2">
                    <input type="radio" checked={mode === "manual"} onChange={() => setMode("manual")} />
                    <span>Manual (kartları siz ekleyin)</span>
                  </label>
                </div>

                {mode === "manual" && (
                  <>
                    <div className="grid gap-3 md:grid-cols-3">
                      <Field label="Banka Kodu (ops.)" value={bankCode} onChange={setBankCode} placeholder="e.g. 62" />
                    </div>

                    <div className="mt-2 flex items-center justify-between">
                      <div className="font-medium">Kartlar</div>
                      <button className="btn-outline" onClick={addCard}>
                        Kart Ekle
                      </button>
                    </div>

                    <div className="max-h-72 space-y-3 overflow-auto">
                      {manualCards.map((c, idx) => (
                        <div key={idx} className="grid items-end gap-2 md:grid-cols-5">
                          <Field label="CC No" value={c.ccno} onChange={(v) => updCard(idx, "ccno", v)} />
                          <Field label="Ay" value={c.e_month} onChange={(v) => updCard(idx, "e_month", v)} />
                          <Field label="Yıl" value={c.e_year} onChange={(v) => updCard(idx, "e_year", v)} />
                          <Field label="CVV" value={c.cvv} onChange={(v) => updCard(idx, "cvv", v)} />
                          <div className="flex items-end gap-2">
                            <Field label="Banka" value={c.bank_code || ""} onChange={(v) => updCard(idx, "bank_code", v)} />
                            <button className="h-10 rounded-xl border border-base-700 px-3 text-sm hover:bg-base-900" onClick={() => delCard(idx)}>
                              Sil
                            </button>
                          </div>
                        </div>
                      ))}
                      {manualCards.length === 0 && <div className="text-sm text-base-400">Henüz kart eklenmedi.</div>}
                    </div>
                  </>
                )}
              </div>
            )}

            {/* Sadece cancel/refund (ödemesiz) seçildiyse tek başına adaylar */}
            {!hasPayment && (hasCancel || hasRefund) && (
              <>
                <div className="text-sm text-base-300">
                  {hasCancel ? "Cancel" : "Refund"} için uygun işlemler listelenir. Satır seçince paymentId formu dolacak.
                </div>

                <CandidateFinder
                  action={hasCancel ? "cancel" : "refund"}
                  channelId={channelId}
                  onPick={(r) => setPickedCandidate({ paymentId: r.paymentId })}
                />

                {pickedCandidate?.paymentId ? (
                  <div className="rounded-xl border border-emerald-700/40 bg-emerald-700/10 p-3 text-sm text-emerald-300">
                    Seçilen paymentId: <span className="font-mono">{pickedCandidate.paymentId}</span>
                  </div>
                ) : (
                  <div className="rounded-xl border border-base-800 bg-base-900 p-3 text-sm text-base-400">
                    Henüz bir satır seçilmedi.
                  </div>
                )}
              </>
            )}

            <div className="mt-2 flex justify-between">
              <button className="btn-outline" onClick={() => setStep(3)}>
                Geri
              </button>
              <button className="btn" onClick={() => setStep(5)}>
                İleri
              </button>
            </div>
          </section>
        )}

        {/* Step 5 — Ödeme Bilgileri */}
        {step === 5 && (
          <section className="space-y-4">
            <StepPayment value={payment} onChange={setPayment} />
            <div className="mt-6 flex justify-between">
              <button className="btn-outline" onClick={() => setStep(4)}>
                Geri
              </button>
              <button className="btn" onClick={() => setStep(6)}>
                İleri
              </button>
            </div>
          </section>
        )}

        {/* Step 6 — Özet & Çalıştır */}
        {step === 6 && (
          <section className="space-y-4">
            <div className="card p-4">
              <div className="grid gap-3 text-sm md:grid-cols-3">
                <Summary label="SENARYO" value={scenarios.includes("all") ? "full-suite" : scenarios.join(", ")} />
                <Summary label="ORTAM" value={env} />
                <Summary label="CHANNEL ID" value={channelId} />
                <Summary label="APPLICATIONNAME" value={app.applicationName || "-"} />
                <Summary label="TRANSACTIONID" value={app.transactionId || randDigits(19)} />
                <Summary label="TRANSACTIONDATETIME" value={app.transactionDateTime || nowStamp()} />
                <Summary label="KART ADEDİ" value={String(mode === "manual" ? manualCards.length : cardCount)} />
                <Summary label="MSISDN" value={normalizeMsisdn(payment.msisdn)} />
                <Summary label="TUTAR" value={String(payment.amount)} />
                <Summary label="3D" value={"false"} />
                <Summary label="TAKSİT" value={String(payment.installmentNumber)} />
                <Summary label="USER" value={`${payment.userName} (${payment.userId || "-"})`} />
                {(hasCancel || hasRefund) && (
                  <Summary label="PAYMENT REF" value={pickedCandidate?.paymentId || "-"} />
                )}
              </div>
              <div className="mt-3 rounded border border-base-800 px-3 py-2 text-xs text-base-400">
                Çalıştırma Modu bilgisi: Kuyruk modunda sonuç arka planda takip edilir (long-poll).
              </div>
            </div>

            <div className="mt-6 flex justify-between">
              <button className="btn-outline" onClick={() => setStep(5)}>
                Geri
              </button>
              <button className="btn" onClick={onStart}>
                Botu Çalıştır
              </button>
            </div>
          </section>
        )}
      </Modal>

      {/* İptal tetikleme modalı (placeholder) */}
      <Modal open={cancelModalOpen} onClose={() => setCancelModalOpen(false)} title="İptal tetikleniyor…">
        <div className="flex items-center gap-3">
          <span className="inline-block h-5 w-5 rounded-full border-2 border-base-700 border-t-primary animate-spin" />
          <div className="text-sm">
            Hazırlanıyor — n8n bağlantısı eklenecek.
            <div className="mt-1 text-xs text-base-400">
              paymentId: <span className="font-mono">{cancelPaymentId}</span>
            </div>
          </div>
        </div>
      </Modal>
    </div>
  );
}

function LiveTicker({ steps }: { steps: Array<{ time: string; name: string; status: string; message?: string }> }) {
  const last = steps.slice(-6).reverse();
  if (!last.length) return null;
  return (
    <div className="mt-3 rounded-xl border border-base-800 bg-base-900 p-3">
      <div className="mb-2 text-xs text-base-500">Canlı Ticker</div>
      <ul className="space-y-1 text-sm">
        {last.map((s, i) => (
          <li key={i} className="flex items-center gap-2">
            <span
              className={`h-2 w-2 rounded-full inline-block ${
                s.status === "success" ? "bg-emerald-500" : s.status === "error" ? "bg-red-500" : "bg-amber-500"
              }`}
            />
            <span className="font-medium">{s.name}</span>
            {s.message && <span className="text-base-400">— {s.message}</span>}
            <span className="ml-auto text-xs text-base-500">{new Date(s.time).toLocaleTimeString()}</span>
          </li>
        ))}
      </ul>
    </div>
  );
}

/* ---------- small UI ---------- */
const STEP_LABELS = [
  "Senaryo Seçimi",
  "Ortam & Kanal",
  "Application Bilgileri",
  "Kart/Test Verisi",
  "Ödeme Bilgileri",
  "Özet & Çalıştır",
] as const;

const SCENARIOS: Record<ScenarioKey, { label: string; tip: string }> = {
  token: { label: "Token Alma", tip: "Kart için token üretilir (ödeme yapılmaz)." },
  payment: { label: "3Dsiz Peşin Satış", tip: "Token ile ödeme yapılır (PAYMENT flow)." },
  cancel: { label: "İptal", tip: "Var olan bir paymentId için CANCEL SOAP çağrısı." },
  refund: { label: "İade", tip: "Var olan bir paymentId için REFUND SOAP çağrısı." },
  all: { label: "Hepsi", tip: "Full suite: token + payment (+ iptal/iade ileride). Şimdilik ödeme tetiklenir." },
};

function StepBar({ step, labels }: { step: number; labels: readonly string[] }) {
  return (
    <div className="mb-4 flex flex-wrap items-center gap-2">
      {labels.map((l, i) => {
        const active = step === i + 1;
        return (
          <span
            key={l}
            className={`pill ${
              active ? "bg-emerald-500/15 text-emerald-300 ring-emerald-500/30" : "bg-base-900 text-base-400 ring-base-800"
            }`}
          >
            {`${i + 1}. ${l}`}
          </span>
        );
      })}
    </div>
  );
}

function Field(props: {
  label: string;
  value: string;
  onChange: (v: string) => void;
  type?: "text" | "number";
  placeholder?: string;
}) {
  return (
    <label className="block">
      <div className="mb-1 text-sm">{props.label}</div>
      <input
        className="input"
        value={props.value}
        onChange={(e) => props.onChange(e.target.value)}
        type={props.type ?? "text"}
        placeholder={props.placeholder}
      />
    </label>
  );
}

function Summary({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded border border-base-800 bg-transparent px-3 py-2">
      <div className="text-[10px] uppercase tracking-wider text-base-500">{label}</div>
      <div className="mt-1 break-all text-sm text-base-100">{value}</div>
    </div>
  );
}

function toggleScenario(
  key: ScenarioKey,
  checked: boolean,
  list: ScenarioKey[],
  setList: (l: ScenarioKey[]) => void,
  isAll = false,
) {
  if (isAll || key === "all") return setList(checked ? ["all"] : []);
  const next = new Set(list.filter((s) => s !== "all"));
  checked ? next.add(key) : next.delete(key);
  setList([...next]);
}
