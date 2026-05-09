// map-draw.js — draws the SVG route map in each panel

window.drawMaps = function(routeKey) {
  const route = window.ROUTES[routeKey];
  drawSingleMap('map-current',   route, 'current');
  drawSingleMap('map-proposed',  route, 'proposed');
};

function drawSingleMap(svgId, route, type) {
  const svg = document.getElementById(svgId);
  if (!svg) return;

  // Clear
  while (svg.firstChild) svg.removeChild(svg.firstChild);

  const W = 280, H = 620;
  const trackX = W / 2;
  const padTop = 40, padBot = 40;
  const trackTop = padTop;
  const trackH = H - padTop - padBot;

  const ns = 'http://www.w3.org/2000/svg';

  const mk = (tag, attrs) => {
    const el = document.createElementNS(ns, tag);
    for (const [k, v] of Object.entries(attrs)) el.setAttribute(k, v);
    return el;
  };

  // Background gradient (subtle)
  const defs = mk('defs', {});
  const grad = mk('linearGradient', { id: `bg-${svgId}`, x1: '0', y1: '0', x2: '0', y2: '1' });
  const s1 = mk('stop', { offset: '0%', 'stop-color': type === 'proposed' ? '#fff8f8' : '#f8f8ff', 'stop-opacity': '1' });
  const s2 = mk('stop', { offset: '100%', 'stop-color': '#f8fafc', 'stop-opacity': '1' });
  grad.appendChild(s1);
  grad.appendChild(s2);
  defs.appendChild(grad);
  svg.appendChild(defs);

  // BG rect
  svg.appendChild(mk('rect', {
    x: 0, y: 0, width: W, height: H,
    fill: `url(#bg-${svgId})`
  }));

  // Speed zone shading (background color bands by speed)
  const profile = type === 'current' ? route.currentSpeeds : route.proposedSpeeds;
  for (let i = 1; i < profile.length; i++) {
    const a = profile[i - 1], b = profile[i];
    const avgMph = (a.mph + b.mph) / 2;
    const yTop = trackTop + a.pos * trackH;
    const yBot = trackTop + b.pos * trackH;
    const color = speedColor(avgMph, type);
    svg.appendChild(mk('rect', {
      x: trackX - 32, y: yTop,
      width: 64, height: yBot - yTop,
      fill: color, opacity: 0.18,
      rx: 4
    }));
  }

  // Track line (railroad style — dashed center)
  // Outer track lines
  const trackColor = type === 'current' ? '#93c5fd' : '#fca5a5';
  svg.appendChild(mk('line', {
    x1: trackX - 6, y1: trackTop, x2: trackX - 6, y2: trackTop + trackH,
    stroke: trackColor, 'stroke-width': 2, opacity: 0.6
  }));
  svg.appendChild(mk('line', {
    x1: trackX + 6, y1: trackTop, x2: trackX + 6, y2: trackTop + trackH,
    stroke: trackColor, 'stroke-width': 2, opacity: 0.6
  }));

  // Railroad ties
  const tieCount = 28;
  for (let i = 0; i <= tieCount; i++) {
    const yy = trackTop + (i / tieCount) * trackH;
    svg.appendChild(mk('line', {
      x1: trackX - 14, y1: yy, x2: trackX + 14, y2: yy,
      stroke: trackColor, 'stroke-width': 2.5, opacity: 0.3
    }));
  }

  // Center line
  svg.appendChild(mk('line', {
    x1: trackX, y1: trackTop, x2: trackX, y2: trackTop + trackH,
    stroke: type === 'current' ? '#3b82f6' : '#ef4444',
    'stroke-width': 1.5,
    'stroke-dasharray': '6 4',
    opacity: 0.4
  }));

  // Station dots & labels
  route.stations.forEach((station, idx) => {
    const y = trackTop + station.pos * trackH;
    const isLeft = idx % 2 === 0;
    const labelX = isLeft ? trackX - 20 : trackX + 20;
    const anchor = isLeft ? 'end' : 'start';

    // Dot
    const dot = mk('circle', {
      cx: trackX, cy: y, r: 6,
      fill: '#fff',
      stroke: type === 'current' ? '#2563EB' : '#DC2626',
      'stroke-width': 2
    });
    dot.setAttribute('data-station', station.name);
    svg.appendChild(dot);

    // Tick line
    svg.appendChild(mk('line', {
      x1: isLeft ? trackX - 8 : trackX + 8,
      y1: y,
      x2: isLeft ? trackX - 18 : trackX + 18,
      y2: y,
      stroke: '#94a3b8', 'stroke-width': 1
    }));

    // City name
    const cityText = mk('text', {
      x: labelX, y: y - 2,
      'font-size': '11',
      'font-family': "'Instrument Sans', sans-serif",
      'font-weight': '600',
      fill: '#1e293b',
      'text-anchor': anchor,
      'dominant-baseline': 'auto'
    });
    cityText.textContent = station.name;
    svg.appendChild(cityText);

    // Time label
    const timeMin = type === 'current' ? station.currentMin : station.proposedMin;
    const timeText = mk('text', {
      x: labelX, y: y + 12,
      'font-size': '10',
      'font-family': "'DM Mono', monospace",
      fill: '#64748b',
      'text-anchor': anchor,
      'dominant-baseline': 'auto'
    });
    timeText.textContent = window.fmtTime(timeMin);
    svg.appendChild(timeText);
  });

  // Start / end city labels
  const startStation = route.stations[0];
  const endStation = route.stations[route.stations.length - 1];

  // Start (top)
  const startBg = mk('rect', {
    x: trackX - 60, y: 4, width: 120, height: 22, rx: 4,
    fill: type === 'current' ? '#EFF6FF' : '#FEF2F2'
  });
  svg.appendChild(startBg);
  const startLabel = mk('text', {
    x: trackX, y: 19,
    'font-size': '11', 'font-weight': '700',
    'font-family': "'Syne', sans-serif",
    fill: type === 'current' ? '#1d4ed8' : '#b91c1c',
    'text-anchor': 'middle'
  });
  startLabel.textContent = startStation.name;
  svg.appendChild(startLabel);

  // End (bottom)
  const endBg = mk('rect', {
    x: trackX - 64, y: H - 26, width: 128, height: 22, rx: 4,
    fill: type === 'current' ? '#EFF6FF' : '#FEF2F2'
  });
  svg.appendChild(endBg);
  const endLabel = mk('text', {
    x: trackX, y: H - 11,
    'font-size': '11', 'font-weight': '700',
    'font-family': "'Syne', sans-serif",
    fill: type === 'current' ? '#1d4ed8' : '#b91c1c',
    'text-anchor': 'middle'
  });
  endLabel.textContent = endStation.name;
  svg.appendChild(endLabel);

  // Speed legend (small, bottom right)
  drawSpeedLegend(svg, ns, mk, W, H, type);
}

