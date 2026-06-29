import { useEffect } from 'react'
import { useStore } from '../store.jsx'
import { useSim } from '../sim.jsx'

// Mirrors the charging simulation's SoC back into the app store so the "My EV"
// battery panel (and car popup) stay in sync as the battery fills.
export default function SimStoreBridge() {
  const { dispatch } = useStore()
  const soc = useSim((s) => (s.open && s.mode === 'charge') ? Math.round(s.soc) : null)
  useEffect(() => {
    if (soc != null) dispatch({ type: 'SET_SOC', soc })
  }, [soc, dispatch])
  return null
}
