#!/usr/bin/env python3
"""Backend server for Global Markets Map — fetches live index quotes every hour."""

import asyncio
import csv
import io
import json
import re
import time
import urllib.request
from contextlib import asynccontextmanager
from datetime import datetime, timezone

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

# ── Ticker → country metadata (static) ──────────────────────────
COUNTRY_META = {
    "^GSPC":      {"country": "United States",  "code": "USA", "index": "S&P 500",            "flag": "🇺🇸",
                   "goodReasons": ["Tax cuts & deregulation boosting corporate earnings and business investment","AI infrastructure buildout driving massive capex across tech sector","Strong consumer spending and resilient labor market supporting GDP growth"],
                   "badReasons":  ["Middle East conflict escalation raising oil prices and inflation fears","AI disruption concerns causing tech sector rotation and valuation reassessment","Trade tariff uncertainties creating supply chain and cost headwinds"]},
    "^FTSE":      {"country": "United Kingdom", "code": "GBR", "index": "FTSE 100",           "flag": "🇬🇧",
                   "goodReasons": ["Energy sector gains from rising oil prices benefiting BP and Shell","Defence spending increases boosting aerospace and military stocks","Below-target inflation allowing accommodative monetary policy"],
                   "badReasons":  ["Geopolitical uncertainty from Middle East conflict dampening sentiment","Rising energy costs squeezing consumer discretionary spending","Weak economic growth outlook and housing market softness"]},
    "^N225":      {"country": "Japan",          "code": "JPN", "index": "Nikkei 225",          "flag": "🇯🇵",
                   "goodReasons": ["PM Takaichi's supermajority election win providing political stability","Semiconductor and tech export boom driven by global AI demand","Corporate governance reforms attracting record foreign investment"],
                   "badReasons":  ["Oil price surge hitting energy-import-dependent economy hard","Yen volatility creating uncertainty for exporters and importers","Global risk-off sentiment dragging equities from recent highs"]},
    "^GDAXI":     {"country": "Germany",        "code": "DEU", "index": "DAX",                 "flag": "🇩🇪",
                   "goodReasons": ["Federal fiscal spending package stimulating economic growth","Defence sector surge on increased NATO spending commitments","Strong industrial earnings beating expectations"],
                   "badReasons":  ["Energy dependency on Middle East creating supply chain risks","Rising oil prices reigniting inflation concerns across Eurozone","US tariff threats creating uncertainty for export-heavy economy"]},
    "^FCHI":      {"country": "France",         "code": "FRA", "index": "CAC 40",              "flag": "🇫🇷",
                   "goodReasons": ["Luxury goods sector resilient with strong Asian demand","Below-target Eurozone inflation enabling ECB rate cut expectations","Defence and aerospace stocks rallying on increased spending"],
                   "badReasons":  ["Geopolitical risk from Middle East conflict weighing on sentiment","Energy cost pressures from Strait of Hormuz disruptions","Political uncertainty around fiscal policy tightening measures"]},
    "000001.SS":  {"country": "China",          "code": "CHN", "index": "SSE Composite",       "flag": "🇨🇳",
                   "goodReasons": ["Government stimulus measures supporting economic recovery","Tech sector rebound on AI development and DeepSeek momentum","Export growth benefiting from weaker yuan and new trade partnerships"],
                   "badReasons":  ["US-China trade tensions and tariff escalation hurting exporters","Property sector weakness continuing to drag on consumer confidence","Deflationary pressures and weak domestic consumption"]},
    "^HSI":       {"country": "Hong Kong",      "code": "HKG", "index": "Hang Seng",           "flag": "🇭🇰",
                   "goodReasons": ["China tech stocks rally on AI breakthroughs and policy support","Southbound capital flows from mainland investors increasing","Valuation discount to global peers attracting bargain hunters"],
                   "badReasons":  ["US-China geopolitical tensions creating regulatory uncertainty","Global risk-off sentiment from Middle East conflict","Property developer debt restructuring concerns persisting"]},
    "^NSEI":      {"country": "India",          "code": "IND", "index": "NIFTY 50",            "flag": "🇮🇳",
                   "goodReasons": ["GDP growth forecast at 6.9% — fastest major economy in 2026","AI hyperscaler data center buildout attracting massive FDI","New trade deals signed with South Korea, Canada, Brazil, and EU"],
                   "badReasons":  ["Crude oil surge above $114/barrel crushing import-dependent economy","IT sector worst monthly decline since 2008 on AI disruption fears","FII outflows exceeding ₹6,000 crore as global investors flee to safety"]},
    "^AXJO":      {"country": "Australia",      "code": "AUS", "index": "S&P/ASX 200",         "flag": "🇦🇺",
                   "goodReasons": ["Mining sector benefiting from strong commodity prices and gold rally","Banking sector resilient with stable earnings and dividends","Rate cut expectations supporting housing and consumer sectors"],
                   "badReasons":  ["China slowdown concerns impacting iron ore demand outlook","Global geopolitical uncertainty reducing risk appetite","Rising energy costs squeezing consumer spending power"]},
    "^KS11":      {"country": "South Korea",    "code": "KOR", "index": "KOSPI",               "flag": "🇰🇷",
                   "goodReasons": ["AI memory chip profits surging — Samsung tripled in 6 months","Semiconductor exports booming on global AI infrastructure demand","Corporate governance reforms narrowing Korea discount"],
                   "badReasons":  ["175% rally from April 2025 raises bubble concerns and profit-taking risk","Record household debt at $1.4T threatening domestic demand","Oil price shock from Middle East conflict hitting growth outlook"]},
    "^GSPTSE":    {"country": "Canada",         "code": "CAN", "index": "S&P/TSX",             "flag": "🇨🇦",
                   "goodReasons": ["Materials sector surging on record gold and silver prices (+130% YoY earnings)","Energy sector benefiting from rising oil prices and capital discipline","Safe-haven flows as global uncertainty drives investors to Canadian assets"],
                   "badReasons":  ["US trade tariff uncertainty creating export headwinds","Potential economic spillover from Middle East conflict escalation","Housing market vulnerabilities from elevated interest rates"]},
    "^IBEX":      {"country": "Spain",          "code": "ESP", "index": "IBEX 35",             "flag": "🇪🇸",
                   "goodReasons": ["Banking sector outperformance driving index higher","Tourism recovery boosting consumer and services sectors","Resilience against US trade threats — market shrugged off embargo talk"],
                   "badReasons":  ["US threatens trade embargo over military base access dispute","Energy price spike from Middle East tensions raising costs","European-wide recession concerns weighing on sentiment"]},
    "FTSEMIB.MI": {"country": "Italy",          "code": "ITA", "index": "FTSE MIB",            "flag": "🇮🇹",
                   "goodReasons": ["Banking sector consolidation driving valuations higher","Defence spending increases benefiting Leonardo and Fincantieri","Sovereign bond spreads narrowing versus Germany"],
                   "badReasons":  ["Energy dependence on Middle East imports creating vulnerability","Rising oil prices threatening industrial sector margins","EU fiscal austerity expectations dampening growth outlook"]},
    "^AEX":       {"country": "Netherlands",    "code": "NLD", "index": "AEX",                 "flag": "🇳🇱",
                   "goodReasons": ["ASML benefiting from insatiable global semiconductor demand","Defensive positioning of index with strong dividend payers","Strong earnings from Shell and Unilever"],
                   "badReasons":  ["ASML export restrictions to China creating growth uncertainty","Eurozone economic slowdown weighing on cyclical stocks","Global trade tension impact on export-oriented companies"]},
    "^SSMI":      {"country": "Switzerland",    "code": "CHE", "index": "SMI",                 "flag": "🇨🇭",
                   "goodReasons": ["Safe-haven flows boosting franc-denominated assets","Pharmaceutical giants Novartis and Roche providing defensive stability","Strong Swiss National Bank balance sheet supporting confidence"],
                   "badReasons":  ["Strong franc hurting export competitiveness","Global risk-off sentiment limiting upside potential","Luxury watch sector facing weaker Chinese demand"]},
    "^BVSP":      {"country": "Brazil",         "code": "BRA", "index": "IBOVESPA",            "flag": "🇧🇷",
                   "goodReasons": ["Commodity exports benefiting from rising global prices","New trade deals with India and EU expanding market access","Attractive EM valuations drawing global capital inflows"],
                   "badReasons":  ["Fiscal deficit concerns and government spending pressures","Rising interest rate environment squeezing corporate margins","Currency volatility creating uncertainty for foreign investors"]},
    "^MXX":       {"country": "Mexico",         "code": "MEX", "index": "IPC",                 "flag": "🇲🇽",
                   "goodReasons": ["Nearshoring trend bringing manufacturing investment from US and Asia","Top performing EM market in February at +5.63%","Energy sector benefiting from higher oil prices (Pemex)"],
                   "badReasons":  ["US tariff risks on Mexican imports creating trade uncertainty","Peso depreciation raising imported inflation concerns","Political uncertainty around institutional reforms"]},
    "IMOEX.ME":   {"country": "Russia",         "code": "RUS", "index": "MOEX",                "flag": "🇷🇺",
                   "goodReasons": ["Energy revenues boosted by surging global oil prices","Domestic consumer sector growing despite sanctions","Government fiscal stimulus supporting defense-linked industries"],
                   "badReasons":  ["Western sanctions limiting capital inflows and technology access","Isolation from global financial markets reducing liquidity","Currency and capital controls distorting market dynamics"]},
    "^TSE50":     {"country": "Taiwan",         "code": "TWN", "index": "TWSE Taiwan 50",      "flag": "🇹🇼",
                   "goodReasons": ["TSMC dominance in AI chip manufacturing driving massive revenues","GDP growth forecast upgraded to 7.7% — extraordinary for a developed economy","Semiconductor export boom as global AI infrastructure spending accelerates"],
                   "badReasons":  ["Concentration risk — market heavily dependent on TSMC and chip cycle","US-China tensions creating geopolitical risk for the island","Global oil shock raising energy import costs"]},
    "^JKSE":      {"country": "Indonesia",      "code": "IDN", "index": "Jakarta Composite",   "flag": "🇮🇩",
                   "goodReasons": ["Government raising minimum free float to 15% to improve market quality","Pension fund equity allocation limits raised from 8% to 20%","Strong demographic tailwinds and domestic consumption growth"],
                   "badReasons":  ["MSCI threatening frontier-market downgrade over transparency concerns","$120B market cap wiped out after MSCI warning on investability","Forced gold mine nationalization (Martabe) destroying foreign investor confidence"]},
    "^KLSE":      {"country": "Malaysia",       "code": "MYS", "index": "KLCI",                "flag": "🇲🇾",
                   "goodReasons": ["Semiconductor packaging and testing industry benefiting from AI demand","Palm oil exports generating strong trade surplus","Data center investments from US hyperscalers boosting economy"],
                   "badReasons":  ["Global risk-off sentiment reducing foreign investment","Rising oil prices as net importer affecting current account","Ringgit weakness pressuring imported inflation"]},
    "^CASE30":    {"country": "Egypt",          "code": "EGY", "index": "EGX 30",              "flag": "🇪🇬",
                   "goodReasons": ["Suez Canal revenues rising with increased global shipping activity","IMF-backed reforms attracting international investment","Tourism sector recovery boosting foreign exchange earnings"],
                   "badReasons":  ["Middle East conflict directly threatening regional stability","Currency devaluation eroding purchasing power and real returns","High inflation squeezing consumer spending and corporate margins"]},
    "XU100.IS":   {"country": "Turkey",         "code": "TUR", "index": "BIST 100",            "flag": "🇹🇷",
                   "goodReasons": ["Orthodox monetary policy restoring investor confidence","Defence industry exports growing rapidly amid global demand","Tourism revenues at record levels supporting current account"],
                   "badReasons":  ["Persistent high inflation eroding real equity returns","Lira depreciation continuing despite rate hikes","Middle East proximity creating geopolitical risk premium"]},
    "WIG20.WA":   {"country": "Poland",         "code": "POL", "index": "WIG20",               "flag": "🇵🇱",
                   "goodReasons": ["EU defence spending boost benefiting Polish defence contractors","EU recovery fund inflows supporting infrastructure investment","Banking sector profiting from higher interest rate environment"],
                   "badReasons":  ["Proximity to Russia-Ukraine conflict maintaining risk premium","Rising energy costs impacting industrial competitiveness","Political uncertainty around judicial and media reforms"]},
    "^OMXS30":    {"country": "Sweden",         "code": "SWE", "index": "OMX Stockholm 30",    "flag": "🇸🇪",
                   "goodReasons": ["Defence sector stocks surging on NATO commitments and spending","Ericsson benefiting from 5G and AI network infrastructure buildout","Weak krona boosting export competitiveness"],
                   "badReasons":  ["Housing market weakness persisting from rate hike cycle","Industrial sector facing weakening European demand","Global tech selloff affecting Stockholm's tech-heavy index"]},
    "^OMXH25":    {"country": "Finland",        "code": "FIN", "index": "OMX Helsinki 25",     "flag": "🇫🇮",
                   "goodReasons": ["Nokia benefiting from 5G infrastructure and AI networking demand","Defence sector growth as NATO member increases military spending","Forest industry exports strong on global demand"],
                   "badReasons":  ["Nokia volatility on competitive pressures in telecom equipment","European economic slowdown reducing industrial demand","Small market size leading to liquidity and concentration risk"]},
    "^OMXC20":    {"country": "Denmark",        "code": "DNK", "index": "OMX Copenhagen 20",   "flag": "🇩🇰",
                   "goodReasons": ["Novo Nordisk and Ozempic/Wegovy driving pharma-led index gains","Green energy transition boosting Vestas and Orsted","Strong current account surplus providing economic stability"],
                   "badReasons":  ["Novo Nordisk concentration risk (dominates index weighting)","GLP-1 drug competition emerging from Lilly and other pharma","Global shipping disruptions impacting Maersk revenues"]},
    "^BFX":       {"country": "Belgium",        "code": "BEL", "index": "BEL 20",              "flag": "🇧🇪",
                   "goodReasons": ["AB InBev global beer market leadership providing earnings stability","EU institution presence attracting service sector investment","Healthcare and biotech sector strength"],
                   "badReasons":  ["Small open economy vulnerable to European recession risk","High government debt limiting fiscal stimulus options","Rising energy costs impacting industrial competitiveness"]},
    "^ATX":       {"country": "Austria",        "code": "AUT", "index": "ATX",                 "flag": "🇦🇹",
                   "goodReasons": ["Banking sector benefiting from higher interest rate environment","Central European growth outperforming Western Europe","Tourism and services sector recovery"],
                   "badReasons":  ["Eastern Europe exposure creating geopolitical risk premium","Energy dependence on Russian gas supplies","Industrial sector facing order book weakness"]},
    "^NZ50":      {"country": "New Zealand",    "code": "NZL", "index": "S&P/NZX 50",          "flag": "🇳🇿",
                   "goodReasons": ["Dairy export revenues strong on global food demand","Rate cut expectations supporting interest-rate-sensitive sectors","Tourism recovery from Asia-Pacific markets"],
                   "badReasons":  ["Small, illiquid market vulnerable to global risk-off moves","China slowdown risk affecting commodity export demand","Housing market correction weighing on consumer wealth effect"]},
    "^TA125.TA":  {"country": "Israel",         "code": "ISR", "index": "TA-125",              "flag": "🇮🇱",
                   "goodReasons": ["Tech sector resilience with strong AI and cybersecurity companies","Defence sector stocks surging on elevated military spending","Ceasefire hopes providing intermittent relief rallies"],
                   "badReasons":  ["Direct involvement in Middle East conflict creating existential risk","Military reservist call-ups reducing civilian economic output","Foreign investment hesitancy due to geopolitical uncertainty"]},
    "^STI":       {"country": "Singapore",      "code": "SGP", "index": "STI",                 "flag": "🇸🇬",
                   "goodReasons": ["Financial hub status attracting wealth management inflows","Banking sector (DBS, OCBC, UOB) delivering record profits","Data center boom driving REITs and tech infrastructure"],
                   "badReasons":  ["Trade-dependent economy vulnerable to global slowdown","Property market cooling measures limiting real estate gains","Rising oil prices increasing import costs for city-state"]},
}

