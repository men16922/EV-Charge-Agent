import React from 'react'
import ReactDOM from 'react-dom/client'
import './leafletGlobal.js'    // sets window.L (must precede the markercluster plugin)
import 'leaflet.markercluster' // JS plugin: attaches L.markerClusterGroup
import 'leaflet/dist/leaflet.css'
import 'leaflet.markercluster/dist/MarkerCluster.css'
import 'leaflet.markercluster/dist/MarkerCluster.Default.css'
import './styles.css'
import App from './App.jsx'
import { I18nProvider } from './i18nContext.jsx'
import { AppStoreProvider } from './store.jsx'
import { SimProvider } from './sim.jsx'

ReactDOM.createRoot(document.getElementById('root')).render(
  <React.StrictMode>
    <I18nProvider>
      <AppStoreProvider>
        <SimProvider>
          <App />
        </SimProvider>
      </AppStoreProvider>
    </I18nProvider>
  </React.StrictMode>,
)
