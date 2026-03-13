# Global Markets — Live Performance Map

### [🌍 View Live Demo](https://www.perplexity.ai/computer/a/global-markets-live-performanc-b1PdVFDlSZijqXUCDnb1TA)

Interactive 3D globe showing real-time stock market performance for 32 countries. Color-coded by daily change (green = gaining, red = declining). Hover any country for index price, % change, and top 3 reasons driving performance.

## Features

- **Interactive globe** — drag to rotate, scroll to zoom, double-click to zoom in
- **Region presets** — one-click views for Americas, Europe, Asia, Africa
- **Live data** — fetches real-time quotes from finance API, auto-refreshes every hour
- **Hover tooltips** — country flag, index name, price, daily change, and top 3 reasons (bullish or bearish)
- **32 indices tracked** — S&P 500, FTSE 100, Nikkei 225, DAX, CAC 40, SSE Composite, Hang Seng, NIFTY 50, and 24 more

## Tech Stack

- **Frontend:** D3.js (orthographic projection + TopoJSON), vanilla JS, CSS
- **Backend:** Python FastAPI — fetches quotes via finance API, serves `/api/market-data`
- **Data:** Real-time quotes for 32 global stock indices

## Quick Start

```bash
pip install fastapi uvicorn
python api_server.py
# Backend runs on http://localhost:8000

# Serve frontend
npx serve . -l 3000
# Open http://localhost:3000
```

## File Structure

```
├── index.html        # Main page
├── app.js            # D3 globe, interactions, tooltips, live data fetch
├── style.css         # Component styles
├── base.css          # Dark theme base
├── api_server.py     # FastAPI backend (hourly data refresh)
└── README.md
```

## Screenshot

![Global Markets Map](https://img.shields.io/badge/status-live-brightgreen)

Dark-themed 3D globe with red/green country shading by daily stock performance. Hover for detailed tooltips with price data and market analysis.
