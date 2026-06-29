import { useEffect, useRef, useState } from 'react'
import { useI18n } from '../i18nContext.jsx'
import { useChat, formatMarkdown } from '../chat.jsx'
import { useSmartActions } from '../actions.jsx'
import Recommendations from './Recommendations.jsx'
import ChargePlanCard from './ChargePlanCard.jsx'
import ForecastCard from './ForecastCard.jsx'

export default function Chat() {
  const { t } = useI18n()
  const { entries, typing, sendUser } = useChat()
  const { smartCharge, lunchWhileCharging, planSmartTrip } = useSmartActions()
  const [input, setInput] = useState('')
  const scrollRef = useRef(null)

  useEffect(() => {
    const el = scrollRef.current
    if (el) el.scrollTop = el.scrollHeight
  }, [entries, typing])

  const submit = () => { const v = input.trim(); if (!v) return; setInput(''); sendUser(v) }
  const quick = (text) => sendUser(text)

  return (
    <div className="chat-wrap">
      <div className="chat-head">
        <img className="avatar" src="/static/ev-agent.png" alt="" onError={(e) => { e.target.style.display = 'none' }} />
        <span>{t('askAgent')}</span>
      </div>
      <div className="chat-cards">
        <ChargePlanCard />
        <ForecastCard />
      </div>
      <div className="chat-scroll" ref={scrollRef}>
        <Recommendations />
        <div className="chat-box">
          <div className="message-bubble message-agent" dangerouslySetInnerHTML={{ __html: t('intro') }} />
          {entries.map((e) => e.kind === 'steps'
            ? <Steps key={e.id} labels={e.labels} t={t} />
            : <Bubble key={e.id} sender={e.sender} text={e.text} />)}
        </div>
        {typing && <div className="typing">{t('thinking')}</div>}
      </div>
      <div className="quick">
        <span className="chip" onClick={smartCharge}>{t('chipSmart')}</span>
        <span className="chip" onClick={() => quick('Where are the charging deserts near me?')}>{t('chipDesert')}</span>
        <span className="chip" onClick={lunchWhileCharging}>{t('chipLunch')}</span>
        <span className="chip" onClick={planSmartTrip}>{t('chipTrip')}</span>
        <span className="chip" onClick={() => quick('How much CO2 does this charging network help avoid?')}>{t('chipCo2')}</span>
      </div>
      <div className="chat-input-area">
        <input className="chat-input" value={input} placeholder={t('placeholder')}
          onChange={(e) => setInput(e.target.value)}
          onKeyDown={(e) => { if (e.key === 'Enter') submit() }} />
        <button className="btn btn-primary" onClick={submit}>{t('send')}</button>
      </div>
    </div>
  )
}

function Bubble({ sender, text }) {
  if (sender === 'agent') return <div className="message-bubble message-agent" dangerouslySetInnerHTML={{ __html: formatMarkdown(text) }} />
  return <div className="message-bubble message-user">{text}</div>
}

function Steps({ labels, t }) {
  return (
    <div className="steps">
      <b>{t('stepsHeader')}</b>
      {labels.map((l, i) => <div key={i}>{l}</div>)}
    </div>
  )
}
