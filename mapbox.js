// mapbox.js — NEC current vs proposed HSR with real bypass geometry

const MAPBOX_TOKEN = 'pk.eyJ1Ijoic2dvcmRvbjIwMDAiLCJhIjoiY21veW12ZW52MDgzcjJzbXowcWwzNzc0ZiJ9.888GrTBMQEBvEZSXiPM07w';

const BOUNDS = {
  nydc:  [[-77.3, 38.6], [-73.7, 41.0]],
  nybos: [[-74.3, 40.5], [-70.8, 42.6]],
  full:  [[-77.3, 38.6], [-70.8, 42.6]],
};

window.mapboxState = {
  map: null,
  routeKey: 'full',
  routeReady: false,
  currentCoords: null,
  proposedCoords: null,
  _popups: [],
};

window.initMapbox = function() {
  if (!window.mapboxgl)    { console.warn('Mapbox GL not loaded');    return; }
  if (!window.NEC_COORDS)  { console.warn('route-coords.js not loaded'); return; }

  mapboxgl.accessToken = MAPBOX_TOKEN;

  const map = new mapboxgl.Map({
    container: 'map',
    style: 'mapbox://styles/mapbox/light-v11',
    center: [-75.5, 39.9],
    zoom: 6,
    attributionControl: false,
  });

  window.mapboxState.map = map;
  map.addControl(new mapboxgl.NavigationControl({ visualizePitch: false }), 'top-right');

  map.on('load', () => {
    // Always show the full corridor on the map
    const nec = routeCoords('full', window.NEC_COORDS);
    const hsr = routeCoords('full', window.HSR_COORDS);

    // Insert below first label layer
    const labelLayer = map.getStyle().layers.find(
      l => l.type === 'symbol' && l.layout?.['text-field']
    );
    const before = labelLayer?.id;

    // ── Sources ───────────────────────────────────────────────────────────────
    map.addSource('nec-src',      { type: 'geojson', data: lineFeature(nec) });
    map.addSource('hsr-src',      { type: 'geojson', data: lineFeature(hsr) });
    map.addSource('current-train',{ type: 'geojson', data: pointFeature(nec[0]) });
    map.addSource('proposed-train',{ type: 'geojson', data: pointFeature(hsr[0]) });

    // Bypass highlight sources
    if (window.HSR_BYPASSES) {
      window.HSR_BYPASSES.forEach((b, i) => {
        map.addSource(`bypass-${i}`, { type: 'geojson', data: lineFeature(b.coords) });
      });
    }

    // ── Layers ────────────────────────────────────────────────────────────────

    // NEC current — solid blue
    map.addLayer({
      id: 'nec-line',
      type: 'line',
      source: 'nec-src',
      paint: {
        'line-color': '#2563EB',
        'line-width': 3.5,
        'line-opacity': 0.85,
      },
    }, before);

    // HSR proposed — solid red, slightly thinner so both are visible
    map.addLayer({
      id: 'hsr-line',
      type: 'line',
      source: 'hsr-src',
      paint: {
        'line-color': '#DC2626',
        'line-width': 2.5,
        'line-opacity': 0.9,
        'line-dasharray': [6, 0], // solid
      },
    }, before);

    // Bypass highlight — bright orange, thicker, on top
    if (window.HSR_BYPASSES) {
      window.HSR_BYPASSES.forEach((b, i) => {
        map.addLayer({
          id: `bypass-line-${i}`,
          type: 'line',
          source: `bypass-${i}`,
          paint: {
            'line-color': '#F59E0B',
            'line-width': 4,
            'line-opacity': 1,
            'line-dasharray': [1, 0],
          },
        });
      });
    }

    // Train dots — above everything
    map.addLayer({
      id: 'current-train-point',
      type: 'circle',
      source: 'current-train',
      paint: {
        'circle-radius': 9,
        'circle-color': '#2563EB',
        'circle-stroke-width': 2.5,
        'circle-stroke-color': '#fff',
      },
    });

    map.addLayer({
      id: 'proposed-train-point',
      type: 'circle',
      source: 'proposed-train',
      paint: {
        'circle-radius': 9,
        'circle-color': '#DC2626',
        'circle-stroke-width': 2.5,
        'circle-stroke-color': '#fff',
      },
    });

    // ── Bypass popups on click ────────────────────────────────────────────────
    if (window.HSR_BYPASSES) {
      window.HSR_BYPASSES.forEach((b, i) => {
        map.on('click', `bypass-line-${i}`, (e) => {
          new mapboxgl.Popup({ closeButton: true, maxWidth: '260px' })
            .setLngLat(e.lngLat)
            .setHTML(`
              <div style="font-family:'Instrument Sans',sans-serif;padding:4px">
                <div style="font-weight:700;font-size:13px;color:#92400e;margin-bottom:4px">
                  🚄 ${b.label}
                </div>
                <div style="font-size:12px;color:#44403c;line-height:1.5">${b.description}</div>
              </div>`)
            .addTo(map);
        });
        map.on('mouseenter', `bypass-line-${i}`, () => map.getCanvas().style.cursor = 'pointer');
        map.on('mouseleave', `bypass-line-${i}`, () => map.getCanvas().style.cursor = '');
      });
    }

    window.mapboxState.currentCoords  = routeCoords('full', window.NEC_COORDS);
    window.mapboxState.proposedCoords = routeCoords('full', window.HSR_COORDS);
    window.mapboxState.routeReady = true;

    fitRoute(map, 'full');
    window.updateMapMarkers(0, 0);
    addBypassMarkers(map);
  });
};

