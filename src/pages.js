// ===== pages.js — Rendu de chaque page =====

const PAGES = { overview: renderOverview, transactions: renderTransactions, categories: renderCategories, subscriptions: renderSubscriptions, budget: renderBudget, accounts: renderAccounts };
let budgetTargets = {};
let allTxs = [];

// ===== OVERVIEW =====
function renderOverview(data) {
  const { months, monthlyIncome, monthlyExpenses, monthlyBalance, categories, catMonthly, income, expenses, balance, alerts, accountNames, txs } = data;
  const fmtM = m => new Date(m+'-01').toLocaleDateString('fr-FR',{month:'short',year:'2-digit'});
  const labels = months.map(fmtM);
  document.getElementById('main-content').innerHTML = `
  <div class="page-header">
    <div><div class="ptitle">Tableau de <span>bord</span></div>
    <div class="psub">${months[0]} → ${months[months.length-1]} · ${txs.length} transactions · ${accountNames.length} compte(s)</div></div>
  </div>
  <div class="kpis kpis-4">
    <div class="kpi"><div class="kpi-lbl">💰 Revenus totaux</div><div class="kpi-val pos">${fmt(income)}</div><div class="kpi-sub">${months.length} mois</div></div>
    <div class="kpi"><div class="kpi-lbl">💸 Dépenses totales</div><div class="kpi-val neg">${fmt(expenses)}</div><div class="kpi-sub">Hors mouvements internes</div></div>
    <div class="kpi"><div class="kpi-lbl">⚖️ Solde net</div><div class="kpi-val ${balance>=0?'pos':'neg'}">${fmt(balance)}</div><div class="kpi-sub">Revenus – Dépenses</div></div>
    <div class="kpi"><div class="kpi-lbl">📅 Mois analysés</div><div class="kpi-val">${months.length}</div><div class="kpi-sub">${data.firstDate} → ${data.lastDate}</div></div>
  </div>
  ${alerts.length ? `<div class="stitle" style="margin-bottom:.625rem">⚡ Points d'attention <span class="badge">${alerts.length}</span></div><div style="display:grid;grid-template-columns:repeat(auto-fill,minmax(260px,1fr));gap:.625rem;margin-bottom:1.25rem" id="alerts-grid"></div>` : ''}
  <div class="g2">
    <div class="card"><div class="stitle">📊 Revenus vs Dépenses</div><div class="cw cw-md"><canvas id="cMonthly"></canvas></div></div>
    <div class="card"><div class="stitle">📈 Solde mensuel net</div><div class="cw cw-md"><canvas id="cBalance"></canvas></div></div>
  </div>
  <div class="g2">
    <div class="card"><div class="stitle">🗂️ Répartition dépenses</div>
      <div style="display:grid;grid-template-columns:1fr 1fr;gap:1rem;align-items:center">
        <div class="cw cw-sm"><canvas id="cPie"></canvas></div>
        <div id="pie-leg" class="bl-list" style="gap:.35rem"></div>
      </div>
    </div>
    <div class="card"><div class="stitle">📅 Évolution mensuelle (top catégories)</div><div class="cw cw-md"><canvas id="cStack"></canvas></div></div>
  </div>`;

  const ag = document.getElementById('alerts-grid');
  if (ag) alerts.forEach(a => {
    const d = document.createElement('div');
    d.className = `alert ${a.type||'neutral'}`;
    d.innerHTML = `<div class="alert-ic">${a.icon}</div><div><div class="alert-t">${a.title}</div><div class="alert-d">${a.desc}</div></div>`;
    ag.appendChild(d);
  });

  chartMonthly('cMonthly', labels, monthlyIncome, monthlyExpenses);
  chartBalance('cBalance', labels, monthlyBalance);
  chartDonut('cPie', categories.slice(0,8).map(c=>c.label), categories.slice(0,8).map(c=>c.total), document.getElementById('pie-leg'));
  chartStacked('cStack', labels, Object.entries(catMonthly).map(([label,data]) => ({ label, data })));
  animateBars();
}

// ===== TRANSACTIONS =====
function renderTransactions(data) {
  allTxs = data.txs;
  const cats = [...new Set(data.txs.map(t => t.categoryParent||t.category||'Non catégorisé'))].sort();
  const accs = [...new Set(data.txs.map(t => t.account))].sort();
  const fmtM = m => new Date(m+'-01').toLocaleDateString('fr-FR',{month:'long',year:'numeric'});
  document.getElementById('main-content').innerHTML = `
  <div class="page-header"><div><div class="ptitle">Transactions</div><div class="psub">${data.txs.length} opérations</div></div></div>
  <div class="card">
    <div style="display:flex;gap:.625rem;flex-wrap:wrap;margin-bottom:.875rem">
      <div class="sbar-inp" style="flex:1;min-width:160px"><svg width="13" height="13" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24"><circle cx="11" cy="11" r="8"/><path d="m21 21-4.35-4.35"/></svg><input id="txq" placeholder="Rechercher…" oninput="filterTx()"></div>
      <select id="txcat" class="fsel" onchange="filterTx()"><option value="">Toutes catégories</option>${cats.map(c=>`<option value="${c}">${c}</option>`).join('')}</select>
      <select id="txmo" class="fsel" onchange="filterTx()"><option value="">Tous les mois</option>${data.months.map(m=>`<option value="${m}">${fmtM(m)}</option>`).join('')}</select>
      <select id="txacc" class="fsel" onchange="filterTx()"><option value="">Tous les comptes</option>${accs.map(a=>`<option value="${a}">${a}</option>`).join('')}</select>
      <select id="txdir" class="fsel" onchange="filterTx()"><option value="">Toutes</option><option value="debit">Dépenses</option><option value="credit">Revenus</option></select>
    </div>
    <div class="tbl-wrap"><table><thead><tr><th>Date</th><th>Libellé</th><th>Catégorie</th><th>Compte</th><th style="text-align:right">Montant</th></tr></thead><tbody id="tx-tbody"></tbody></table></div>
    <div style="font-size:.7rem;color:var(--txf);margin-top:.625rem;display:flex;justify-content:space-between"><span id="tx-count"></span><span id="tx-sum"></span></div>
  </div>`;
  filterTx();
}

function filterTx() {
  const q = (document.getElementById('txq')?.value||'').toLowerCase();
  const cat = document.getElementById('txcat')?.value||'';
  const mo = document.getElementById('txmo')?.value||'';
  const acc = document.getElementById('txacc')?.value||'';
  const dir = document.getElementById('txdir')?.value||'';
  const rows = allTxs.filter(t => {
    if (q && !(t.label||'').toLowerCase().includes(q)) return false;
    if (cat && (t.categoryParent||t.category||'Non catégorisé') !== cat) return false;
    if (mo && t.date.slice(0,7) !== mo) return false;
    if (acc && t.account !== acc) return false;
    if (dir==='debit' && t.amount >= 0) return false;
    if (dir==='credit' && t.amount <= 0) return false;
    return true;
  });
  const accs = [...new Set(allTxs.map(t=>t.account))];
  const tbody = document.getElementById('tx-tbody');
  if (!tbody) return;
  tbody.innerHTML = rows.slice(0,300).map(t => {
    const cls = t.amount >= 0 ? 'ap' : 'an';
    const color = CHART_COLORS[accs.indexOf(t.account)%10];
    return `<tr><td>${t.date}</td><td>${t.label||'–'}</td><td><span class="cbadge">${t.categoryParent||t.category||'–'}</span></td><td><span class="sbadge" style="background:${color}22;color:${color}">${t.account}</span></td><td class="${cls}" style="text-align:right">${fmt2(Math.abs(t.amount))} ${t.amount>=0?'↑':'↓'}</td></tr>`;
  }).join('');
  const sum = rows.reduce((s,t)=>s+t.amount,0);
  document.getElementById('tx-count').textContent = rows.length+' opération(s)'+(rows.length>300?' — 300 premières affichées':'');
  document.getElementById('tx-sum').textContent = 'Total : '+fmt2(sum);
}

// ===== CATEGORIES =====
function renderCategories(data) {
  const { months, categories, catMonthly } = data;
  const fmtM = m => new Date(m+'-01').toLocaleDateString('fr-FR',{month:'short',year:'2-digit'});
  document.getElementById('main-content').innerHTML = `
  <div class="page-header"><div><div class="ptitle">Catégories</div><div class="psub">Répartition des dépenses sur ${months.length} mois</div></div></div>
  <div class="g2">
    <div class="card"><div class="stitle">🏆 Top catégories</div><div id="cat-bars" class="bl-list"></div></div>
    <div class="card"><div class="stitle">📅 Évolution mensuelle</div><div class="cw cw-xl"><canvas id="cStack2"></canvas></div></div>
  </div>
  <div class="card"><div class="stitle">🍕 Donut dépenses</div><div class="cw cw-lg"><canvas id="cPie2"></canvas></div></div>`;
  renderBarList(document.getElementById('cat-bars'), categories.slice(0,12).map(c=>({label:c.label,value:c.total})));
  mkChart('cPie2', { type:'doughnut', data:{ labels:categories.slice(0,10).map(c=>c.label), datasets:[{ data:categories.slice(0,10).map(c=>c.total), backgroundColor:CHART_COLORS, borderWidth:2 }]}, options:{ responsive:true, maintainAspectRatio:false, cutout:'50%', plugins:{ legend:{ display:true, position:'right', labels:{boxWidth:10,font:{size:10}}}, tooltip:{ callbacks:{ label: ctx => ctx.label+': '+fmt(ctx.raw) }}}}});
  chartStacked('cStack2', months.map(fmtM), Object.entries(catMonthly).map(([label,d])=>({label,data:d})));
  animateBars();
}

// ===== SUBSCRIPTIONS =====
function renderSubscriptions(data) {
  const { months, subscriptions } = data;
  const fmtM = m => new Date(m+'-01').toLocaleDateString('fr-FR',{month:'short',year:'2-digit'});
  const active = subscriptions.filter(s => s.presence[s.presence.length-1]===1||s.presence[s.presence.length-2]===1);
  const totalActive = active.reduce((s,sub)=>s+sub.avg,0);
  document.getElementById('main-content').innerHTML = `
  <div class="page-header"><div><div class="ptitle">Abonnements</div><div class="psub">${subscriptions.length} prélèvements récurrents détectés</div></div></div>
  <div class="g2">
    <div class="card"><div class="stitle">🔔 Abonnements détectés <span class="badge-wa badge">~${fmt2(totalActive)}/mois actifs</span></div><div id="sub-list"></div></div>
    <div class="card"><div class="stitle">📅 Présence par mois</div>
      <div style="overflow-x:auto">
        <div style="display:flex;padding-left:140px;gap:.15rem;margin-bottom:.25rem">${months.map(m=>`<div style="flex:1;text-align:center;font-size:.6rem;color:var(--txf);white-space:nowrap;overflow:hidden">${fmtM(m)}</div>`).join('')}</div>
        <div id="tl-rows"></div>
      </div>
    </div>
  </div>
  <div class="card"><div class="stitle">📈 Coût mensuel des abonnements</div><div class="cw cw-md"><canvas id="cSubCost"></canvas></div></div>`;

  const list = document.getElementById('sub-list');
  subscriptions.forEach((s,i) => {
    const isActive = s.presence[s.presence.length-1]===1||s.presence[s.presence.length-2]===1;
    list.innerHTML += `<div style="display:flex;align-items:center;justify-content:space-between;padding:.5rem .65rem;background:var(--sur2);border:1px solid var(--brd);border-radius:.45rem;margin-bottom:.3rem;${!isActive?'opacity:.5':''}">
      <div><div style="font-size:.82rem;font-weight:500;color:var(--tx);display:flex;align-items:center;gap:.4rem">
        <span style="width:8px;height:8px;border-radius:50%;background:${CHART_COLORS[i%10]};display:inline-block"></span>${s.label}
        <span style="font-size:.6rem;padding:.1rem .38rem;border-radius:9999px;background:${isActive?'var(--okl)':'var(--erl)'};color:${isActive?'var(--ok)':'var(--er)'}">${isActive?'Actif':'Stoppé'}</span>
      </div><div style="font-size:.68rem;color:var(--txm)">${s.months.length}× · ${s.category||'–'}</div></div>
      <div style="font-size:.82rem;font-weight:700;color:var(--tx)">${fmt2(s.avg)}/mois</div>
    </div>`;
  });

  const tlRows = document.getElementById('tl-rows');
  subscriptions.slice(0,15).forEach((s,i) => {
    tlRows.innerHTML += `<div class="sub-timeline">
      <div style="font-size:.72rem;color:var(--txm);overflow:hidden;text-overflow:ellipsis;white-space:nowrap">${s.label}</div>
      <div class="tl-cells">${s.presence.map((v,mi)=>v?`<div class="tl-cell on" style="background:${CHART_COLORS[i%10]};opacity:.85">✓</div>`:`<div class="tl-cell off">·</div>`).join('')}</div>
    </div>`;
  });

  const costPerMonth = months.map((m,mi) => subscriptions.filter(s=>s.presence[mi]===1).reduce((sum,s)=>sum+s.avg,0));
  chartLine('cSubCost', months.map(fmtM), [{ label:'Coût abos/mois', data:costPerMonth.map(v=>Math.round(v*100)/100), color:'#7a5af8', fill:true }]);
}

// ===== BUDGET =====
function renderBudget(data) {
  const { categories, months } = data;
  const avgMonths = months.length || 1;
  document.getElementById('main-content').innerHTML = `
  <div class="page-header">
    <div><div class="ptitle">Budget & Objectifs</div><div class="psub">Définissez vos plafonds mensuels par catégorie</div></div>
    <button class="btn-ghost" onclick="saveBudgetTargets()">💾 Sauvegarder</button>
  </div>
  <div class="card">
    <div class="stitle">🎯 Budgets mensuels</div>
    <div style="display:grid;grid-template-columns:200px 1fr 100px 110px 80px;gap:.75rem;padding:.35rem 0;border-bottom:1px solid var(--brd);margin-bottom:.5rem">
      <div style="font-size:.65rem;text-transform:uppercase;letter-spacing:.07em;color:var(--txf)">Catégorie</div>
      <div style="font-size:.65rem;text-transform:uppercase;letter-spacing:.07em;color:var(--txf)">Progression moy.</div>
      <div style="font-size:.65rem;text-transform:uppercase;letter-spacing:.07em;color:var(--txf);text-align:right">Moy/mois</div>
      <div style="font-size:.65rem;text-transform:uppercase;letter-spacing:.07em;color:var(--txf)">Budget cible</div>
      <div style="font-size:.65rem;text-transform:uppercase;letter-spacing:.07em;color:var(--txf);text-align:right">Statut</div>
    </div>
    <div id="budget-rows"></div>
  </div>`;
  const rows = document.getElementById('budget-rows');
  categories.slice(0,12).forEach(c => {
    const avg = Math.round(c.total / avgMonths * 100) / 100;
    const target = budgetTargets[c.label] || Math.round(avg * 1.1);
    const pct = Math.min(Math.round(avg/target*100),150);
    const cls = pct>110?'over-budget':pct>90?'near-budget':'on-budget';
    const txt = pct>110?'⚠️ Dépassé':pct>90?'🔶 Limite':'✅ OK';
    rows.innerHTML += `<div style="display:grid;grid-template-columns:200px 1fr 100px 110px 80px;gap:.75rem;align-items:center;padding:.55rem 0;border-bottom:1px solid var(--brd)">
      <div style="font-size:.8rem;color:var(--tx);font-weight:500">${c.label}</div>
      <div><div class="bl-track"><div class="bl-fill" style="width:${Math.min(pct,100)}%;background:${pct>110?'var(--er)':pct>90?'var(--wa)':'var(--ok)'}"></div></div><div style="font-size:.65rem;color:var(--txm);margin-top:.15rem">${pct}%</div></div>
      <div style="font-size:.8rem;font-weight:600;text-align:right">${fmt2(avg)}</div>
      <div><input class="budget-inp" type="number" id="budget-${c.label.replace(/\s/g,'_')}" value="${Math.round(target)}" step="10" min="0" onchange="updateBudgetRow('${c.label}')"></div>
      <div class="budget-pct ${cls}" style="text-align:right;font-size:.75rem">${txt}</div>
    </div>`;
  });
  animateBars();
}

function updateBudgetRow(label) {
  const id = 'budget-'+label.replace(/\s/g,'_');
  budgetTargets[label] = parseFloat(document.getElementById(id)?.value||0);
}
function saveBudgetTargets() {
  try { localStorage.setItem('ff_budget', JSON.stringify(budgetTargets)); } catch(e){}
  const btn = document.querySelector('[onclick="saveBudgetTargets()"]');
  if(btn){ btn.textContent='✅ Sauvegardé'; setTimeout(()=>btn.textContent='💾 Sauvegarder',1500); }
}
function loadBudgetTargets() {
  try { const v = localStorage.getItem('ff_budget'); if(v) budgetTargets = JSON.parse(v); } catch(e){}
}

// ===== ACCOUNTS =====
function renderAccounts(data) {
  const { accountNames, monthlyByAccount, months, txs } = data;
  const fmtM = m => new Date(m+'-01').toLocaleDateString('fr-FR',{month:'short',year:'2-digit'});
  let html = `<div class="page-header"><div><div class="ptitle">Comptes</div><div class="psub">${accountNames.length} compte(s) importé(s)</div></div></div>`;
  accountNames.forEach((acc,i) => {
    const accTxs = txs.filter(t=>t.account===acc);
    const accInc = accTxs.filter(t=>t.amount>0).reduce((s,t)=>s+t.amount,0);
    const accExp = accTxs.filter(t=>t.amount<0).reduce((s,t)=>s+Math.abs(t.amount),0);
    const color = CHART_COLORS[i%10];
    html += `<div class="card"><div class="stitle" style="color:${color}">🏦 ${acc}</div>
      <div class="kpis kpis-3" style="margin-bottom:.875rem">
        <div class="kpi"><div class="kpi-lbl">Revenus</div><div class="kpi-val pos">${fmt(accInc)}</div></div>
        <div class="kpi"><div class="kpi-lbl">Dépenses</div><div class="kpi-val neg">${fmt(accExp)}</div></div>
        <div class="kpi"><div class="kpi-lbl">Transactions</div><div class="kpi-val">${accTxs.length}</div></div>
      </div><div class="cw cw-md"><canvas id="cAcc${i}"></canvas></div></div>`;
  });
  document.getElementById('main-content').innerHTML = html;
  accountNames.forEach((acc,i) => {
    const byAcc = monthlyByAccount[acc];
    if (byAcc) chartMonthly('cAcc'+i, months.map(fmtM), byAcc.income, byAcc.expenses);
  });
}

function animateBars() {
  setTimeout(() => {
    document.querySelectorAll('.bl-fill').forEach(b => {
      const w = b.style.width; b.style.width='0';
      requestAnimationFrame(() => { b.style.width = w; });
    });
  }, 80);
}
