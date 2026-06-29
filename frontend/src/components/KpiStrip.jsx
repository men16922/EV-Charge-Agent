import { useEffect, useState } from 'react'
import { useI18n } from '../i18nContext.jsx'
import { useStore } from '../store.jsx'
import { getCommunityStats } from '../api.js'

export default function KpiStrip() {
  const { t } = useI18n()
  const { state } = useStore()
  const [d, setD] = useState(null)

  useEffect(() => { getCommunityStats().then(setD).catch(console.error) }, [])

  const desertText = state.desert
    ? `${state.desert.deserts} (${state.desert.desert_pct}%)`
    : '—'

  return (
    <div className="kpis">
      <div className="kpi"><div className="v">{d ? (d.total || 0).toLocaleString() : '—'}</div><div className="l">{t('kpiStations')}</div></div>
      <div className="kpi"><div className="v">{d ? (d.public_pct || 0) + '%' : '—'}</div><div className="l">{t('kpiPublic')}</div></div>
      <div className="kpi"><div className="v">{d ? `${(d.fast || 0).toLocaleString()} / ${(d.ultra || 0).toLocaleString()}` : '—'}</div><div className="l">{t('kpiFast')}</div></div>
      <div className="kpi eco"><div className="v">{d ? '~' + (d.co2_avoided_tonnes_yr || 0).toLocaleString() + ' t' : '—'}</div><div className="l">{t('kpiCo2')}</div><div className="hint">{d?.co2_assumption || ''}</div></div>
      <div className="kpi"><div className="v">{desertText}</div><div className="l">{t('kpiDesert')}</div><div className="hint">{t('kpiDesertHint')}</div></div>
    </div>
  )
}
