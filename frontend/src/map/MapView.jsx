import { useEffect, useRef } from 'react'
import L from 'leaflet'
import { useStore } from '../store.jsx'
import { useI18n } from '../i18nContext.jsx'
import { useSimApi } from '../sim.jsx'
import { getStations, getCoverage } from '../api.js'
import { carIcon, chargerIcon, stationPopup, carPopup, poiMarkerIcon } from './icons.js'
import MapDriveHUD from '../components/MapDriveHUD.jsx'

export default function MapView() {
  const { state, dispatch, rangeKm } = useStore()
  const { t, lang } = useI18n()
  const sim = useSimApi()
  const r = useRef({}) // leaflet objects

  // create the map once
  useEffect(() => {
    const map = L.map('map', { zoomControl: true }).setView([37.5503, 126.9971], 12)
    L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', { maxZoom: 19, attribution: '© OpenStreetMap' }).addTo(map)
    const clusterLayer = L.markerClusterGroup({ chunkedLoading: true, maxClusterRadius: 50 })
    map.addLayer(clusterLayer)
    const recLayer = L.layerGroup().addTo(map)
    const equityLayer = L.layerGroup()
    const poiLayer = L.layerGroup().addTo(map)
    const legend = L.control({ position: 'bottomleft' })
    legend.onAdd = () => { const d = L.DomUtil.create('div', 'legend'); r.current.legendDiv = d; renderLegend(); return d }
    legend.addTo(map)
    r.current = { ...r.current, map, clusterLayer, recLayer, equityLayer, poiLayer, legend }

    getStations(8000).then((d) => {
      const markers = (d.stations || []).filter((s) => s.lat != null && s.lon != null)
        .map((s) => L.marker([s.lat, s.lon], { icon: chargerIcon(s.max_power_kw) }).bindPopup(stationPopup(s)))
      clusterLayer.addLayers(markers)
    }).catch(console.error)

    return () => map.remove()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  function renderLegend() {
    const d = r.current.legendDiv
    if (!d) return
    d.innerHTML = `<b>${t('legendTitle')}</b><br><i style="background:#1e8e3e"></i>${t('legUltra')}` +
      `<br><i style="background:#1a73e8"></i>${t('legFast')}<br><i style="background:#9aa0a6"></i>${t('legStd')}`
  }
  useEffect(renderLegend, [lang]) // eslint-disable-line react-hooks/exhaustive-deps

  // car marker follows store.location
  useEffect(() => {
    const { map } = r.current
    if (!map) return
    if (!state.location) return
    const { lat, lon, label } = state.location
    const soc = state.soc
    if (r.current.carMarker) map.removeLayer(r.current.carMarker)
    r.current.carMarker = L.marker([lat, lon], { icon: carIcon(state.vehicle), zIndexOffset: 1000 })
      .addTo(map).bindPopup(carPopup(state.vehicle, soc, rangeKm(),
        (label || '').replace(/[\u{1F1E6}-\u{1F1FF}]/gu, '').trim()), { closeButton: false }).openPopup()
    map.setView([lat, lon], 13)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [state.location])

  // update car popup/icon when vehicle or soc changes
  useEffect(() => {
    const { map, carMarker } = r.current
    if (!map || !carMarker || !state.location) return
    carMarker.setIcon(carIcon(state.vehicle))
    carMarker.setPopupContent(carPopup(state.vehicle, state.soc, rangeKm(),
      (state.location.label || '').replace(/[\u{1F1E6}-\u{1F1FF}]/gu, '').trim()))
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [state.vehicle, state.soc])

  // recommendation markers follow store.nearby
  useEffect(() => {
    const { recLayer } = r.current
    if (!recLayer) return
    recLayer.clearLayers()
    state.nearby.forEach((s, i) => {
      L.marker([s.lat, s.lon], { icon: chargerIcon(s.max_power_kw, { rec: true, best: i === 0, label: String(i + 1) }), zIndexOffset: 500 })
        .bindPopup(stationPopup(s)).addTo(recLayer)
    })
  }, [state.nearby])

  // POI markers (restaurants/shopping/parking) follow store.pois
  useEffect(() => {
    const { poiLayer } = r.current
    if (!poiLayer) return
    poiLayer.clearLayers()
    state.pois.forEach((p) => {
      L.marker([p.lat, p.lon], { icon: poiMarkerIcon(p.type) })
        .bindPopup(`<b>${p.name}</b><br>🚶 ${p.walk_min} min${p.rating ? ` · ★ ${p.rating}` : ''}`)
        .addTo(poiLayer)
    })
  }, [state.pois])

  // route polyline follows store.route
  useEffect(() => {
    const { map } = r.current
    if (!map) return
    if (r.current.routeLayer) { map.removeLayer(r.current.routeLayer); r.current.routeLayer = null }
    if (r.current.routeBox) { map.removeControl(r.current.routeBox); r.current.routeBox = null }
    const route = state.route
    if (!route || !route.coords || !route.coords.length) return
    r.current.routeLayer = L.polyline(route.coords, { color: '#1a73e8', weight: 5, opacity: .8 }).addTo(map)
    map.fitBounds(r.current.routeLayer.getBounds(), { padding: [60, 60] })
    const km = ((route.distance_m || 0) / 1000).toFixed(1), min = Math.round((route.duration_s || 0) / 60)
    const prov = route.provider === 'google'
      ? '<span class="prov google">via Google Maps</span>'
      : '<span class="prov osrm">via OpenStreetMap</span>'
    const box = L.control({ position: 'topright' })
    box.onAdd = () => { const d = L.DomUtil.create('div', 'routebox'); d.innerHTML = `🧭 <b>${km} km · ${min} min</b>${prov}`; return d }
    box.addTo(map)
    r.current.routeBox = box
  }, [state.route])

  // equity overlay follows store.equityOn
  useEffect(() => {
    const { map, equityLayer } = r.current
    if (!map || !equityLayer) return
    if (!state.equityOn) { map.removeLayer(equityLayer); equityLayer.clearLayers(); return }
    const b = map.getBounds()
    getCoverage({ south: b.getSouth(), west: b.getWest(), north: b.getNorth(), east: b.getEast() })
      .then((d) => {
        equityLayer.clearLayers()
        const step = d.cell_deg || 0.02
        ;(d.cells || []).forEach((c) => {
          if (c.nearest_m == null) return
          const m = c.nearest_m
          const col = m > 5000 ? '#d93025' : m > 2000 ? '#f9ab00' : m > 1000 ? '#fbbc04' : '#1e8e3e'
          L.rectangle([[c.lat - step / 2, c.lon - step / 2], [c.lat + step / 2, c.lon + step / 2]],
            { color: col, weight: 0, fillColor: col, fillOpacity: m > 2000 ? .34 : .16 })
            .bindPopup(`Nearest charger: <b>${(m / 1000).toFixed(1)} km</b>${m > 2000 ? ' · ⚠️ charging desert' : ''}`)
            .addTo(equityLayer)
        })
        equityLayer.addTo(map)
        dispatch({ type: 'SET_EQUITY', on: true, desert: { deserts: d.deserts || 0, desert_pct: d.desert_pct || 0 } })
      }).catch(console.error)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [state.equityOn])

  // animate the main-map car during simulation (per-frame, no React re-render)
  useEffect(() => {
    return sim.subscribeRaw((st) => {
      const { map, carMarker } = r.current
      if (!carMarker) return
      if (st.phase === 'drive' && st.carPos) {
        carMarker.setLatLng(st.carPos)
        // inline (non-modal) drive: keep the moving car centered on the main map
        if (!st.modal && map) map.panTo(st.carPos, { animate: true, duration: 0.25 })
      }
    })
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  return (
    <div className="map-wrap">
      <div id="map" />
      <MapDriveHUD />
    </div>
  )
}