function speedColor(mph, type) {
  // slow = cooler/lighter, fast = warmer
  if (type === 'current') {
    if (mph < 50)  return '#bfdbfe'; // very slow
    if (mph < 80)  return '#93c5fd';
    if (mph < 120) return '#60a5fa';
    return '#3b82f6';
  } else {
    if (mph < 80)  return '#fecaca';
    if (mph < 150) return '#f87171';
    if (mph < 200) return '#ef4444';
    return '#dc2626';
  }
}

function drawSpeedLegend(svg, ns, mk, W, H, type) {
  // small velocity indicator strip in corner
  const lx = W - 12, ly = H - 80, lh = 60, lw = 6;
  const stops = type === 'current'
    ? ['#bfdbfe', '#60a5fa', '#2563EB']
    : ['#fecaca', '#ef4444', '#DC2626'];

  const grad = document.createElementNS(ns, 'linearGradient');
  const gid = `lg-${type}-${Math.random().toString(36).slice(2,6)}`;
  grad.setAttribute('id', gid);
  grad.setAttribute('x1', '0'); grad.setAttribute('y1', '1');
  grad.setAttribute('x2', '0'); grad.setAttribute('y2', '0');
  stops.forEach((c, i) => {
    const s = document.createElementNS(ns, 'stop');
    s.setAttribute('offset', `${i * 50}%`);
    s.setAttribute('stop-color', c);
    grad.appendChild(s);
  });
  svg.querySelector('defs').appendChild(grad);

  svg.appendChild(mk('rect', {
    x: lx - lw, y: ly, width: lw, height: lh,
    rx: 3, fill: `url(#${gid})`, opacity: 0.7
  }));
  svg.appendChild(mk('text', {
    x: lx - lw - 3, y: ly + 5,
    'font-size': '9', 'font-family': "'DM Mono', monospace",
    fill: '#94a3b8', 'text-anchor': 'end'
  })).textContent = type === 'current' ? '150' : '220';
  svg.appendChild(mk('text', {
    x: lx - lw - 3, y: ly + lh,
    'font-size': '9', 'font-family': "'DM Mono', monospace",
    fill: '#94a3b8', 'text-anchor': 'end'
  })).textContent = 'mph';
}

// Expose a function to get the Y pixel position for a train at progress 0–1
window.getTrainY = function(progress) {
  // Map 0–1 to the CSS % top position
  const padTop = 40, padBot = 40;
  const totalH = 620;
  const trackH = totalH - padTop - padBot;
  const svgY = padTop + progress * trackH;
  return (svgY / totalH) * 100; // as percent
};