function addBypassMarkers(map) {
  if (!window.HSR_BYPASSES) return;
  window.HSR_BYPASSES.forEach(b => {
    const el = document.createElement('div');
    el.title = b.label;
    el.style.cssText = `
      width: 20px; height: 20px;
      background: #F59E0B;
      border: 2px solid #fff;
      border-radius: 50%;
      display: flex; align-items: center; justify-content: center;
      font-size: 11px; font-weight: 700; color: white;
      cursor: pointer; box-shadow: 0 1px 4px rgba(0,0,0,0.3);
    `;
    el.textContent = '✦';
    new mapboxgl.Marker({ element: el })
      .setLngLat(b.midpoint)
      .setPopup(new mapboxgl.Popup({ offset: 14, maxWidth: '260px' }).setHTML(`
        <div style="font-family:'Instrument Sans',sans-serif;padding:4px">
          <div style="font-weight:700;font-size:13px;color:#92400e;margin-bottom:4px">✦ ${b.label}</div>
          <div style="font-size:12px;color:#44403c;line-height:1.5">${b.description}</div>
        </div>`))
      .addTo(map);
  });
}

window.setMapRoute = function(routeKey) {
  const { map, routeReady } = window.mapboxState;
  if (!map || !routeReady) return;

  // Lines always show the full corridor — only train dots change
  const nec = routeCoords(routeKey, window.NEC_COORDS);
  const hsr = routeCoords(routeKey, window.HSR_COORDS);

  window.mapboxState.routeKey       = routeKey;
  window.mapboxState.currentCoords  = nec;
  window.mapboxState.proposedCoords = hsr;

  // Don't update line sources — they always show full corridor
  fitRoute(map, routeKey);
  window.updateMapMarkers(0, 0);
};

function fitRoute(map, routeKey) {
  const [[w, s], [e, n]] = BOUNDS[routeKey];
  map.fitBounds([[w, s], [e, n]], { padding: 60, duration: 700 });
}

function routeCoords(routeKey, coordsMap) {
  const coords = coordsMap[routeKey] || coordsMap.nydc;
  return routeKey === 'full' ? [...coords].reverse() : coords;
}

// ── Geometry ──────────────────────────────────────────────────────────────────

function pointAlong(coords, frac) {
  frac = Math.max(0, Math.min(1, frac));
  const total = totalDist(coords);
  const target = frac * total;
  let traveled = 0;
  for (let i = 1; i < coords.length; i++) {
    const seg = segDist(coords[i-1], coords[i]);
    if (traveled + seg >= target) {
      const t = (target - traveled) / seg;
      return [
        coords[i-1][0] + (coords[i][0] - coords[i-1][0]) * t,
        coords[i-1][1] + (coords[i][1] - coords[i-1][1]) * t,
      ];
    }
    traveled += seg;
  }
  return coords[coords.length - 1];
}

function totalDist(pts) {
  let t = 0;
  for (let i = 1; i < pts.length; i++) t += segDist(pts[i-1], pts[i]);
  return t;
}

function segDist(a, b) {
  const R = 6371000, r = Math.PI / 180;
  const h = Math.sin(((b[1]-a[1])*r)/2)**2
          + Math.cos(a[1]*r) * Math.cos(b[1]*r) * Math.sin(((b[0]-a[0])*r)/2)**2;
  return 2 * R * Math.atan2(Math.sqrt(h), Math.sqrt(1-h));
}

function lineFeature(coords) {
  return { type:'Feature', geometry:{ type:'LineString', coordinates:coords }, properties:{} };
}
function pointFeature(coord) {
  return { type:'Feature', geometry:{ type:'Point', coordinates:coord }, properties:{} };
}

// ── Public API ────────────────────────────────────────────────────────────────

window.updateMapMarkers = function(currentProgress, proposedProgress) {
  const { map, currentCoords, proposedCoords, routeReady } = window.mapboxState;
  if (!map || !routeReady || !currentCoords) return;
  map.getSource('current-train')?.setData(pointFeature(pointAlong(currentCoords, currentProgress)));
  map.getSource('proposed-train')?.setData(pointFeature(pointAlong(proposedCoords, proposedProgress)));
};

window.addEventListener('DOMContentLoaded', initMapbox);