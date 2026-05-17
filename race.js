// ============================================================
// race.js — Animation engine for the NEC HSR race visualization
//
// What this file does:
//   Drives the side-by-side SVG race animation. Each animation
//   frame it:
//     1. Advances a shared simulation clock
//     2. Calculates how far each train has traveled (0–1)
//     3. Moves the SVG train icons down their respective tracks
//     4. Updates elapsed time, speed, and current station labels
//     5. Updates the time-saved delta counter
//     6. Calls window.updateMapMarkers() so the Mapbox dots
//        stay in sync with the SVG panels
//
// Dependencies (must load before this file):
//   - route-data.js  → window.ROUTES, window.interpSpeed,
//                      window.getTrainY
//   - map-draw.js    → window.drawMaps
//   - mapbox.js      → window.updateMapMarkers,
//                      window.setMapRoute,
//                      window.resetMapCamera
//
// State is kept entirely inside the IIFE closure — nothing
// leaks to the global scope except via the above window APIs.
// ============================================================

(function() {

  // ── Simulation state ──────────────────────────────────────────────────────

  // Which route is currently selected: 'nydc' | 'nybos' | 'full'
  let currentRoute = 'full';

  // Simulation speed multiplier set by the 1×/2×/4× buttons.
  // At 2×, 30 real seconds = 1 simulated hour.
  let simSpeed = 2;

  // Whether the animation loop is currently running
  let isRunning = false;

  // requestAnimationFrame handle — kept so we can cancel it on pause
  let rafId = null;

  // Accumulated simulation time in minutes.
  // Advances each frame by: (realDeltaSec × simSpeed) × (60/30)
  let simTimeSec = 0;

  // Timestamp from the previous rAF call — used to calculate
  // real elapsed seconds between frames
  let lastTimestamp = null;

  // Per-train completion flags — set to true when progress reaches 1
  let currentDone  = false;
  let proposedDone = false;

  // Set to true when BOTH trains have finished.
  // The Start button checks this to decide whether to restart
  // from scratch (Race Again) vs resume a paused race.
  let raceFinished = false;


  // ── DOM references ────────────────────────────────────────────────────────
  // Grabbed once at init time — cheaper than querying every frame.

  const btnStart  = document.getElementById('btn-start');
  const btnReset  = document.getElementById('btn-reset');

  // SVG train icon elements (positioned via style.top %)
  const trainC    = document.getElementById('train-current');
  const trainP    = document.getElementById('train-proposed');

  // Stats display elements updated each frame
  const elapsedC  = document.getElementById('elapsed-current');
  const elapsedP  = document.getElementById('elapsed-proposed');
  const speedC    = document.getElementById('speed-current');
  const speedP    = document.getElementById('speed-proposed');
  const stationC  = document.getElementById('station-current');
  const stationP  = document.getElementById('station-proposed');

  // Progress bar fill divs (width set as % each frame)
  const progressC = document.getElementById('progress-current');
  const progressP = document.getElementById('progress-proposed');

  // Center divider time-saved display
  const deltaVal  = document.getElementById('delta-value');
  const deltaSub  = document.getElementById('delta-sub');

  // Arrival banner (shown when HSR finishes)
  const arrBanner = document.getElementById('arrival-banner');
  const arrTitle  = document.getElementById('arrival-title');
  const arrSub    = document.getElementById('arrival-sub');
  const arrDelta  = document.getElementById('arrival-delta');

  // Progress bar endpoint labels
  const pLabelS   = document.getElementById('progress-label-start');
  const pLabelE   = document.getElementById('progress-label-end');


  // ── Initialization ────────────────────────────────────────────────────────

  function init() {
    // Draw the SVG maps and reset all UI for the default route
    applyRoute(currentRoute);

    // Route selector buttons (New York → DC, New York → Boston, Full Corridor)
    document.querySelectorAll('.route-btn[data-route]').forEach(btn => {
      btn.addEventListener('click', () => {
        // Block route changes while the race is running to avoid
        // mid-race state corruption
        if (isRunning) return;

        document.querySelectorAll('.route-btn[data-route]')
          .forEach(b => b.classList.remove('active'));
        btn.classList.add('active');

        currentRoute = btn.dataset.route;
        reset();
        applyRoute(currentRoute);

        // Tell mapbox.js to pan to the selected route's bounding box
        // and update which coord slice the dots travel along
        if (window.setMapRoute) window.setMapRoute(currentRoute);
      });
    });

    // Simulation speed buttons (1×, 2×, 4×)
    document.querySelectorAll('.route-btn[data-speed]').forEach(btn => {
      btn.addEventListener('click', () => {
        document.querySelectorAll('.route-btn[data-speed]')
          .forEach(b => b.classList.remove('active'));
        btn.classList.add('active');
        simSpeed = parseFloat(btn.dataset.speed);
      });
    });

    // Start / Pause / Resume / Race Again button
    btnStart.addEventListener('click', () => {
      if (raceFinished) {
        // Race completed — "Race Again" does a full reset then
        // immediately starts a new race from the beginning
        reset();
        startRace();
      } else {
        // Mid-race: toggle between running and paused
        toggleRace();
      }
    });

    // Reset button — stops and resets everything
    btnReset.addEventListener('click', () => {
      stopRace();
      reset();
    });
  }


  // ── Route setup ───────────────────────────────────────────────────────────

  // Apply a route: re-draw SVG maps, update progress bar labels,
  // and reset all position/stat UI to the starting state.
  function applyRoute(routeKey) {
    const route = window.ROUTES[routeKey];

    // map-draw.js draws the station dots, city labels, and
    // speed-zone shading on both SVG panels
    window.drawMaps(routeKey);

    // Update the start/end labels on the progress bars
    pLabelS.textContent = route.stations[0].name;
    pLabelE.textContent = route.stations[route.stations.length - 1].name;

    resetPositions(route);
  }

  // Reset all animated elements to their starting positions.
  // Called on init, route change, and explicit reset.
  function resetPositions(route) {
    setTrainPos(trainC, 0);
    setTrainPos(trainP, 0);

    progressC.style.width = '0%';
    progressP.style.width = '0%';

    elapsedC.textContent = '0:00';
    elapsedP.textContent = '0:00';
    speedC.textContent   = '0 mph';
    speedP.textContent   = '0 mph';

    stationC.textContent = route.stations[0].name;
    stationP.textContent = route.stations[0].name;

    deltaVal.textContent = '—';
    arrBanner.hidden = true;

    // Reset Mapbox train dots to the start coordinate as well
    if (window.updateMapMarkers) window.updateMapMarkers(0, 0);
  }


  // ── Race control ──────────────────────────────────────────────────────────

  // Full state reset — clears sim clock, flags, and UI.
  // Does NOT start the race — call startRace() separately if needed.
  function reset() {
    isRunning    = false;
    raceFinished = false;
    currentDone  = false;
    proposedDone = false;
    simTimeSec   = 0;
    lastTimestamp = null;

    btnStart.textContent = '▶ Start Race';
    arrBanner.hidden = true;

    trainC.classList.remove('animating');
    trainP.classList.remove('animating');

    const route = window.ROUTES[currentRoute];
    resetPositions(route);

    // Snap the Mapbox camera back to the overview bounding box
    if (window.resetMapCamera) window.resetMapCamera();
  }

  function toggleRace() {
    if (isRunning) stopRace();
    else startRace();
  }

  function startRace() {
    isRunning    = true;
    raceFinished = false;
    btnStart.textContent = '⏸ Pause';

    // .animating enables the CSS transition on style.top so the
    // train icon glides smoothly instead of jumping each frame
    trainC.classList.add('animating');
    trainP.classList.add('animating');

    lastTimestamp = null; // will be set on the first tick
    rafId = requestAnimationFrame(tick);
  }

  function stopRace() {
    isRunning = false;

    // Show "Race Again" if fully done, "Resume" if just paused
    btnStart.textContent = raceFinished ? '▶ Race Again' : '▶ Resume';

    trainC.classList.remove('animating');
    trainP.classList.remove('animating');

    if (rafId) {
      cancelAnimationFrame(rafId);
      rafId = null;
    }
  }


  // ── Animation loop ────────────────────────────────────────────────────────

  // tick() is called by the browser ~60 times per second via rAF.
  // Each call:
  //   1. Calculates real time elapsed since the last frame
  //   2. Converts that to simulated minutes using simSpeed
  //   3. Derives a 0–1 progress fraction for each train
  //   4. Updates all UI elements
  //   5. Checks for race completion
  //   6. Schedules the next frame (or stops if done)
  function tick(timestamp) {
    if (!isRunning) return;

    // First frame: initialize the timestamp reference
    if (lastTimestamp === null) lastTimestamp = timestamp;

    // Real seconds elapsed since last frame (typically ~0.016s at 60fps)
    const dtSec = (timestamp - lastTimestamp) / 1000;
    lastTimestamp = timestamp;

    // Convert real seconds to simulated minutes.
    // Formula: (realSec × simSpeed) × (60min / 30sec)
    // This means at 1× speed: 30 real seconds = 1 simulated hour
    // At 2× speed: 15 real seconds = 1 simulated hour
    const dtSimMin = (dtSec * simSpeed) * (60 / 30);
    simTimeSec += dtSimMin;

    const simMinutes = simTimeSec;
    const route = window.ROUTES[currentRoute];

    // Progress 0–1 for each train (clamped so it never exceeds 1)
    const cProgress = getProgress(simMinutes, route.currentMinutes);
    const pProgress = getProgress(simMinutes, route.proposedMinutes);

    // Update Acela (only if not yet finished)
    if (!currentDone) {
      updateTrain({
        trainEl:      trainC,
        progressEl:   progressC,
        elapsedEl:    elapsedC,
        speedEl:      speedC,
        stationEl:    stationC,
        progress:     cProgress,
        simMin:       simMinutes,
        totalMin:     route.currentMinutes,
        speedProfile: route.currentSpeeds,
        stations:     route.stations,
      });
      if (cProgress >= 1) currentDone = true;
    }

    // Update HSR (only if not yet finished)
    if (!proposedDone) {
      updateTrain({
        trainEl:      trainP,
        progressEl:   progressP,
        elapsedEl:    elapsedP,
        speedEl:      speedP,
        stationEl:    stationP,
        progress:     pProgress,
        simMin:       simMinutes,
        totalMin:     route.proposedMinutes,
        speedProfile: route.proposedSpeeds,
        stations:     route.stations,
      });

      // HSR just crossed the finish line
      if (pProgress >= 1 && !proposedDone) {
        proposedDone = true;
        showArrivalBanner(route);
      }
    }

    // Sync the Mapbox animated dots to the current progress values
    if (window.updateMapMarkers) window.updateMapMarkers(cProgress, pProgress);

    // Update the center time-saved delta display
    updateDelta(simMinutes, route);

    // Both trains finished — end the race
    if (currentDone && proposedDone) {
      raceFinished = true;
      stopRace();
      btnStart.textContent = '▶ Race Again';
      // Snap Mapbox camera back so user can see the full route
      if (window.resetMapCamera) window.resetMapCamera();
      return; // Don't schedule another frame
    }

    // Schedule the next frame
    rafId = requestAnimationFrame(tick);
  }


  // ── Per-train update ──────────────────────────────────────────────────────

  // Updates all UI elements for one train per animation frame.
  function updateTrain({ trainEl, progressEl, elapsedEl, speedEl, stationEl,
                         progress, simMin, totalMin, speedProfile, stations }) {
    const p = Math.min(progress, 1);

    // Move the SVG train icon (sets style.top as a % of track height)
    setTrainPos(trainEl, p);

    // Widen the progress bar fill
    progressEl.style.width = (p * 100).toFixed(1) + '%';

    // Elapsed time — capped at the total journey time once finished
    elapsedEl.textContent = formatMMSS(Math.min(simMin, totalMin));

    // Current speed from the speed profile defined in route-data.js
    speedEl.textContent = window.interpSpeed(speedProfile, p) + ' mph';

    // Nearest station label
    stationEl.textContent = getCurrentStation(p, stations);
  }


  // ── Delta display ─────────────────────────────────────────────────────────

  // Updates the center "Time Saved" counter with three states:
  //   - During race: shows how far HSR is ahead in minutes
  //   - After HSR arrives: shows total time saved
  //   - After both arrive: shows the final total time saved
  function updateDelta(simMinutes, route) {
    if (simMinutes <= 0) return;

    const totalSaved = route.currentMinutes - route.proposedMinutes;

    if (proposedDone && !currentDone) {
      // HSR arrived — Acela still running
      deltaVal.textContent = fmtMinDelta(totalSaved);
      deltaSub.textContent = 'saved by HSR';
    } else if (proposedDone && currentDone) {
      // Both done
      deltaVal.textContent = fmtMinDelta(totalSaved);
      deltaSub.textContent = 'total time saved';
    } else {
      // Live: show how many minutes HSR is ahead so far.
      // Caps at the total savings to avoid overshooting.
      deltaVal.textContent = fmtMinDelta(Math.min(simMinutes, totalSaved));
      deltaSub.textContent = 'HSR lead';
    }
  }


  // ── Arrival banner ────────────────────────────────────────────────────────

  // Shows the dark banner that slides up when HSR reaches its destination.
  // The banner is hidden by the HTML `hidden` attribute by default.
  function showArrivalBanner(route) {
    const saved = route.currentMinutes - route.proposedMinutes;
    arrTitle.textContent = '🚄 HSR has arrived!';
    arrSub.textContent   = `The Acela still has ${fmtMinDelta(saved)} left to travel.`;
    arrDelta.textContent = fmtMinDelta(saved) + ' faster';
    arrBanner.hidden = false;
  }


  // ── Helper functions ──────────────────────────────────────────────────────

  // Convert simulation minutes elapsed to a 0–1 progress fraction.
  // Clamped to 1 so trains never go past the end of the track.
  function getProgress(simMin, totalMin) {
    return Math.min(simMin / totalMin, 1);
  }

  // Set the train icon's vertical position on the SVG track.
  // window.getTrainY() (from map-draw.js) converts 0–1 to a CSS
  // top% value that accounts for the track's padding.
  function setTrainPos(trainEl, progress) {
    trainEl.style.top = window.getTrainY(progress).toFixed(2) + '%';
  }

  // Find the name of the station the train is currently at or
  // has most recently passed, by scanning backwards through the
  // stations array until we find one with pos <= current progress.
  function getCurrentStation(progress, stations) {
    for (let i = stations.length - 1; i >= 0; i--) {
      // Small 0.01 tolerance handles floating-point rounding
      if (progress >= stations[i].pos - 0.01) return stations[i].name;
    }
    return stations[0].name;
  }

  // Format decimal minutes as h:mm:ss or m:ss string.
  // Examples: 176.5 → "2:56:30", 45.25 → "45:15"
  function formatMMSS(minutes) {
    const h = Math.floor(minutes / 60);
    const m = Math.floor(minutes % 60);
    const s = Math.floor((minutes * 60) % 60);
    if (h > 0) {
      return `${h}:${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`;
    }
    return `${m}:${String(s).padStart(2, '0')}`;
  }

  // Format a number of minutes as a compact human-readable delta.
  // Examples: 45 → "45m", 116 → "1h 56m", 120 → "2h"
  function fmtMinDelta(min) {
    const m = Math.round(min);
    if (m < 60) return `${m}m`;
    const h   = Math.floor(m / 60);
    const rem = m % 60;
    return rem > 0 ? `${h}h ${rem}m` : `${h}h`;
  }


  // ── Boot ──────────────────────────────────────────────────────────────────

  // Run init() once the DOM is ready. The readyState check handles
  // the case where this script loads after DOMContentLoaded has
  // already fired (e.g. if the script tag is deferred or async).
  document.addEventListener('DOMContentLoaded', init);
  if (document.readyState !== 'loading') init();

})();