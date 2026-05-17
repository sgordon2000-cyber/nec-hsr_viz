// ============================================================
// mapbox.js — NEC High-Speed Rail Mapbox Visualization
//
// What this file does:
//   1. Initializes a Mapbox GL map inside #map
//   2. Draws the real NEC route (blue) from route-coords.js
//   3. Draws the proposed HSR route (green) from route-coords.js
//   4. Draws bypass segments (amber) from HSR_BYPASSES
//   5. Animates two train dots along each route
//   6. Provides a "Follow trains" camera mode that zooms in
//      and tracks both dots as they move
//
// Dependencies (must load before this file):
//   - mapbox-gl@2.15.0 JS + CSS (CDN)
//   - route-coords.js  → sets window.NEC_COORDS, window.HSR_COORDS,
//                        window.HSR_BYPASSES
//
// Public API (called by race.js):
//   window.updateMapMarkers(currentProgress, proposedProgress)
//   window.setMapRoute(routeKey)
//   window.resetMapCamera()
// ============================================================


// ── Configuration ─────────────────────────────────────────────────────────────

const MAPBOX_TOKEN = 'pk.eyJ1Ijoic2dvcmRvbjIwMDAiLCJhIjoiY21veW12ZW52MDgzcjJzbXowcWwzNzc0ZiJ9.888GrTBMQEBvEZSXiPM07w';

// Bounding boxes for each route used by fitRoute().
// Format: [[west, south], [east, north]]
const BOUNDS = {
  nydc:  [[-77.3, 38.6], [-73.7, 41.0]],
  nybos: [[-74.3, 40.5], [-70.8, 42.6]],
  full:  [[-77.3, 38.6], [-70.8, 42.6]],
};

// Camera mode — toggled by the "Follow trains" button.
// 'overview': map stays at the route bounding box
// 'follow':   map zooms in and tracks both train dots each frame
let cameraMode = 'overview';


// ── Shared state ──────────────────────────────────────────────────────────────

// All map state is on window.mapboxState so race.js can
// call window.updateMapMarkers() without importing anything.
window.mapboxState = {
  map: null,            // The Mapbox GL Map instance
  routeKey: 'full',     // Currently selected route key
  routeReady: false,    // True once map.on('load') has finished
  currentCoords: null,  // NEC coordinate array for the selected route
  proposedCoords: null, // HSR coordinate array for the selected route
};


// ── Initialization ────────────────────────────────────────────────────────────

window.initMapbox = function() {
  // Guard: bail if dependencies haven't loaded yet
  if (!window.mapboxgl) {
    console.warn('mapbox.js: mapbox-gl script not loaded');
    return;
  }
  if (!window.NEC_COORDS) {
    console.warn('mapbox.js: route-coords.js not loaded — NEC_COORDS missing');
    return;
  }

  mapboxgl.accessToken = MAPBOX_TOKEN;

  const map = new mapboxgl.Map({
    container: 'map',          // ID of the div in index.html
    style: 'mapbox://styles/mapbox/light-v11',
    center: [-75.5, 39.9],     // Roughly center of NEC corridor
    zoom: 6,
    minZoom: 4,
    maxZoom: 14,
    attributionControl: false, // We rely on the default Mapbox credit
  });

  window.mapboxState.map = map;

  // IMPORTANT: call map.resize() after a short delay.
  // When the map div is inside a CSS grid, the browser may
  // not have finished calculating the grid layout when Mapbox
  // initializes. Without resize(), the map renders into a
  // 0-height container and shows blank.
  setTimeout(function() { map.resize(); }, 150);

  // Also resize whenever the browser window changes size
  window.addEventListener('resize', function() { map.resize(); });

  // Add zoom/pan controls to the top-right corner
  map.addControl(new mapboxgl.NavigationControl({ visualizePitch: false }), 'top-right');

  // Build the "Follow trains" toggle button and inject it into the map div
  buildCameraButton(map);

  // Once the map style has fully loaded, add our data layers
  map.on('load', function() {
    addRouteLayers(map);
  });
};


// ── Camera toggle button ──────────────────────────────────────────────────────

