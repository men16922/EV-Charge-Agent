import { useEffect, useState } from 'react'
import Panel from './Panel.jsx'
import { useI18n } from '../i18nContext.jsx'
import { getForecast } from '../api.js'

export default function DemandPanel() {
  const { t } = useI18n()
  const [fc, setFc] = useState(null) // { area, line, lo, hi }

  useEffect(() => {
    getForecast('ZONE_GANGNAM', 12).then((d) => {
      const s = d.series || []
      if (!s.length) return
      const kws = s.map((p) => p.kw), lo = Math.min(...kws), hi = Math.max(...kws)
      const W = 320, H = 56, pad = 4
      const x = (i) => pad + i * (W - 2 * pad) / (s.length - 1)
      const y = (v) => H - pad - (v - lo) / ((hi - lo) || 1) * (H - 2 * pad)
      const line = s.map((p, i) => `${i ? 'L' : 'M'}${x(i).toFixed(1)},${y(p.kw).toFixed(1)}`).join(' ')
      const area = line + ` L${x(s.length - 1)},${H} L${x(0)},${H} Z`
      setFc({ area, line, lo, hi })
    }).catch(console.error)
  }, [])

  return (
    <Panel title={<span>{t('demand')}</span>} defaultCollapsed>
      <svg className="spark" viewBox="0 0 320 56" preserveAspectRatio="none">
        {fc && <>
          <path d={fc.area} fill="#e6f4ea" />
          <path d={fc.line} fill="none" stroke="#1e8e3e" strokeWidth="2" />
        </>}
      </svg>
      <div className="spark-meta">
        <span>{fc ? `${t('sparkLo')} ${fc.lo.toFixed(0)} kW` : '—'}</span>
        <span>{fc ? `${t('sparkPeak')} ${fc.hi.toFixed(0)} kW` : '—'}</span>
      </div>
    </Panel>
  )
}
