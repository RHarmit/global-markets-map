// ============================================================
// Global Markets — Live Interactive Performance Map
// ============================================================

const API = "__PORT_8000__".startsWith("__") ? "http://localhost:8000" : "__PORT_8000__";

// ISO alpha-3 to numeric ID mapping for TopoJSON
const ISO_TO_NUMERIC = {
  USA:840, GBR:826, JPN:392, DEU:276, FRA:250, CHN:156,
  HKG:344, IND:356, AUS:36, KOR:410, CAN:124, ESP:724,
  ITA:380, NLD:528, CHE:756, BRA:76, MEX:484, RUS:643,
  TWN:158, IDN:360, MYS:458, EGY:818, TUR:792, POL:616,
  SWE:752, FIN:246, DNK:208, BEL:56, AUT:40, NZL:554,
  ISR:376, SGP:702
};

// ── State ────────────────────────────────────────────────────
let MARKET_DATA = null;
let dataByNumericId = {};
let absMax = 1;
let projection, pathGen, svg, countriesGroup, bordersPath, spherePath;
let currentRotation = [0, -15, 0];
let isDragging = false;
let dragStart = null;
let rotateStart = null;
let currentZoom = 1;
let worldData = null;
let countriesGeo = null;
let refreshTimer = null;

// ── Fallback data (embedded from initial fetch) ──────────────
const FALLBACK_DATA = {"lastUpdated":"2026-03-13T18:12:45Z","countries":[{"country":"United States","code":"USA","index":"S&P 500","price":6640.77,"change":-31.85,"changePercent":-0.48,"yearLow":4835.04,"yearHigh":7002.28,"flag":"🇺🇸","goodReasons":["Tax cuts & deregulation boosting corporate earnings and business investment","AI infrastructure buildout driving massive capex across tech sector","Strong consumer spending and resilient labor market supporting GDP growth"],"badReasons":["Middle East conflict escalation raising oil prices and inflation fears","AI disruption concerns causing tech sector rotation and valuation reassessment","Trade tariff uncertainties creating supply chain and cost headwinds"]},{"country":"United Kingdom","code":"GBR","index":"FTSE 100","price":10261.15,"change":-44,"changePercent":-0.43,"yearLow":7544.83,"yearHigh":10934.94,"flag":"🇬🇧","goodReasons":["Energy sector gains from rising oil prices benefiting BP and Shell","Defence spending increases boosting aerospace and military stocks","Below-target inflation allowing accommodative monetary policy"],"badReasons":["Geopolitical uncertainty from Middle East conflict dampening sentiment","Rising energy costs squeezing consumer discretionary spending","Weak economic growth outlook and housing market softness"]},{"country":"Japan","code":"JPN","index":"Nikkei 225","price":53819.61,"change":-633.35,"changePercent":-1.16,"yearLow":30792.74,"yearHigh":59332.43,"flag":"🇯🇵","goodReasons":["PM Takaichi's supermajority election win providing political stability","Semiconductor and tech export boom driven by global AI demand","Corporate governance reforms attracting record foreign investment"],"badReasons":["Oil price surge hitting energy-import-dependent economy hard","Yen volatility creating uncertainty for exporters and importers","Global risk-off sentiment dragging equities from recent highs"]},{"country":"Germany","code":"DEU","index":"DAX","price":23403.74,"change":-185.91,"changePercent":-0.79,"yearLow":14458.39,"yearHigh":24096.91,"flag":"🇩🇪","goodReasons":["Federal fiscal spending package stimulating economic growth","Defence sector surge on increased NATO spending commitments","Strong industrial earnings beating expectations"],"badReasons":["Energy dependency on Middle East creating supply chain risks","Rising oil prices reigniting inflation concerns across Eurozone","US tariff threats creating uncertainty for export-heavy economy"]},{"country":"France","code":"FRA","index":"CAC 40","price":8088.97,"change":-47.25,"changePercent":-0.58,"yearLow":6940.02,"yearHigh":8259.19,"flag":"🇫🇷","goodReasons":["Luxury goods sector resilient with strong Asian demand","Below-target Eurozone inflation enabling ECB rate cut expectations","Defence and aerospace stocks rallying on increased spending"],"badReasons":["Geopolitical risk from Middle East conflict weighing on sentiment","Energy cost pressures from Strait of Hormuz disruptions","Political uncertainty around fiscal policy tightening measures"]},{"country":"China","code":"CHN","index":"SSE Composite","price":3373.12,"change":12.67,"changePercent":0.38,"yearLow":2702.19,"yearHigh":3674.4,"flag":"🇨🇳","goodReasons":["Government stimulus measures supporting economic recovery","Tech sector rebound on AI development and DeepSeek momentum","Export growth benefiting from weaker yuan and new trade partnerships"],"badReasons":["US-China trade tensions and tariff escalation hurting exporters","Property sector weakness continuing to drag on consumer confidence","Deflationary pressures and weak domestic consumption"]},{"country":"Hong Kong","code":"HKG","index":"Hang Seng","price":23959.98,"change":388.27,"changePercent":1.65,"yearLow":14961.18,"yearHigh":24874.58,"flag":"🇭🇰","goodReasons":["China tech stocks rally on AI breakthroughs and policy support","Southbound capital flows from mainland investors increasing","Valuation discount to global peers attracting bargain hunters"],"badReasons":["US-China geopolitical tensions creating regulatory uncertainty","Global risk-off sentiment from Middle East conflict","Property developer debt restructuring concerns persisting"]},{"country":"India","code":"IND","index":"NIFTY 50","price":22397.2,"change":-182.45,"changePercent":-0.81,"yearLow":21964.6,"yearHigh":26277.35,"flag":"🇮🇳","goodReasons":["GDP growth forecast at 6.9% — fastest major economy in 2026","AI hyperscaler data center buildout attracting massive FDI","New trade deals signed with South Korea, Canada, Brazil, and EU"],"badReasons":["Crude oil surge above $114/barrel crushing import-dependent economy","IT sector worst monthly decline since 2008 on AI disruption fears","FII outflows exceeding ₹6,000 crore as global investors flee to safety"]},{"country":"Australia","code":"AUS","index":"S&P/ASX 200","price":7861.8,"change":-110.1,"changePercent":-1.38,"yearLow":7579.8,"yearHigh":8615.2,"flag":"🇦🇺","goodReasons":["Mining sector benefiting from strong commodity prices and gold rally","Banking sector resilient with stable earnings and dividends","Rate cut expectations supporting housing and consumer sectors"],"badReasons":["China slowdown concerns impacting iron ore demand outlook","Global geopolitical uncertainty reducing risk appetite","Rising energy costs squeezing consumer spending power"]},{"country":"South Korea","code":"KOR","index":"KOSPI","price":2558.13,"change":-17.46,"changePercent":-0.68,"yearLow":2149.64,"yearHigh":2693.98,"flag":"🇰🇷","goodReasons":["AI memory chip profits surging — Samsung tripled in 6 months","Semiconductor exports booming on global AI infrastructure demand","Corporate governance reforms narrowing Korea discount"],"badReasons":["175% rally from April 2025 raises bubble concerns and profit-taking risk","Record household debt at $1.4T threatening domestic demand","Oil price shock from Middle East conflict hitting growth outlook"]},{"country":"Canada","code":"CAN","index":"S&P/TSX","price":24712.67,"change":-228.14,"changePercent":-0.91,"yearLow":21458.8,"yearHigh":25916.7,"flag":"🇨🇦","goodReasons":["Materials sector surging on record gold and silver prices (+130% YoY earnings)","Energy sector benefiting from rising oil prices and capital discipline","Safe-haven flows as global uncertainty drives investors to Canadian assets"],"badReasons":["US trade tariff uncertainty creating export headwinds","Potential economic spillover from Middle East conflict escalation","Housing market vulnerabilities from elevated interest rates"]},{"country":"Spain","code":"ESP","index":"IBEX 35","price":12983.4,"change":-109.4,"changePercent":-0.84,"yearLow":10414.2,"yearHigh":13497.7,"flag":"🇪🇸","goodReasons":["Banking sector outperformance driving index higher","Tourism recovery boosting consumer and services sectors","Resilience against US trade threats — market shrugged off embargo talk"],"badReasons":["US threatens trade embargo over military base access dispute","Energy price spike from Middle East tensions raising costs","European-wide recession concerns weighing on sentiment"]},{"country":"Italy","code":"ITA","index":"FTSE MIB","price":38327.0,"change":-436.0,"changePercent":-1.12,"yearLow":30445.0,"yearHigh":40064.0,"flag":"🇮🇹","goodReasons":["Banking sector consolidation driving valuations higher","Defence spending increases benefiting Leonardo and Fincantieri","Sovereign bond spreads narrowing versus Germany"],"badReasons":["Energy dependence on Middle East imports creating vulnerability","Rising oil prices threatening industrial sector margins","EU fiscal austerity expectations dampening growth outlook"]},{"country":"Netherlands","code":"NLD","index":"AEX","price":912.37,"change":-9.68,"changePercent":-1.05,"yearLow":834.48,"yearHigh":980.53,"flag":"🇳🇱","goodReasons":["ASML benefiting from insatiable global semiconductor demand","Defensive positioning of index with strong dividend payers","Strong earnings from Shell and Unilever"],"badReasons":["ASML export restrictions to China creating growth uncertainty","Eurozone economic slowdown weighing on cyclical stocks","Global trade tension impact on export-oriented companies"]},{"country":"Switzerland","code":"CHE","index":"SMI","price":12924.55,"change":-7.63,"changePercent":-0.06,"yearLow":11401.0,"yearHigh":13296.77,"flag":"🇨🇭","goodReasons":["Safe-haven flows boosting franc-denominated assets","Pharmaceutical giants Novartis and Roche providing defensive stability","Strong Swiss National Bank balance sheet supporting confidence"],"badReasons":["Strong franc hurting export competitiveness","Global risk-off sentiment limiting upside potential","Luxury watch sector facing weaker Chinese demand"]},{"country":"Brazil","code":"BRA","index":"IBOVESPA","price":130293.0,"change":1661.0,"changePercent":1.29,"yearLow":117658.0,"yearHigh":137832.0,"flag":"🇧🇷","goodReasons":["Commodity exports benefiting from rising global prices","New trade deals with India and EU expanding market access","Attractive EM valuations drawing global capital inflows"],"badReasons":["Fiscal deficit concerns and government spending pressures","Rising interest rate environment squeezing corporate margins","Currency volatility creating uncertainty for foreign investors"]},{"country":"Mexico","code":"MEX","index":"IPC","price":53476.23,"change":243.72,"changePercent":0.46,"yearLow":44372.0,"yearHigh":56060.4,"flag":"🇲🇽","goodReasons":["Nearshoring trend bringing manufacturing investment from US and Asia","Top performing EM market in February at +5.63%","Energy sector benefiting from higher oil prices (Pemex)"],"badReasons":["US tariff risks on Mexican imports creating trade uncertainty","Peso depreciation raising imported inflation concerns","Political uncertainty around institutional reforms"]},{"country":"Russia","code":"RUS","index":"MOEX","price":3227.28,"change":35.79,"changePercent":1.12,"yearLow":2370.44,"yearHigh":3401.11,"flag":"🇷🇺","goodReasons":["Energy revenues boosted by surging global oil prices","Domestic consumer sector growing despite sanctions","Government fiscal stimulus supporting defense-linked industries"],"badReasons":["Western sanctions limiting capital inflows and technology access","Isolation from global financial markets reducing liquidity","Currency and capital controls distorting market dynamics"]},{"country":"Taiwan","code":"TWN","index":"TWSE Taiwan 50","price":20744.85,"change":-222.13,"changePercent":-1.06,"yearLow":17279.76,"yearHigh":23416.65,"flag":"🇹🇼","goodReasons":["TSMC dominance in AI chip manufacturing driving massive revenues","GDP growth forecast upgraded to 7.7% — extraordinary for a developed economy","Semiconductor export boom as global AI infrastructure spending accelerates"],"badReasons":["Concentration risk — market heavily dependent on TSMC and chip cycle","US-China tensions creating geopolitical risk for the island","Global oil shock raising energy import costs"]},{"country":"Indonesia","code":"IDN","index":"Jakarta Composite","price":6262.15,"change":-154.3,"changePercent":-2.41,"yearLow":5882.57,"yearHigh":7905.39,"flag":"🇮🇩","goodReasons":["Government raising minimum free float to 15% to improve market quality","Pension fund equity allocation limits raised from 8% to 20%","Strong demographic tailwinds and domestic consumption growth"],"badReasons":["MSCI threatening frontier-market downgrade over transparency concerns","$120B market cap wiped out after MSCI warning on investability","Forced gold mine nationalization (Martabe) destroying foreign investor confidence"]},{"country":"Malaysia","code":"MYS","index":"KLCI","price":1520.53,"change":-18.63,"changePercent":-1.21,"yearLow":1482.0,"yearHigh":1672.49,"flag":"🇲🇾","goodReasons":["Semiconductor packaging and testing industry benefiting from AI demand","Palm oil exports generating strong trade surplus","Data center investments from US hyperscalers boosting economy"],"badReasons":["Global risk-off sentiment reducing foreign investment","Rising oil prices as net importer affecting current account","Ringgit weakness pressuring imported inflation"]},{"country":"Egypt","code":"EGY","index":"EGX 30","price":32018.37,"change":418.37,"changePercent":1.32,"yearLow":26084.7,"yearHigh":35156.36,"flag":"🇪🇬","goodReasons":["Suez Canal revenues rising with increased global shipping activity","IMF-backed reforms attracting international investment","Tourism sector recovery boosting foreign exchange earnings"],"badReasons":["Middle East conflict directly threatening regional stability","Currency devaluation eroding purchasing power and real returns","High inflation squeezing consumer spending and corporate margins"]},{"country":"Turkey","code":"TUR","index":"BIST 100","price":9536.17,"change":145.23,"changePercent":1.55,"yearLow":8004.37,"yearHigh":11789.57,"flag":"🇹🇷","goodReasons":["Orthodox monetary policy restoring investor confidence","Defence industry exports growing rapidly amid global demand","Tourism revenues at record levels supporting current account"],"badReasons":["Persistent high inflation eroding real equity returns","Lira depreciation continuing despite rate hikes","Middle East proximity creating geopolitical risk premium"]},{"country":"Poland","code":"POL","index":"WIG20","price":2399.58,"change":-27.06,"changePercent":-1.11,"yearLow":2133.28,"yearHigh":2672.95,"flag":"🇵🇱","goodReasons":["EU defence spending boost benefiting Polish defence contractors","EU recovery fund inflows supporting infrastructure investment","Banking sector profiting from higher interest rate environment"],"badReasons":["Proximity to Russia-Ukraine conflict maintaining risk premium","Rising energy costs impacting industrial competitiveness","Political uncertainty around judicial and media reforms"]},{"country":"Sweden","code":"SWE","index":"OMX Stockholm 30","price":2407.79,"change":-19.58,"changePercent":-0.81,"yearLow":2156.44,"yearHigh":2658.82,"flag":"🇸🇪","goodReasons":["Defence sector stocks surging on NATO commitments and spending","Ericsson benefiting from 5G and AI network infrastructure buildout","Weak krona boosting export competitiveness"],"badReasons":["Housing market weakness persisting from rate hike cycle","Industrial sector facing weakening European demand","Global tech selloff affecting Stockholm's tech-heavy index"]},{"country":"Finland","code":"FIN","index":"OMX Helsinki 25","price":4979.55,"change":-51.63,"changePercent":-1.03,"yearLow":4536.27,"yearHigh":5526.72,"flag":"🇫🇮","goodReasons":["Nokia benefiting from 5G infrastructure and AI networking demand","Defence sector growth as NATO member increases military spending","Forest industry exports strong on global demand"],"badReasons":["Nokia volatility on competitive pressures in telecom equipment","European economic slowdown reducing industrial demand","Small market size leading to liquidity and concentration risk"]},{"country":"Denmark","code":"DNK","index":"OMX Copenhagen 20","price":2523.5,"change":-5.69,"changePercent":-0.23,"yearLow":2202.44,"yearHigh":2984.73,"flag":"🇩🇰","goodReasons":["Novo Nordisk and Ozempic/Wegovy driving pharma-led index gains","Green energy transition boosting Vestas and Orsted","Strong current account surplus providing economic stability"],"badReasons":["Novo Nordisk concentration risk (dominates index weighting)","GLP-1 drug competition emerging from Lilly and other pharma","Global shipping disruptions impacting Maersk revenues"]},{"country":"Belgium","code":"BEL","index":"BEL 20","price":4383.53,"change":-51.77,"changePercent":-1.17,"yearLow":3922.85,"yearHigh":4559.09,"flag":"🇧🇪","goodReasons":["AB InBev global beer market leadership providing earnings stability","EU institution presence attracting service sector investment","Healthcare and biotech sector strength"],"badReasons":["Small open economy vulnerable to European recession risk","High government debt limiting fiscal stimulus options","Rising energy costs impacting industrial competitiveness"]},{"country":"Austria","code":"AUT","index":"ATX","price":4048.25,"change":-29.25,"changePercent":-0.72,"yearLow":3354.23,"yearHigh":4308.3,"flag":"🇦🇹","goodReasons":["Banking sector benefiting from higher interest rate environment","Central European growth outperforming Western Europe","Tourism and services sector recovery"],"badReasons":["Eastern Europe exposure creating geopolitical risk premium","Energy dependence on Russian gas supplies","Industrial sector facing order book weakness"]},{"country":"New Zealand","code":"NZL","index":"S&P/NZX 50","price":12034.4,"change":-97.7,"changePercent":-0.81,"yearLow":11164.7,"yearHigh":13219.68,"flag":"🇳🇿","goodReasons":["Dairy export revenues strong on global food demand","Rate cut expectations supporting interest-rate-sensitive sectors","Tourism recovery from Asia-Pacific markets"],"badReasons":["Small, illiquid market vulnerable to global risk-off moves","China slowdown risk affecting commodity export demand","Housing market correction weighing on consumer wealth effect"]},{"country":"Israel","code":"ISR","index":"TA-125","price":2248.68,"change":7.23,"changePercent":0.32,"yearLow":1801.36,"yearHigh":2362.12,"flag":"🇮🇱","goodReasons":["Tech sector resilience with strong AI and cybersecurity companies","Defence sector stocks surging on elevated military spending","Ceasefire hopes providing intermittent relief rallies"],"badReasons":["Direct involvement in Middle East conflict creating existential risk","Military reservist call-ups reducing civilian economic output","Foreign investment hesitancy due to geopolitical uncertainty"]},{"country":"Singapore","code":"SGP","index":"STI","price":3951.45,"change":-27.22,"changePercent":-0.68,"yearLow":3281.19,"yearHigh":4005.16,"flag":"🇸🇬","goodReasons":["Financial hub status attracting wealth management inflows","Banking sector (DBS, OCBC, UOB) delivering record profits","Data center boom driving REITs and tech infrastructure"],"badReasons":["Trade-dependent economy vulnerable to global slowdown","Property market cooling measures limiting real estate gains","Rising oil prices increasing import costs for city-state"]}]};

