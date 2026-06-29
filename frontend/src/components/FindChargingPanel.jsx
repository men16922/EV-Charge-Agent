import { useState } from 'react'
import Panel from './Panel.jsx'
import { useI18n } from '../i18nContext.jsx'
import { useStore } from '../store.jsx'
import { useChat } from '../chat.jsx'
import { useSimApi } from '../sim.jsx'
import { CITIES, CITY_VEHICLE, VEHICLES } from '../config.js'
import { getNearby, getRoute, getPois } from '../api.js'

export default function FindChargingPanel() {
  const { t } = useI18n()
  const { state, dispatch, rangeKm } = useStore()
  const { sendPrompt } = useChat()
  const sim = useSimApi()
  const [locBtn, setLocBtn] = useState(null)
  const { filters, vehicle, soc, location, route, selectedStation } = state

  const selectCity = (id) => {
    const c = CITIES.find((x) => x.id === id)
    if (!c) return
    const vid = CITY_VEHICLE[id]
    if (vid) { const v = VEHICLES.find((x) => x.id === vid); if (v) dispatch({ type: 'SET_VEHICLE', vehicle: v }) }
    dispatch({ type: 'SET_LOCATION', location: { lat: c.lat, lon: c.lon, label: c.name } })
  }

  const useMyLocation = () => {
    setLocBtn('Locating…')
    if (!navigator.geolocation) { setLocBtn(null); return }
    navigator.geolocation.getCurrentPosition(
      (p) => { dispatch({ type: 'SET_LOCATION', location: { lat: p.coords.latitude, lon: p.coords.longitude, label: 'My car' } }); setLocBtn('📍 Location set') },
      () => { setLocBtn(null) },
      { enableHighAccuracy: true, timeout: 8000 })
  }

  const recommend = async () => {
    if (!location) return
    try {
      const d = await getNearby({ lat: location.lat, lon: location.lon, radiusKm: filters.radiusKm, minPowerKw: filters.minPowerKw, connector: vehicle.conn, limit: 14 })
      const all = d.stations || []
      if (!all.length) { dispatch({ type: 'SET_NEARBY', nearby: [] }); return }
      const matches = all.filter((s) => s.is_match)
      const show = (matches.length ? matches : all).slice(0, 6)
      dispatch({ type: 'SET_NEARBY', nearby: show })
      dispatch({ type: 'SET_TAB', tab: 'chat' }) // show the streaming result + plan card
      const r = await getRoute({ fromLat: location.lat, fromLon: location.lon, toLat: show[0].lat, toLon: show[0].lon })
      dispatch({ type: 'SET_ROUTE', route: r, station: show[0] })
      const minLabel = filters.minPowerKw === 0 ? 'any-power' : `${filters.minPowerKw}kW+`
      sendPrompt(
        `My EV is a ${vehicle.name} (${vehicle.connLabel} connector), battery at ${soc}% (~${rangeKm()} km range). ` +
        `I'm at latitude ${location.lat.toFixed(4)}, longitude ${location.lon.toFixed(4)}. ` +
        `Recommend the best ${minLabel} charging station within ${filters.radiusKm}km that is reachable on my current battery and matches my connector. ` +
        `Explain why using distance, power/connector match and likely upcoming congestion, then give the driving ETA.`)
    } catch (e) { console.error(e) }
  }

  const simulateDrive = async () => {
    if (!route || !selectedStation) return
    sim.startDrive({ route, station: selectedStation, vehicle, socStart: soc, socTarget: 80, pois: [], modal: false })
    try {
      const p = await getPois({ lat: selectedStation.lat, lon: selectedStation.lon, type: 'restaurant' })
      sim.setPois(p.pois || [])
      dispatch({ type: 'SET_POIS', pois: p.pois || [] }) // also show POIs on the main map
    } catch (e) { console.error(e) }
  }

  return (
    <Panel title={<span>{t('findCharging')}</span>}>
      <div className="row">
        <button className="btn btn-primary" onClick={useMyLocation}>{locBtn || t('myCarLoc')}</button>
        <label className="fld" style={{ flex: 1 }}><span>{t('jumpCity')}</span>
          <select value="" onChange={(e) => selectCity(e.target.value)}>
            <option value="">{t('selectCity')}</option>
            {CITIES.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
          </select>
        </label>
      </div>
      <div className="row">
        <label className="fld"><span>{t('radius')}</span>
          <select value={filters.radiusKm} onChange={(e) => dispatch({ type: 'SET_FILTERS', filters: { radiusKm: +e.target.value } })}>
            <option value="3">3 km</option><option value="5">5 km</option><option value="10">10 km</option><option value="25">25 km</option>
          </select>
        </label>
        <label className="fld"><span>{t('minPower')}</span>
          <select value={filters.minPowerKw} onChange={(e) => dispatch({ type: 'SET_FILTERS', filters: { minPowerKw: +e.target.value } })}>
            <option value="0">{t('powAny')}</option><option value="50">{t('powFast')}</option><option value="150">{t('powUltra')}</option>
          </select>
        </label>
        <label className="fld">&nbsp;<button className="btn btn-primary" onClick={recommend} disabled={!location}>{t('recommend')}</button></label>
        <label className="fld">&nbsp;<button className={'btn btn-eco' + (state.equityOn ? ' active' : '')} onClick={() => dispatch({ type: 'SET_EQUITY', on: !state.equityOn })}>{state.equityOn ? t('eqOn') : t('eqView')}</button></label>
      </div>
      {route && selectedStation && (
        <div className="row">
          <button className="btn btn-primary" style={{ flex: 1 }} onClick={simulateDrive}>{t('simDrive')}</button>
        </div>
      )}
    </Panel>
  )
}
