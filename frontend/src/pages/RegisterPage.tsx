import { useState, FormEvent } from 'react'
import { useNavigate, Link } from 'react-router-dom'
import { motion } from 'framer-motion'
import { useAuth } from '../contexts/AuthContext'

export default function RegisterPage() {
  const { register } = useAuth()
  const navigate = useNavigate()
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [loading, setLoading] = useState(false)

  async function handleSubmit(e: FormEvent) {
    e.preventDefault()
    setError(null)
    if (password.length < 8) {
      setError('Password must be at least 8 characters.')
      return
    }
    setLoading(true)
    try {
      await register(email, password)
      navigate('/chat')
    } catch (err: unknown) {
      const msg = (err as { response?: { data?: { message?: string } } })?.response?.data?.message
      setError(msg ?? 'Registration failed. Email may already be in use.')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="min-h-screen flex items-center justify-center px-4" style={{ background: 'var(--bg)' }}>
      <div className="orb-blue" />
      <div className="orb-purple" />

      <motion.div
        className="w-full max-w-sm relative z-10"
        initial={{ opacity: 0, y: 24 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.4, ease: [0.2, 0, 0, 1] }}
      >
        <div className="text-center mb-8">
          <h1 className="text-3xl tracking-[0.15em] uppercase font-light" style={{ color: 'var(--on-surface)' }}>
            Learn<span className="rgb-text-gradient font-normal">One</span>
          </h1>
          <p className="mt-2 text-sm" style={{ color: 'var(--on-muted)' }}>Create your account</p>
        </div>

        <div className="glass-card-static p-8">
          <form onSubmit={handleSubmit} className="flex flex-col gap-4">
            <div className="flex flex-col gap-1.5">
              <label className="text-xs tracking-widest uppercase" style={{ color: 'var(--outline)' }}>Email</label>
              <input
                className="input-base"
                type="email"
                placeholder="you@example.com"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                required
                autoComplete="email"
              />
            </div>
            <div className="flex flex-col gap-1.5">
              <label className="text-xs tracking-widest uppercase" style={{ color: 'var(--outline)' }}>Password</label>
              <input
                className="input-base"
                type="password"
                placeholder="min 8 characters"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                required
                autoComplete="new-password"
              />
            </div>

            {error && (
              <p className="text-xs" style={{ color: 'var(--error)' }}>{error}</p>
            )}

            <button className="btn-primary w-full mt-2" type="submit" disabled={loading}>
              {loading ? (
                <span className="flex items-center gap-2">
                  <span className="typing-dot" /><span className="typing-dot" /><span className="typing-dot" />
                </span>
              ) : 'Create Account'}
            </button>
          </form>

          <p className="mt-6 text-center text-xs" style={{ color: 'var(--outline)' }}>
            Already have an account?{' '}
            <Link to="/login" className="transition-colors hover:text-[#c6c6c8]" style={{ color: 'var(--on-muted)' }}>
              Sign in
            </Link>
          </p>
        </div>
      </motion.div>
    </div>
  )
}