// ── Format helpers ───────────────────────────────────────────
function formatNumber(n) {
  if (n == null) return '—';
  return n.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}
function formatChange(n) { return (n >= 0 ? '+' : '') + formatNumber(n); }
function formatPercent(n) { return (n >= 0 ? '+' : '') + n.toFixed(2) + '%'; }

// ── Color ────────────────────────────────────────────────────
const NO_DATA_COLOR = '#1a1a2e';
function getColor(pct) {
  if (pct == null) return NO_DATA_COLOR;
  if (pct === 0) return '#252538';
  if (pct > 0) {
    const t = Math.min(pct / absMax, 1);
    return d3.interpolateRgb('#1a3a2a', '#22c55e')(t);
  }
  const t = Math.min(Math.abs(pct) / absMax, 1);
  return d3.interpolateRgb('#3d1c1c', '#ef4444')(t);
}

// ── Data processing ──────────────────────────────────────────
function processData(data) {
  MARKET_DATA = data;
  dataByNumericId = {};
  data.countries.forEach(d => {
    const numId = ISO_TO_NUMERIC[d.code];
    if (numId !== undefined) dataByNumericId[numId] = d;
  });
  const percs = data.countries.map(c => c.changePercent).filter(p => p != null);
  absMax = Math.max(Math.abs(Math.min(...percs)), Math.abs(Math.max(...percs)), 0.5);
}

