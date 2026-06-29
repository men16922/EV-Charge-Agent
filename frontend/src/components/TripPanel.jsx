import Panel from './Panel.jsx'
import { useI18n } from '../i18nContext.jsx'
import { useStore } from '../store.jsx'
import { useChat } from '../chat.jsx'
import { useSimApi } from '../sim.jsx'
import { CITIES } from '../config.js'
import { getRoute } from '../api.js'

export default function TripPanel() {
  const { t } = useI18n()
  const { state, dispatch } = useStore()
  const { sendPrompt } = useChat()
  const sim = useSimApi()
  const stops = state.trip.stops

  const addCity = (id) => {
    const c = CITIES.find((x) => x.id === id)
    if (c) dispatch({ type: 'ADD_TRIP_STOP', stop: { name: c.name, lat: c.lat, lon: c.lon } })
  }
  const addCar = () => {
    if (state.location) dispatch({ type: 'ADD_TRIP_STOP', stop: { name: state.location.label || 'My car', lat: state.location.lat, lon: state.location.lon } })
  }

  const planTrip = async () => {
    if (stops.length < 2) return
    const legs = []
    let allCoords = [], distM = 0, durS = 0, provider = 'osrm'
    for (let i = 0; i < stops.length - 1; i++) {
      const a = stops[i], b = stops[i + 1]
      try {
        const r = await getRoute({ fromLat: a.lat, fromLon: a.lon, toLat: b.lat, toLon: b.lon })
        if (r.coords && r.coords.length) {
          legs.push({ coords: r.coords, duration_s: r.duration_s, from: a.name, to: b.name })
          allCoords = allCoords.concat(r.coords)
          distM += r.distance_m || 0; durS += r.duration_s || 0; provider = r.provider
        }
      } catch (e) { console.error(e) }
    }
    if (!legs.length) return
    dispatch({ type: 'SET_ROUTE', route: { coords: allCoords, distance_m: distM, duration_s: durS, provider } })
    const totalKm = +(distM / 1000).toFixed(1), totalMin = Math.round(durS / 60)
    dispatch({ type: 'SET_TRIP_PLAN', plan: { total_km: totalKm, total_min: totalMin, legs: legs.length } })
    sim.startTrip({ legs, title: stops.map((s) => s.name.replace(/[\u{1F1E6}-\u{1F1FF}]/gu, '').trim()).join(' → '), socStart: state.soc, pois: state.pois, totalKm, totalMin })
    const list = stops.map((s) => `${s.name} (lat ${s.lat.toFixed(4)}, lon ${s.lon.toFixed(4)})`).join(' → ')
    sendPrompt(`Plan a multi-stop EV trip through these stops in order: ${list}. ` +
      `Give per-leg distance and ETA, the total, and flag where congestion or a charging stop may be needed.`)
  }

  return (
    <Panel title={<span>{t('tripPanel')}</span>} defaultCollapsed>
      <div className="row">
        <label className="fld" style={{ flex: 1 }}><span>{t('jumpCity')}</span>
          <select value="" onChange={(e) => addCity(e.target.value)}>
            <option value="">{t('selectCity')}</option>
            {CITIES.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
          </select>
        </label>
        <label className="fld">&nbsp;<button className="btn btn-ghost" onClick={addCar} disabled={!state.location}>+ 📍</button></label>
      </div>
      {stops.length === 0 && <div className="rec-empty">{t('tripEmpty')}</div>}
      {stops.map((s, i) => (
        <div className="trip-stop" key={i}>
          <span className="dot">{i + 1}</span>
          <span className="nm">{s.name}</span>
          <span className="rm" onClick={() => dispatch({ type: 'REMOVE_TRIP_STOP', index: i })}>✕</span>
        </div>
      ))}
      {state.trip.plan && (
        <div className="trip-total">{t('tripTotal')}: <b>{state.trip.plan.total_km} km · {state.trip.plan.total_min} min</b> · {state.trip.plan.legs} legs</div>
      )}
      <div className="row" style={{ marginTop: 8 }}>
        <button className="btn btn-primary" style={{ flex: 1 }} onClick={planTrip} disabled={stops.length < 2}>{t('tripPlan')}</button>
      </div>
    </Panel>
  )
}
