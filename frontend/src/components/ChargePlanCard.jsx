import { useI18n } from '../i18nContext.jsx'
import { useStore } from '../store.jsx'
import { useChat } from '../chat.jsx'
import { useSimApi } from '../sim.jsx'
import { estimateCharge } from '../config.js'
import { getRoute } from '../api.js'

// Structured UI summary of the AGENT's plan: recommended charger + charge time +
// what to do while charging. Prefers the agent's reconstructed pick (from tool
// results) and falls back to the frontend's own recommendation.
export default function ChargePlanCard() {
  const { t } = useI18n()
  const { state } = useStore()
  const { agentPlan } = useChat()
  const sim = useSimApi()
  const { vehicle, soc } = state

  const s = agentPlan?.station || state.selectedStation
  if (!s) return null
  const pois = (agentPlan?.pois && agentPlan.pois.length) ? agentPlan.pois : state.pois
  // duration: agent route is {distance_km,duration_min}; store route is {distance_m,duration_s}
  const driveMin = agentPlan?.route ? agentPlan.route.duration_min
    : state.route ? Math.round((state.route.duration_s || 0) / 60) : null
  const km = agentPlan?.route ? agentPlan.route.distance_km
    : state.route ? (state.route.distance_m || 0) / 1000
    : (s.distance_m != null ? s.distance_m / 1000 : null)

  const est = estimateCharge(vehicle, soc, s)
  const poi = pois && pois.length ? pois[0] : null

  const replay = async () => {
    let r = (state.route && state.route.coords && state.route.coords.length) ? state.route : null
    if ((!r || state.selectedStation?.station_id !== s.station_id) && state.location) {
      try { r = await getRoute({ fromLat: state.location.lat, fromLon: state.location.lon, toLat: s.lat, toLon: s.lon }) } catch { /* ignore */ }
    }
    if (r) sim.startDrive({ route: r, station: s, vehicle, socStart: soc, socTarget: est.target, pois: pois || [] })
  }

  return (
    <div className="plan-card">
      <div className="plan-h">{t('planTitle')}</div>
      <div className="plan-body">
        <div className="plan-station">{s.title || 'Station'}</div>
        <div className="plan-pills">
          {km != null && <span className="pill dist">📍 {km.toFixed(2)} km</span>}
          <span className="pill kw">⚡ {s.max_power_kw || '?'} kW</span>
          {s.is_match
            ? <span className="pill match">🔌 {t('yourPlug')}</span>
            : <span className="pill conn">{(s.connector_types || 'n/a').split(',')[0]}</span>}
          {s.live && <LivePill s={s} t={t} />}
        </div>
        <div className="plan-grid">
          <div className="plan-stat"><b>~{est.minutes}<small> min</small></b><span>{t('planChargeTo').replace('{a}', soc).replace('{b}', est.target)}</span></div>
          <div className="plan-stat"><b>{est.kw}<small> kW</small></b><span>+{est.addedKwh} kWh {t('planAdded')}</span></div>
          {driveMin != null && <div className="plan-stat"><b>{driveMin}<small> min</small></b><span>🧭 {t('planDrive')}</span></div>}
        </div>
        {poi && (
          <div className="plan-poi">
            🍴 <b>{t('planWhile')}:</b> {poi.name}
            {poi.rating ? <span className="star"> · ★ {poi.rating}</span> : null}
            {poi.walk_min ? ` · 🚶 ${poi.walk_min} ${t('planWalk')}` : ''}
          </div>
        )}
        <button className="btn btn-primary plan-replay" onClick={replay}>{t('planReplay')}</button>
      </div>
    </div>
  )
}

function LivePill({ s, t }) {
  const cls = s.live === 'available' ? 'ok' : (s.live === 'busy' ? 'warn' : 'bad')
  const label = s.live === 'offline' ? `⚫ ${t('offlineWord')}`
    : s.live === 'busy' ? `🟠 ${t('busyWord')}`
    : `🟢 ${s.available}/${s.total} ${t('freeWord')}`
  return <span className={'pill ' + cls}>{label}</span>
}
