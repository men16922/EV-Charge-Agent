import { useEffect, useState } from 'react'
import { useI18n } from '../i18nContext.jsx'
import { useChat } from '../chat.jsx'
import { getForecast } from '../api.js'

// Renders the agent's demand-forecast (predict_charging_demand) as a UI card with
// a sparkline + peak/low, instead of a raw markdown table in the chat.
export default function ForecastCard() {
  const { t } = useI18n()
  const { agentPlan } = useChat()
  const zone = agentPlan?.forecastZone
  const [fc, setFc] = useState(null)

  useEffect(() => {
    let alive = true
    if (!zone) { setFc(null); return }
    ;(async () => {
      let z = zone
      let d = await getForecast(z, 12).catch(() => null)
      // BQML model is trained on ZONE_GANGNAM; fall back if the asked zone is empty.
      if ((!d || !(d.series || []).length) && z !== 'ZONE_GANGNAM') {
        z = 'ZONE_GANGNAM'; d = await getForecast(z, 12).catch(() => null)
      }
      const s = (d && d.series) || []
      if (!alive || !s.length) { if (alive) setFc(null); return }
      const kws = s.map((p) => p.kw), lo = Math.min(...kws), hi = Math.max(...kws)
      const W = 300, H = 48, pad = 4
      const x = (i) => pad + i * (W - 2 * pad) / (s.length - 1)
      const y = (v) => H - pad - (v - lo) / ((hi - lo) || 1) * (H - 2 * pad)
      const line = s.map((p, i) => `${i ? 'L' : 'M'}${x(i).toFixed(1)},${y(p.kw).toFixed(1)}`).join(' ')
      const area = line + ` L${x(s.length - 1)},${H} L${x(0)},${H} Z`
      setFc({ zone: z, area, line, lo, hi })
    })()
    return () => { alive = false }
  }, [zone])

  if (!fc) return null
  return (
    <div className="plan-card forecast-card">
      <div className="plan-h">{t('forecastCardTitle')} · {fc.zone.replace('ZONE_', '')}</div>
      <div className="plan-body">
        <svg className="spark" viewBox="0 0 300 48" preserveAspectRatio="none" style={{ height: 48 }}>
          <path d={fc.area} fill="#e6f4ea" />
          <path d={fc.line} fill="none" stroke="#1e8e3e" strokeWidth="2" />
        </svg>
        <div className="spark-meta">
          <span>{t('forecastNext')} · {t('forecastLowLabel')} {fc.lo.toFixed(0)} kW</span>
          <span>{t('forecastPeakLabel')} {fc.hi.toFixed(0)} kW</span>
        </div>
      </div>
    </div>
  )
}
