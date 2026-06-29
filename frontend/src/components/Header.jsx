import { useI18n } from '../i18nContext.jsx'

export default function Header() {
  const { t, lang, toggle } = useI18n()
  return (
    <header>
      <div className="logo">
        <img src="/static/ev-agent.png" alt="EV" onError={(e) => { e.target.parentNode.textContent = '⚡' }} />
      </div>
      <div>
        <h1>{t('appName')}</h1>
        <div className="sub">{t('tagline')}</div>
      </div>
      <div style={{ marginLeft: 'auto', display: 'flex', alignItems: 'center', gap: 10 }}>
        <button className="langbtn" onClick={toggle}>{lang === 'en' ? '한국어' : 'EN'}</button>
        <span className="tag">Gemini · BigQuery ML · ADK · Google Maps</span>
      </div>
    </header>
  )
}
