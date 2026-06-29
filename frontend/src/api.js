// Root-relative URLs so the same code works behind the Vite dev proxy and Flask in prod.
async function getJSON(url) {
  const r = await fetch(url)
  if (!r.ok) throw new Error(`${url} → ${r.status}`)
  return r.json()
}

export const getStations = (limit = 8000) => getJSON(`/api/stations?limit=${limit}`)

export const getNearby = ({ lat, lon, radiusKm, minPowerKw, connector, limit = 14 }) =>
  getJSON(`/api/nearby?lat=${lat}&lon=${lon}&radius_km=${radiusKm}&min_power_kw=${minPowerKw}` +
    `&connector=${encodeURIComponent(connector)}&limit=${limit}`)

export const getRoute = ({ fromLat, fromLon, toLat, toLon }) =>
  getJSON(`/api/route?from_lat=${fromLat}&from_lon=${fromLon}&to_lat=${toLat}&to_lon=${toLon}`)

export const getForecast = (zone = 'ZONE_GANGNAM', horizon = 12) =>
  getJSON(`/api/forecast?zone=${zone}&horizon=${horizon}`)

export const getCommunityStats = () => getJSON('/api/community_stats')

export const getCoverage = (b) =>
  getJSON(`/api/coverage?south=${b.south}&west=${b.west}&north=${b.north}&east=${b.east}`)

export const getPois = ({ lat, lon, type = 'restaurant' }) =>
  getJSON(`/api/poi?lat=${lat}&lon=${lon}&type=${encodeURIComponent(type)}`)

// Streaming chat (NDJSON). Calls onStep / onToken as events arrive.
// Returns an abort fn. Guards are handled by the caller (useChatStream).
export async function streamChat(message, { onStep, onToken, onCall, onData, signal } = {}) {
  const resp = await fetch('/chat/stream', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ message }),
    signal,
  })
  const reader = resp.body.getReader()
  const dec = new TextDecoder()
  let buf = ''
  while (true) {
    const { value, done } = await reader.read()
    if (done) break
    buf += dec.decode(value, { stream: true })
    let nl
    while ((nl = buf.indexOf('\n')) >= 0) {
      const line = buf.slice(0, nl)
      buf = buf.slice(nl + 1)
      if (!line.trim()) continue
      let ev
      try { ev = JSON.parse(line) } catch { continue }
      if (ev.type === 'step') onStep && onStep(ev.label)
      else if (ev.type === 'token') onToken && onToken(ev.text)
      else if (ev.type === 'call') onCall && onCall(ev.tool, ev.args)
      else if (ev.type === 'data') onData && onData(ev.tool, ev.result)
    }
  }
}

// ---------- geometry helpers for the drive simulation ----------
const R = 6371000
const toRad = (d) => d * Math.PI / 180
export function haversine([lat1, lon1], [lat2, lon2]) {
  const dLat = toRad(lat2 - lat1), dLon = toRad(lon2 - lon1)
  const a = Math.sin(dLat / 2) ** 2 +
    Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) * Math.sin(dLon / 2) ** 2
  return 2 * R * Math.asin(Math.sqrt(a))
}

// Precompute cumulative distances so the car moves at constant ground speed
// regardless of uneven polyline point spacing.
export function buildPath(coords) {
  const cum = [0]
  for (let i = 1; i < coords.length; i++) cum.push(cum[i - 1] + haversine(coords[i - 1], coords[i]))
  return { coords, cum, total: cum[cum.length - 1] || 0 }
}

// progress 0..1 → interpolated [lat, lon] along the path.
export function pointAt(path, progress) {
  const { coords, cum, total } = path
  if (!coords.length) return null
  if (coords.length === 1 || total === 0) return coords[0]
  const target = Math.max(0, Math.min(1, progress)) * total
  let lo = 0, hi = cum.length - 1
  while (lo < hi) {
    const mid = (lo + hi) >> 1
    if (cum[mid] < target) lo = mid + 1; else hi = mid
  }
  const i = Math.max(1, lo)
  const segLen = cum[i] - cum[i - 1] || 1
  const f = (target - cum[i - 1]) / segLen
  const [aLat, aLon] = coords[i - 1], [bLat, bLon] = coords[i]
  return [aLat + (bLat - aLat) * f, aLon + (bLon - aLon) * f]
}
