// src/utils/card.ts
export function luhnOk(num: string) {
  const s = (num || "").replace(/\s+/g, "");
  if (!/^\d+$/.test(s)) return false;
  let sum = 0, dbl = false;
  for (let i = s.length - 1; i >= 0; i--) {
    let d = +s[i];
    if (dbl) { d *= 2; if (d > 9) d -= 9; }
    sum += d; dbl = !dbl;
  }
  return sum % 10 === 0;
}

export function maskPan(pan: string) {
  const d = (pan || "").replace(/\s+/g, "");
  return d.length >= 4 ? `•••• ${d.slice(-4)}` : "••••";
}
