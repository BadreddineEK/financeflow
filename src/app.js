// ===== app.js — Orchestrateur principal FinanceFlow =====

let globalData = null;
let importedFiles = [];
const ACCOUNT_COLORS = ['#4f98a3','#fdab43','#6daa45','#d163a7','#5591c7','#f97316','#a78bfa','#34d399'];

// ===== INIT =====
document.addEventListener('DOMContentLoaded', () => {
  loadBudgetTargets();
  setupDropZone();
  setupNavigation();
  renderBankList();
  const savedTheme = localStorage.getItem('ff_theme') || 'dark';
  document.documentElement.setAttribute('data-theme', savedTheme);
});

// ===== BANK LIST =====
const SUPPORTED_BANKS = [
  { name:'BoursoBank', supported:true },
  { name:'LCL', supported:true },
  { name:'N26', supported:true },
  { name:'Revolut', supported:true },
  { name:'Société Générale', supported:true },
  { name:'Crédit Agricole', supported:false },
  { name:'BNP Paribas', supported:false },
  { name:'Fortuneo', supported:false },
];
function renderBankList() {
  const el = document.getElementById('banks-row');
  if (!el) return;
  el.innerHTML = SUPPORTED_BANKS.map(b =>
    `<span class="bank-chip ${b.supported?'supported':''}">${ b.supported?'✓':''} ${b.name}</span>`
  ).join('');
}

// ===== DROP ZONE =====
function setupDropZone() {
  const zone = document.getElementById('dropZone');
  const input = document.getElementById('fileInput');
  if (!zone || !input) return;
  zone.addEventListener('dragover', e => { e.preventDefault(); zone.classList.add('drag-over'); });
  zone.addEventListener('dragleave', () => zone.classList.remove('drag-over'));
  zone.addEventListener('drop', e => {
    e.preventDefault(); zone.classList.remove('drag-over');
    handleFiles([...e.dataTransfer.files]);
  });
  zone.addEventListener('click', e => { if (e.target !== input) input.click(); });
  input.addEventListener('change', () => handleFiles([...input.files]));
}

// ===== FILE HANDLING =====
function handleFiles(files) {
  files.filter(f => f.name.endsWith('.csv')).forEach(file => {
    const reader = new FileReader();
    reader.onload = e => {
      const result = importCSVFile(e.target.result, file.name);
      const existing = importedFiles.findIndex(f => f.fileName === result.fileName);
      if (existing >= 0) importedFiles[existing] = result;
      else importedFiles.push(result);
      renderFileList();
    };
    reader.readAsText(file, 'UTF-8');
  });
}

function renderFileList() {
  const el = document.getElementById('file-list');
  const actEl = document.getElementById('import-actions');
  if (!el) return;
  el.innerHTML = importedFiles.map((f, i) => `
    <div class="file-item">
      <div class="fi-name">
        <svg width="13" height="13" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24"><path d="M13 2H6a2 2 0 00-2 2v16a2 2 0 002 2h12a2 2 0 002-2V9z"/><polyline points="13 2 13 9 20 9"/></svg>
        ${f.fileName}
      </div>
      <span class="fi-bank" style="background:${f.bankColor}22;color:${f.bankColor}">${f.bankName}</span>
      <span class="fi-rows">${f.transactions.length} tx</span>
      <button class="fi-remove" onclick="removeFile(${i})">✕</button>
    </div>`).join('');
  if (actEl) actEl.style.display = importedFiles.length > 0 ? 'block' : 'none';
}

function removeFile(i) {
  importedFiles.splice(i, 1);
  renderFileList();
}

// ===== START ANALYSIS =====
function startAnalysis() {
  if (!importedFiles.length) return;
  const all = importedFiles.flatMap((f, fi) =>
    f.transactions.map(t => ({
      ...autoCategory(t),
      accountColor: ACCOUNT_COLORS[fi % ACCOUNT_COLORS.length],
    }))
  );
  globalData = analyzeTransactions(all);
  showDashboard();
}

// ===== DEMO DATA =====
function loadDemo() {
  const demoTxs = generateDemoData();
  globalData = analyzeTransactions(demoTxs.map(autoCategory));
  showDashboard();
}

