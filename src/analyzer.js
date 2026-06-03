// ===== analyzer.js — Analyse & enrichissement des données =====

const CATEGORY_KEYWORDS = {
  'Alimentation': ['auchan','leclerc','carrefour','intermarché','lidl','aldi','monoprix','casino','franprix','picard','biocoop','naturalia','supermarché','superette'],
  'Restaurants & Cafés': ['mcdonalds','burger king','kfc','subway','kebab','sushi','restaurant','brasserie','bistrot','café','starbucks','paul '],
  'Transports': ['sncf','ratp','transdev','tgv','ouigo','blablacar','flixbus','uber','bolt','taxi','vtc','navigo','tcl','keolis','inoui'],
  'Carburant': ['totalenergies','total ','bp ','shell','esso','leclerc carburant','intermarché carburant','auchan carburant'],
  'Auto & Moto': ['assurance','matmut','axa','maif','macif','allianz','maaf','mma','aprr','asf','cofiroute','autoroute','péage','contrôle technique','amende','contravention'],
  'Logement': ['loyer','charges','edf','engie','veolia','eau ','electricité','gaz ','sfr','orange','bouygues','free ','fibre'],
  'Santé': ['pharmacie','médecin','dentiste','opticien','kiné','hôpital','clinique','laboratoire','mutuelle'],
  'Abonnements': ['netflix','spotify','disney','amazon prime','apple','google','youtube','deezer','canal','molotov','plex','github','ovh','online.net'],
  'Shopping': ['amazon','fnac','darty','boulanger','ikea','maisons du monde','zara','h&m','uniqlo','decathlon','nike','adidas','zalando','cdiscount'],
  'Loisirs & Culture': ['cinéma','ugc','pathé','mkp','théâtre','musée','concert','basic-fit','salle de sport'],
  'Voyages': ['booking','airbnb','expedia','corsair','easyjet','ryanair','air france','lufthansa','hôtel','hotel'],
  'Épargne': ['épargne','livret','assurance vie','pea','investissement'],
};

function autoCategory(tx) {
  if (tx.category && tx.category !== '') return tx;
  const label = (tx.label + ' ' + tx.rawLabel).toLowerCase();
  for (const [cat, keywords] of Object.entries(CATEGORY_KEYWORDS)) {
    if (keywords.some(k => label.includes(k))) {
      return { ...tx, category: cat, categoryParent: cat };
    }
  }
  return { ...tx, category: 'Non catégorisé', categoryParent: 'Non catégorisé' };
}

const ACC_COLORS = ['#4f98a3','#fdab43','#6daa45','#d163a7','#5591c7','#f97316','#a78bfa','#34d399'];

function round2(n) { return Math.round(n * 100) / 100; }

function fmtAmt(v) {
  return new Intl.NumberFormat('fr-FR', { style:'currency', currency:'EUR', maximumFractionDigits:0 }).format(v);
}

