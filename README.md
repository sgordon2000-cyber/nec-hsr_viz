# NEC High-Speed Rail Visualizer

An interactive side-by-side animation showing the difference between **today's Acela** and the **proposed high-speed rail** on the Northeast Corridor — based on the [Marron Institute's NEC Report](https://nec.transitcosts.com/) by Alon Levy & Devin Wilkins.

## 🚄 Live Demo

> Deploy to GitHub Pages and paste link here

## Features

- **Real-time race animation** — watch both trains travel simultaneously
- **Three routes**: New York↔DC, New York↔Boston, Full Corridor
- **Speed visualization** — color-coded speed zones on each track
- **Live stats** — elapsed time, current speed, station name for each train
- **Arrival banner** — shows how far ahead HSR arrives
- **1×/2×/4× simulation speeds**
- **Station-by-station table** with time savings

## Data Sources

All timing data is based on the Marron Institute report:
- Current Acela: NY–DC 2h 56m, NY–Boston 3h 30m
- Proposed HSR: NY–DC 1h 56m, NY–Boston 1h 56m
- Infrastructure cost: $12.5B (vs. Amtrak's $117B 15-year plan)

## Deploy to GitHub Pages

1. Fork or clone this repository
2. Go to **Settings → Pages**
3. Under Source, select **Deploy from a branch**
4. Choose `main` branch, `/ (root)` folder
5. Click Save — your site will be live at `https://yourusername.github.io/nec-hsr/`

## Local Development

No build step needed — pure HTML, CSS, and vanilla JS.

```bash
git clone https://github.com/yourusername/nec-hsr
cd nec-hsr
# Open index.html in your browser, or use any static server:
npx serve .
```

## Project Structure

```
nec-hsr/
├── index.html          # Main page
├── css/
│   └── style.css       # All styles
├── js/
│   ├── route-data.js   # Station timing & speed profiles
│   ├── map-draw.js     # SVG map generation
│   └── race.js         # Animation engine
└── README.md
```

## Customizing

**To adjust timing data**, edit `js/route-data.js`. Each route has:
- `currentMinutes` / `proposedMinutes` — total journey time
- `stations[]` — stops with position (0–1) and time at each
- `currentSpeeds[]` / `proposedSpeeds[]` — speed profile along the route

**To add a new route**, add an entry to `window.ROUTES` and a button in `index.html`.

## Credits

- Report: *How to Build High-Speed Rail on the Northeast Corridor* — Alon Levy & Devin Wilkins, Marron Institute at NYU
- Interactive site: [nec.transitcosts.com](https://nec.transitcosts.com/)

## License

MIT — free to use, modify, and share.
