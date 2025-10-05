import React, { useState } from 'react';

const bankPresets = [
  { name: 'Ak Bank', card: '4355084355084358', month: '12', year: '26', cvv: '000' },
  { name: 'DenizBank', card: '4090700090840057', month: '11', year: '22', cvv: '592' },
  { name: 'Garanti Bank', card: '4282209004348015', month: '08', year: '22', cvv: '123' },
  { name: 'WireCard', card: '5818775818772285', month: '12', year: '20', cvv: '001' },
];

export default function ThreeDSession() {
  const [form, setForm] = useState({
    banka: '',
    cardnumber: '',
    cardexpiredatemonth: '',
    cardexpiredateyear: '',
    cardCVV: '',
    amount: '100',
    installmentCount: '0',
    cardholdername: 'Kezban Mahmut',
    threeDSessionId: '',
    callbackurl: '',
  });

  function applyPreset(p) {
    setForm((s) => ({ ...s, banka: p.name, cardnumber: p.card, cardexpiredatemonth: p.month, cardexpiredateyear: p.year, cardCVV: p.cvv }));
  }

  function openBankDev() {
    // build a fake launch URL using session id if present
    const params = new URLSearchParams({ runKey: form.threeDSessionId || `local-${Date.now()}` });
    const url = `http://localhost:5701/webhook/payment-test/3d/launch?${params.toString()}`;
    window.open(url, '_blank');
  }

  function copySession() {
    navigator.clipboard.writeText(form.threeDSessionId || '').catch(() => {});
  }

  return (
    <div className="p-6 max-w-4xl mx-auto">
      <h2 className="text-2xl font-semibold mb-4">3D Session Builder</h2>

      <div className="mb-4 grid grid-cols-2 gap-3">
        {bankPresets.map((p) => (
          <button key={p.name} className="btn btn-outline" onClick={() => applyPreset(p)}>{p.name}</button>
        ))}
      </div>

      <div className="grid grid-cols-1 gap-4">
        <label>Card Number<input className="input input-bordered w-full" value={form.cardnumber} onChange={(e) => setForm({ ...form, cardnumber: e.target.value })} /></label>
        <div className="grid grid-cols-3 gap-3">
          <input className="input input-bordered" value={form.cardexpiredatemonth} onChange={(e) => setForm({ ...form, cardexpiredatemonth: e.target.value })} placeholder="MM" />
          <input className="input input-bordered" value={form.cardexpiredateyear} onChange={(e) => setForm({ ...form, cardexpiredateyear: e.target.value })} placeholder="YY" />
          <input className="input input-bordered" value={form.cardCVV} onChange={(e) => setForm({ ...form, cardCVV: e.target.value })} placeholder="CVV" />
        </div>
        <label>Cardholder Name<input className="input input-bordered w-full" value={form.cardholdername} onChange={(e) => setForm({ ...form, cardholdername: e.target.value })} /></label>
        <label>Amount<input className="input input-bordered w-full" value={form.amount} onChange={(e) => setForm({ ...form, amount: e.target.value })} /></label>

        <label>3D Session ID<div className="flex gap-2"><input className="input input-bordered flex-1" value={form.threeDSessionId} onChange={(e) => setForm({ ...form, threeDSessionId: e.target.value })} /><button className="btn" onClick={copySession}>Copy</button></div></label>

        <div className="flex gap-2">
          <button className="btn btn-primary" onClick={openBankDev}>Open Bank (Dev)</button>
          <button className="btn" onClick={() => alert('Submit -> backend not implemented in this demo')}>Bankaya Gönder (simulate)</button>
        </div>
      </div>
    </div>
  );
}
