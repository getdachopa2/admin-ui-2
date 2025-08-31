// src/components/wizard/StepCards.tsx
import type { ManualCard } from "@/types/n8n";

export default function StepCards({
  manualMode, setManualMode,
  manualCards, addCard, removeCard, updateCard,
  manualValid,
}:{
  manualMode: boolean;
  setManualMode: (v:boolean)=>void;
  manualCards: ManualCard[];
  addCard: ()=>void;
  removeCard: (i:number)=>void;
  updateCard: (i:number, k:keyof ManualCard, v:string)=>void;
  manualValid: boolean;
}) {
  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-4">
          <label className="flex items-center gap-2 text-sm">
            <input type="checkbox" checked={manualMode} onChange={(e)=> setManualMode(e.target.checked)} />
            Manuel kart gireceğim
          </label>
          {!manualMode && <span className="text-xs text-neutral-400">Otomatik mod: DB’den aktif rastgele 10 kart.</span>}
        </div>
        {manualMode && (
          <button className="rounded-xl border border-neutral-700 px-3 py-2 text-sm hover:bg-neutral-800" onClick={addCard}>Kart Ekle</button>
        )}
      </div>

      {manualMode ? (
        <div className="space-y-3 max-h-72 overflow-auto pr-1">
          {manualCards.map((c, idx)=> (
            <div key={idx} className="grid grid-cols-1 items-end gap-2 sm:grid-cols-5">
              <Clearable label="CC No" value={c.ccno}   onChange={(v)=> updateCard(idx,'ccno',v)}   placeholder="4111 1111 1111 1111" />
              <Clearable label="Ay"    value={c.e_month} onChange={(v)=> updateCard(idx,'e_month',v)} placeholder="MM" />
              <Clearable label="Yıl"   value={c.e_year}  onChange={(v)=> updateCard(idx,'e_year',v)}  placeholder="YY veya YYYY" />
              <Clearable label="CVV"   value={c.cvv}   onChange={(v)=> updateCard(idx,'cvv',v)}   placeholder="3-4 hane" />
              <div className="flex items-end gap-2">
                <Clearable label="Banka" value={c.bank_code || ''} onChange={(v)=> updateCard(idx,'bank_code',v)} placeholder="örn. 62" />
                <button className="h-10 rounded-lg border border-neutral-700 px-3 text-sm hover:bg-neutral-800" onClick={()=> removeCard(idx)}>Sil</button>
              </div>
            </div>
          ))}
          {manualCards.length===0 && (
            <div className="rounded-xl border border-neutral-800 bg-neutral-900 p-4 text-sm text-neutral-400">Henüz kart eklenmedi.</div>
          )}
          {!manualValid && (
            <div className="rounded-xl border border-red-900 bg-red-950/40 p-3 text-sm text-red-300">
              Kart bilgilerini kontrol edin. PAN/Ay/Yıl/CVV formatları geçerli olmalı.
            </div>
          )}
        </div>
      ) : (
        <div className="rounded-xl border border-neutral-800 bg-neutral-900 p-4 text-sm text-neutral-400">Otomatik modda 10 kart seçilecektir.</div>
      )}
    </div>
  );
}

function Clearable({ label, value, onChange, placeholder }:{ label:string; value:string; onChange:(v:string)=>void; placeholder?:string }) {
  return (
    <div className="relative">
      <label className="text-xs text-neutral-400">{label}</label>
      <input value={value} onChange={(e)=> onChange(e.target.value)} placeholder={placeholder} className="mt-1 w-full rounded-xl border border-neutral-800 bg-neutral-900 p-2 pr-9 text-sm" />
      {!!value && (
        <button type="button" className="absolute right-2 top-[26px] grid h-6 w-6 place-items-center rounded-md text-neutral-400 hover:bg-neutral-800" onClick={()=> onChange("")}>×</button>
      )}
    </div>
  );
}