function buildCameraButton(map) {
  var btn = document.createElement('button');
  btn.id = 'camera-toggle';
  btn.textContent = 'Follow trains';
  btn.style.cssText = [
    'position:absolute',
    'bottom:40px',
    'right:10px',
    'z-index:10',
    'background:#0f172a',
    'color:#fff',
    'border:none',
    'border-radius:8px',
    'padding:8px 14px',
    'font-size:12px',
    "font-family:'Instrument Sans',sans-serif",
    'font-weight:600',
    'cursor:pointer',
    'box-shadow:0 2px 6px rgba(0,0,0,0.25)',
    'transition:background 0.15s',
  ].join(';');

  btn.addEventListener('click', function() {
    if (cameraMode === 'overview') {
      // Switch to follow mode
      cameraMode = 'follow';
      btn.textContent = 'Overview';
      btn.style.background = '#DC2626'; // Red = active/following
    } else {
      // Switch back to overview
      cameraMode = 'overview';
      btn.textContent = 'Follow trains';
      btn.style.background = '#0f172a';
      // Snap back to the full route bounding box immediately
      fitRoute(map, window.mapboxState.routeKey);
    }
  });

  document.getElementById('map').appendChild(btn);
}


// ── Route layers ──────────────────────────────────────────────────────────────

function addRouteLayers(map) {
  // Always display the full DC→Boston corridor regardless of
  // which route segment the race animation is showing.
  var nec = routeCoords('full', window.NEC_COORDS);
  var hsr = routeCoords('full', window.HSR_COORDS);

  // Find the first label layer so we can insert route lines
  // beneath it — this keeps city/state names readable on top.
  var labelLayer = map.getStyle().layers.find(function(l) {
    return l.type === 'symbol' && l.layout && l.layout['text-field'];
  });
  var before = labelLayer ? labelLayer.id : undefined;

  // ── GeoJSON sources ──────────────────────────────────────

  // Full NEC route geometry
  map.addSource('nec-src', { type: 'geojson', data: lineFeature(nec) });

  // Full HSR proposed route geometry
  map.addSource('hsr-src', { type: 'geojson', data: lineFeature(hsr) });

  // Animated train dot positions (updated every frame by updateMapMarkers)
  map.addSource('current-train',  { type: 'geojson', data: pointFeature(nec[0]) });
  map.addSource('proposed-train', { type: 'geojson', data: pointFeature(hsr[0]) });

  // One source per bypass segment
  if (window.HSR_BYPASSES) {
    window.HSR_BYPASSES.forEach(function(b, i) {
      map.addSource('bypass-' + i, { type: 'geojson', data: lineFeature(b.coords) });
    });
  }

  // ── Line layers (drawn below labels) ─────────────────────

  // Current NEC — solid dark blue
  map.addLayer({
    id: 'nec-line',
    type: 'line',
    source: 'nec-src',
    paint: {
      'line-color': '#003399',
      'line-width': 3.5,
      'line-opacity': 0.85,
    },
  }, before);

  // Proposed HSR — solid green, slightly thinner so both are
  // visible where the routes overlap
  map.addLayer({
    id: 'hsr-line',
    type: 'line',
    source: 'hsr-src',
    paint: {
      'line-color': '#16a34a',
      'line-width': 2.5,
      'line-opacity': 0.9,
    },
  }, before);

  // Bypass segments — amber, drawn on top of both route lines
  // so they're clearly visible as diverging alignments
  if (window.HSR_BYPASSES) {
    window.HSR_BYPASSES.forEach(function(b, i) {
      map.addLayer({
        id: 'bypass-line-' + i,
        type: 'line',
        source: 'bypass-' + i,
        paint: {
          'line-color': '#F59E0B',
          'line-width': 4,
          'line-opacity': 1,
        },
      });
    });
  }

  // ── Train dot layers (drawn above everything) ─────────────

  map.addLayer({
    id: 'current-train-point',
    type: 'circle',
    source: 'current-train',
    paint: {
      'circle-radius': 9,
      'circle-color': '#003399',
      'circle-stroke-width': 2.5,
      'circle-stroke-color': '#ffffff',
    },
  });

  map.addLayer({
    id: 'proposed-train-point',
    type: 'circle',
    source: 'proposed-train',
    paint: {
      'circle-radius': 9,
      'circle-color': '#16a34a',
      'circle-stroke-width': 2.5,
      'circle-stroke-color': '#ffffff',
    },
  });

  // ── Bypass interactivity ──────────────────────────────────

  if (window.HSR_BYPASSES) {
    window.HSR_BYPASSES.forEach(function(b, i) {
      var layerId = 'bypass-line-' + i;

      // Show a popup when the user clicks a bypass segment
      map.on('click', layerId, function(e) {
        new mapboxgl.Popup({ closeButton: true, maxWidth: '260px' })
          .setLngLat(e.lngLat)
          .setHTML(
            '<div style="font-family:\'Instrument Sans\',sans-serif;padding:4px">' +
            '<div style="font-weight:700;font-size:13px;color:#92400e;margin-bottom:4px">' +
            'Bypass: ' + b.label +
            '</div>' +
            '<div style="font-size:12px;color:#44403c;line-height:1.5">' +
            b.description +
            '</div>' +
            '</div>'
          )
          .addTo(map);
      });

      // Pointer cursor on hover so users know it's clickable
      map.on('mouseenter', layerId, function() {
        map.getCanvas().style.cursor = 'pointer';
      });
      map.on('mouseleave', layerId, function() {
        map.getCanvas().style.cursor = '';
      });
    });
  }

  // ── Bypass dot markers ────────────────────────────────────
  addBypassMarkers(map);

  // ── Finalize state ────────────────────────────────────────

  // Set train dot coords to the initial route (full corridor)
  window.mapboxState.currentCoords  = routeCoords('full', window.NEC_COORDS);
  window.mapboxState.proposedCoords = routeCoords('full', window.HSR_COORDS);
  window.mapboxState.routeReady = true;

  // Fit map to full corridor and place dots at start
  fitRoute(map, 'full');
  window.updateMapMarkers(0, 0);
}


