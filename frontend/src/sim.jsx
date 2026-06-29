import { createContext, useContext, useRef, useCallback, useMemo, useEffect, useState } from 'react'
import { BASE_SIM_RATE } from './config.js'
import { buildPath, pointAt } from './api.js'

const SimContext = createContext(null)

// effective charging power with a simple taper above 80% SoC.
function taperedKw(soc, maxKw) {
  if (soc < 80) return maxKw
  const f = 1 - 0.75 * (soc - 80) / 20 // 1.0 at 80% → 0.25 at 100%
  return maxKw * Math.max(0.25, f)
}

function freshState() {
  return {
    open: false, playing: false, turbo: 1,
    modal: true,            // true → cinematic full-screen modal; false → inline on the main map
    mode: 'charge',         // 'charge' (drive→charge→explore) | 'trip' (multi-stop drive)
    phase: 'idle',          // idle | drive | arrive | charge | poi | done
    legs: [], legIndex: 0,
    tripKm: 0, tripMin: 0,
    driveMin: 0, totalDriveMin: 0, driveProgress: 0,
    carPos: null, bearing: 0,
    soc: 0, socStart: 0, socTarget: 80,
    chargeMin: 0, estChargeMin: 0, chargeKw: 0,
    batteryKwh: 60, acceptKw: 100, maxPowerKw: 50,
    station: null, pois: [], title: '', provider: 'osrm',
  }
}

