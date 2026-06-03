// ===== charts.js — Wrappers Chart.js =====

const CHART_COLORS = ['#4f98a3','#6daa45','#fdab43','#d163a7','#5591c7','#f97316','#a78bfa','#34d399','#fb923c','#60a5fa'];
const chartRegistry = {};

function destroyChart(id) {
  if (chartRegistry[id]) { chartRegistry[id].destroy(); delete chartRegistry[id]; }
}
function destroyAll() {
  Object.keys(chartRegistry).forEach(id => { try { chartRegistry[id].destroy(); } catch(e){} delete chartRegistry[id]; });
}

function chartDefaults() {
  const dark = document.documentElement.getAttribute('data-theme') === 'dark';
  Chart.defaults.font.family = "'Inter', sans-serif";
  Chart.defaults.font.size = 11;
  Chart.defaults.color = dark ? '#797875' : '#6b6a66';
  Chart.defaults.borderColor = dark ? 'rgba(255,255,255,.08)' : 'rgba(0,0,0,.09)';
  Chart.defaults.plugins.legend.display = false;
  Chart.defaults.plugins.tooltip.backgroundColor = dark ? '#232220' : '#fff';
  Chart.defaults.plugins.tooltip.titleColor = dark ? '#d2d0cc' : '#1a1915';
  Chart.defaults.plugins.tooltip.bodyColor = dark ? '#797875' : '#6b6a66';
  Chart.defaults.plugins.tooltip.borderColor = dark ? 'rgba(255,255,255,.08)' : 'rgba(0,0,0,.09)';
  Chart.defaults.plugins.tooltip.borderWidth = 1;
  Chart.defaults.plugins.tooltip.padding = 10;
  Chart.defaults.plugins.tooltip.cornerRadius = 8;
}

function mkChart(id, config) {
  destroyChart(id);
  const el = document.getElementById(id);
  if (!el) return null;
  chartDefaults();
  chartRegistry[id] = new Chart(el, config);
  return chartRegistry[id];
}

const fmt = v => new Intl.NumberFormat('fr-FR',{style:'currency',currency:'EUR',maximumFractionDigits:0}).format(v);
const fmt2 = v => new Intl.NumberFormat('fr-FR',{style:'currency',currency:'EUR',minimumFractionDigits:2}).format(v);

function chartMonthly(id, labels, income, expenses) {
  return mkChart(id, {
    type:'bar',
    data:{ labels, datasets:[
      { label:'Revenus', data:income, backgroundColor:'rgba(79,152,163,.75)', borderColor:'#4f98a3', borderWidth:1, borderRadius:5 },
      { label:'Dépenses', data:expenses, backgroundColor:'rgba(209,99,167,.55)', borderColor:'#d163a7', borderWidth:1, borderRadius:5 },
    ]},
    options:{ responsive:true, maintainAspectRatio:false,
      plugins:{ legend:{ display:true, position:'top', labels:{ boxWidth:10, font:{size:10} }},
        tooltip:{ callbacks:{ label: ctx => ctx.dataset.label+': '+fmt(ctx.raw) }}},
      scales:{ x:{ grid:{ display:false }}, y:{ ticks:{ callback: v => fmt(v) }}}},
  });
}

function chartBalance(id, labels, balances) {
  const colors = balances.map(v => v >= 0 ? 'rgba(109,170,69,.8)' : 'rgba(209,99,167,.8)');
  return mkChart(id, {
    type:'bar',
    data:{ labels, datasets:[{ label:'Solde net', data:balances, backgroundColor:colors, borderRadius:5 }]},
    options:{ responsive:true, maintainAspectRatio:false,
      plugins:{ tooltip:{ callbacks:{ label: ctx => fmt(ctx.raw) }}},
      scales:{ x:{ grid:{ display:false }}, y:{ ticks:{ callback: v => fmt(v) }}}},
  });
}

function chartDonut(id, labels, values, legendEl) {
  const dark = document.documentElement.getAttribute('data-theme') === 'dark';
  const chart = mkChart(id, {
    type:'doughnut',
    data:{ labels, datasets:[{ data:values, backgroundColor:CHART_COLORS, borderWidth:2, borderColor: dark?'#111110':'#f5f4f0' }]},
    options:{ responsive:true, maintainAspectRatio:false, cutout:'60%',
      plugins:{ legend:{ display:false }, tooltip:{ callbacks:{ label: ctx => ctx.label+': '+fmt(ctx.raw) }}}},
  });
  if (legendEl) {
    const total = values.reduce((a,b)=>a+b,0);
    legendEl.innerHTML = labels.map((l,i) => {
      const pct = Math.round(values[i]/total*100);
      return `<div class="bl-item"><div class="bl-meta"><span style="font-size:.73rem;color:var(--tx);display:flex;align-items:center;gap:.3rem"><span style="width:8px;height:8px;border-radius:50%;background:${CHART_COLORS[i]};display:inline-block"></span>${l}</span><span style="font-size:.73rem;font-weight:700;color:var(--tx)">${pct}%</span></div></div>`;
    }).join('');
  }
  return chart;
}

function chartStacked(id, labels, datasets) {
  return mkChart(id, {
    type:'bar',
    data:{ labels, datasets: datasets.map((d,i) => ({ label:d.label, data:d.data, backgroundColor:CHART_COLORS[i%10], stack:'stack' }))},
    options:{ responsive:true, maintainAspectRatio:false,
      plugins:{ legend:{ display:true, position:'top', labels:{ boxWidth:10, font:{size:10} }},
        tooltip:{ mode:'index', callbacks:{ label: ctx => ctx.dataset.label+': '+fmt(ctx.raw) }}},
      scales:{ x:{ stacked:true, grid:{ display:false }}, y:{ stacked:true, ticks:{ callback: v => fmt(v) }}}},
  });
}

function chartLine(id, labels, datasets) {
  return mkChart(id, {
    type:'line',
    data:{ labels, datasets: datasets.map((d,i) => ({
      label:d.label, data:d.data, borderColor:d.color||CHART_COLORS[i],
      backgroundColor: d.fill ? (d.color||CHART_COLORS[i]).replace(')',',0.12)').replace('rgb','rgba') : 'transparent',
      tension:0.4, fill:!!d.fill, pointRadius:4, pointBackgroundColor:d.color||CHART_COLORS[i],
    }))},
    options:{ responsive:true, maintainAspectRatio:false,
      plugins:{ legend:{ display:datasets.length>1, position:'top', labels:{ boxWidth:10, font:{size:10} }},
        tooltip:{ callbacks:{ label: ctx => ctx.dataset.label+': '+fmt(ctx.raw) }}},
      scales:{ x:{ grid:{ display:false }}, y:{ ticks:{ callback: v => fmt(v) }}}},
  });
}

function renderBarList(el, items) {
  if (!el || !items.length) return;
  const max = items[0].value || 1;
  el.innerHTML = items.map((item,i) => {
    const pct = Math.round(item.value/max*100);
    return `<div class="bl-item"><div class="bl-meta"><span class="bl-name">${item.label}</span><span class="bl-amt">${fmt2(item.value)}</span></div><div class="bl-track"><div class="bl-fill" style="width:${pct}%;background:${CHART_COLORS[i%10]}"></div></div></div>`;
  }).join('');
}
