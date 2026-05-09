// Route data for NEC High-Speed Rail visualization
// Positions are normalized 0–1 along the track (0 = start, 1 = end)
// Times are in minutes

window.ROUTES = {

  // NEW YORK → WASHINGTON DC (southbound)
  nydc: {
    label: 'New York → Washington DC',
    startLabel: 'New York Penn',
    endLabel: 'Washington DC',
    currentMinutes: 176,   // 2h 56m
    proposedMinutes: 116,  // 1h 56m
    stations: [
      { name: 'New York Penn',   pos: 0.00, currentMin: 0,   proposedMin: 0   },
      { name: 'Newark',          pos: 0.08, currentMin: 20,  proposedMin: 8   },
      { name: 'Philadelphia',    pos: 0.38, currentMin: 70,  proposedMin: 42  },
      { name: 'Wilmington',      pos: 0.55, currentMin: 100, proposedMin: 58  },
      { name: 'Baltimore',       pos: 0.72, currentMin: 125, proposedMin: 80  },
      { name: 'BWI Airport',     pos: 0.82, currentMin: 140, proposedMin: 90  },
      { name: 'Washington DC',   pos: 1.00, currentMin: 176, proposedMin: 116 },
    ],
    // Speed profile: [{pos, mph}] — interpolated
    currentSpeeds: [
      { pos: 0.00, mph: 0 },
      { pos: 0.05, mph: 60 },
      { pos: 0.12, mph: 90 },
      { pos: 0.30, mph: 135 },
      { pos: 0.50, mph: 150 },
      { pos: 0.65, mph: 110 },
      { pos: 0.75, mph: 70 },
      { pos: 0.85, mph: 120 },
      { pos: 0.95, mph: 80 },
      { pos: 1.00, mph: 0 },
    ],
    proposedSpeeds: [
      { pos: 0.00, mph: 0 },
      { pos: 0.04, mph: 110 },
      { pos: 0.10, mph: 200 },
      { pos: 0.40, mph: 220 },
      { pos: 0.60, mph: 220 },
      { pos: 0.75, mph: 180 },
      { pos: 0.88, mph: 200 },
      { pos: 0.95, mph: 120 },
      { pos: 1.00, mph: 0 },
    ],
  },

  // NEW YORK → BOSTON (northbound)
  nybos: {
    label: 'New York → Boston',
    startLabel: 'New York Penn',
    endLabel: 'Boston South Station',
    currentMinutes: 210,   // 3h 30m
    proposedMinutes: 116,  // 1h 56m
    stations: [
      { name: 'New York Penn',   pos: 0.00, currentMin: 0,   proposedMin: 0   },
      { name: 'New Haven',       pos: 0.30, currentMin: 75,  proposedMin: 30  },
      { name: 'Providence',      pos: 0.65, currentMin: 145, proposedMin: 75  },
      { name: 'Route 128',       pos: 0.85, currentMin: 185, proposedMin: 100 },
      { name: 'Boston South',    pos: 1.00, currentMin: 210, proposedMin: 116 },
    ],
    currentSpeeds: [
      { pos: 0.00, mph: 0 },
      { pos: 0.05, mph: 60 },
      { pos: 0.15, mph: 100 },
      { pos: 0.25, mph: 80 },  // slow zone New Haven approach
      { pos: 0.32, mph: 45 },  // New Haven crawl
      { pos: 0.38, mph: 100 },
      { pos: 0.55, mph: 150 },
      { pos: 0.70, mph: 120 },
      { pos: 0.85, mph: 90 },
      { pos: 0.95, mph: 60 },
      { pos: 1.00, mph: 0 },
    ],
    proposedSpeeds: [
      { pos: 0.00, mph: 0 },
      { pos: 0.05, mph: 150 },
      { pos: 0.12, mph: 220 },
      { pos: 0.30, mph: 220 },
      { pos: 0.35, mph: 200 }, // bypass completed
      { pos: 0.65, mph: 220 },
      { pos: 0.85, mph: 200 },
      { pos: 0.95, mph: 130 },
      { pos: 1.00, mph: 0 },
    ],
  },

  // FULL CORRIDOR: BOSTON → DC
  full: {
    label: 'Full Corridor: Boston → Washington DC',
    startLabel: 'Boston South Station',
    endLabel: 'Washington DC',
    currentMinutes: 386,   // ~6h 26m
    proposedMinutes: 232,  // ~3h 52m
    stations: [
      { name: 'Boston South',    pos: 0.00, currentMin: 0,   proposedMin: 0   },
      { name: 'Route 128',       pos: 0.05, currentMin: 25,  proposedMin: 16  },
      { name: 'Providence',      pos: 0.18, currentMin: 65,  proposedMin: 41  },
      { name: 'New Haven',       pos: 0.40, currentMin: 150, proposedMin: 85  },
      { name: 'New York Penn',   pos: 0.58, currentMin: 210, proposedMin: 116 },
      { name: 'Philadelphia',    pos: 0.75, currentMin: 280, proposedMin: 158 },
      { name: 'Baltimore',       pos: 0.88, currentMin: 335, proposedMin: 198 },
      { name: 'Washington DC',   pos: 1.00, currentMin: 386, proposedMin: 232 },
    ],
    currentSpeeds: [
      { pos: 0.00, mph: 0 },
      { pos: 0.05, mph: 80 },
      { pos: 0.15, mph: 150 },
      { pos: 0.30, mph: 120 },
      { pos: 0.38, mph: 45 },
      { pos: 0.44, mph: 110 },
      { pos: 0.58, mph: 80 },
      { pos: 0.65, mph: 135 },
      { pos: 0.80, mph: 150 },
      { pos: 0.90, mph: 100 },
      { pos: 1.00, mph: 0 },
    ],
    proposedSpeeds: [
      { pos: 0.00, mph: 0 },
      { pos: 0.04, mph: 150 },
      { pos: 0.10, mph: 220 },
      { pos: 0.55, mph: 220 },
      { pos: 0.60, mph: 180 },
      { pos: 0.65, mph: 220 },
      { pos: 0.92, mph: 200 },
      { pos: 0.97, mph: 100 },
      { pos: 1.00, mph: 0 },
    ],
  },
};

// Format minutes as h:mm
window.fmtTime = function(min) {
  const h = Math.floor(min / 60);
  const m = Math.round(min % 60);
  return h > 0
    ? `${h}h ${String(m).padStart(2, '0')}m`
    : `${m}m`;
};

// Interpolate speed at a given position from a speed profile array
window.interpSpeed = function(profile, pos) {
  for (let i = 1; i < profile.length; i++) {
    const a = profile[i - 1], b = profile[i];
    if (pos <= b.pos) {
      const t = (pos - a.pos) / (b.pos - a.pos);
      return Math.round(a.mph + t * (b.mph - a.mph));
    }
  }
  return profile[profile.length - 1].mph;
};
