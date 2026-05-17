# NEC High-Speed Rail Visualizer

An interactive visualization comparing **today's Acela service** with the **proposed high-speed rail** on the Northeast Corridor.

This project shows:
- a Mapbox base map with the full NEC corridor drawn in blue,
- overlaid proposed HSR geometry in red,
- animated train markers along route-specific segments,
- a side-by-side track race animation for current vs proposed service,
- three route options: `nydc`, `nybos`, and `full`.

## 🚄 What’s included

- `index.html` — UI, controls, map container, and buttons
- `style.css` — layout, panel styles, buttons, and responsive rules
- `route-data.js` — route definitions, station timing, and speed profiles
- `route-coords.js` — full route coordinate arrays used by Mapbox markers
- `mapbox.js` — Mapbox setup, route rendering, train dot animation,
  and route switching logic
- `map-draw.js` — SVG track diagram rendering for the two panels
- `race.js` — animation engine, progress bars, elapsed time, and station labels

## Key behavior

- The app now defaults to the **Full Corridor** route.
- The full route map is displayed **southbound**, from Boston South Station to Washington DC.
- The Mapbox route lines remain the full corridor, while train dots move according
  to the currently selected route.
- Route selection updates both the SVG race view and the map markers.

## Usage

1. Open `index.html` in a browser.
2. Select a route using the route buttons.
3. Click **Start Race** to animate both services.
4. Use `1×`, `2×`, or `4×` to change simulation speed.

## Development notes

### Route data

- `route-data.js` defines the route metadata in `window.ROUTES`.
- Each route entry contains:
  - `label`, `startLabel`, `endLabel`
  - `currentMinutes` / `proposedMinutes`
  - `stations[]` with `name`, `pos`, `currentMin`, and `proposedMin`
  - `currentSpeeds[]` / `proposedSpeeds[]` for interpolated speed display

### Mapbox geometry

- `route-coords.js` provides the coordinate arrays used by `mapbox.js`.
- The map shows the full corridor geometry as a static line.
- `mapbox.js` updates the animated train point positions based on the selected route.

### SVG track panels

- `map-draw.js` draws the two vertical route diagrams for current and proposed trains.
- It uses the `pos` values from `window.ROUTES` to place stations and speed bands.

### Cleaned-up files

The project no longer uses legacy OSM/GeoJSON data files (`data/nec-osm.json`, `data/nec-osm-raw.json`, `data/amtrak-routes.geojson`, `transitcosts-route.geojson`).

## Customization

### Change route timing

Edit `route-data.js` and update the route object values:
- `currentMinutes`
- `proposedMinutes`
- `stations[].pos`
- `stations[].currentMin`
- `stations[].proposedMin`
- `currentSpeeds[]`
- `proposedSpeeds[]`

### Add a new route

1. Add a new route object to `window.ROUTES` in `route-data.js`.
2. Add a route button in `index.html` with `data-route="<new-key>"`.
3. Add a corresponding bounds entry in `mapbox.js` if you want map auto-fit behavior.

## Running locally

No build tooling is required.

```bash
git clone https://github.com/yourusername/nec-hsr_viz.git
cd nec-hsr_viz
# open index.html directly or use a local server
npx serve .
```

## Notes

- This is a pure client-side project using vanilla JavaScript and Mapbox GL JS.
- The live map uses `mapbox://styles/mapbox/light-v11` and requires a Mapbox access token in `mapbox.js`.
- The UI is designed as a visualization and not a production transit planning tool.

## License

MIT — free to use, modify, and share.