TICKER_SYMBOLS = list(COUNTRY_META.keys())

# ── Shared mutable state ─────────────────────────────────────────
latest_data = {"lastUpdated": None, "countries": []}
fetch_lock = asyncio.Lock()


def parse_number(s):
    """Parse a number string, handling commas."""
    if not s:
        return None
    try:
        return float(s.replace(",", "").strip())
    except ValueError:
        return None


def parse_markdown_content(content):
    """Parse per-ticker quote sections from the markdown content."""
    countries = []
    for ticker, meta in COUNTRY_META.items():
        entry = {**meta}
        # Find the data row for this ticker
        # Pattern: | ticker | name | ... | price | change | changesPercentage | ... |
        pattern = rf'\| {re.escape(ticker)} \|'
        for line in content.split("\n"):
            if re.search(pattern, line):
                parts = [p.strip() for p in line.split("|")]
                parts = [p for p in parts if p]  # remove empty strings
                if len(parts) >= 8:
                    # Columns: symbol, name, timestamp, fetched_at, market_status, price, change, changesPercentage, [more...]
                    try:
                        entry["price"] = parse_number(parts[5])
                        entry["change"] = parse_number(parts[6])
                        entry["changePercent"] = parse_number(parts[7])
                        if len(parts) > 8:
                            entry["yearLow"] = parse_number(parts[8])
                        if len(parts) > 9:
                            entry["yearHigh"] = parse_number(parts[9])
                    except (IndexError, TypeError):
                        pass
                break
        countries.append(entry)
    return countries