// ── Summary bar ──────────────────────────────────────────────
function updateSummaryBar() {
  if (!MARKET_DATA) return;
  const c = MARKET_DATA.countries;
  document.getElementById('stat-total').textContent = c.length;
  document.getElementById('stat-up').textContent = c.filter(x => x.changePercent > 0).length;
  document.getElementById('stat-down').textContent = c.filter(x => x.changePercent < 0).length;
  if (MARKET_DATA.lastUpdated) {
    const d = new Date(MARKET_DATA.lastUpdated);
    document.getElementById('stat-updated').textContent = d.toLocaleString('en-US', {
      month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit', timeZoneName: 'short'
    });
  }
}

// ── Leaderboard Sidebar ──────────────────────────────────────
function updateLeaderboard() {
  if (!MARKET_DATA) return;
  const countries = [...MARKET_DATA.countries].filter(c => c.changePercent != null);

  // Sort: gainers descending, losers ascending (most negative first)
  const gainers = countries.filter(c => c.changePercent > 0)
    .sort((a, b) => b.changePercent - a.changePercent);
  const losers = countries.filter(c => c.changePercent < 0)
    .sort((a, b) => a.changePercent - b.changePercent);

  const gainersList = document.getElementById('gainers-list');
  const losersList = document.getElementById('losers-list');
  if (!gainersList || !losersList) return;

  gainersList.innerHTML = gainers.length ? gainers.map((c, i) => buildLeaderboardRow(c, i, 'gainer')).join('') 
    : '<div class="lb-empty">No gainers today</div>';
  losersList.innerHTML = losers.length ? losers.map((c, i) => buildLeaderboardRow(c, i, 'loser')).join('')
    : '<div class="lb-empty">No losers today</div>';
}

