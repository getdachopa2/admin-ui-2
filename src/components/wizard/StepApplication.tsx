// src/components/wizard/StepApplication.tsx
import ClearInput from '@/components/ClearInput';

// Helper functions from old code
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

export interface StepApplicationValue {
  applicationName: string;
  applicationPassword: string;
  secureCode: string;
  transactionId: string;
  transactionDateTime: string;
}

interface StepApplicationProps {
  value: StepApplicationValue;
  onChange: (value: StepApplicationValue) => void;
}

export default function StepApplication({ value, onChange }: StepApplicationProps) {
  const updateField = <K extends keyof StepApplicationValue>(key: K, val: StepApplicationValue[K]) => {
    onChange({ ...value, [key]: val });
  };

  const setPreset = (preset: Partial<StepApplicationValue>) => {
    onChange({ ...value, ...preset });
  };

  return (
    <div className="space-y-4">
      <header>
        <h2 className="text-base font-semibold">Uygulama Bilgileri</h2>
        <p className="text-xs text-neutral-400">
          Test edilecek uygulamanın kimlik bilgilerini girin.
        </p>
      </header>

      {/* Preset buttons */}
      <div className="flex flex-wrap items-center gap-2">
        <span className="text-xs text-neutral-400">Hazır Presetler:</span>
        <button
          className="rounded-lg border border-neutral-700 bg-neutral-800 px-3 py-1 text-xs text-neutral-200 hover:bg-neutral-700"
          onClick={() =>
            setPreset({
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
          className="rounded-lg border border-neutral-700 bg-neutral-800 px-3 py-1 text-xs text-neutral-200 hover:bg-neutral-700"
          onClick={() =>
            setPreset({
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
          className="rounded-lg border border-neutral-700 bg-neutral-800 px-3 py-1 text-xs text-neutral-200 hover:bg-neutral-700"
          onClick={() =>
            setPreset({
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

      {/* Form fields */}
      <div className="grid gap-3 md:grid-cols-2">
        <div>
          <label className="block text-xs font-medium text-neutral-200 mb-1">
            Application Name
          </label>
          <ClearInput
            value={value.applicationName}
            onChange={(v) => updateField('applicationName', v)}
            placeholder="PAYCELLTEST"
          />
        </div>

        <div>
          <label className="block text-xs font-medium text-neutral-200 mb-1">
            Application Password
          </label>
          <ClearInput
            value={value.applicationPassword}
            onChange={(v) => updateField('applicationPassword', v)}
            placeholder="Application password"
          />
        </div>

        <div>
          <label className="block text-xs font-medium text-neutral-200 mb-1">
            Secure Code
          </label>
          <ClearInput
            value={value.secureCode}
            onChange={(v) => updateField('secureCode', v)}
            placeholder="Secure code"
          />
        </div>

        <div>
          <label className="block text-xs font-medium text-neutral-200 mb-1">
            Transaction ID
            <button
              className="ml-2 text-xs text-emerald-400 hover:text-emerald-300"
              onClick={() => updateField('transactionId', randDigits(19))}
            >
              (otomatik üret)
            </button>
          </label>
          <ClearInput
            value={value.transactionId}
            onChange={(v) => updateField('transactionId', v)}
            placeholder="19 haneli ID"
          />
        </div>

        <div className="md:col-span-2">
          <label className="block text-xs font-medium text-neutral-200 mb-1">
            Transaction DateTime
            <button
              className="ml-2 text-xs text-emerald-400 hover:text-emerald-300"
              onClick={() => updateField('transactionDateTime', nowStamp())}
            >
              (şimdi)
            </button>
          </label>
          <ClearInput
            value={value.transactionDateTime}
            onChange={(v) => updateField('transactionDateTime', v)}
            placeholder="YYYYMMDDHHMMSS"
          />
        </div>
      </div>

      {/* Info */}
  
    </div>
  );
}
