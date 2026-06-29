import { useEffect, useRef } from 'react'
import L from 'leaflet'
import { useSim, useSimApi } from '../sim.jsx'
import { useStore } from '../store.jsx'
import { useI18n } from '../i18nContext.jsx'
import { TURBO_SPEEDS, socColor, poiIcon } from '../config.js'
import { carIcon, poiMarkerIcon, chargerIcon } from '../map/icons.js'

export default function SimulationModal() {
  const open = useSim((s) => s.open)
  const modal = useSim((s) => s.modal)
  if (!open || !modal) return null
  return <ModalInner />
}

function ModalInner() {
  const sim = useSimApi()
  const { state } = useStore()
  const { t } = useI18n()
  const mapRef = useRef({})

  const phase = useSim((s) => s.phase)
  const playing = useSim((s) => s.playing)
  const turbo = useSim((s) => s.turbo)
  const title = useSim((s) => s.title)
  const mode = useSim((s) => s.mode)
  const tripKm = useSim((s) => s.tripKm)
  const tripMin = useSim((s) => s.tripMin)
  const stops = useSim((s) => s.legs.length + (s.legs.length ? 1 : 0))
  const soc = useSim((s) => Math.round(s.soc))
  const driveMin = useSim((s) => Math.round(s.driveMin))
  const totalDriveMin = useSim((s) => Math.round(s.totalDriveMin))
  const chargeMin = useSim((s) => Math.round(s.chargeMin))
  const estChargeMin = useSim((s) => s.estChargeMin)
  const chargeKw = useSim((s) => s.chargeKw)
  const driveProgress = useSim((s) => Math.round(s.driveProgress * 100))
  const poiCount = useSim((s) => s.pois.length)

  // build the dedicated map once
  useEffect(() => {
    const st = sim.getState()
    const map = L.map('sim-map', { zoomControl: true, attributionControl: false }).setView([37.55, 126.99], 13)
    L.tileLayer('https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}.png', { maxZoom: 19 }).addTo(map)
    const allCoords = st.legs.flatMap((l) => l.path.coords)
    if (allCoords.length) {
      const line = L.polyline(allCoords, { color: '#39d98a', weight: 4, opacity: .9 }).addTo(map)
      map.fitBounds(line.getBounds(), { padding: [40, 40] })
    }
    if (st.station) {
      L.marker([st.station.lat, st.station.lon], { icon: chargerIcon(st.station.max_power_kw, { rec: true, best: true, label: '⚡' }) })
        .addTo(map).bindPopup(st.station.title || 'Charger')
    }
    const car = L.marker(st.carPos || allCoords[0] || [37.55, 126.99], { icon: carIcon(state.vehicle), zIndexOffset: 1000 }).addTo(map)
    mapRef.current = { map, car }

    const unsub = sim.subscribeRaw((s) => {
      if (s.carPos) { car.setLatLng(s.carPos); if (s.phase === 'drive') map.panTo(s.carPos, { animate: true, duration: 0.2 }) }
    })
    return () => { unsub(); map.remove() }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  // drop POI markers when they load / charge starts
  useEffect(() => {
    const { map } = mapRef.current
    if (!map) return
    if (mapRef.current.poiLayer) { map.removeLayer(mapRef.current.poiLayer); mapRef.current.poiLayer = null }
    const pois = sim.getState().pois
    if (!pois.length) return
    const layer = L.layerGroup()
    pois.forEach((p) => L.marker([p.lat, p.lon], { icon: poiMarkerIcon(p.type) }).bindPopup(`${p.name}`).addTo(layer))
    layer.addTo(map)
    mapRef.current.poiLayer = layer
  }, [poiCount, phase]) // eslint-disable-line react-hooks/exhaustive-deps

  const isTrip = mode === 'trip'
  const phases = isTrip
    ? [{ key: 'drive', label: t('phaseDrive') }, { key: 'done', label: t('phaseArrived') }]
    : [{ key: 'drive', label: t('phaseDrive') }, { key: 'charge', label: t('phaseCharge') }, { key: 'poi', label: t('phasePoi') }]
  const order = isTrip ? ['drive', 'done'] : ['drive', 'arrive', 'charge', 'poi', 'done']
  const phaseRank = order.indexOf(phase)
  const phaseLabel = isTrip
    ? (phase === 'done' ? t('phaseArrived') : t('phaseDrive'))
    : { drive: t('phaseDrive'), arrive: t('phaseArrive'), charge: t('phaseCharge'), poi: t('phasePoi'), done: t('phaseDone') }[phase]

  const progressPct = isTrip ? driveProgress
    : (phase === 'charge' || phase === 'poi' || phase === 'done' ? soc : driveProgress)

  const pois = sim.getState().pois
  const showPois = isTrip ? pois.length > 0 : (pois.length > 0 && (phase === 'charge' || phase === 'poi'))

  return (
    <div className="sim-overlay" onClick={(e) => { if (e.target === e.currentTarget) sim.close() }}>
      <div className="sim-modal">
        <div className="sim-head">
          <div>
            <div className="title">🚗 {title}</div>
            <div className="phase-label">{t('simTitle')} · {phaseLabel}</div>
          </div>
          <div className="sim-phases">
            {phases.map((p) => {
              const rank = order.indexOf(p.key)
              const cls = phase === p.key ? 'on' : (rank < phaseRank ? 'done' : '')
              return <span key={p.key} className={'phase-chip ' + cls}>{p.label}</span>
            })}
          </div>
          <button className="sim-close" onClick={() => sim.close()}>✕</button>
        </div>

        <div className="sim-body">
          <div id="sim-map" className="sim-map" />
          <div className="sim-side">
            <BatteryGauge soc={soc} />
            {isTrip ? (
              <div className="sim-stat-grid">
                <div className="sim-stat"><div className="v">{tripKm}<small> km</small></div><div className="l">🧭 {t('tripDistance')}</div></div>
                <div className="sim-stat"><div className="v">{tripMin}<small> min</small></div><div className="l">⏱ {t('tripEta')}</div></div>
                <div className="sim-stat"><div className="v">{stops}</div><div className="l">📍 {t('tripStopsN')}</div></div>
                <div className="sim-stat"><div className="v">{soc}<small>%</small></div><div className="l">🔋 {t('battery')}</div></div>
              </div>
            ) : (
              <div className="sim-stat-grid">
                <div className="sim-stat"><div className="v">{driveMin}/{totalDriveMin}<small> min</small></div><div className="l">🧭 {t('elapsed')}</div></div>
                <div className="sim-stat"><div className="v">{phase === 'charge' || phase === 'poi' || phase === 'done' ? chargeMin : 0}<small>/{estChargeMin} min</small></div><div className="l">⚡ {t('chargeTime')}</div></div>
                <div className="sim-stat"><div className="v">{chargeKw || sim.getState().maxPowerKw}<small> kW</small></div><div className="l">{t('phaseCharge')}</div></div>
                <div className="sim-stat"><div className="v">{soc}<small>%</small></div><div className="l">🔋 {t('battery')}</div></div>
              </div>
            )}

            {showPois && (
              <div className="poi-strip">
                <div className="hd">{isTrip ? t('poiAlong') : t('poiNearby')}</div>
                {pois.slice(0, 4).map((p, i) => (
                  <div className="poi-card" key={i}>
                    <span className="ic">{poiIcon(p.type)}</span>
                    <span className="nm">{p.name}</span>
                    {p.rating ? <span className="rating">★ {p.rating}</span> : null}
                    <span className="walk">🚶 {p.walk_min} {t('walkMin')}</span>
                  </div>
                ))}
              </div>
            )}

            <div className="sim-controls">
              <div className="sim-progress"><span style={{ width: progressPct + '%' }} /></div>
              <div className="sim-btns">
                <button className="play" onClick={() => playing ? sim.pause() : sim.play()}>
                  {playing ? `⏸ ${t('pause')}` : `▶ ${t('play')}`}
                </button>
                <div className="turbo-seg">
                  {TURBO_SPEEDS.map((sp) => (
                    <button key={sp} className={turbo === sp ? 'on' : ''} onClick={() => sim.setTurbo(sp)}>{sp}×</button>
                  ))}
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}

function BatteryGauge({ soc }) {
  const r = 64, c = 2 * Math.PI * r
  const off = c * (1 - soc / 100)
  return (
    <div className="gauge-wrap">
      <div className="gauge">
        <svg width="150" height="150" viewBox="0 0 150 150">
          <circle cx="75" cy="75" r={r} fill="none" stroke="rgba(255,255,255,.1)" strokeWidth="12" />
          <circle cx="75" cy="75" r={r} fill="none" stroke={socColor(soc)} strokeWidth="12"
            strokeLinecap="round" strokeDasharray={c} strokeDashoffset={off} />
        </svg>
        <div className="center">
          <div>
            <div className="pct">{soc}%</div>
            <div className="sub">SoC</div>
          </div>
        </div>
      </div>
    </div>
  )
}
