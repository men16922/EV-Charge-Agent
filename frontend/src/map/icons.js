import L from 'leaflet'
import { powerColor, poiIcon as poiGlyph } from '../config.js'

export function carIcon(vehicle) {
  return L.divIcon({
    className: 'car-marker',
    html: `<img src="${vehicle.img}" alt="🚗" onerror="this.replaceWith(document.createTextNode('🚗'))" ` +
      `style="width:52px;height:34px;object-fit:contain;filter:drop-shadow(0 2px 3px rgba(0,0,0,.45));"/>`,
    iconSize: [52, 34], iconAnchor: [26, 17],
  })
}

export function chargerIcon(kw, opts = {}) {
  if (opts.rec) {
    const color = opts.best ? '#1e8e3e' : '#1a73e8'
    const glyph = opts.label != null ? opts.label : '⚡'
    return L.divIcon({
      className: '', html: `<div class="chg-pin rec" style="background:${color}"><span>${glyph}</span></div>`,
      iconSize: [30, 30], iconAnchor: [15, 30],
    })
  }
  const color = powerColor(kw || 0)
  return L.divIcon({
    className: '', html: `<div class="chg-pin" style="background:${color}"><span>⚡</span></div>`,
    iconSize: [20, 20], iconAnchor: [10, 20],
  })
}

export function poiMarkerIcon(type) {
  return L.divIcon({
    className: '', html: `<div class="poi-pin">${poiGlyph(type)}</div>`,
    iconSize: [24, 24], iconAnchor: [12, 24],
  })
}

export function liveText(s) {
  if (!s.live) return ''
  const icon = s.live === 'offline' ? '⚫' : (s.live === 'available' ? '🟢' : '🟠')
  const txt = s.live === 'offline' ? 'offline' : `${s.available}/${s.total} plugs free`
  const src = s.source === 'google_places' ? 'live · Google' : 'simulated'
  return `${icon} ${txt} <span style="color:#9aa0a6">(${src})</span>`
}

export function stationPopup(s) {
  const cost = s.usage_cost ? `<br>💳 ${s.usage_cost}` : ''
  const dist = (s.distance_m != null) ? `<br>📍 ${(s.distance_m / 1000).toFixed(2)} km away` : ''
  const live = s.live ? `<br>${liveText(s)}` : ''
  return `<b>${s.title || 'EV Charging Station'}</b><br>${s.operator || 'Unknown'} · ${s.town || ''}` +
    `<br>⚡ ${s.max_power_kw || '?'} kW · ${s.connector_types || 'n/a'}${live}${cost}${dist}`
}

export function carPopup(vehicle, soc, rangeKm, label) {
  const col = soc >= 60 ? '#1e8e3e' : soc >= 30 ? '#f9ab00' : '#d93025'
  return `<div class="car-pop">
    <img class="car-pop-img" src="${vehicle.img}" alt="" onerror="this.style.display='none'"/>
    <div class="car-pop-body">
      <div class="car-pop-name">${vehicle.name}</div>
      <div class="car-pop-sub">${label ? label + ' · ' : ''}${vehicle.connLabel}</div>
      <div class="car-pop-batt"><span style="width:${soc}%;background:${col}"></span></div>
      <div class="car-pop-stat">${soc}% · ~${rangeKm} km</div>
    </div></div>`
}
