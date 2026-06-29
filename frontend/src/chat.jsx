import { createContext, useContext, useRef, useState, useCallback } from 'react'
import { streamChat, getRoute, haversine } from './api.js'
import { useStore } from './store.jsx'
import { useI18n } from './i18nContext.jsx'
import { useSimApi } from './sim.jsx'

// Reconstruct the agent's actual recommendation from the structured tool
// call-args + results (so the UI card reflects what the agent decided, e.g. a
// fallback station when the first was busy). `text` is the agent's answer so we
// can match the recommended station by name when no route/POI anchor exists.
function buildAgentPlan(calls, results, text = '') {
  const stations = results.find_nearby_stations?.stations || []
  const poiArgs = calls.find_pois_near
  const routeArgs = calls.plan_route
  const routeRes = results.plan_route
  const pois = results.find_pois_near?.pois || []
  let anchor = null
  if (poiArgs && poiArgs.latitude != null) anchor = [poiArgs.latitude, poiArgs.longitude]
  else if (routeArgs && routeArgs.to_latitude != null) anchor = [routeArgs.to_latitude, routeArgs.to_longitude]
  let station = null
  if (anchor && stations.length) {
    station = stations.reduce((best, s) =>
      (best == null || haversine(anchor, [s.lat, s.lon]) < haversine(anchor, [best.lat, best.lon])) ? s : best, null)
  }
  // fallback: match the station the agent named in its prose
  if (!station && text && stations.length) {
    station = stations.find((s) => s.title && text.includes(s.title)) || null
  }
  if (!station && stations.length) station = stations[0]
  const route = routeRes && routeRes.distance_km != null
    ? { distance_km: routeRes.distance_km, duration_min: routeRes.duration_min } : null
  const fcArgs = calls.predict_charging_demand
  const forecastZone = fcArgs ? (fcArgs.zone_id || fcArgs.zone || 'ZONE_GANGNAM') : null
  if (!station && !pois.length && !forecastZone) return null
  return { station, pois, route, chargeMinutes: poiArgs?.charge_minutes, forecastZone }
}

const ChatContext = createContext(null)

let _id = 0
const nextId = () => ++_id