export function SimProvider({ children }) {
  const s = useRef(freshState())
  const listeners = useRef(new Set())   // React subscribers (coarse)
  const rawListeners = useRef(new Set()) // per-frame imperative (map markers)
  const raf = useRef(0)
  const last = useRef(0)

  const emit = useCallback(() => { listeners.current.forEach((l) => l()) }, [])
  const emitRaw = useCallback(() => { rawListeners.current.forEach((l) => l(s.current)) }, [])
  const getState = useCallback(() => s.current, [])

  const subscribe = useCallback((l) => { listeners.current.add(l); return () => listeners.current.delete(l) }, [])
  const subscribeRaw = useCallback((l) => { rawListeners.current.add(l); return () => rawListeners.current.delete(l) }, [])

  const stopLoop = useCallback(() => { if (raf.current) cancelAnimationFrame(raf.current); raf.current = 0 }, [])

  const step = useCallback((now) => {
    const st = s.current
    const dt = last.current ? (now - last.current) / 1000 : 0
    last.current = now
    if (!st.playing) { raf.current = requestAnimationFrame(step); return }

    const simMin = (dt * st.turbo * BASE_SIM_RATE) / 60

    if (st.phase === 'drive') {
      st.driveMin = Math.min(st.totalDriveMin, st.driveMin + simMin)
      // locate current leg + local progress
      let acc = 0, idx = 0
      for (let i = 0; i < st.legs.length; i++) {
        if (st.driveMin <= acc + st.legs[i].durationMin || i === st.legs.length - 1) { idx = i; break }
        acc += st.legs[i].durationMin
      }
      const leg = st.legs[idx]
      const local = leg.durationMin ? Math.min(1, (st.driveMin - acc) / leg.durationMin) : 1
      st.legIndex = idx
      const p = pointAt(leg.path, local)
      if (p) {
        if (st.carPos) st.bearing = bearingOf(st.carPos, p)
        st.carPos = p
      }
      st.driveProgress = st.totalDriveMin ? st.driveMin / st.totalDriveMin : 1
      emitRaw()
      if (st.driveMin >= st.totalDriveMin - 1e-6) {
        st.phase = st.station ? 'charge' : 'done'
        if (st.phase === 'done') st.playing = false
      }
    } else if (st.phase === 'charge') {
      st.chargeMin += simMin
      const kw = taperedKw(st.soc, Math.min(st.maxPowerKw, st.acceptKw))
      st.chargeKw = Math.round(kw)
      st.soc = Math.min(st.socTarget, st.soc + (kw * (simMin / 60)) / st.batteryKwh * 100)
      emitRaw()
      if (st.soc >= st.socTarget - 1e-6) {
        st.phase = st.pois.length ? 'poi' : 'done'
        st.playing = st.phase === 'poi' ? false : false
      }
    }

    emit()
    if (st.open && (st.phase === 'drive' || st.phase === 'charge')) {
      raf.current = requestAnimationFrame(step)
    } else {
      raf.current = 0
    }
  }, [emit, emitRaw])

  const ensureLoop = useCallback(() => {
    if (!raf.current) { last.current = 0; raf.current = requestAnimationFrame(step) }
  }, [step])

  // ----- public API -----
  const play = useCallback(() => { s.current.playing = true; emit(); ensureLoop() }, [emit, ensureLoop])
  const pause = useCallback(() => { s.current.playing = false; emit() }, [emit])
  const setTurbo = useCallback((t) => { s.current.turbo = t; emit() }, [emit])
  const setModal = useCallback((v) => { s.current.modal = v; emit() }, [emit])

  const close = useCallback(() => {
    stopLoop()
    s.current = freshState()
    emit(); emitRaw()
  }, [emit, emitRaw, stopLoop])

  // Start a single drive→charge→poi simulation.
  // opts: { route, station, vehicle, socStart, socTarget, pois }
  const startDrive = useCallback(({ route, station, vehicle, socStart, socTarget = 80, pois = [], modal = true }) => {
    const path = buildPath(route.coords || [])
    const durationMin = (route.duration_s || 0) / 60 || 1
    const st = freshState()
    st.open = true; st.playing = true; st.mode = 'charge'; st.modal = modal
    st.legs = [{ path, durationMin, from: 'You', to: station.title }]
    st.totalDriveMin = durationMin
    st.phase = 'drive'
    st.carPos = path.coords[0] || [station.lat, station.lon]
    st.station = station
    st.title = station.title || 'Charging station'
    st.provider = route.provider
    st.socStart = socStart; st.soc = socStart; st.socTarget = socTarget
    st.batteryKwh = vehicle.batteryKwh; st.acceptKw = vehicle.acceptKw
    st.maxPowerKw = station.max_power_kw || 50
    const addedKwh = (socTarget - socStart) / 100 * vehicle.batteryKwh
    st.estChargeMin = Math.round(addedKwh / Math.min(st.maxPowerKw, st.acceptKw) * 60)
    st.pois = pois
    s.current = st
    emit(); emitRaw(); ensureLoop()
  }, [emit, emitRaw, ensureLoop])

  // Start a multi-leg trip simulation (no charging by default).
  // opts: { legs:[{coords,duration_s,from,to}], title }
  const startTrip = useCallback(({ legs, title = 'Trip', socStart = 0, pois = [], totalKm = 0, totalMin = 0, modal = true }) => {
    const st = freshState()
    st.open = true; st.playing = true; st.phase = 'drive'; st.mode = 'trip'; st.modal = modal
    st.legs = legs.map((l) => ({ path: buildPath(l.coords || []), durationMin: (l.duration_s || 0) / 60 || 1, from: l.from, to: l.to }))
    st.totalDriveMin = st.legs.reduce((a, l) => a + l.durationMin, 0)
    st.carPos = st.legs[0]?.path.coords[0] || null
    st.station = null
    st.title = title
    st.socStart = socStart; st.soc = socStart
    st.pois = pois
    st.tripKm = totalKm; st.tripMin = totalMin || Math.round(st.totalDriveMin)
    s.current = st
    emit(); emitRaw(); ensureLoop()
  }, [emit, emitRaw, ensureLoop])

  const setPois = useCallback((pois) => { s.current.pois = pois; emit() }, [emit])

  // pause when tab hidden; resume timing cleanly.
  useEffect(() => {
    const onVis = () => { if (document.hidden && s.current.playing) { s.current.playing = false; emit() } }
    document.addEventListener('visibilitychange', onVis)
    return () => { document.removeEventListener('visibilitychange', onVis); stopLoop() }
  }, [emit, stopLoop])

  const api = useMemo(() => ({
    getState, subscribe, subscribeRaw,
    play, pause, setTurbo, setModal, close, startDrive, startTrip, setPois,
  }), [getState, subscribe, subscribeRaw, play, pause, setTurbo, setModal, close, startDrive, startTrip, setPois])

  return <SimContext.Provider value={api}>{children}</SimContext.Provider>
}

function bearingOf([lat1, lon1], [lat2, lon2]) {
  const dLon = (lon2 - lon1) * Math.PI / 180
  const y = Math.sin(dLon) * Math.cos(lat2 * Math.PI / 180)
  const x = Math.cos(lat1 * Math.PI / 180) * Math.sin(lat2 * Math.PI / 180) -
    Math.sin(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) * Math.cos(dLon)
  return (Math.atan2(y, x) * 180 / Math.PI + 360) % 360
}

export function useSimApi() {
  const ctx = useContext(SimContext)
  if (!ctx) throw new Error('useSimApi must be used within SimProvider')
  return ctx
}

// Subscribe to a coarse slice of sim state; re-renders only when the slice changes.
export function useSim(selector) {
  const { getState, subscribe } = useSimApi()
  const selRef = useRef(selector); selRef.current = selector
  const [val, setVal] = useState(() => selector(getState()))
  useEffect(() => {
    let prev = selRef.current(getState())
    setVal(prev)
    return subscribe(() => {
      const next = selRef.current(getState())
      if (!Object.is(next, prev)) { prev = next; setVal(next) }
    })
  }, [getState, subscribe])
  return val
}
