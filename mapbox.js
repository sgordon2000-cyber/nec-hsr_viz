// mapbox.js — loads real route geojson and animates markers on the map

const MAPBOX_TOKEN = 'pk.eyJ1Ijoic2dvcmRvbjIwMDAiLCJhIjoiY21veW12ZW52MDgzcjJzbXowcWwzNzc0ZiJ9.888GrTBMQEBvEZSXiPM07w';
const AMTRAK_GEOJSON = 'data/amtrak-routes.geojson';
const TRANSITCOSTS_GEOJSON = 'data/transitcosts-route.geojson';

window.mapboxState = {
  map: null,
  currentCoords: null,
  proposedCoords: null,
  currentDistance: 0,
  proposedDistance: 0,
};

window.initMapbox = function() {
  if (!window.mapboxgl) {
    console.warn('Mapbox GL JS is not loaded.');
    return;
  }

  mapboxgl.accessToken = MAPBOX_TOKEN;

  const map = new mapboxgl.Map({
    container: 'map',
    style: 'mapbox://styles/mapbox/light-v12',
    center: [-75.1652, 39.9526],
    zoom: 5.5,
    attributionControl: false,
  });

  window.mapboxState.map = map;
  map.addControl(new mapboxgl.NavigationControl({visualizePitch: false}), 'top-right');

  map.on('load', () => {
    Promise.all([loadJson(AMTRAK_GEOJSON), loadJson(TRANSITCOSTS_GEOJSON)])
      .then(([amtrakData, transitData]) => {
        setupRouteMap(map, amtrakData, transitData);
      })
      .catch((err) => {
        console.error('Mapbox route load failed:', err);
        showMapError(map, err);
      });
  });
};

function loadJson(url) {
  return fetch(url).then((res) => {
    if (!res.ok) throw new Error(`Failed to load ${url}: ${res.status}`);
    return res.json();
  });
}

function setupRouteMap(map, amtrakData, transitData) {
  const amtrakLine = pickLongestLine(amtrakData);
  const transitLine = pickLongestLine(transitData);

  if (!amtrakLine || !transitLine) {
    throw new Error('No valid LineString found in one of the geojson files.');
  }

  window.mapboxState.currentCoords = amtrakLine.coordinates;
  window.mapboxState.proposedCoords = transitLine.coordinates;
  window.mapboxState.currentDistance = totalLineDistance(amtrakLine.coordinates);
  window.mapboxState.proposedDistance = totalLineDistance(transitLine.coordinates);

  map.addSource('amtrak-route', { type: 'geojson', data: toGeoJsonFeature(amtrakLine.coordinates) });
  map.addSource('proposed-route', { type: 'geojson', data: toGeoJsonFeature(transitLine.coordinates) });
  map.addSource('current-train', { type: 'geojson', data: buildPointGeoJson(amtrakLine.coordinates[0]) });
  map.addSource('proposed-train', { type: 'geojson', data: buildPointGeoJson(transitLine.coordinates[0]) });

  map.addLayer({
    id: 'amtrak-route-line',
    type: 'line',
    source: 'amtrak-route',
    paint: {
      'line-color': '#2563EB',
      'line-width': 4,
      'line-opacity': 0.8,
    },
  });

  map.addLayer({
    id: 'proposed-route-line',
    type: 'line',
    source: 'proposed-route',
    paint: {
      'line-color': '#DC2626',
      'line-width': 4,
      'line-opacity': 0.8,
      'line-dasharray': [2, 2],
    },
  });

  map.addLayer({
    id: 'current-train-point',
    type: 'circle',
    source: 'current-train',
    paint: {
      'circle-radius': 7,
      'circle-color': '#2563EB',
      'circle-stroke-width': 2,
      'circle-stroke-color': '#fff',
    },
  });

  map.addLayer({
    id: 'proposed-train-point',
    type: 'circle',
    source: 'proposed-train',
    paint: {
      'circle-radius': 7,
      'circle-color': '#DC2626',
      'circle-stroke-width': 2,
      'circle-stroke-color': '#fff',
    },
  });

  const bounds = new mapboxgl.LngLatBounds();
  [...amtrakLine.coordinates, ...transitLine.coordinates].forEach((coord) => bounds.extend(coord));
  map.fitBounds(bounds, { padding: 40, maxZoom: 7, duration: 0 });

  window.updateMapMarkers(0, 0);
}

