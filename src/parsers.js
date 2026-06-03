// ===== parsers.js — Détection & parsing multi-banque =====

const BANK_CONFIGS = {
  boursobank: {
    name: 'BoursoBank',
    color: '#01696f',
    detect: (headers) => headers.some(h => /dateOp|suggestedLabel|accountLabel/i.test(h)),
    parse: parseBoursoBankCSV,
  },
  lcl: {
    name: 'LCL',
    color: '#e30613',
    detect: (headers) => headers.some(h => /Op\u00e9ration|D\u00e9bit|Cr\u00e9dit/i.test(h)) && headers.some(h => /Date/i.test(h)),
    parse: parseLCLCSV,
  },
  n26: {
    name: 'N26',
    color: '#333333',
    detect: (headers) => headers.some(h => /Payee|Transaction type/i.test(h)),
    parse: parseN26CSV,
  },
  revolut: {
    name: 'Revolut',
    color: '#0075eb',
    detect: (headers) => headers.some(h => /Completed Date|Description|Paid Out/i.test(h)),
    parse: parseRevolutCSV,
  },
  sg: {
    name: 'Soci\u00e9t\u00e9 G\u00e9n\u00e9rale',
    color: '#e2001a',
    detect: (headers) => headers.some(h => /libell\u00e9|Montant/i.test(h)) && headers.some(h => /REFERENCE/i.test(h)),
    parse: parseSGCSV,
  },
  generic: {
    name: 'CSV Standard',
    color: '#6b6a66',
    detect: () => true,
    parse: parseGenericCSV,
  },
};

function parseAmount(val) {
  if (val === null || val === undefined || val === '') return 0;
  return parseFloat(String(val).replace(/\s/g,'').replace(/\u00a0/g,'').replace(',','.')) || 0;
}

function parseDate(str) {
  if (!str) return null;
  str = String(str).trim();
  if (/^\d{2}\/\d{2}\/\d{4}$/.test(str)) {
    const [d,m,y] = str.split('/');
    return `${y}-${m}-${d}`;
  }
  if (/^\d{4}-\d{2}-\d{2}/.test(str)) return str.slice(0,10);
  if (/^\d{2}-\d{2}-\d{4}$/.test(str)) {
    const [d,m,y] = str.split('-');
    return `${y}-${m}-${d}`;
  }
  return null;
}

function parseCSVRaw(text) {
  const lines = text.trim().split(/\r?\n/);
  const firstLine = lines[0];
  const sep = (firstLine.split(';').length > firstLine.split(',').length) ? ';' : ',';
  const headers = firstLine.split(sep).map(h => h.replace(/^"|"$/g,'').trim());
  const rows = [];
  for (let i = 1; i < lines.length; i++) {
    if (!lines[i].trim()) continue;
    const vals = lines[i].split(sep).map(v => v.replace(/^"|"$/g,'').trim());
    const row = {};
    headers.forEach((h,j) => { row[h] = vals[j] || ''; });
    rows.push(row);
  }
  return { headers, rows, sep };
}

function detectBank(headers) {
  for (const [key, cfg] of Object.entries(BANK_CONFIGS)) {
    if (key !== 'generic' && cfg.detect(headers)) return key;
  }
  return 'generic';
}

function parseBoursoBankCSV(text, fileName) {
  const { rows } = parseCSVRaw(text);
  return rows.map(r => ({
    date: parseDate(r.dateOp || r.dateVal),
    label: r.suggestedLabel || r.label || '',
    rawLabel: r.label || '',
    category: r.category || '',
    categoryParent: r.categoryParent || '',
    amount: parseAmount(r.amount),
    account: r.accountLabel || fileName,
    balance: parseAmount(r.accountbalance),
    source: 'boursobank',
  })).filter(t => t.date);
}