function buildLeaderboardRow(c, index, type) {
  const isUp = type === 'gainer';
  const pct = formatPercent(c.changePercent);
  const firstClass = index === 0 ? `lb-row--first lb-row--${type}` : '';
  return `
    <div class="lb-row ${firstClass}">
      <span class="lb-row__rank">${index + 1}</span>
      <span class="lb-row__flag">${c.flag}</span>
      <div class="lb-row__info">
        <div class="lb-row__country">${c.country}</div>
        <div class="lb-row__index">${c.index}</div>
      </div>
      <span class="lb-row__change ${isUp ? 'lb-row__change--up' : 'lb-row__change--down'}">${pct}</span>
    </div>`;
}

// ── Legend ────────────────────────────────────────────────────
function buildLegend() {
  const legend = document.getElementById('legend');
  legend.innerHTML = '';
  const titleEl = document.createElement('span');
  titleEl.className = 'legend__title';
  titleEl.textContent = 'Daily Change';
  legend.appendChild(titleEl);

  const leftLabel = document.createElement('span');
  leftLabel.className = 'legend__label';
  leftLabel.textContent = formatPercent(-absMax);
  legend.appendChild(leftLabel);

  const bar = document.createElement('canvas');
  bar.className = 'legend__bar';
  bar.width = 280; bar.height = 10;
  const ctx = bar.getContext('2d');
  for (let i = 0; i < 280; i++) {
    ctx.fillStyle = getColor(-absMax + (2 * absMax * i / 279));
    ctx.fillRect(i, 0, 1, 10);
  }
  legend.appendChild(bar);

  const rightLabel = document.createElement('span');
  rightLabel.className = 'legend__label';
  rightLabel.textContent = formatPercent(absMax);
  legend.appendChild(rightLabel);
}

