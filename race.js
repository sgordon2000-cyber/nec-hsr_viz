// race.js — animation engine for the NEC HSR race visualization

(function() {
  // State
  let currentRoute = 'full';
  let simSpeed = 1;       // multiplier (1x, 2x, 4x)
  let isRunning = false;
  let rafId = null;

  // Sim time in real minutes (both trains start at 0)
  let simTimeSec = 0;   // simulation seconds elapsed (real seconds × simSpeed)
  let lastTimestamp = null;

  // Did each train finish?
  let currentDone = false;
  let proposedDone = false;
  let firstArrivalTime = null; // sim minutes when proposed arrives

  // DOM refs
  const btnStart   = document.getElementById('btn-start');
  const btnReset   = document.getElementById('btn-reset');
  const trainC     = document.getElementById('train-current');
  const trainP     = document.getElementById('train-proposed');
  const elapsedC   = document.getElementById('elapsed-current');
  const elapsedP   = document.getElementById('elapsed-proposed');
  const speedC     = document.getElementById('speed-current');
  const speedP     = document.getElementById('speed-proposed');
  const stationC   = document.getElementById('station-current');
  const stationP   = document.getElementById('station-proposed');
  const progressC  = document.getElementById('progress-current');
  const progressP  = document.getElementById('progress-proposed');
  const deltaVal   = document.getElementById('delta-value');
  const deltaSub   = document.getElementById('delta-sub');
  const arrBanner  = document.getElementById('arrival-banner');
  const arrTitle   = document.getElementById('arrival-title');
  const arrSub     = document.getElementById('arrival-sub');
  const arrDelta   = document.getElementById('arrival-delta');
  const pLabelS    = document.getElementById('progress-label-start');
  const pLabelE    = document.getElementById('progress-label-end');

  // Init
  function init() {
    applyRoute(currentRoute);

    // Route buttons
    document.querySelectorAll('.route-btn[data-route]').forEach(btn => {
      btn.addEventListener('click', () => {
        if (isRunning) return;
        document.querySelectorAll('.route-btn[data-route]').forEach(b => b.classList.remove('active'));
        btn.classList.add('active');
        currentRoute = btn.dataset.route;
        reset();
        applyRoute(currentRoute);
        window.setMapRoute && window.setMapRoute(currentRoute);
      });
    });

    // Speed buttons
    document.querySelectorAll('.route-btn[data-speed]').forEach(btn => {
      btn.addEventListener('click', () => {
        document.querySelectorAll('.route-btn[data-speed]').forEach(b => b.classList.remove('active'));
        btn.classList.add('active');
        simSpeed = parseFloat(btn.dataset.speed);
      });
    });

    btnStart.addEventListener('click', toggleRace);
    btnReset.addEventListener('click', () => { stopRace(); reset(); });
  }

  function applyRoute(routeKey) {
    const route = window.ROUTES[routeKey];
    window.drawMaps(routeKey);
    pLabelS.textContent = route.stations[0].name;
    pLabelE.textContent = route.stations[route.stations.length - 1].name;
    resetPositions(route);
  }

  function resetPositions(route) {
    // Place trains at start
    setTrainPos(trainC, 0);
    setTrainPos(trainP, 0);
    progressC.style.width = '0%';
    progressP.style.width = '0%';
    elapsedC.textContent = '0:00';
    elapsedP.textContent = '0:00';
    speedC.textContent = '0 mph';
    speedP.textContent = '0 mph';
    stationC.textContent = route.stations[0].name;
    stationP.textContent = route.stations[0].name;
    deltaVal.textContent = '—';
    arrBanner.hidden = true;
  }

  function reset() {
    isRunning = false;
    currentDone = false;
    proposedDone = false;
    simTimeSec = 0;
    lastTimestamp = null;
    firstArrivalTime = null;
    btnStart.textContent = '▶ Start Race';
    arrBanner.hidden = true;

    const route = window.ROUTES[currentRoute];
    resetPositions(route);

    trainC.classList.remove('animating');
    trainP.classList.remove('animating');
  }

  function toggleRace() {
    if (isRunning) {
      stopRace();
    } else {
      startRace();
    }
  }

  function startRace() {
    isRunning = true;
    btnStart.textContent = '⏸ Pause';
    trainC.classList.add('animating');
    trainP.classList.add('animating');
    lastTimestamp = null;
    rafId = requestAnimationFrame(tick);
  }

  function stopRace() {
    isRunning = false;
    btnStart.textContent = '▶ Resume';
    trainC.classList.remove('animating');
    trainP.classList.remove('animating');
    if (rafId) { cancelAnimationFrame(rafId); rafId = null; }
  }

  function tick(timestamp) {
    if (!isRunning) return;

    if (lastTimestamp === null) lastTimestamp = timestamp;
    const dtSec = (timestamp - lastTimestamp) / 1000;  // real seconds since last frame
    lastTimestamp = timestamp;

    // Advance simulation time (in minutes)
    const dtSimMin = (dtSec * simSpeed) * (60 / 30); // 30 real seconds = 1 simulated hour at 1×
    simTimeSec += dtSimMin;

    const simMinutes = simTimeSec;
    const route = window.ROUTES[currentRoute];

    // Update each train
    const cProgress = getProgress(simMinutes, route.currentMinutes);
    const pProgress = getProgress(simMinutes, route.proposedMinutes);

    // Current Acela
    if (!currentDone) {
      updateTrain({
        trainEl: trainC,
        progressEl: progressC,
        elapsedEl: elapsedC,
        speedEl: speedC,
        stationEl: stationC,
        progress: cProgress,
        simMin: simMinutes,
        totalMin: route.currentMinutes,
        speedProfile: route.currentSpeeds,
        stations: route.stations,
        type: 'current',
      });
      if (cProgress >= 1) currentDone = true;
    }

    // Proposed HSR
    if (!proposedDone) {
      updateTrain({
        trainEl: trainP,
        progressEl: progressP,
        elapsedEl: elapsedP,
        speedEl: speedP,
        stationEl: stationP,
        progress: pProgress,
        simMin: simMinutes,
        totalMin: route.proposedMinutes,
        speedProfile: route.proposedSpeeds,
        stations: route.stations,
        type: 'proposed',
      });

      if (pProgress >= 1 && !proposedDone) {
        proposedDone = true;
        firstArrivalTime = route.proposedMinutes;
        showArrivalBanner(route);
      }
    }

    if (window.updateMapMarkers) {
      window.updateMapMarkers(cProgress, pProgress);
    }

    // Delta display
    const currentSim = Math.min(simMinutes, route.currentMinutes);
    const proposedSim = Math.min(simMinutes, route.proposedMinutes);
    const proposedPos = getProgress(proposedSim, route.proposedMinutes);
    const currentPos = getProgress(currentSim, route.currentMinutes);

    if (simMinutes > 0) {
      // Show time HSR is ahead
      const hsrAheadMin = (currentPos - proposedPos) * route.currentMinutes;
      if (proposedDone && !currentDone) {
        const remaining = route.currentMinutes - simMinutes;
        deltaVal.textContent = fmtMinDelta(route.currentMinutes - route.proposedMinutes);
        deltaSub.textContent = 'saved by HSR';
      } else if (proposedDone && currentDone) {
        deltaVal.textContent = fmtMinDelta(route.currentMinutes - route.proposedMinutes);
        deltaSub.textContent = 'total time saved';
      } else {
        // Live delta: how many minutes the HSR is "ahead" in terms of time elapsed
        const diff = route.currentMinutes - route.proposedMinutes;
        deltaVal.textContent = fmtMinDelta(Math.min(simMinutes, diff));
        deltaSub.textContent = 'HSR lead';
      }
    }

    // Check if both done
    if (currentDone && proposedDone) {
      stopRace();
      btnStart.textContent = '▶ Race Again';
      return;
    }

    rafId = requestAnimationFrame(tick);
  }

  function updateTrain({ trainEl, progressEl, elapsedEl, speedEl, stationEl,
                          progress, simMin, totalMin, speedProfile, stations, type }) {
    const clampedP = Math.min(progress, 1);

    // Train position
    setTrainPos(trainEl, clampedP);

    // Progress bar
    progressEl.style.width = (clampedP * 100).toFixed(1) + '%';

    // Elapsed time
    const elapsedMin = Math.min(simMin, totalMin);
    elapsedEl.textContent = formatMMSS(elapsedMin);

    // Speed
    const mph = window.interpSpeed(speedProfile, clampedP);
    speedEl.textContent = mph + ' mph';

    // Current station
    const st = getCurrentStation(clampedP, stations, type);
    stationEl.textContent = st;
  }

  function getProgress(simMin, totalMin) {
    return Math.min(simMin / totalMin, 1);
  }

  function setTrainPos(trainEl, progress) {
    // progress 0–1 → CSS top% on the track container
    const pct = window.getTrainY(progress);
    trainEl.style.top = pct.toFixed(2) + '%';
  }

  function getCurrentStation(progress, stations, type) {
    // Find which segment we're in
    for (let i = stations.length - 1; i >= 0; i--) {
      if (progress >= stations[i].pos - 0.01) {
        return stations[i].name;
      }
    }
    return stations[0].name;
  }

  function formatMMSS(minutes) {
    const h = Math.floor(minutes / 60);
    const m = Math.floor(minutes % 60);
    const s = Math.floor((minutes * 60) % 60);
    if (h > 0) {
      return `${h}:${String(m).padStart(2,'0')}:${String(s).padStart(2,'0')}`;
    }
    return `${m}:${String(s).padStart(2,'0')}`;
  }

  function fmtMinDelta(min) {
    const m = Math.round(min);
    if (m < 60) return `${m}m`;
    const h = Math.floor(m / 60);
    const rem = m % 60;
    return rem > 0 ? `${h}h ${rem}m` : `${h}h`;
  }

  function showArrivalBanner(route) {
    const saved = route.currentMinutes - route.proposedMinutes;
    arrTitle.textContent = '🚄 HSR has arrived!';
    arrSub.textContent = `The Acela still has ${fmtMinDelta(saved)} left to travel.`;
    arrDelta.textContent = fmtMinDelta(saved) + ' faster';
    arrBanner.hidden = false;
  }

  // Boot
  document.addEventListener('DOMContentLoaded', init);
  if (document.readyState !== 'loading') init();
})();
