// Representative APAC EV models. `conn` matches OCM connector_types substrings.
// batteryKwh + acceptKw added for the charging simulation (energy/power → minutes).
export const VEHICLES = [
  { id:'ioniq5', name:'Hyundai IONIQ 5', conn:'ccs',     connLabel:'CCS',        range:430, batteryKwh:77.4, acceptKw:233, img:'/static/vehicles/ioniq5.png' },
  { id:'ev6',    name:'Kia EV6',         conn:'ccs',     connLabel:'CCS',        range:480, batteryKwh:77.4, acceptKw:233, img:'/static/vehicles/ev6.png' },
  { id:'model3', name:'Tesla Model 3',   conn:'tesla',   connLabel:'Tesla/NACS', range:510, batteryKwh:60,   acceptKw:170, img:'/static/vehicles/model3.png' },
  { id:'bz4x',   name:'Toyota bZ4X',     conn:'chademo', connLabel:'CHAdeMO',    range:450, batteryKwh:71.4, acceptKw:150, img:'/static/vehicles/bz4x.png' },
  { id:'leaf',   name:'Nissan Leaf',     conn:'chademo', connLabel:'CHAdeMO',    range:270, batteryKwh:40,   acceptKw:50,  img:'/static/vehicles/leaf.png' },
  { id:'atto3',  name:'BYD Atto 3',      conn:'ccs',     connLabel:'CCS',        range:400, batteryKwh:60,   acceptKw:88,  img:'/static/vehicles/atto3.png' },
  { id:'nexon',  name:'Tata Nexon EV',   conn:'ccs',     connLabel:'CCS',        range:310, batteryKwh:40,   acceptKw:50,  img:'/static/vehicles/nexon.png' },
]

// APAC major cities — ordered by importance (financial/tech-hub prominence).
export const CITIES = [
  { id:'seoul',    name:'Seoul 🇰🇷',        lat:37.4979, lon:127.0276, route:'osrm'   },
  { id:'tokyo',    name:'Tokyo 🇯🇵',        lat:35.6812, lon:139.7671, route:'google' },
  { id:'singapore',name:'Singapore 🇸🇬',    lat:1.3521,  lon:103.8198, route:'google' },
  { id:'hongkong', name:'Hong Kong 🇭🇰',    lat:22.3193, lon:114.1694, route:'google' },
  { id:'sydney',   name:'Sydney 🇦🇺',       lat:-33.8688,lon:151.2093, route:'google' },
  { id:'taipei',   name:'Taipei 🇹🇼',       lat:25.0330, lon:121.5654, route:'google' },
  { id:'mumbai',   name:'Mumbai 🇮🇳',       lat:19.0760, lon:72.8777,  route:'google' },
  { id:'delhi',    name:'Delhi 🇮🇳',        lat:28.6139, lon:77.2090,  route:'google' },
  { id:'jakarta',  name:'Jakarta 🇮🇩',      lat:-6.2088, lon:106.8456, route:'google' },
  { id:'bangkok',  name:'Bangkok 🇹🇭',      lat:13.7563, lon:100.5018, route:'google' },
  { id:'kl',       name:'Kuala Lumpur 🇲🇾', lat:3.1390,  lon:101.6869, route:'google' },
  { id:'manila',   name:'Manila 🇵🇭',       lat:14.5995, lon:120.9842, route:'google' },
  { id:'auckland', name:'Auckland 🇳🇿',     lat:-36.8485,lon:174.7633, route:'google' },
]

// Each APAC city demos a representative local EV model.
export const CITY_VEHICLE = {
  seoul:'ioniq5', tokyo:'bz4x', singapore:'atto3', hongkong:'model3',
  sydney:'model3', taipei:'model3', mumbai:'nexon', delhi:'nexon', jakarta:'ioniq5',
  bangkok:'atto3', kl:'atto3', manila:'leaf', auckland:'model3',
}

export const TURBO_SPEEDS = [1, 4, 16]
// At 1x, one real second advances BASE_SIM_RATE sim-seconds: a 20-min drive
// plays in ~30s at 1x, ~2s at 16x.
export const BASE_SIM_RATE = 40

export const POI_TYPES = [
  { id:'restaurant', label:'🍴 Restaurant', icon:'🍴' },
  { id:'cafe',       label:'☕ Cafe',       icon:'☕' },
  { id:'shopping_mall', label:'🛍️ Shopping', icon:'🛍️' },
  { id:'parking',    label:'🅿️ Parking',    icon:'🅿️' },
  { id:'tourist_attraction', label:'📷 Sights', icon:'📷' },
]
export const poiIcon = (type) => (POI_TYPES.find(p => p.id === type)?.icon) || '📍'

export const powerColor = (kw) => kw >= 150 ? '#1e8e3e' : kw >= 50 ? '#1a73e8' : '#9aa0a6'
export const socColor = (soc) => soc >= 60 ? '#1e8e3e' : soc >= 30 ? '#f9ab00' : '#d93025'

// Charge-time estimate (matches the simulation engine): energy / effective power.
export function estimateCharge(vehicle, socStart, station, target = 80) {
  const effKw = Math.min(station?.max_power_kw || 50, vehicle.acceptKw)
  const addedKwh = Math.max(0, (target - socStart) / 100 * vehicle.batteryKwh)
  const minutes = Math.round(addedKwh / effKw * 60)
  return { minutes, kw: Math.round(effKw), addedKwh: Math.round(addedKwh), target }
}