// ── Tooltip ──────────────────────────────────────────────────
const tooltipEl = document.getElementById('tooltip');

function showTooltip(event, d) {
  if (!d) { tooltipEl.classList.remove('visible'); return; }
  const isUp = d.changePercent >= 0;
  const arrow = isUp ? '▲' : '▼';
  const reasons = isUp ? d.goodReasons : d.badReasons;
  const reasonsTitle = isUp ? 'Top 3 Reasons for Strength' : 'Top 3 Reasons for Weakness';

  tooltipEl.innerHTML = `
    <div class="tooltip__header">
      <div>
        <div class="tooltip__country"><span class="tooltip__flag">${d.flag}</span>${d.country}</div>
        <div class="tooltip__index-name">${d.index}</div>
      </div>
    </div>
    <div class="tooltip__price-row">
      <span class="tooltip__price">${formatNumber(d.price)}</span>
      <span class="tooltip__change ${isUp ? 'tooltip__change--up' : 'tooltip__change--down'}">
        ${arrow} ${formatChange(d.change)} (${formatPercent(d.changePercent)})
      </span>
    </div>
    <div class="tooltip__reasons-title ${isUp ? 'tooltip__reasons-title--up' : 'tooltip__reasons-title--down'}">${reasonsTitle}</div>
    <ul class="tooltip__reasons">
      ${reasons.map(r => `<li class="tooltip__reason ${isUp ? 'tooltip__reason--up' : 'tooltip__reason--down'}">${r}</li>`).join('')}
    </ul>`;
  tooltipEl.classList.add('visible');
  positionTooltip(event);
}