function parseLCLCSV(text, fileName) {
  const { rows, headers } = parseCSVRaw(text);
  const labelKey = headers.find(h => /libell\u00e9|Op\u00e9ration/i.test(h)) || headers[2];
  const dateKey = headers.find(h => /date/i.test(h)) || headers[0];
  const debitKey = headers.find(h => /d\u00e9bit/i.test(h)) || headers[3];
  const creditKey = headers.find(h => /cr\u00e9dit/i.test(h)) || headers[4];
  return rows.map(r => {
    const debit = parseAmount(r[debitKey]);
    const credit = parseAmount(r[creditKey]);
    const amount = credit > 0 ? credit : -Math.abs(debit);
    return { date: parseDate(r[dateKey]), label: r[labelKey]||'', rawLabel: r[labelKey]||'', category:'', categoryParent:'', amount, account: fileName, balance:0, source:'lcl' };
  }).filter(t => t.date && t.amount !== 0);
}

function parseN26CSV(text, fileName) {
  const { rows } = parseCSVRaw(text);
  return rows.map(r => ({
    date: parseDate(r['Date'] || r['Booking Date']),
    label: r['Payee'] || r['Partner Name'] || r['Transaction type'] || '',
    rawLabel: r['Reference'] || '',
    category: r['Category'] || r['Transaction type'] || '',
    categoryParent: r['Category'] || '',
    amount: parseAmount(r['Amount (EUR)'] || r['Amount']),
    account: fileName, balance: parseAmount(r['Balance (EUR)']||''), source: 'n26',
  })).filter(t => t.date);
}

function parseRevolutCSV(text, fileName) {
  const { rows, headers } = parseCSVRaw(text);
  const dateKey = headers.find(h => /date/i.test(h)) || headers[0];
  const descKey = headers.find(h => /description/i.test(h)) || headers[2];
  const paidOutKey = headers.find(h => /paid out/i.test(h)) || headers[3];
  const paidInKey = headers.find(h => /paid in/i.test(h)) || headers[4];
  return rows.map(r => {
    const out = parseAmount(r[paidOutKey]);
    const inc = parseAmount(r[paidInKey]);
    const amount = inc > 0 ? inc : -Math.abs(out);
    return { date: parseDate(r[dateKey]?.slice(0,10)), label: r[descKey]||'', rawLabel: r[descKey]||'', category: r['Type']||'', categoryParent: r['Type']||'', amount, account: fileName, balance: parseAmount(r['Balance']||''), source: 'revolut' };
  }).filter(t => t.date && t.amount !== 0);
}

function parseSGCSV(text, fileName) {
  const { rows, headers } = parseCSVRaw(text);
  const dateKey = headers.find(h => /date/i.test(h)) || headers[0];
  const labelKey = headers.find(h => /libell\u00e9/i.test(h)) || headers[1];
  const amtKey = headers.find(h => /montant/i.test(h)) || headers[2];
  return rows.map(r => ({
    date: parseDate(r[dateKey]), label: r[labelKey]||'', rawLabel: r[labelKey]||'',
    category:'', categoryParent:'', amount: parseAmount(r[amtKey]), account: fileName, balance:0, source:'sg',
  })).filter(t => t.date && t.amount !== 0);
}

function parseGenericCSV(text, fileName) {
  const { rows, headers } = parseCSVRaw(text);
  const dateKey = headers.find(h => /date/i.test(h)) || headers[0];
  const labelKey = headers.find(h => /label|libell\u00e9|description|intitul\u00e9|wording/i.test(h)) || headers[1];
  const amtKey = headers.find(h => /amount|montant/i.test(h)) || headers[headers.length-1];
  return rows.map(r => ({
    date: parseDate(r[dateKey]), label: r[labelKey]||'', rawLabel: r[labelKey]||'',
    category:'', categoryParent:'', amount: parseAmount(r[amtKey]), account: fileName, balance:0, source:'generic',
  })).filter(t => t.date && t.amount !== 0);
}

function importCSVFile(text, fileName) {
  const bom = text.charCodeAt(0) === 0xFEFF ? text.slice(1) : text;
  const { headers } = parseCSVRaw(bom);
  const bankKey = detectBank(headers);
  const cfg = BANK_CONFIGS[bankKey];
  const transactions = cfg.parse(bom, fileName.replace(/\.csv$/i,''));
  return { bankKey, bankName: cfg.name, bankColor: cfg.color, transactions, fileName: fileName.replace(/\.csv$/i,'') };
}