function generateDemoData() {
  const txs = [];
  const now = new Date();
  const months = 12;
  const accounts = ['Compte Courant', 'Livret A'];
  const templates = [
    { label:'E.Leclerc', cat:'Alimentation', parent:'Vie quotidienne', avg:-85, sd:20 },
    { label:'Auchan', cat:'Alimentation', parent:'Vie quotidienne', avg:-70, sd:25 },
    { label:'Netflix', cat:'Abonnements', parent:'Abonnements & téléphonie', avg:-13.99, sd:0 },
    { label:'Spotify', cat:'Abonnements', parent:'Abonnements & téléphonie', avg:-9.99, sd:0 },
    { label:'Apple', cat:'Abonnements', parent:'Abonnements & téléphonie', avg:-9.99, sd:0 },
    { label:'TotalEnergies', cat:'Carburant', parent:'Auto & Moto', avg:-80, sd:30 },
    { label:'Salaire', cat:'Revenus', parent:'Virements reçus', avg:2400, sd:100 },
    { label:'Loyer', cat:'Logement', parent:'Logement', avg:-850, sd:0 },
    { label:'Restaurant', cat:'Restaurants', parent:'Loisirs et sorties', avg:-45, sd:20 },
    { label:'SNCF', cat:'Transports', parent:'Voyages & Transports', avg:-35, sd:40 },
    { label:'Pharmacie', cat:'Santé', parent:'Santé', avg:-25, sd:15 },
    { label:'Amazon', cat:'Shopping', parent:'Vie quotidienne', avg:-65, sd:50 },
  ];
  for (let m = months - 1; m >= 0; m--) {
    const d = new Date(now.getFullYear(), now.getMonth() - m, 1);
    templates.forEach(c => {
      const times = c.sd === 0 ? 1 : Math.floor(Math.random() * 2) + 1;
      for (let t = 0; t < times; t++) {
        const amount = c.avg + (Math.random() - 0.5) * c.sd;
        txs.push({
          date: new Date(d.getFullYear(), d.getMonth(), Math.floor(Math.random() * 26) + 1).toISOString().slice(0, 10),
          label: c.label, rawLabel: c.label,
          category: c.cat, categoryParent: c.parent,
          amount: Math.round(amount * 100) / 100,
          account: c.label === 'Salaire' ? 'Compte Courant' : accounts[Math.random() < 0.8 ? 0 : 1],
          balance: 0, source: 'demo',
        });
      }
    });
  }
  return txs;
}

// ===== SHOW DASHBOARD =====
function showDashboard() {
  if (!globalData) return;
  document.getElementById('import-screen').style.display = 'none';
  document.getElementById('dashboard').style.display = 'grid';
  const el = document.getElementById('logo-period');
  if (el) el.textContent = `${globalData.firstDate} → ${globalData.lastDate}`;
  renderAccountChips();
  navigateTo('overview');
}

// ===== ACCOUNT CHIPS =====
function renderAccountChips() {
  const el = document.getElementById('account-chips');
  if (!el || !globalData) return;
  el.innerHTML = globalData.accountNames.map((acc, i) => {
    const color = ACCOUNT_COLORS[i % ACCOUNT_COLORS.length];
    const txCount = globalData.txs.filter(t => t.account === acc).length;
    return `<div class="account-chip" title="${acc}">
      <span class="ac-dot" style="background:${color}"></span>
      <span class="ac-name">${acc}</span>
      <span style="font-size:.65rem;color:var(--txf)">${txCount}</span>
    </div>`;
  }).join('');
}

// ===== NAVIGATION =====
let currentPage = 'overview';

function setupNavigation() {
  document.querySelectorAll('.nav-item[data-page]').forEach(btn => {
    btn.addEventListener('click', () => navigateTo(btn.dataset.page));
  });
}

function navigateTo(page) {
  if (!PAGES[page] || !globalData) return;
  currentPage = page;
  document.querySelectorAll('.nav-item[data-page]').forEach(btn => {
    btn.classList.toggle('active', btn.dataset.page === page);
  });
  destroyAll();
  PAGES[page](globalData);
}

function goImport() {
  document.getElementById('dashboard').style.display = 'none';
  document.getElementById('import-screen').style.display = 'flex';
}

// ===== THEME =====
function toggleTheme() {
  const current = document.documentElement.getAttribute('data-theme');
  const next = current === 'dark' ? 'light' : 'dark';
  document.documentElement.setAttribute('data-theme', next);
  localStorage.setItem('ff_theme', next);
  if (globalData) { destroyAll(); PAGES[currentPage](globalData); }
}
