import React from "react";
import type { PaymentState } from '@/types/n8n';


/** MSISDN -> '90...' */
export function normalizeMsisdn(x: string) {
  let d = (x || "").replace(/\D+/g, "");
  if (d.startsWith("0")) d = "90" + d.slice(1);
  if (!d.startsWith("90")) d = "90" + d;
  return d;
}


export default function StepPayment({
  value,
  onChange,
}: {
  value: PaymentState;
  onChange: (v: PaymentState) => void;
}) {
  const v = value;

  const set = <K extends keyof PaymentState>(k: K, val: PaymentState[K]) =>
    onChange({ ...v, [k]: val });

  const setOpt = <K extends keyof PaymentState["options"]>(
    k: K,
    val: PaymentState["options"][K]
  ) => onChange({ ...v, options: { ...v.options, [k]: val } });

  const applyPresetTPAY = () => {
    onChange({
      ...v,
      userId: "5315236097",
      userName: "TPAY",
    });
  };

  return (
    <section className="space-y-3">
      {/* Preset */}
      <div className="flex items-center gap-2">
        <span className="text-xs text-neutral-400">Preset:</span>
        <button
          type="button"
          className="rounded-full border border-neutral-700 px-2 py-1 text-xs text-neutral-200 hover:bg-neutral-800"
          onClick={applyPresetTPAY}
        >
          TPAY (userId+userName)
        </button>
      </div>

      <div className="grid gap-2 md:grid-cols-2">
        <Field label="User ID" value={v.userId} onChange={(x) => set("userId", x)} />
        <Field label="User Name" value={v.userName} onChange={(x) => set("userName", x)} />

       <Field
   label="Tutar"
   type="text"
   value={String(v.amount)}
   onChange={(x)=>{
     const y = x.replace(',', '.').replace(/[^\d.]/g,'');
     set('amount', y ? parseFloat(y) : 0);
   }}
 />
        <Field
          label="MSISDN"
          value={v.msisdn}
          onChange={(x) => set("msisdn", x)}
          placeholder="5303589836"
        />

        {/* 3D ile öde — disabled for now */}
        <SelectBoolDisabled
          label="3D ile öde (yakında)"
          value={false}
          disabled={true}
          onChange={(b) => set("threeDOperation", false)}
        />

        <Field
          label="Taksit (0 = peşin)"
          type="number"
          value={String(v.installmentNumber)}
          onChange={(x) => set("installmentNumber", Number(x) || 0)}
        />

        {/* paymentType UI’da gizli tutuyoruz */}
        <div className="hidden">
          <Field
            label="Payment Type"
            value={v.paymentType}
            onChange={(x) => set("paymentType", x as PaymentState["paymentType"])}
          />
        </div>
      </div>

      {/* Opsiyonlar — hepsi dropdown true/false */}
      <div className="mt-2 grid gap-2 md:grid-cols-2">
        <SelectBool
          label="includeMsisdnInOrderID"
          value={v.options.includeMsisdnInOrderID}
          onChange={(b) => setOpt("includeMsisdnInOrderID", b)}
        />
        <SelectBool
          label="checkCBBLForMsisdn"
          value={v.options.checkCBBLForMsisdn}
          onChange={(b) => setOpt("checkCBBLForMsisdn", b)}
        />
        <SelectBool
          label="checkCBBLForCard"
          value={v.options.checkCBBLForCard}
          onChange={(b) => setOpt("checkCBBLForCard", b)}
        />
        <SelectBool
          label="checkFraudStatus"
          value={v.options.checkFraudStatus}
          onChange={(b) => setOpt("checkFraudStatus", b)}
        />
      </div>
    </section>
  );
}

/* small inputs */
function Field({
  label,
  value,
  onChange,
  type,
  placeholder,
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
  type?: "text" | "number";
  placeholder?: string;
}) {
  return (
    <label className="block">
      <div className="mb-1 text-xs">{label}</div>
      <input
        className="input text-sm"
        value={value}
        onChange={(e) => onChange(e.target.value)}
        type={type ?? "text"}
        placeholder={placeholder}
      />
    </label>
  );
}

function SelectBool({
  label,
  value,
  onChange,
}: {
  label: string;
  value: boolean;
  onChange: (b: boolean) => void;
}) {
  return (
    <label className="block">
      <div className="mb-1 text-xs">{label}</div>
      <select
        className="input text-sm"
        value={String(value)}
        onChange={(e) => onChange(e.target.value === "true")}
      >
        <option value="true">true</option>
        <option value="false">false</option>
      </select>
    </label>
  );
}

function SelectBoolDisabled({
  label,
  value,
  disabled,
  onChange,
}: {
  label: string;
  value: boolean;
  disabled: boolean;
  onChange: (b: boolean) => void;
}) {
  return (
    <label className="block">
      <div className="mb-1 text-xs text-neutral-400">{label}</div>
      <select
        className="input text-sm bg-neutral-800 text-neutral-500 cursor-not-allowed"
        value={String(value)}
        disabled={disabled}
        onChange={(e) => onChange(e.target.value === "true")}
      >
        <option value="false">false</option>
      </select>
    </label>
  );
}
