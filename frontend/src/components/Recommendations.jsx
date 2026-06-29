import { useI18n } from '../i18nContext.jsx'
import { useStore } from '../store.jsx'
import { getRoute } from '../api.js'

export default function Recommendations() {
  const { t } = useI18n()
  const { state, dispatch, reachability } = useStore()
  const list = state.nearby

  if (!list.length) {
    return (
      <div className="results">
        <div className="rec-empty" dangerouslySetInnerHTML={{ __html: t('recEmpty') }} />
      </div>
    )
  }

  const compatible = list.filter((s) => s.is_match).length

  const pickStation = async (s) => {
    if (!state.location) return
    try {
      const r = await getRoute({ fromLat: state.location.lat, fromLon: state.location.lon, toLat: s.lat, toLon: s.lon })
      dispatch({ type: 'SET_ROUTE', route: r, station: s })
    } catch (e) { console.error(e) }
  }

  return (
    <div className="results">
      {compatible === 0 && (
        <div className="rec-warn">{t('noMatch').replace('{conn}', state.vehicle.connLabel)}</div>
      )}
      {list.map((s, i) => {
        const reach = reachability(s)
        const match = !!s.is_match
        const km = (s.distance_m / 1000).toFixed(2)
        return (
          <div className={'rec' + (i === 0 ? ' top' : '')} key={s.station_id ?? i} onClick={() => pickStation(s)}>
            <div className="name">{i === 0 && <span className="pill best">{t('best')}</span>} {s.title || 'Station'}</div>
            <div className="meta">{s.operator || 'Unknown'} · {s.town || ''}</div>
            <div className="why">
              {s.live && <LivePill s={s} t={t} />}
              <span className="pill dist">📍 {km} km</span>
              <span className="pill kw">⚡ {s.max_power_kw || '?'} kW</span>
              {match
                ? <span className="pill match">{t('yourPlug')}</span>
                : <span className="pill conn">{(s.connector_types || 'n/a').split(',')[0]}</span>}
              <span className={'pill ' + reach.cls}>{t(reach.key)}</span>
              {/public/i.test(s.usage_type || '') && <span className="pill pub">{t('publicWord')}</span>}
            </div>
          </div>
        )
      })}
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
