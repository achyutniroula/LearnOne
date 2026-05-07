import { useEffect, useRef, useState } from 'react'
import mermaid from 'mermaid'

mermaid.initialize({ startOnLoad: false, theme: 'dark', securityLevel: 'loose' })

let idCounter = 0

export default function MermaidBlock({ code }: { code: string }) {
  const ref = useRef<HTMLDivElement>(null)
  const [error, setError] = useState(false)

  useEffect(() => {
    if (!ref.current || !code) return
    const id = `mermaid-${++idCounter}`
    setError(false)
    mermaid.render(id, code)
      .then(({ svg }) => { if (ref.current) ref.current.innerHTML = svg })
      .catch(() => setError(true))
  }, [code])

  if (error) return null

  return (
    <div
      ref={ref}
      className="my-4 rounded-lg overflow-x-auto p-4"
      style={{ background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.07)' }}
    />
  )
}