export function ChatProvider({ children }) {
  const { state, dispatch, rangeKm } = useStore()
  const { lang, t } = useI18n()
  const sim = useSimApi()
  const [entries, setEntries] = useState([]) // {id, kind:'msg'|'steps', sender?, text?, labels?}
  const [typing, setTyping] = useState(false)
  const [agentPlan, setAgentPlan] = useState(null) // reconstructed from tool events
  const abortRef = useRef(null)
  const stateRef = useRef(state)
  stateRef.current = state
  const locRef = useRef(state.location)
  locRef.current = state.location
  const driveRef = useRef(null) // {loc} when the current chat should auto-drive

  // After the agent's plan is known, drive it on the MAIN map (inline, not modal).
  const maybeDrive = useCallback(async (plan) => {
    if (!driveRef.current || !plan || !plan.station) return
    const loc = driveRef.current.loc || locRef.current
    if (!loc) return
    try {
      const r = await getRoute({ fromLat: loc.lat, fromLon: loc.lon, toLat: plan.station.lat, toLon: plan.station.lon })
      if (r.coords && r.coords.length) {
        const st = stateRef.current
        sim.startDrive({ route: r, station: plan.station, vehicle: st.vehicle, socStart: st.soc, socTarget: 80, pois: plan.pois || [], modal: false })
      }
    } catch { /* ignore */ }
  }, [sim])

  // Draw the agent's chosen station + POIs on the main map (fetch coords for the polyline).
  const syncMap = useCallback((plan) => {
    if (!plan || !plan.station) return
    dispatch({ type: 'SELECT_STATION', station: plan.station })
    if (plan.pois && plan.pois.length) dispatch({ type: 'SET_POIS', pois: plan.pois })
    const loc = locRef.current
    if (loc) {
      getRoute({ fromLat: loc.lat, fromLon: loc.lon, toLat: plan.station.lat, toLon: plan.station.lon })
        .then((r) => dispatch({ type: 'SET_ROUTE', route: r, station: plan.station }))
        .catch(() => {})
    }
  }, [dispatch])

  const push = useCallback((e) => { const id = nextId(); setEntries((p) => [...p, { id, ...e }]); return id }, [])
  const updateEntry = useCallback((id, patch) => {
    setEntries((p) => p.map((e) => e.id === id ? { ...e, ...patch } : e))
  }, [])

  // Core streaming send. display optional user bubble; sendText goes to the agent.
  const run = useCallback(async (sendText, { display, silent, drive, driveLoc } = {}) => {
    if (!silent && display) push({ kind: 'msg', sender: 'user', text: display })
    setTyping(true)
    if (abortRef.current) abortRef.current.abort()
    const ctrl = new AbortController()
    abortRef.current = ctrl
    driveRef.current = drive ? { loc: driveLoc } : null
    let stepsId = null, agentId = null, acc = ''
    let stepLabels = []
    const calls = {}, results = {}
    setAgentPlan(null)
    // live (card + map) update while streaming; final drive happens after.
    const tryBuild = () => { const p = buildAgentPlan(calls, results, acc); if (p) { setAgentPlan(p); syncMap(p) } }
    try {
      await streamChat(sendText, {
        signal: ctrl.signal,
        onStep: (label) => {
          if (stepsId == null) { stepLabels = []; stepsId = push({ kind: 'steps', labels: [] }) }
          stepLabels = [...stepLabels, label]
          updateEntry(stepsId, { labels: stepLabels })
        },
        onToken: (tok) => {
          setTyping(false)
          if (agentId == null) agentId = push({ kind: 'msg', sender: 'agent', text: '' })
          acc += tok
          updateEntry(agentId, { text: acc })
        },
        onCall: (tool, args) => { calls[tool] = args; tryBuild() },
        onData: (tool, result) => { results[tool] = result; tryBuild() },
      })
      setTyping(false)
      if (agentId == null) push({ kind: 'msg', sender: 'agent', text: '(no response)' })
      // final reconstruction with the full answer text → most accurate station match
      const finalPlan = buildAgentPlan(calls, results, acc)
      if (finalPlan) { setAgentPlan(finalPlan); syncMap(finalPlan); await maybeDrive(finalPlan) }
    } catch (e) {
      if (e.name !== 'AbortError') { setTyping(false); push({ kind: 'msg', sender: 'agent', text: 'Error reaching the agent server.' }) }
    } finally {
      driveRef.current = null
    }
  }, [push, updateEntry, syncMap, maybeDrive])

  const evContext = useCallback(() => {
    let msg = ` (My EV: ${state.vehicle.name}, ${state.vehicle.connLabel} connector, battery ${state.soc}%, ~${rangeKm()} km range.`
    if (state.location) msg += ` My car location: latitude ${state.location.lat.toFixed(4)}, longitude ${state.location.lon.toFixed(4)}.`
    return msg + ')'
  }, [state.vehicle, state.soc, state.location, rangeKm])

  const langSuffix = useCallback(() => (lang === 'ko' ? t('langInstr') : ''), [lang, t])

  // Free-form user message (adds EV context like the original sendMessage).
  // opts.drive → after the agent answers, drive its chosen station on the main map.
  const sendUser = useCallback((text, { drive = false, loc = null, display = null } = {}) => {
    if (!text.trim()) return
    run(text + evContext() + langSuffix(), { display: display ?? text, drive, driveLoc: loc })
  }, [run, evContext, langSuffix])

  // Agent-directed prompt (recommend / POI / trip). Silent by default.
  const sendPrompt = useCallback((prompt, { silent = true, drive = false, loc = null } = {}) => {
    run(prompt + langSuffix(), { silent, drive, driveLoc: loc })
  }, [run, langSuffix])

  const value = { entries, typing, agentPlan, sendUser, sendPrompt }
  return <ChatContext.Provider value={value}>{children}</ChatContext.Provider>
}

export function useChat() {
  const ctx = useContext(ChatContext)
  if (!ctx) throw new Error('useChat must be used within ChatProvider')
  return ctx
}

export function formatMarkdown(text) {
  if (!text) return ''
  let f = text.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
  f = f.replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>').replace(/`([^`]+)`/g, '<code>$1</code>')
  f = f.replace(/(?:^|\n)\s*[*-]\s+(.*?)(?=\n|$)/g, '<li>$1</li>').replace(/\n/g, '<br>')
  if (f.includes('<li>')) f = f.replace(/(<li>.*<\/li>)/s, '<ul>$1</ul>')
  return f
}
