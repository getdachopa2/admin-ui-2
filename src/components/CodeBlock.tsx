import { useMemo, useState } from 'react';

// XML Syntax Highlighter Component
function XMLHighlighter({ text }: { text: string }) {
  const highlighted = useMemo(() => {
    // HTML encode first to prevent XSS
    const escaped = text
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#39;');
    
    return escaped
      // XML tags (opening, closing, self-closing)
      .replace(/(&lt;\/?[a-zA-Z0-9:_-]+[^&]*?&gt;)/g, 
        '<span class="text-blue-300">$1</span>')
      // Attribute names
      .replace(/(\s+)([a-zA-Z0-9:_-]+)(=)/g, 
        '$1<span class="text-yellow-300">$2</span><span class="text-gray-400">$3</span>')
      // Attribute values
      .replace(/(=)(&quot;|&#39;)([^&]*?)\2/g, 
        '<span class="text-gray-400">$1</span><span class="text-green-300">$2$3$2</span>')
      // XML declaration
      .replace(/(&lt;\?xml[^&]*?\?&gt;)/g, 
        '<span class="text-purple-300">$1</span>')
      // Comments
      .replace(/(&lt;!--.*?--&gt;)/gs, 
        '<span class="text-gray-500">$1</span>')
      // CDATA
      .replace(/(&lt;!\[CDATA\[.*?\]\]&gt;)/gs, 
        '<span class="text-orange-300">$1</span>')
      // SOAP-specific namespaces
      .replace(/(soap:|soapenv:|ns\d+:)/g, 
        '<span class="text-cyan-300">$1</span>');
  }, [text]);

  return <span dangerouslySetInnerHTML={{ __html: highlighted }} />;
}

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
      <pre className="max-h-[520px] overflow-auto p-3 text-[13px] leading-5">
        <code>
          {effectiveLang === 'xml' ? (
            <XMLHighlighter text={shown} />
          ) : effectiveLang === 'json' ? (
            <span className="text-emerald-200">{shown}</span>
          ) : (
            <span className="text-base-200">{shown}</span>
          )}
        </code>
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
    // SOAP XML için gelişmiş formatting
    let xml = s.trim();
    
    // Gereksiz boşlukları temizle
    xml = xml.replace(/>\s+</g, '><');
    
    // XML header'ı ayrı satıra al
    xml = xml.replace(/(<\?xml[^>]*\?>)/, '$1\n');
    
    // SOAP namespace'leri düzenle - tek satırda uzun attribute'ları böl
    xml = xml.replace(/(<soap:Envelope[^>]*?)(\s+xmlns[^>]*?>)/g, (match, start, attrs) => {
      const formattedAttrs = attrs.split(/\s+xmlns/).map((attr, index) => {
        if (index === 0) return attr;
        return '\n  xmlns' + attr;
      }).join('');
      return start + formattedAttrs;
    });
    
    // Tag'ler arasına newline ekle
    xml = xml.replace(/>\s*</g, '>\n<');
    
    // CDATA sections'ı koru
    const cdataPlaceholders: string[] = [];
    xml = xml.replace(/<!\[CDATA\[.*?\]\]>/gs, (match) => {
      const placeholder = `__CDATA_${cdataPlaceholders.length}__`;
      cdataPlaceholders.push(match);
      return placeholder;
    });
    
    const lines = xml.split('\n').filter(line => line.trim());
    let indentLevel = 0;
    const indentSize = 2;
    
    const formatted = lines.map(line => {
      const trimmed = line.trim();
      
      // Closing tag ise indent'i azalt
      if (trimmed.startsWith('</')) {
        indentLevel = Math.max(0, indentLevel - 1);
      }
      
      const indent = ' '.repeat(indentLevel * indentSize);
      
      // Opening tag ise (self-closing değilse) indent'i artır
      if (trimmed.startsWith('<') && 
          !trimmed.startsWith('</') && 
          !trimmed.endsWith('/>') && 
          !trimmed.startsWith('<?') && 
          !trimmed.startsWith('<!')) {
        
        // Eğer tag içinde content varsa (örn: <tag>content</tag>) indent artırma
        if (!trimmed.includes('></')) {
          indentLevel++;
        }
      }
      
      return indent + trimmed;
    }).join('\n');
    
    // CDATA placeholder'larını geri koy
    return cdataPlaceholders.reduce((result, cdata, index) => {
      return result.replace(`__CDATA_${index}__`, cdata);
    }, formatted);
    
  } catch {
    return s;
  }
}
