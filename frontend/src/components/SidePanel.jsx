import { useStore } from '../store.jsx'
import { useI18n } from '../i18nContext.jsx'
import MyEvPanel from './MyEvPanel.jsx'
import FindChargingPanel from './FindChargingPanel.jsx'
import DemandPanel from './DemandPanel.jsx'
import TripPanel from './TripPanel.jsx'
import Chat from './Chat.jsx'

export default function SidePanel() {
  const { state, dispatch } = useStore()
  const { t } = useI18n()
  const tab = state.activeTab

  return (
    <aside className="side">
      <div className="side-tabs">
        <button className={tab === 'car' ? 'on' : ''} onClick={() => dispatch({ type: 'SET_TAB', tab: 'car' })}>{t('tabCar')}</button>
        <button className={tab === 'chat' ? 'on' : ''} onClick={() => dispatch({ type: 'SET_TAB', tab: 'chat' })}>{t('tabChat')}</button>
      </div>
      {/* Both mounted (keep map/chat state); inactive one hidden so each tab gets full height. */}
      <div className="side-controls" style={{ display: tab === 'car' ? 'block' : 'none' }}>
        <MyEvPanel />
        <FindChargingPanel />
        <TripPanel />
        <DemandPanel />
      </div>
      <div className="chat-tab" style={{ display: tab === 'chat' ? 'flex' : 'none' }}>
        <Chat />
      </div>
    </aside>
  )
}
