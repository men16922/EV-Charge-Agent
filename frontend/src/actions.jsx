import { useStore } from './store.jsx'
import { useChat } from './chat.jsx'
import { useSimApi } from './sim.jsx'
import { getRoute, getPois } from './api.js'
import { CITIES, CITY_VEHICLE, VEHICLES } from './config.js'

// Smart-life actions for the chat chips. Recommendation-style chips are
// AGENT-DRIVEN: they send a prompt and let the agent pick the station; the chat
// layer then draws + drives that pick on the main map (so card, map and drive
// all agree). The trip chip stays deterministic (multi-stop isn't one station).
export function useSmartActions() {
  const { state, dispatch } = useStore()
  const { sendUser } = useChat()
  const sim = useSimApi()

  // Use the car's location; if none set yet, default to Seoul so the demo flows.
  function ensureLocation() {
    if (state.location) return state.location
    const c = CITIES[0]
    const v = VEHICLES.find((x) => x.id === CITY_VEHICLE[c.id])
    if (v) dispatch({ type: 'SET_VEHICLE', vehicle: v })
    const loc = { lat: c.lat, lon: c.lon, label: c.name }
    dispatch({ type: 'SET_LOCATION', location: loc })
    return loc
  }
  const at = (loc) => `latitude ${loc.lat.toFixed(4)}, longitude ${loc.lon.toFixed(4)}`

  // ⚡ Smart & not busy → agent recommends a non-busy charger, then we drive it.
  function smartCharge() {
    const loc = ensureLocation()
    sendUser(
      `Find a fast charger near ${at(loc)} that won't be busy soon. Call plan_route to the one you recommend, and explain why using distance, power, live availability and the demand forecast.`,
      { drive: true, loc, display: "Find a fast charger that won't be busy soon" })
  }

  // 🍴 Lunch while I charge → agent recommends a charger + nearby restaurant, then we drive it.
  function lunchWhileCharging() {
    const loc = ensureLocation()
    sendUser(
      `I'm at ${at(loc)}. Recommend a fast charger, call plan_route to it, then use find_pois_near to suggest a restaurant I can walk to while it charges. Give a concrete plan.`,
      { drive: true, loc, display: 'Recommend a charger + lunch while I charge' })
  }

  // 🗺️ Shopping → dinner → parking outing (deterministic multi-stop), drawn + simulated inline.
  async function planSmartTrip() {
    const loc = ensureLocation()
    const types = ['shopping_mall', 'restaurant', 'parking']
    const res = await Promise.all(types.map((tp) => getPois({ lat: loc.lat, lon: loc.lon, type: tp }).catch(() => ({ pois: [] }))))
    const stops = [{ name: (loc.label || 'Start').replace(/[\u{1F1E6}-\u{1F1FF}]/gu, '').trim() || 'Start', lat: loc.lat, lon: loc.lon }]
    const allPois = []
    res.forEach((r) => {
      const p = (r.pois || [])[0]
      if (p) stops.push({ name: p.name, lat: p.lat, lon: p.lon })
      ;(r.pois || []).slice(0, 2).forEach((x) => allPois.push(x))
    })
    dispatch({ type: 'SET_TRIP_STOPS', stops })
    dispatch({ type: 'SET_POIS', pois: allPois })
    const legs = []
    let allCoords = [], distM = 0, durS = 0, provider = 'osrm'
    for (let i = 0; i < stops.length - 1; i++) {
      const a = stops[i], b = stops[i + 1]
      try {
        const rr = await getRoute({ fromLat: a.lat, fromLon: a.lon, toLat: b.lat, toLon: b.lon })
        if (rr.coords && rr.coords.length) {
          legs.push({ coords: rr.coords, duration_s: rr.duration_s, from: a.name, to: b.name })
          allCoords = allCoords.concat(rr.coords); distM += rr.distance_m || 0; durS += rr.duration_s || 0; provider = rr.provider
        }
      } catch { /* skip leg */ }
    }
    if (legs.length) {
      const totalKm = +(distM / 1000).toFixed(1), totalMin = Math.round(durS / 60)
      dispatch({ type: 'SET_ROUTE', route: { coords: allCoords, distance_m: distM, duration_s: durS, provider } })
      dispatch({ type: 'SET_TRIP_PLAN', plan: { total_km: totalKm, total_min: totalMin, legs: legs.length } })
      sim.startTrip({ legs, title: stops.map((s) => s.name).join(' → '), socStart: state.soc, pois: allPois, totalKm, totalMin, modal: false })
    }
    const list = stops.map((s) => `${s.name} (lat ${s.lat.toFixed(4)}, lon ${s.lon.toFixed(4)})`).join(' → ')
    sendUser(`Plan a smart EV outing near me through these stops in order: ${list}. Give per-leg ETA, the total, where congestion may bite, and where to charge if the battery would run low.`,
      { display: 'Plan a shopping + dinner trip near me' })
  }

  return { smartCharge, lunchWhileCharging, planSmartTrip }
}
