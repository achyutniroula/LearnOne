import { useState } from 'react'
import { Prism as SyntaxHighlighter } from 'react-syntax-highlighter'
import { vscDarkPlus } from 'react-syntax-highlighter/dist/esm/styles/prism'
import { Play, Copy, Check } from 'lucide-react'
import { codeApi, LANGUAGES, CodeResult } from '../api/code'

interface Props {
  code: string
  language?: string
}

const langIdMap: Record<string, number> = Object.fromEntries(
  LANGUAGES.map((l) => [l.ext, l.id])
)

export default function CodeBlock({ code, language = 'text' }: Props) {
  const [copied, setCopied] = useState(false)
  const [running, setRunning] = useState(false)
  const [result, setResult] = useState<CodeResult | null>(null)

  const langId = langIdMap[language]
  const canRun = !!langId

  function copy() {
    navigator.clipboard.writeText(code)
    setCopied(true)
    setTimeout(() => setCopied(false), 1500)
  }

  async function run() {
    if (!canRun || running) return
    setRunning(true)
    setResult(null)
    try {
      const r = await codeApi.execute(code, langId)
      setResult(r)
    } catch {
      setResult({ stdout: null, stderr: 'Execution failed.', status: 'Error', exitCode: -1 })
    } finally {
      setRunning(false)
    }
  }

  return (
    <div className="my-3 rounded-lg overflow-hidden" style={{ border: '1px solid rgba(255,255,255,0.07)' }}>
      <div className="flex items-center justify-between px-3 py-1.5"
        style={{ background: 'rgba(255,255,255,0.04)', borderBottom: '1px solid rgba(255,255,255,0.07)' }}>
        <span className="text-[10px] tracking-widest uppercase" style={{ color: 'var(--outline)' }}>{language}</span>
        <div className="flex gap-2">
          {canRun && (
            <button onClick={run} disabled={running} className="btn-ghost py-0.5 px-2 text-xs flex items-center gap-1">
              <Play className="w-3 h-3" />
              {running ? 'Running…' : 'Run'}
            </button>
          )}
          <button onClick={copy} className="btn-ghost py-0.5 px-2 text-xs flex items-center gap-1">
            {copied ? <Check className="w-3 h-3" /> : <Copy className="w-3 h-3" />}
          </button>
        </div>
      </div>
      <SyntaxHighlighter
        language={language}
        style={vscDarkPlus}
        customStyle={{ margin: 0, background: 'rgba(14,14,15,0.8)', fontSize: '0.82rem' }}
        wrapLongLines
      >
        {code}
      </SyntaxHighlighter>
      {result && (
        <div className="px-3 py-2 text-xs font-mono" style={{ background: 'rgba(0,0,0,0.4)', color: result.stderr ? '#ee7d77' : '#6ee7b7' }}>
          <span className="text-[10px] uppercase tracking-widest block mb-1" style={{ color: 'var(--outline)' }}>
            {result.status}
          </span>
          <pre className="whitespace-pre-wrap">{result.stdout || result.stderr || '(no output)'}</pre>
        </div>
      )}
    </div>
  )
}