function pickLongestLine(data) {
  if (!data) return null;

  if (data.type === 'FeatureCollection') {
    let best = null;
    let bestLen = -1;
    data.features.forEach((feature) => {
      const coords = getLineCoords(feature.geometry);
      if (coords && coords.length > 1) {
        const len = totalLineDistance(coords);
        if (len > bestLen) {
          bestLen = len;
          best = coords;
        }
      }
    });
    return best ? { type: 'LineString', coordinates: best } : null;
  }

  if (data.type === 'Feature') {
    const coords = getLineCoords(data.geometry);
    return coords && coords.length > 1 ? { type: 'LineString', coordinates: coords } : null;
  }

  if (data.type === 'LineString') {
    return data;
  }

  if (data.type === 'MultiLineString') {
    let best = null;
    let bestLen = -1;
    data.coordinates.forEach((coords) => {
      const len = totalLineDistance(coords);
      if (len > bestLen) {
        bestLen = len;
        best = coords;
      }
    });
    return best ? { type: 'LineString', coordinates: best } : null;
  }

  return null;
}

function getLineCoords(geometry) {
  if (!geometry) return null;
  if (geometry.type === 'LineString') return geometry.coordinates;
  if (geometry.type === 'MultiLineString') {
    let best = null;
    let bestLen = -1;
    geometry.coordinates.forEach((coords) => {
      const len = totalLineDistance(coords);
      if (len > bestLen) {
        bestLen = len;
        best = coords;
      }
    });
    return best;
  }
  return null;
}

function toGeoJsonFeature(coords) {
  return {
    type: 'Feature',
    geometry: {
      type: 'LineString',
      coordinates: coords,
    },
    properties: {},
  };
}

function buildPointGeoJson(coord) {
  return {
    type: 'Feature',
    geometry: {
      type: 'Point',
      coordinates: coord,
    },
    properties: {},
  };
}

function totalLineDistance(coords) {
  let total = 0;
  for (let i = 1; i < coords.length; i++) {
    total += distanceBetween(coords[i - 1], coords[i]);
  }
  return total;
}

function distanceBetween(a, b) {
  const R = 6371000; // meters
  const rad = Math.PI / 180;
  const lat1 = a[1] * rad;
  const lat2 = b[1] * rad;
  const dLat = (b[1] - a[1]) * rad;
  const dLng = (b[0] - a[0]) * rad;
  const sinLat = Math.sin(dLat / 2);
  const sinLng = Math.sin(dLng / 2);
  const h = sinLat * sinLat + Math.cos(lat1) * Math.cos(lat2) * sinLng * sinLng;
  return 2 * R * Math.atan2(Math.sqrt(h), Math.sqrt(1 - h));
}

function pointAlongLine(coords, fraction) {
  if (!coords || coords.length === 0) return null;
  fraction = Math.max(0, Math.min(1, fraction));

  const total = totalLineDistance(coords);
  const target = fraction * total;
  let traveled = 0;

  for (let i = 1; i < coords.length; i++) {
    const start = coords[i - 1];
    const end = coords[i];
    const segLen = distanceBetween(start, end);
    if (traveled + segLen >= target) {
      const segmentFraction = (target - traveled) / segLen;
      return [
        start[0] + (end[0] - start[0]) * segmentFraction,
        start[1] + (end[1] - start[1]) * segmentFraction,
      ];
    }
    traveled += segLen;
  }

  return coords[coords.length - 1];
}

function showMapError(map, error) {
  const fallback = document.createElement('div');
  fallback.style.position = 'absolute';
  fallback.style.top = '0';
  fallback.style.left = '0';
  fallback.style.width = '100%';
  fallback.style.height = '100%';
  fallback.style.background = 'rgba(255,255,255,0.92)';
  fallback.style.display = 'flex';
  fallback.style.alignItems = 'center';
  fallback.style.justifyContent = 'center';
  fallback.style.textAlign = 'center';
  fallback.style.padding = '24px';
  fallback.style.color = '#111827';
  fallback.innerHTML = `<div><strong>Unable to load Mapbox geojson routes.</strong><br>${error.message}</div>`;
  map.getContainer().appendChild(fallback);
}

window.updateMapMarkers = function(currentProgress, proposedProgress) {
  const state = window.mapboxState;
  if (!state.map || !state.currentCoords || !state.proposedCoords) return;

  const currentCoord = pointAlongLine(state.currentCoords, currentProgress);
  const proposedCoord = pointAlongLine(state.proposedCoords, proposedProgress);

  if (currentCoord) {
    const source = state.map.getSource('current-train');
    if (source) source.setData(buildPointGeoJson(currentCoord));
  }
  if (proposedCoord) {
    const source = state.map.getSource('proposed-train');
    if (source) source.setData(buildPointGeoJson(proposedCoord));
  }
};

window.addEventListener('DOMContentLoaded', initMapbox);