function positionTooltip(event) {
  const pad = 16;
  const rect = tooltipEl.getBoundingClientRect();
  const w = window.innerWidth, h = window.innerHeight;
  let x = event.clientX + pad, y = event.clientY + pad;
  if (x + rect.width + pad > w) x = event.clientX - rect.width - pad;
  if (y + rect.height + pad > h) y = event.clientY - rect.height - pad;
  tooltipEl.style.left = Math.max(4, x) + 'px';
  tooltipEl.style.top = Math.max(4, y) + 'px';
}

function hideTooltip() { tooltipEl.classList.remove('visible'); }

// ── Render map countries ─────────────────────────────────────
function renderCountries() {
  if (!countriesGeo || !svg) return;

  countriesGroup.selectAll('.country-path')
    .data(countriesGeo, d => d.id)
    .join('path')
    .attr('class', 'country-path')
    .attr('d', pathGen)
    .attr('data-has-data', d => dataByNumericId[parseInt(d.id, 10)] ? 'true' : 'false')
    .attr('fill', d => {
      const m = dataByNumericId[parseInt(d.id, 10)];
      return m ? getColor(m.changePercent) : NO_DATA_COLOR;
    })
    .on('mouseenter', function(event, d) {
      const m = dataByNumericId[parseInt(d.id, 10)];
      if (m) { showTooltip(event, m); d3.select(this).raise(); }
    })
    .on('mousemove', function(event) {
      if (tooltipEl.classList.contains('visible')) positionTooltip(event);
    })
    .on('mouseleave', hideTooltip);

  // Borders
  if (bordersPath) {
    bordersPath.attr('d', pathGen(topojson.mesh(worldData, worldData.objects.countries, (a, b) => a !== b)));
  }
  // Sphere
  if (spherePath) {
    spherePath.attr('d', pathGen({ type: 'Sphere' }));
  }
}

// ── Build map ────────────────────────────────────────────────
async function buildMap() {
  const container = document.getElementById('map');
  const containerWidth = container.clientWidth || 1280;
  const aspectRatio = 0.52;
  const width = containerWidth;
  const height = width * aspectRatio;

  svg = d3.select('#map')
    .append('svg')
    .attr('viewBox', `0 0 ${width} ${height}`)
    .attr('preserveAspectRatio', 'xMidYMid meet');

  // Defs: ocean dot pattern + graticule clip
  const defs = svg.append('defs');
  const pattern = defs.append('pattern')
    .attr('id', 'ocean-dots').attr('width', 20).attr('height', 20)
    .attr('patternUnits', 'userSpaceOnUse');
  pattern.append('rect').attr('width', 20).attr('height', 20).attr('fill', '#0f1117');
  pattern.append('circle').attr('cx', 10).attr('cy', 10).attr('r', 0.6)
    .attr('fill', 'rgba(255,255,255,0.04)');

  // Ocean
  svg.append('rect').attr('width', width).attr('height', height).attr('fill', 'url(#ocean-dots)');

  // Projection — orthographic for rotate support
  projection = d3.geoOrthographic()
    .scale(width / 4.5)
    .translate([width / 2, height / 2])
    .rotate(currentRotation)
    .clipAngle(90);

  pathGen = d3.geoPath().projection(projection);

  // Sphere background (ocean globe)
  svg.append('path')
    .datum({ type: 'Sphere' })
    .attr('fill', 'rgba(15,17,23,0.8)')
    .attr('stroke', 'rgba(255,255,255,0.08)')
    .attr('stroke-width', 1)
    .attr('d', pathGen);

  // Graticule
  const graticule = d3.geoGraticule10();
  svg.append('path')
    .datum(graticule)
    .attr('fill', 'none')
    .attr('stroke', 'rgba(255,255,255,0.04)')
    .attr('stroke-width', 0.5)
    .attr('d', pathGen)
    .attr('class', 'graticule-path');

  // Countries group
  countriesGroup = svg.append('g').attr('class', 'countries-group');

  // Borders
  bordersPath = svg.append('path')
    .attr('fill', 'none')
    .attr('stroke', 'rgba(255,255,255,0.08)')
    .attr('stroke-width', 0.5)
    .attr('class', 'borders-path');

  // Sphere outline on top
  spherePath = svg.append('path')
    .datum({ type: 'Sphere' })
    .attr('fill', 'none')
    .attr('stroke', 'rgba(255,255,255,0.1)')
    .attr('stroke-width', 1.2);

  // Load TopoJSON
  worldData = await d3.json('https://cdn.jsdelivr.net/npm/world-atlas@2/countries-110m.json');
  countriesGeo = topojson.feature(worldData, worldData.objects.countries).features;

  renderCountries();

  // ── Drag to rotate ──────────────────────────────────────
  const drag = d3.drag()
    .on('start', function(event) {
      isDragging = true;
      dragStart = [event.x, event.y];
      rotateStart = projection.rotate();
      hideTooltip();
    })
    .on('drag', function(event) {
      const dx = event.x - dragStart[0];
      const dy = event.y - dragStart[1];
      const sensitivity = 0.4 / currentZoom;
      const newRotation = [
        rotateStart[0] + dx * sensitivity,
        Math.max(-89, Math.min(89, rotateStart[1] - dy * sensitivity)),
        rotateStart[2]
      ];
      currentRotation = newRotation;
      projection.rotate(newRotation);
      updateAllPaths();
    })
    .on('end', function() {
      isDragging = false;
    });

  svg.call(drag);

  // ── Scroll to zoom ──────────────────────────────────────
  svg.on('wheel', function(event) {
    event.preventDefault();
    const factor = event.deltaY > 0 ? 0.9 : 1.1;
    currentZoom = Math.max(0.5, Math.min(8, currentZoom * factor));
    projection.scale((width / 4.5) * currentZoom);
    updateAllPaths();
    updateZoomDisplay();
  });

  // Double-click to zoom in
  svg.on('dblclick', function(event) {
    event.preventDefault();
    currentZoom = Math.min(8, currentZoom * 1.5);
    projection.scale((width / 4.5) * currentZoom);
    updateAllPaths();
    updateZoomDisplay();
  });
}

