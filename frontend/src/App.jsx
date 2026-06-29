import { ChatProvider } from './chat.jsx'
import Header from './components/Header.jsx'
import KpiStrip from './components/KpiStrip.jsx'
import MapView from './map/MapView.jsx'
import SidePanel from './components/SidePanel.jsx'
import SimulationModal from './components/SimulationModal.jsx'
import SimStoreBridge from './components/SimStoreBridge.jsx'

export default function App() {
  return (
    <ChatProvider>
      <div className="app">
        <Header />
        <KpiStrip />
        <main>
          <MapView />
          <SidePanel />
        </main>
      </div>
      <SimulationModal />
      <SimStoreBridge />
    </ChatProvider>
  )
}
