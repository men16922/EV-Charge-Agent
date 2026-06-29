import Panel from './Panel.jsx'
import { useI18n } from '../i18nContext.jsx'
import { useStore } from '../store.jsx'
import { VEHICLES, socColor } from '../config.js'

export default function MyEvPanel() {
  const { t } = useI18n()
  const { state, dispatch, rangeKm } = useStore()
  const { vehicle, soc } = state

  const onVehicle = (id) => {
    const v = VEHICLES.find((x) => x.id === id)
    if (v) dispatch({ type: 'SET_VEHICLE', vehicle: v })
  }

  return (
    <Panel title={<span>{t('myev')}</span>}>
      <div className="ev-card">
        <img className="veh-img-lg" src={vehicle.img} alt="" onError={(e) => { e.target.style.visibility = 'hidden' }} />
        <div className="ev-info">
          <select value={vehicle.id} onChange={(e) => onVehicle(e.target.value)}>
            {VEHICLES.map((v) => <option key={v.id} value={v.id}>{v.name}</option>)}
          </select>
          <div className="ev-stats">
            <span className="ev-conn">🔌 {vehicle.connLabel}</span>
            <span className="ev-range">🧭 <b>{rangeKm()} km</b></span>
          </div>
        </div>
      </div>
      <div className="batt">
        <div className="batt-top"><span>{t('battery')}</span><b>{soc}%</b></div>
        <div className="batt-track"><div className="batt-fill" style={{ width: soc + '%', background: socColor(soc) }} /></div>
        <input type="range" min="5" max="100" step="5" value={soc}
          onChange={(e) => dispatch({ type: 'SET_SOC', soc: +e.target.value })} />
      </div>
    </Panel>
  )
}
