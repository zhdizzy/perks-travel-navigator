// Veteran Perks & Travel Navigator — a real .docx writer for the what-to-bring list (copied from
// vre-approval-prep/docx.js; the document shape is the same: header, howTo, sections, closing).
// No library: a .docx is a ZIP of a few XML
// files, and the ZIP here is written "stored" (no compression) with a CRC-32 per entry. The first
// version of the download was HTML saved with a .doc name; desktop Word tolerates that but iOS does
// not (no preview, and the file gets handed to whatever app claims .doc). This writes the genuine
// format so Quick Look, Word, Pages, and Google Docs all open it.
//
// buildDocxBytes(letter) -> Uint8Array.  `letter` is the object from letter.js buildLetter().

const enc = new TextEncoder();
const xmlEsc = s => String(s ?? '').replace(/[&<>]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;' }[c])).replace(/[\u0000-\u0008\u000B\u000C\u000E-\u001F]/g, '');

/* ─── WordprocessingML pieces ───────────────────────────────────────────── */
const run = (text, { bold = false, highlight = false, italic = false } = {}) =>
  `<w:r>${bold || highlight || italic ? `<w:rPr>${bold ? '<w:b/>' : ''}${italic ? '<w:i/>' : ''}${highlight ? '<w:highlight w:val="yellow"/>' : ''}</w:rPr>` : ''}<w:t xml:space="preserve">${xmlEsc(text)}</w:t></w:r>`;
const partRuns = (parts, opts = {}) => parts.map(p => p.b ? run(`[${p.b}]`, { ...opts, bold: true, highlight: true }) : (p.t ? run(p.t, opts) : '')).join('');
const para = (inner, { indent = false, after = 160, keepNext = false, shade = false } = {}) =>
  `<w:p><w:pPr>${keepNext ? '<w:keepNext/>' : ''}${shade ? '<w:shd w:val="clear" w:color="auto" w:fill="FFF8DC"/>' : ''}<w:spacing w:after="${after}"/>${indent ? '<w:ind w:left="540" w:hanging="300"/>' : ''}</w:pPr>${inner}</w:p>`;

function documentXml(letter, { includeHowTo = true } = {}) {
  const out = [];
  letter.header.forEach((line, i) => out.push(para(partRuns(line, { bold: i < 2 }), { after: i === letter.header.length - 1 ? 200 : 0 })));
  if (includeHowTo) {
    out.push(para(run(letter.howToTitle || 'HOW TO USE THIS CHECKLIST', { bold: true }), { after: 40, shade: true, keepNext: true }));
    letter.howTo.forEach((h, i) => out.push(para(run('•  ' + h), { indent: true, after: i === letter.howTo.length - 1 ? 200 : 40, shade: true })));
  }
  for (const sec of letter.sections) {
    out.push(para(run(`${sec.n}. ${sec.title.toUpperCase()}`, { bold: true }), { after: 100, keepNext: true }));
    for (const blk of sec.blocks) {
      if (blk.type === 'p') out.push(para(partRuns(blk.items[0])));
      else blk.items.forEach((it, i) => out.push(para(run(blk.type === 'ol' ? `${i + 1}.  ` : '•  ') + partRuns(it), { indent: true, after: i === blk.items.length - 1 ? 160 : 60 })));
    }
  }
  letter.closing.forEach((line, i) => out.push(para(partRuns(line), { after: i === 0 ? 480 : 0 })));
  return `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<w:document xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main"><w:body>${out.join('')}<w:sectPr><w:pgSz w:w="12240" w:h="15840"/><w:pgMar w:top="1440" w:right="1440" w:bottom="1440" w:left="1440" w:header="720" w:footer="720" w:gutter="0"/></w:sectPr></w:body></w:document>`;
}

const STYLES = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<w:styles xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main"><w:docDefaults><w:rPrDefault><w:rPr><w:rFonts w:ascii="Georgia" w:hAnsi="Georgia" w:eastAsia="Georgia" w:cs="Georgia"/><w:sz w:val="24"/><w:szCs w:val="24"/><w:lang w:val="en-US"/></w:rPr></w:rPrDefault><w:pPrDefault><w:pPr><w:spacing w:after="160" w:line="300" w:lineRule="auto"/></w:pPr></w:pPrDefault></w:docDefaults><w:style w:type="paragraph" w:default="1" w:styleId="Normal"><w:name w:val="Normal"/><w:qFormat/></w:style></w:styles>`;
const CONTENT_TYPES = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types"><Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/><Default Extension="xml" ContentType="application/xml"/><Override PartName="/word/document.xml" ContentType="application/vnd.openxmlformats-officedocument.wordprocessingml.document.main+xml"/><Override PartName="/word/styles.xml" ContentType="application/vnd.openxmlformats-officedocument.wordprocessingml.styles+xml"/><Override PartName="/docProps/core.xml" ContentType="application/vnd.openxmlformats-package.core-properties+xml"/></Types>`;
const ROOT_RELS = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"><Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="word/document.xml"/><Relationship Id="rId2" Type="http://schemas.openxmlformats.org/package/2006/relationships/metadata/core-properties" Target="docProps/core.xml"/></Relationships>`;
const DOC_RELS = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"><Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/styles" Target="styles.xml"/></Relationships>`;
const coreXml = (iso, title) => `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<cp:coreProperties xmlns:cp="http://schemas.openxmlformats.org/package/2006/metadata/core-properties" xmlns:dc="http://purl.org/dc/elements/1.1/" xmlns:dcterms="http://purl.org/dc/terms/" xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance"><dc:title>${xmlEsc(title || 'Veteran Perks What to Bring List')}</dc:title><dcterms:created xsi:type="dcterms:W3CDTF">${iso}</dcterms:created><dcterms:modified xsi:type="dcterms:W3CDTF">${iso}</dcterms:modified></cp:coreProperties>`;

/* ─── ZIP (stored entries, UTF-8 names) ─────────────────────────────────── */
const CRC_TABLE = (() => { const t = new Uint32Array(256); for (let n = 0; n < 256; n++) { let c = n; for (let k = 0; k < 8; k++) c = c & 1 ? 0xEDB88320 ^ (c >>> 1) : c >>> 1; t[n] = c >>> 0; } return t; })();
function crc32(bytes) { let c = 0xFFFFFFFF; for (let i = 0; i < bytes.length; i++) c = CRC_TABLE[(c ^ bytes[i]) & 0xFF] ^ (c >>> 8); return (c ^ 0xFFFFFFFF) >>> 0; }
function zip(files, date = new Date()) {
  const dosTime = ((date.getHours() << 11) | (date.getMinutes() << 5) | (date.getSeconds() >> 1)) & 0xFFFF;
  const dosDate = (((date.getFullYear() - 1980) << 9) | ((date.getMonth() + 1) << 5) | date.getDate()) & 0xFFFF;
  const chunks = [], central = [];
  let offset = 0;
  for (const [name, text] of files) {
    const nameB = enc.encode(name), data = enc.encode(text), crc = crc32(data);
    const lh = new DataView(new ArrayBuffer(30));
    lh.setUint32(0, 0x04034b50, true); lh.setUint16(4, 20, true); lh.setUint16(6, 0x0800, true); lh.setUint16(8, 0, true);
    lh.setUint16(10, dosTime, true); lh.setUint16(12, dosDate, true); lh.setUint32(14, crc, true);
    lh.setUint32(18, data.length, true); lh.setUint32(22, data.length, true); lh.setUint16(26, nameB.length, true); lh.setUint16(28, 0, true);
    chunks.push(new Uint8Array(lh.buffer), nameB, data);
    const ch = new DataView(new ArrayBuffer(46));
    ch.setUint32(0, 0x02014b50, true); ch.setUint16(4, 20, true); ch.setUint16(6, 20, true); ch.setUint16(8, 0x0800, true); ch.setUint16(10, 0, true);
    ch.setUint16(12, dosTime, true); ch.setUint16(14, dosDate, true); ch.setUint32(16, crc, true);
    ch.setUint32(20, data.length, true); ch.setUint32(24, data.length, true); ch.setUint16(28, nameB.length, true);
    ch.setUint16(30, 0, true); ch.setUint16(32, 0, true); ch.setUint16(34, 0, true); ch.setUint16(36, 0, true); ch.setUint32(38, 0, true); ch.setUint32(42, offset, true);
    central.push(new Uint8Array(ch.buffer), nameB);
    offset += 30 + nameB.length + data.length;
  }
  const centralSize = central.reduce((n, c) => n + c.length, 0);
  const end = new DataView(new ArrayBuffer(22));
  end.setUint32(0, 0x06054b50, true); end.setUint16(4, 0, true); end.setUint16(6, 0, true);
  end.setUint16(8, files.length, true); end.setUint16(10, files.length, true);
  end.setUint32(12, centralSize, true); end.setUint32(16, offset, true); end.setUint16(20, 0, true);
  const all = [...chunks, ...central, new Uint8Array(end.buffer)];
  const out = new Uint8Array(all.reduce((n, c) => n + c.length, 0));
  let p = 0; for (const c of all) { out.set(c, p); p += c.length; }
  return out;
}

export const DOCX_MIME = 'application/vnd.openxmlformats-officedocument.wordprocessingml.document';
export function buildDocxBytes(letter, opts = {}) {
  const now = opts.date || new Date();
  // [Content_Types].xml must be the first entry for strict readers.
  return zip([
    ['[Content_Types].xml', CONTENT_TYPES],
    ['_rels/.rels', ROOT_RELS],
    ['docProps/core.xml', coreXml(now.toISOString().replace(/\.\d+Z$/, 'Z'), letter.title)],
    ['word/document.xml', documentXml(letter, opts)],
    ['word/_rels/document.xml.rels', DOC_RELS],
    ['word/styles.xml', STYLES],
  ], now);
}