// ── Bypass dot markers ────────────────────────────────────────────────────────

function addBypassMarkers(map) {
  if (!window.HSR_BYPASSES) return;

  window.HSR_BYPASSES.forEach(function(b) {
    // Small amber circle marker at the midpoint of each bypass
    var el = document.createElement('div');
    el.title = b.label;
    el.style.cssText = [
      'width:12px',
      'height:12px',
      'background:#F59E0B',
      'border:1.5px solid #fff',
      'border-radius:50%',
      'cursor:pointer',
      'box-shadow:0 1px 3px rgba(0,0,0,0.2)',
      'display:flex',
      'align-items:center',
      'justify-content:center',
      'font-size:8px',
      'color:white',
      'font-weight:700',
    ].join(';');
    el.textContent = '\u2726'; // ✦

    var popup = new mapboxgl.Popup({ offset: 14, maxWidth: '260px' }).setHTML(
      '<div style="font-family:\'Instrument Sans\',sans-serif;padding:4px">' +
      '<div style="font-weight:700;font-size:13px;color:#92400e;margin-bottom:4px">' +
      '\u2726 ' + b.label +
      '</div>' +
      '<div style="font-size:12px;color:#44403c;line-height:1.5">' +
      b.description +
      '</div>' +
      '</div>'
    );

    new mapboxgl.Marker({ element: el })
      .setLngLat(b.midpoint)
      .setPopup(popup)
      .addTo(map);
  });
}


// ── Public API ────────────────────────────────────────────────────────────────

// Called by race.js every animation frame with progress values 0–1.
// Updates the position of both train dots on the map.
// In follow mode, also pans/zooms to keep both dots in view.
window.updateMapMarkers = function(currentProgress, proposedProgress) {
  var state = window.mapboxState;
  if (!state.map || !state.routeReady || !state.currentCoords) return;

  var cCoord = pointAlong(state.currentCoords,  currentProgress);
  var pCoord = pointAlong(state.proposedCoords, proposedProgress);

  // Update the GeoJSON source data — Mapbox re-renders automatically
  var cs = state.map.getSource('current-train');
  var ps = state.map.getSource('proposed-train');
  if (cs) cs.setData(pointFeature(cCoord));
  if (ps) ps.setData(pointFeature(pCoord));

  // Camera follow mode: fit the viewport to both train positions.
  // JITTER FIX: only call fitBounds when a train has moved at least
  // 0.015 degrees since the last call. Calling fitBounds every frame
  // (60fps) causes the camera animation to fight itself and makes
  // the bypass markers visibly shake.
  // ZOOM FIX: tight offsets (0.08/0.06 degrees) give a close-up view.
  // duration:1500 means the camera glides smoothly between updates.
  if (cameraMode === 'follow') {
    var last = state._lastFollowBounds;
    var moved = !last
      || Math.abs(cCoord[0] - last.cx) > 0.015
      || Math.abs(cCoord[1] - last.cy) > 0.015
      || Math.abs(pCoord[0] - last.px) > 0.015
      || Math.abs(pCoord[1] - last.py) > 0.015;

    if (moved) {
      state._lastFollowBounds = {
        cx: cCoord[0], cy: cCoord[1],
        px: pCoord[0], py: pCoord[1],
      };
      var w = Math.min(cCoord[0], pCoord[0]) - 0.25;
      var e = Math.max(cCoord[0], pCoord[0]) + 0.25;
      var s = Math.min(cCoord[1], pCoord[1]) - 0.18;
      var n = Math.max(cCoord[1], pCoord[1]) + 0.18;
      state.map.fitBounds([[w, s], [e, n]], {
        padding: 40,
        maxZoom: 8,
        duration: 1500,
        essential: false,
      });
    }
  }
};

