// race.js — animation engine for the NEC HSR race visualization

(function() {
  let currentRoute = 'full';
  let simSpeed = 2;
  let isRunning = false;
  let rafId = null;
  let simTimeSec = 0;
  let lastTimestamp = null;
  let currentDone = false;
  let proposedDone = false;
  let raceFinished = false; // tracks whether race has fully completed

  const btnStart  = document.getElementById('btn-start');
  const btnReset  = document.getElementById('btn-reset');
  const trainC    = document.getElementById('train-current');
  const trainP    = document.getElementById('train-proposed');
  const elapsedC  = document.getElementById('elapsed-current');
  const elapsedP  = document.getElementById('elapsed-proposed');
  const speedC    = document.getElementById('speed-current');
  const speedP    = document.getElementById('speed-proposed');
  const stationC  = document.getElementById('station-current');
  const stationP  = document.getElementById('station-proposed');
  const progressC = document.getElementById('progress-current');
  const progressP = document.getElementById('progress-proposed');
  const deltaVal  = document.getElementById('delta-value');
  const deltaSub  = document.getElementById('delta-sub');
  const arrBanner = document.getElementById('arrival-banner');
  const arrTitle  = document.getElementById('arrival-title');
  const arrSub    = document.getElementById('arrival-sub');
  const arrDelta  = document.getElementById('arrival-delta');
  const pLabelS   = document.getElementById('progress-label-start');
  const pLabelE   = document.getElementById('progress-label-end');

  function init() {
    applyRoute(currentRoute);

    document.querySelectorAll('.route-btn[data-route]').forEach(btn => {
      btn.addEventListener('click', () => {
        if (isRunning) return; // don't allow route switch mid-race
        document.querySelectorAll('.route-btn[data-route]').forEach(b => b.classList.remove('active'));
        btn.classList.add('active');
        currentRoute = btn.dataset.route;
        reset();
        applyRoute(currentRoute);
        window.setMapRoute && window.setMapRoute(currentRoute);
      });
    });

    document.querySelectorAll('.route-btn[data-speed]').forEach(btn => {
      btn.addEventListener('click', () => {
        document.querySelectorAll('.route-btn[data-speed]').forEach(b => b.classList.remove('active'));
        btn.classList.add('active');
        simSpeed = parseFloat(btn.dataset.speed);
      });
    });

    btnStart.addEventListener('click', () => {
      if (raceFinished) {
        // "Race Again" — full reset then start
        reset();
        startRace();
      } else {
        toggleRace();
      }
    });

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
    if (window.updateMapMarkers) window.updateMapMarkers(0, 0);
  }

  function reset() {
    isRunning = false;
    raceFinished = false;
    currentDone = false;
    proposedDone = false;
    simTimeSec = 0;
    lastTimestamp = null;
    btnStart.textContent = '▶ Start Race';
    arrBanner.hidden = true;
    trainC.classList.remove('animating');
    trainP.classList.remove('animating');
    const route = window.ROUTES[currentRoute];
    resetPositions(route);
    // Snap camera back to overview on reset
    window.resetMapCamera && window.resetMapCamera();
  }

  function toggleRace() {
    if (isRunning) stopRace();
    else startRace();
  }

  function startRace() {
    isRunning = true;
    raceFinished = false;
    btnStart.textContent = '⏸ Pause';
    trainC.classList.add('animating');
    trainP.classList.add('animating');
    lastTimestamp = null;
    rafId = requestAnimationFrame(tick);
  }

  function stopRace() {
    isRunning = false;
    btnStart.textContent = raceFinished ? '▶ Race Again' : '▶ Resume';
    trainC.classList.remove('animating');
    trainP.classList.remove('animating');
    if (rafId) { cancelAnimationFrame(rafId); rafId = null; }
  }

  function tick(timestamp) {
    if (!isRunning) return;

    if (lastTimestamp === null) lastTimestamp = timestamp;
    const dtSec = (timestamp - lastTimestamp) / 1000;
    lastTimestamp = timestamp;

    const dtSimMin = (dtSec * simSpeed) * (60 / 30);
    simTimeSec += dtSimMin;

    const simMinutes = simTimeSec;
    const route = window.ROUTES[currentRoute];
    const cProgress = getProgress(simMinutes, route.currentMinutes);
    const pProgress = getProgress(simMinutes, route.proposedMinutes);

    if (!currentDone) {
      updateTrain({
        trainEl: trainC, progressEl: progressC, elapsedEl: elapsedC,
        speedEl: speedC, stationEl: stationC,
        progress: cProgress, simMin: simMinutes, totalMin: route.currentMinutes,
        speedProfile: route.currentSpeeds, stations: route.stations, type: 'current',
      });
      if (cProgress >= 1) currentDone = true;
    }

    if (!proposedDone) {
      updateTrain({
        trainEl: trainP, progressEl: progressP, elapsedEl: elapsedP,
        speedEl: speedP, stationEl: stationP,
        progress: pProgress, simMin: simMinutes, totalMin: route.proposedMinutes,
        speedProfile: route.proposedSpeeds, stations: route.stations, type: 'proposed',
      });
      if (pProgress >= 1 && !proposedDone) {
        proposedDone = true;
        showArrivalBanner(route);
      }
    }

    if (window.updateMapMarkers) window.updateMapMarkers(cProgress, pProgress);

    // Delta display
    if (simMinutes > 0) {
      if (proposedDone && !currentDone) {
        deltaVal.textContent = fmtMinDelta(route.currentMinutes - route.proposedMinutes);
        deltaSub.textContent = 'saved by HSR';
      } else if (proposedDone && currentDone) {
        deltaVal.textContent = fmtMinDelta(route.currentMinutes - route.proposedMinutes);
        deltaSub.textContent = 'total time saved';
      } else {
        const diff = route.currentMinutes - route.proposedMinutes;
        deltaVal.textContent = fmtMinDelta(Math.min(simMinutes, diff));
        deltaSub.textContent = 'HSR lead';
      }
    }

    if (currentDone && proposedDone) {
      raceFinished = true;
      stopRace();
      btnStart.textContent = '▶ Race Again';
      // Snap camera back to overview so user can see both routes
      window.resetMapCamera && window.resetMapCamera();
      return;
    }

    rafId = requestAnimationFrame(tick);
  }

  function updateTrain({ trainEl, progressEl, elapsedEl, speedEl, stationEl,
                         progress, simMin, totalMin, speedProfile, stations }) {
    const p = Math.min(progress, 1);
    setTrainPos(trainEl, p);
    progressEl.style.width = (p * 100).toFixed(1) + '%';
    elapsedEl.textContent = formatMMSS(Math.min(simMin, totalMin));
    speedEl.textContent = window.interpSpeed(speedProfile, p) + ' mph';
    stationEl.textContent = getCurrentStation(p, stations);
  }

  function getProgress(simMin, totalMin) { return Math.min(simMin / totalMin, 1); }

  function setTrainPos(trainEl, progress) {
    trainEl.style.top = window.getTrainY(progress).toFixed(2) + '%';
  }

  function getCurrentStation(progress, stations) {
    for (let i = stations.length - 1; i >= 0; i--) {
      if (progress >= stations[i].pos - 0.01) return stations[i].name;
    }
    return stations[0].name;
  }

  function formatMMSS(minutes) {
    const h = Math.floor(minutes / 60);
    const m = Math.floor(minutes % 60);
    const s = Math.floor((minutes * 60) % 60);
    return h > 0
      ? `${h}:${String(m).padStart(2,'0')}:${String(s).padStart(2,'0')}`
      : `${m}:${String(s).padStart(2,'0')}`;
  }

  function fmtMinDelta(min) {
    const m = Math.round(min);
    if (m < 60) return `${m}m`;
    const h = Math.floor(m / 60), rem = m % 60;
    return rem > 0 ? `${h}h ${rem}m` : `${h}h`;
  }

  function showArrivalBanner(route) {
    const saved = route.currentMinutes - route.proposedMinutes;
    arrTitle.textContent = '🚄 HSR has arrived!';
    arrSub.textContent = `The Acela still has ${fmtMinDelta(saved)} left to travel.`;
    arrDelta.textContent = fmtMinDelta(saved) + ' faster';
    arrBanner.hidden = false;
  }

  document.addEventListener('DOMContentLoaded', init);
  if (document.readyState !== 'loading') init();
})();