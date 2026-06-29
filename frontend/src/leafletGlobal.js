// leaflet.markercluster is a UMD plugin that expects a global `L`. In a Vite/ESM
// bundle there is no global, so it throws "L is not defined". Import THIS module
// before 'leaflet.markercluster' so the global is set first.
import L from 'leaflet'
window.L = L
export default L