// Called by race.js when the user changes the route selector.
// Updates which coordinate slice the train dots animate along,
// and pans the map to the appropriate bounding box.
window.setMapRoute = function(routeKey) {
  var state = window.mapboxState;
  if (!state.map || !state.routeReady) return;

  state.routeKey       = routeKey;
  state.currentCoords  = routeCoords(routeKey, window.NEC_COORDS);
  state.proposedCoords = routeCoords(routeKey, window.HSR_COORDS);

  // Route lines always show the full corridor — only the
  // train dot animation coords change here.
  if (cameraMode === 'overview') {
    fitRoute(state.map, routeKey);
  }

  window.updateMapMarkers(0, 0);
};

// Called by race.js when the race finishes or resets.
// Snaps the camera back to the overview bounding box.
window.resetMapCamera = function() {
  cameraMode = 'overview';
  var btn = document.getElementById('camera-toggle');
  if (btn) {
    btn.textContent = 'Follow trains';
    btn.style.background = '#0f172a';
  }
  fitRoute(window.mapboxState.map, window.mapboxState.routeKey);
};


// ── Internal helpers ──────────────────────────────────────────────────────────

// Fit the map to a predefined bounding box for the given route.
function fitRoute(map, routeKey) {
  var bounds = BOUNDS[routeKey] || BOUNDS.full;
  map.fitBounds(bounds, { padding: 60, duration: 700 });
}

// Return the coordinate array for a given route key.
// The 'full' route is stored DC→Boston in route-coords.js;
// we reverse it so the animation runs Boston→DC (matching
// the race panel direction).
function routeCoords(routeKey, coordsMap) {
  var coords = coordsMap[routeKey] || coordsMap.nydc;
  if (routeKey === 'full') {
    return coords.slice().reverse();
  }
  return coords;
}

// Interpolate a geographic point at fraction `frac` (0–1)
// along a coordinate array using great-circle distance.
function pointAlong(coords, frac) {
  frac = Math.max(0, Math.min(1, frac));
  var total = totalDist(coords);
  var target = frac * total;
  var traveled = 0;

  for (var i = 1; i < coords.length; i++) {
    var seg = segDist(coords[i - 1], coords[i]);
    if (traveled + seg >= target) {
      var t = (target - traveled) / seg;
      return [
        coords[i-1][0] + (coords[i][0] - coords[i-1][0]) * t,
        coords[i-1][1] + (coords[i][1] - coords[i-1][1]) * t,
      ];
    }
    traveled += seg;
  }

  return coords[coords.length - 1];
}

// Sum of great-circle distances between all consecutive points.
function totalDist(pts) {
  var t = 0;
  for (var i = 1; i < pts.length; i++) {
    t += segDist(pts[i - 1], pts[i]);
  }
  return t;
}

// Haversine distance in meters between two [lng, lat] points.
function segDist(a, b) {
  var R = 6371000;
  var r = Math.PI / 180;
  var dLat = (b[1] - a[1]) * r;
  var dLng = (b[0] - a[0]) * r;
  var h = Math.sin(dLat / 2) * Math.sin(dLat / 2)
        + Math.cos(a[1] * r) * Math.cos(b[1] * r)
        * Math.sin(dLng / 2) * Math.sin(dLng / 2);
  return 2 * R * Math.atan2(Math.sqrt(h), Math.sqrt(1 - h));
}

// Wrap a coordinate array in a GeoJSON LineString Feature.
function lineFeature(coords) {
  return {
    type: 'Feature',
    geometry: { type: 'LineString', coordinates: coords },
    properties: {},
  };
}

// Wrap a single coordinate in a GeoJSON Point Feature.
function pointFeature(coord) {
  return {
    type: 'Feature',
    geometry: { type: 'Point', coordinates: coord },
    properties: {},
  };
}


// ── Boot ──────────────────────────────────────────────────────────────────────

// initMapbox() is called once the DOM is ready.
// If DOMContentLoaded already fired (e.g. script is deferred),
// the readyState check ensures it still runs.
window.addEventListener('DOMContentLoaded', initMapbox);
if (document.readyState !== 'loading') {
  initMapbox();
}