// ── Update all paths after rotation/zoom ─────────────────────
function updateAllPaths() {
  countriesGroup.selectAll('.country-path').attr('d', pathGen);
  svg.select('.graticule-path').attr('d', pathGen(d3.geoGraticule10()));
  if (bordersPath) {
    bordersPath.attr('d', pathGen(topojson.mesh(worldData, worldData.objects.countries, (a, b) => a !== b)));
  }
  if (spherePath) {
    spherePath.attr('d', pathGen({ type: 'Sphere' }));
  }
  svg.selectAll('path').filter(function() {
    return d3.select(this).datum() && d3.select(this).datum().type === 'Sphere';
  }).attr('d', pathGen);
}

function updateZoomDisplay() {
  const el = document.getElementById('zoom-level');
  if (el) el.textContent = Math.round(currentZoom * 100) + '%';
}

// ── Control buttons ──────────────────────────────────────────
function setupControls() {
  document.getElementById('btn-zoom-in').addEventListener('click', () => {
    currentZoom = Math.min(8, currentZoom * 1.3);
    const w = document.getElementById('map').clientWidth || 1280;
    projection.scale((w / 4.5) * currentZoom);
    updateAllPaths();
    updateZoomDisplay();
  });

  document.getElementById('btn-zoom-out').addEventListener('click', () => {
    currentZoom = Math.max(0.5, currentZoom / 1.3);
    const w = document.getElementById('map').clientWidth || 1280;
    projection.scale((w / 4.5) * currentZoom);
    updateAllPaths();
    updateZoomDisplay();
  });

  document.getElementById('btn-reset').addEventListener('click', () => {
    currentZoom = 1;
    currentRotation = [0, -15, 0];
    const w = document.getElementById('map').clientWidth || 1280;
    projection.scale(w / 4.5).rotate(currentRotation);
    updateAllPaths();
    updateZoomDisplay();
  });

  document.getElementById('btn-rotate-left').addEventListener('click', () => {
    currentRotation[0] -= 30;
    projection.rotate(currentRotation);
    updateAllPaths();
  });

  document.getElementById('btn-rotate-right').addEventListener('click', () => {
    currentRotation[0] += 30;
    projection.rotate(currentRotation);
    updateAllPaths();
  });

  // Preset views
  document.querySelectorAll('[data-region]').forEach(btn => {
    btn.addEventListener('click', () => {
      const region = btn.dataset.region;
      const views = {
        americas: [90, 15, 0, 1.2],
        europe:   [-15, -50, 0, 2.5],
        asia:     [-100, -30, 0, 1.5],
        africa:   [-20, 0, 0, 1.8],
      };
      const v = views[region];
      if (v) {
        currentRotation = [v[0], v[1], v[2]];
        currentZoom = v[3];
        const w = document.getElementById('map').clientWidth || 1280;
        projection.rotate(currentRotation).scale((w / 4.5) * currentZoom);
        updateAllPaths();
        updateZoomDisplay();
      }
      // Highlight active
      document.querySelectorAll('[data-region]').forEach(b => b.classList.remove('active'));
      btn.classList.add('active');
    });
  });
}

