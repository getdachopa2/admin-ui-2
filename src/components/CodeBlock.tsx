import { useMemo, useState } from 'react';

/** basit JSON/XML beautifier + kopyala butonlu codeblock */
export default function CodeBlock({
  value,
  lang,
  className = '',
}: {
  value: unknown;
  lang?: 'json' | 'xml' | 'text';
  className?: string;
}) {
  const [copied, setCopied] = useState(false);
  const [pretty, setPretty] = useState(true);

  const raw = useMemo(() => stringify(value), [value]);
  const prettyText = useMemo(() => {
    if (lang === 'json') return tryPrettyJSON(raw);
    if (lang === 'xml') return tryPrettyXML(raw);
    // otomatik algıla
    if (!lang) {
      if (looksLikeXML(raw)) return tryPrettyXML(raw);
      if (looksLikeJSON(raw)) return tryPrettyJSON(raw);
    }
    return raw;
  }, [raw, lang]);

  const shown = pretty ? prettyText : raw;
  const effectiveLang: 'json' | 'xml' | 'text' = lang
    ? lang
    : looksLikeXML(raw)
    ? 'xml'
    : looksLikeJSON(raw)
    ? 'json'
    : 'text';

  async function copy() {
    try {
      await navigator.clipboard.writeText(shown);
      setCopied(true);
      setTimeout(() => setCopied(false), 1200);
    } catch {}
  }

  return (
    <div className={`group relative overflow-hidden rounded-2xl border border-base-800 bg-base-900/70 ${className}`}>
      {/* toolbar */}
      <div className="flex items-center justify-between border-b border-base-800/80 px-3 py-2 text-xs">
        <div className="flex items-center gap-2">
          <span className="rounded bg-base-800 px-2 py-0.5 text-[10px] uppercase tracking-wider text-base-400">
            {effectiveLang}
          </span>
          {(effectiveLang === 'json' || effectiveLang === 'xml') && (
            <button
              className="rounded-md border border-base-700 bg-base-900 px-2 py-1 text-[11px] text-base-200 hover:bg-base-800"
              onClick={() => setPretty((s) => !s)}
              type="button"
            >
              {pretty ? 'Raw göster' : 'Beautify'}
            </button>
          )}
        </div>

        <button
          className="rounded-md border border-base-700 bg-base-900 px-2 py-1 text-[11px] text-base-200 hover:bg-base-800"
          onClick={copy}
          type="button"
        >
          {copied ? 'Kopyalandı' : 'Kopyala'}
        </button>
      </div>

      {/* code */}
      <pre className="max-h-[520px] overflow-auto p-3 text-[13px] leading-5 text-emerald-200">
        <code>{shown}</code>
      </pre>
    </div>
  );
}

/* ---------- helpers ---------- */
function stringify(v: unknown) {
  if (typeof v === 'string') return v;
  try {
    return JSON.stringify(v ?? {}, null, 2);
  } catch {
    return String(v);
  }
}
function looksLikeJSON(s: string) {
  const t = s.trim();
  return (t.startsWith('{') && t.endsWith('}')) || (t.startsWith('[') && t.endsWith(']'));
}
function looksLikeXML(s: string) {
  const t = s.trim();
  return t.startsWith('<') && t.endsWith('>') && /<\/?[a-zA-Z]/.test(t);
}
function tryPrettyJSON(s: string) {
  try {
    return JSON.stringify(JSON.parse(s), null, 2);
  } catch {
    return s;
  }
}
function tryPrettyXML(s: string) {
  try {
    // çok basit girinti: tag aralarına \n koy, seviyeye göre boşluk ekle
    const xml = s.replace(/>\s*</g, '><').replace(/></g, '>\n<');
    const lines = xml.split('\n');
    let lvl = 0;
    return lines
      .map((line) => {
        const openClose = /^<\/.+>/.test(line);
        const self = /\/>$/.test(line) || /^<\?.+\?>$/.test(line) || /^<!.+>$/.test(line);
        if (openClose) lvl = Math.max(0, lvl - 1);
        const pad = '  '.repeat(lvl);
        if (!openClose && !self && /^<[^/].+>.*$/.test(line) && !/>.*</.test(line)) lvl++;
        return pad + line;
      })
      .join('\n');
  } catch {
    return s;
  }
}
