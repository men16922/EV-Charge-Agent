import { createContext, useContext, useReducer, useMemo, useCallback } from 'react'
import { VEHICLES } from './config.js'

const initialState = {
  vehicle: VEHICLES[0],
  soc: 20,
  location: null,        // { lat, lon, label }
  filters: { radiusKm: 5, minPowerKw: 50 },
  nearby: [],            // recommendation list (lastNearby)
  selectedStation: null,
  route: null,           // { provider, distance_m, duration_s, coords }
  pois: [],              // points of interest drawn on the main map
  equityOn: false,
  desert: null,          // { deserts, desert_pct }
  trip: { stops: [], plan: null },
  activeTab: 'car',      // side-panel tab: 'car' (controls) | 'chat' (assistant)
}

function reducer(state, action) {
  switch (action.type) {
    case 'SET_VEHICLE': return { ...state, vehicle: action.vehicle }
    case 'SET_SOC': return { ...state, soc: action.soc }
    case 'SET_LOCATION': return { ...state, location: action.location }
    case 'SET_FILTERS': return { ...state, filters: { ...state.filters, ...action.filters } }
    case 'SET_NEARBY': return { ...state, nearby: action.nearby }
    case 'SELECT_STATION': return { ...state, selectedStation: action.station }
    case 'SET_ROUTE': return { ...state, route: action.route, selectedStation: action.station ?? state.selectedStation }
    case 'SET_POIS': return { ...state, pois: action.pois }
    case 'SET_EQUITY': return { ...state, equityOn: action.on, desert: action.desert ?? state.desert }
    case 'SET_TRIP_STOPS': return { ...state, trip: { ...state.trip, stops: action.stops } }
    case 'ADD_TRIP_STOP': return { ...state, trip: { ...state.trip, stops: [...state.trip.stops, action.stop] } }
    case 'REMOVE_TRIP_STOP': return { ...state, trip: { ...state.trip, stops: state.trip.stops.filter((_, i) => i !== action.index) } }
    case 'SET_TRIP_PLAN': return { ...state, trip: { ...state.trip, plan: action.plan } }
    case 'CLEAR_TRIP': return { ...state, trip: { stops: [], plan: null } }
    case 'SET_TAB': return { ...state, activeTab: action.tab }
    default: return state
  }
}

const AppStoreContext = createContext(null)

export function AppStoreProvider({ children }) {
  const [state, dispatch] = useReducer(reducer, initialState)

  // Selectors / derived helpers (not stored).
  const rangeKm = useCallback(() => Math.round(state.vehicle.range * state.soc / 100), [state.vehicle, state.soc])
  const reachability = useCallback((station) => {
    const driveKm = (station.distance_m / 1000) * 1.3 // straight-line × detour factor
    const r = rangeKm()
    if (driveKm <= r * 0.8) return { key: 'reachOk', cls: 'ok' }
    if (driveKm <= r) return { key: 'reachTight', cls: 'warn' }
    return { key: 'reachBad', cls: 'bad' }
  }, [rangeKm])

  const value = useMemo(() => ({ state, dispatch, rangeKm, reachability }),
    [state, rangeKm, reachability])
  return <AppStoreContext.Provider value={value}>{children}</AppStoreContext.Provider>
}

export function useStore() {
  const ctx = useContext(AppStoreContext)
  if (!ctx) throw new Error('useStore must be used within AppStoreProvider')
  return ctx
}
