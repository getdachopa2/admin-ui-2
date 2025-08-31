// src/pages/KanalKontrolBotu.tsx
import React, { useEffect, useMemo, useState } from "react";
import Modal from "@/components/Modal";
import { IndeterminateBar, SolidProgress, RateLimitProgress } from "@/components/ProgressBar";
import CodeBlock from "@/components/CodeBlock";
import { useProgress } from "@/hooks/useProgress";
import { useRateLimit } from "@/hooks/useRateLimit";
import { startPayment } from "@/lib/n8nClient";
import Wizard from "@/components/wizard/Wizard";
import { saveRun, type SavedRun } from "@/lib/runsStore";

/* ---------- helpers ---------- */
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
  const SAVE_LOCAL = import.meta.env.VITE_SAVE_LOCAL_RUNS === "true";

  // Rate limiting (5 saniye minimum interval)
  const rateLimit = useRateLimit({ minInterval: 5000 });

  // Wizard modal
  const [wizardOpen, setWizardOpen] = useState(false);

  // Çalıştırma / progress
  const [runKey, setRunKey] = useState<string | null>(null);
  const { data: prog, error: progErr } = useProgress(runKey, 25, 2000);
  const steps = prog?.steps ?? [];
  const running = prog?.status === "running";

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
        message: `Test simülasyonu başlatıldı.`,
      },
    ]);
  }, [runKey]);

  const liveSteps = useMemo(() => [...echoSteps, ...steps], [echoSteps, steps]);
  const listSteps = useMemo(() => (running ? liveSteps : steps), [running, liveSteps, steps]);

  /* ---------- yalnızca HTTP içeren step'ler (rapor için) ---------- */
  const httpSteps = useMemo(
    () => steps.filter((s) => s && (s.request != null || s.response != null)),
    [steps],
  );

  async function onWizardComplete(payload: any) {
    if (!rateLimit.canMakeRequest) {
      alert(`Rate limit aktif. ${Math.ceil(rateLimit.remainingTime / 1000)} saniye sonra tekrar deneyin.`);
      return;
    }

    try {
      const res = await rateLimit.executeRequest(() => startPayment(payload));
      setRunKey(res.runKey);
      setWizardOpen(false);
    } catch (e) {
      alert("Start error: " + (e as Error).message);
    }
  }

  // Koşu tamamlanınca son 5'e kaydet
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
        params: {},
      },
    };
    saveRun(toSave);
  }, [prog?.status, runKey, SAVE_LOCAL, prog]);

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
    return Array.from(map.entries());
  }, [httpSteps]);

  return (
    <div className="space-y-6">
      {/* Üst kart */}
      <div className="card p-6">
        <h1 className="mb-2 text-2xl font-bold tracking-tight text-base-100">Kanal Kontrol Botu</h1>
        <p className="max-w-3xl text-sm leading-6 text-base-300">
          **Unified Test Interface** - Payment, Cancel, Refund akışlarını tek noktadan yönetin. 
          Artık farklı tool'lar yerine sihirbazla guided test yapın.
        </p>
        <div className="mt-4 flex items-center gap-4">
          <button
            className="btn"
            onClick={() => setWizardOpen(true)}
            disabled={!rateLimit.canMakeRequest}
          >
            Test Sihirbazını Aç
          </button>
          
          {!rateLimit.canMakeRequest && (
            <div className="flex-1 max-w-xs">
              <RateLimitProgress remainingTime={rateLimit.remainingTime} />
            </div>
          )}
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
              <div className="w-56">
                {running ? (
                  <IndeterminateBar message="Test çalışıyor..." />
                ) : (
                  <SolidProgress value={100} message="Tamamlandı" />
                )}
              </div>
            </div>
            {progErr && <div className="mt-2 text-sm text-red-400">Hata: {progErr}</div>}

            {/* Koşarken ticker */}
           

            {/* Adımlar */}
            <div className="mt-4">
              <div className="mb-2 font-medium">Test Adımları</div>
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
                {!listSteps.length && <li className="text-sm text-base-500">Test başlamadı...</li>}
              </ul>
            </div>
          </div>

          {/* Detaylı Rapor */}
          <div className="card p-6">
            {running && !prog?.result && (
              <div className="rounded-xl border border-base-800 bg-base-900 p-4 text-sm text-base-400">
                Test sürüyor... Detaylar hazır olduğunda görünecek.
              </div>
            )}

            {/* Senaryo Accordion */}
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
                  Henüz detaylı HTTP isteği yok.
                </div>
              )}
            </div>
          </div>
        </>
      )}

      {/* Yeni Wizard Modal */}
      <Modal open={wizardOpen} onClose={() => setWizardOpen(false)} title="Test Sihirbazı">
        <Wizard onComplete={onWizardComplete} onCancel={() => setWizardOpen(false)} />
      </Modal>
    </div>
  );
}

function LiveTicker({ steps }: { steps: Array<{ time: string; name: string; status: string; message?: string }> }) {
  const last = steps.slice(-6).reverse();
  if (!last.length) return null;
  return (
    <div className="mt-3 rounded-xl border border-base-800 bg-base-900 p-3">
      <div className="mb-2 text-xs text-base-500">Son Aktiviteler</div>
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
