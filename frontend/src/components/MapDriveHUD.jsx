import { useSim, useSimApi } from '../sim.jsx'
import { useI18n } from '../i18nContext.jsx'
import { TURBO_SPEEDS } from '../config.js'

// Compact control bar shown OVER the main map when an inline (non-modal)
// simulation is running — so the car visibly drives on the dashboard map.
export default function MapDriveHUD() {
  const open = useSim((s) => s.open)
  const modal = useSim((s) => s.modal)
  if (!open || modal) return null
  return <HUD />
}

function HUD() {
  const sim = useSimApi()
  const { t } = useI18n()
  const phase = useSim((s) => s.phase)
  const playing = useSim((s) => s.playing)
  const turbo = useSim((s) => s.turbo)
  const isTrip = useSim((s) => s.mode === 'trip')
  const soc = useSim((s) => Math.round(s.soc))
  const driveProgress = useSim((s) => Math.round(s.driveProgress * 100))
  const driveMin = useSim((s) => Math.round(s.driveMin))
  const totalDriveMin = useSim((s) => Math.round(s.totalDriveMin))

  const phaseLabel = isTrip
    ? (phase === 'done' ? t('phaseArrived') : t('phaseDrive'))
    : { drive: t('phaseDrive'), arrive: t('phaseArrive'), charge: t('phaseCharge'), poi: t('phasePoi'), done: t('phaseDone') }[phase]
  const pct = (!isTrip && (phase === 'charge' || phase === 'poi' || phase === 'done')) ? soc : driveProgress

  return (
    <div className="map-hud">
      <div className="map-hud-row">
        <span className="map-hud-phase">🚗 {phaseLabel}</span>
        <span className="map-hud-stat">{isTrip || phase === 'drive' ? `${driveMin}/${totalDriveMin} min` : `🔋 ${soc}%`}</span>
        <button className="map-hud-btn" onClick={() => playing ? sim.pause() : sim.play()}>{playing ? '⏸' : '▶'}</button>
        <div className="map-hud-turbo">
          {TURBO_SPEEDS.map((sp) => (
            <button key={sp} className={turbo === sp ? 'on' : ''} onClick={() => sim.setTurbo(sp)}>{sp}×</button>
          ))}
        </div>
        <button className="map-hud-btn" title="Cinematic" onClick={() => sim.setModal(true)}>🎬</button>
        <button className="map-hud-btn" onClick={() => sim.close()}>✕</button>
      </div>
      <div className="map-hud-bar"><span style={{ width: pct + '%' }} /></div>
    </div>
  )
}