function analyzeTransactions(txs) {
  if (!txs.length) return null;
  const sorted = [...txs].sort((a,b) => a.date < b.date ? -1 : 1);
  const firstDate = sorted[0].date;
  const lastDate = sorted[sorted.length-1].date;
  const monthSet = new Set(sorted.map(t => t.date.slice(0,7)));
  const months = [...monthSet].sort();
  const accountNames = [...new Set(sorted.map(t => t.account))];

  const income = sorted.filter(t => t.amount > 0).reduce((s,t) => s+t.amount, 0);
  const expenses = sorted.filter(t => t.amount < 0).reduce((s,t) => s+Math.abs(t.amount), 0);

  const monthlyIncome = months.map(m => round2(sorted.filter(t => t.date.slice(0,7)===m && t.amount>0).reduce((s,t)=>s+t.amount,0)));
  const monthlyExpenses = months.map(m => round2(sorted.filter(t => t.date.slice(0,7)===m && t.amount<0).reduce((s,t)=>s+Math.abs(t.amount),0)));
  const monthlyBalance = months.map((_,i) => round2(monthlyIncome[i] - monthlyExpenses[i]));

  const monthlyByAccount = {};
  accountNames.forEach(acc => {
    monthlyByAccount[acc] = {
      income: months.map(m => round2(sorted.filter(t=>t.account===acc&&t.date.slice(0,7)===m&&t.amount>0).reduce((s,t)=>s+t.amount,0))),
      expenses: months.map(m => round2(sorted.filter(t=>t.account===acc&&t.date.slice(0,7)===m&&t.amount<0).reduce((s,t)=>s+Math.abs(t.amount),0))),
    };
  });

  const catMap = {};
  sorted.filter(t => t.amount < 0).forEach(t => {
    const c = t.categoryParent || t.category || 'Non catégorisé';
    catMap[c] = (catMap[c]||0) + Math.abs(t.amount);
  });
  const categories = Object.entries(catMap).map(([label,total]) => ({ label, total: round2(total) })).sort((a,b) => b.total-a.total);

  const catMonthly = {};
  categories.slice(0,8).forEach(c => {
    catMonthly[c.label] = months.map(m =>
      round2(sorted.filter(t=>t.date.slice(0,7)===m&&t.amount<0&&(t.categoryParent||t.category||'Non catégorisé')===c.label).reduce((s,t)=>s+Math.abs(t.amount),0))
    );
  });

  const labelMap = {};
  sorted.filter(t => t.amount < 0).forEach(t => {
    const k = (t.label||'').toLowerCase().trim();
    if (!k) return;
    if (!labelMap[k]) labelMap[k] = { label: t.label, months: new Set(), amounts: [], category: t.categoryParent||t.category||'' };
    labelMap[k].months.add(t.date.slice(0,7));
    labelMap[k].amounts.push(Math.abs(t.amount));
  });
  const subscriptions = Object.values(labelMap)
    .filter(s => s.months.size >= 2)
    .map(s => ({
      label: s.label,
      months: [...s.months].sort(),
      presence: months.map(m => s.months.has(m) ? 1 : 0),
      avg: round2(s.amounts.reduce((a,b)=>a+b,0)/s.amounts.length),
      total: round2(s.amounts.reduce((a,b)=>a+b,0)),
      category: s.category,
    }))
    .sort((a,b) => b.months.size - a.months.size || b.avg - a.avg)
    .slice(0, 20);

  const topExpenses = [...sorted].filter(t => t.amount < 0)
    .sort((a,b) => a.amount - b.amount).slice(0,20)
    .map(t => ({ ...t, absAmount: round2(Math.abs(t.amount)) }));

  const alerts = generateAlerts(sorted, months, monthlyExpenses, monthlyIncome, subscriptions, categories);

  return { txs: sorted, months, accountNames, firstDate, lastDate, income: round2(income), expenses: round2(expenses), balance: round2(income-expenses), monthlyIncome, monthlyExpenses, monthlyBalance, monthlyByAccount, categories, catMonthly, subscriptions, topExpenses, alerts };
}

function generateAlerts(txs, months, monthlyExp, monthlyInc, subscriptions, categories) {
  const alerts = [];
  const maxExpIdx = monthlyExp.indexOf(Math.max(...monthlyExp));
  if (maxExpIdx >= 0) alerts.push({ type:'warning', icon:'📈', title:`Pic de dépenses : ${fmtAmt(monthlyExp[maxExpIdx])} en ${months[maxExpIdx]}`, desc:'Mois avec les dépenses les plus élevées sur la période.' });

  const negMonths = months.filter((_,i) => monthlyInc[i] - monthlyExp[i] < -200);
  if (negMonths.length) alerts.push({ type:'danger', icon:'🔴', title:`${negMonths.length} mois déficitaire(s)`, desc: negMonths.join(', ') });

  const totalExp = categories.reduce((s,c)=>s+c.total,0);
  const topCat = categories[0];
  if (topCat && topCat.total/totalExp > 0.35) alerts.push({ type:'info', icon:'🏆', title:`${topCat.label} = ${Math.round(topCat.total/totalExp*100)}% des dépenses`, desc:`${fmtAmt(topCat.total)} sur la période. Poste dominant.` });

  const cash = txs.filter(t => /retrait|dab|atm/i.test(t.label) && t.amount < 0);
  if (cash.length > 3) {
    const total = cash.reduce((s,t)=>s+Math.abs(t.amount),0);
    alerts.push({ type:'neutral', icon:'💵', title:`${fmtAmt(total)} retirés en espèces (${cash.length} retraits)`, desc:'Cash non traçable. Difficile à analyser budgétairement.' });
  }

  const subTotal = subscriptions.filter(s=>s.presence[s.presence.length-1]===1||s.presence[s.presence.length-2]===1).reduce((s,sub)=>s+sub.avg,0);
  if (subTotal > 50) alerts.push({ type:'neutral', icon:'🔔', title:`${fmtAmt(subTotal)}/mois en abonnements actifs`, desc:`${subscriptions.length} prélèvements récurrents détectés.` });

  return alerts;
}