// ── Live data handling ───────────────────────────────────────
let sseRefreshInterval = 300; // default 5 min, updated from server
let lastUpdateTimestamp = null;
let countdownTimer = null;

function applyLiveData(data) {
  if (data && data.countries && data.countries.length > 0 && data.countries.some(c => c.price)) {
    processData(data);
    updateSummaryBar();
    updateLeaderboard();
    buildLegend();
    renderCountries();
    lastUpdateTimestamp = Date.now();
    flashUpdate();
    startCountdown();
    return true;
  }
  return false;
}

function flashUpdate() {
  const statusEl = document.getElementById('refresh-status');
  const badge = statusEl?.parentElement;
  if (!statusEl || !badge) return;
  statusEl.textContent = 'Updated';
  badge.classList.add('flash');
  setTimeout(() => {
    statusEl.textContent = 'Live';
    badge.classList.remove('flash');
  }, 2000);
}

function startCountdown() {
  if (countdownTimer) clearInterval(countdownTimer);
  let remaining = sseRefreshInterval;
  const el = document.getElementById('next-refresh');
  if (!el) return;
  el.textContent = formatCountdown(remaining);
  countdownTimer = setInterval(() => {
    remaining--;
    if (remaining <= 0) remaining = sseRefreshInterval;
    el.textContent = formatCountdown(remaining);
  }, 1000);
}

function formatCountdown(secs) {
  const m = Math.floor(secs / 60);
  const s = secs % 60;
  return `${m}m ${s.toString().padStart(2, '0')}s`;
}

// ── SSE Real-Time Stream ─────────────────────────────────────
let eventSource = null;
let reconnectAttempts = 0;
const MAX_RECONNECT_DELAY = 30000;

function connectSSE() {
  const statusEl = document.getElementById('refresh-status');
  const streamDot = document.getElementById('stream-dot');

  if (eventSource) {
    eventSource.close();
    eventSource = null;
  }

  const sseUrl = `${API}/api/stream`;
  const badge = statusEl?.parentElement;
  console.log('[SSE] Connecting to', sseUrl);
  if (statusEl) { statusEl.textContent = 'Connecting...'; }
  if (badge) { badge.classList.add('active'); }

  eventSource = new EventSource(sseUrl);

  // Main data messages
  eventSource.onmessage = function(event) {
    try {
      const data = JSON.parse(event.data);
      if (data.countries) {
        console.log('[SSE] Received live data update');
        applyLiveData(data);
        reconnectAttempts = 0;
        if (badge) { badge.classList.remove('active'); }
        if (streamDot) { streamDot.classList.add('connected'); }
      }
    } catch (e) {
      console.warn('[SSE] Parse error:', e);
    }
  };

  // Server info event
  eventSource.addEventListener('connected', function(event) {
    try {
      const info = JSON.parse(event.data);
      if (info.refreshInterval) {
        sseRefreshInterval = info.refreshInterval;
        console.log('[SSE] Refresh interval:', sseRefreshInterval, 's');
      }
    } catch (e) { /* ignore */ }
    reconnectAttempts = 0;
    if (statusEl) { statusEl.textContent = 'Live'; }
    if (badge) { badge.classList.remove('active'); }
    if (streamDot) { streamDot.classList.add('connected'); }
  });

  eventSource.onerror = function() {
    console.warn('[SSE] Connection error, will reconnect...');
    if (statusEl) { statusEl.textContent = 'Reconnecting...'; }
    if (badge) { badge.classList.add('active'); }
    if (streamDot) { streamDot.classList.remove('connected'); }
    eventSource.close();
    eventSource = null;

    // Exponential backoff reconnect
    reconnectAttempts++;
    const delay = Math.min(1000 * Math.pow(2, reconnectAttempts), MAX_RECONNECT_DELAY);
    console.log(`[SSE] Reconnecting in ${delay}ms (attempt ${reconnectAttempts})`);
    setTimeout(connectSSE, delay);
  };
}

// Fallback: one-time fetch if SSE isn't available
async function fetchLiveDataOnce() {
  try {
    const res = await fetch(`${API}/api/market-data`);
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    const data = await res.json();
    return applyLiveData(data);
  } catch (e) {
    console.warn('[fetchLiveData]', e.message);
  }
  return false;
}

// ── Init ─────────────────────────────────────────────────────
async function init() {
  // Start with fallback data immediately
  processData(FALLBACK_DATA);
  updateSummaryBar();
  updateLeaderboard();
  buildLegend();
  await buildMap();
  setupControls();
  updateZoomDisplay();

  // Try initial fetch, then connect SSE for real-time updates
  const gotLive = await fetchLiveDataOnce();
  if (!gotLive) {
    console.log('[init] Using fallback data');
  }

  // Connect SSE stream for live push updates
  connectSSE();
}

init();