def parse_csv_from_url(url):
    """Download and parse CSV data."""
    try:
        with urllib.request.urlopen(url, timeout=15) as resp:
            text = resp.read().decode("utf-8")
        reader = csv.DictReader(io.StringIO(text))
        rows = {}
        for row in reader:
            sym = row.get("symbol", "")
            rows[sym] = row

        countries = []
        for ticker, meta in COUNTRY_META.items():
            entry = {**meta}
            row = rows.get(ticker)
            if row:
                entry["price"] = parse_number(row.get("price"))
                entry["change"] = parse_number(row.get("change"))
                entry["changePercent"] = parse_number(row.get("changesPercentage"))
                entry["yearLow"] = parse_number(row.get("yearLow"))
                entry["yearHigh"] = parse_number(row.get("yearHigh"))
            countries.append(entry)
        return countries
    except Exception as e:
        print(f"[parse_csv] ERROR: {e}")
        return None


async def refresh_data():
    """Refresh market data from the finance API."""
    global latest_data
    async with fetch_lock:
        print("[refresh] Fetching fresh market data...")
        try:
            proc = await asyncio.create_subprocess_exec(
                "external-tool", "call", json.dumps({
                    "source_id": "finance",
                    "tool_name": "finance_quotes",
                    "arguments": {
                        "ticker_symbols": TICKER_SYMBOLS,
                        "fields": ["price", "change", "changesPercentage",
                                   "yearLow", "yearHigh"],
                    },
                }),
                stdout=asyncio.subprocess.PIPE,
                stderr=asyncio.subprocess.PIPE,
            )
            stdout, stderr = await proc.communicate()
            if proc.returncode != 0:
                print(f"[refresh] CLI error: {stderr.decode()}")
                return

            result = json.loads(stdout.decode())
            countries = None

            # Try CSV first (most reliable)
            csv_files = result.get("csv_files", [])
            if csv_files:
                url = csv_files[0].get("url")
                if url:
                    countries = parse_csv_from_url(url)

            # Fallback: parse markdown content
            if not countries or not any(c.get("price") for c in countries):
                content = result.get("content", "")
                if content:
                    countries = parse_markdown_content(content)

            if countries and any(c.get("price") for c in countries):
                latest_data = {
                    "lastUpdated": datetime.now(timezone.utc).isoformat(),
                    "countries": countries,
                }
                valid = sum(1 for c in countries if c.get("price"))
                print(f"[refresh] ✓ Updated {valid}/{len(countries)} countries with live prices")
            else:
                print("[refresh] No valid data extracted, keeping old data")

        except Exception as e:
            print(f"[refresh] Exception: {e}")
            import traceback
            traceback.print_exc()


async def periodic_refresh():
    """Background task: refresh data every hour."""
    while True:
        await refresh_data()
        await asyncio.sleep(3600)  # 1 hour


@asynccontextmanager
async def lifespan(app):
    task = asyncio.create_task(periodic_refresh())
    yield
    task.cancel()


app = FastAPI(lifespan=lifespan)
app.add_middleware(CORSMiddleware, allow_origins=["*"], allow_methods=["*"], allow_headers=["*"])


@app.get("/api/market-data")
def get_market_data():
    return latest_data


@app.post("/api/refresh")
async def force_refresh():
    await refresh_data()
    return {"status": "refreshed", "lastUpdated": latest_data.get("lastUpdated")}


if __name__ == "__main__":
    import uvicorn
    uvicorn.run(app, host="0.0.0.0", port=8000)
