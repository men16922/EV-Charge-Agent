import { useState } from 'react'

export default function Panel({ title, defaultCollapsed = false, children }) {
  const [collapsed, setCollapsed] = useState(defaultCollapsed)
  return (
    <div className={'panel' + (collapsed ? ' collapsed' : '')}>
      <h2 onClick={() => setCollapsed((c) => !c)}>
        <span>{title}</span><span className="chev">▾</span>
      </h2>
      <div className="panel-body">{children}</div>
    </div>
  )
}
