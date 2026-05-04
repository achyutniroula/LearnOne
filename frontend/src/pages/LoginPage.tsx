import { useState, FormEvent } from 'react'
import { useNavigate, Link } from 'react-router-dom'
import { useAuth } from '../contexts/AuthContext'

export default function LoginPage() {
  const { login } = useAuth()
  const navigate = useNavigate()
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [loading, setLoading] = useState(false)

  async function handleSubmit(e: FormEvent) {
    e.preventDefault()
    setError(null)
    setLoading(true)
    try {
      await login(email, password)
      navigate('/dashboard')
    } catch {
      setError('Invalid email or password.')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div style={styles.container}>
      <div style={styles.card}>
        <h1 style={styles.title}>LearnOne</h1>
        <p style={styles.subtitle}>Sign in to your account</p>
        <form onSubmit={handleSubmit} style={styles.form}>
          <input
            style={styles.input}
            type="email"
            placeholder="Email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            required
            autoComplete="email"
          />
          <input
            style={styles.input}
            type="password"
            placeholder="Password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            required
            autoComplete="current-password"
          />
          {error && <p style={styles.error}>{error}</p>}
          <button style={styles.button} type="submit" disabled={loading}>
            {loading ? 'Signing in…' : 'Sign In'}
          </button>
        </form>
        <p style={styles.footer}>
          No account? <Link to="/register">Register</Link>
        </p>
      </div>
    </div>
  )
}

const styles: Record<string, React.CSSProperties> = {
  container: { display: 'flex', alignItems: 'center', justifyContent: 'center', minHeight: '100vh', background: '#0f0f0f' },
  card: { background: '#1a1a1a', border: '1px solid #2a2a2a', borderRadius: 12, padding: '2rem', width: '100%', maxWidth: 380 },
  title: { color: '#fff', margin: 0, fontSize: '1.8rem', fontWeight: 700 },
  subtitle: { color: '#888', marginTop: 4, marginBottom: '1.5rem' },
  form: { display: 'flex', flexDirection: 'column', gap: '0.75rem' },
  input: { padding: '0.75rem 1rem', borderRadius: 8, border: '1px solid #333', background: '#111', color: '#fff', fontSize: '0.95rem' },
  button: { padding: '0.75rem', borderRadius: 8, border: 'none', background: '#6366f1', color: '#fff', fontWeight: 600, cursor: 'pointer', fontSize: '1rem' },
  error: { color: '#ef4444', margin: 0, fontSize: '0.85rem' },
  footer: { marginTop: '1rem', textAlign: 'center', color: '#888' },
}
