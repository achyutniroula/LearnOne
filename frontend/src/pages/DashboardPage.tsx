import { useEffect } from 'react'
import { useAuth } from '../contexts/AuthContext'
import { useNavigate } from 'react-router-dom'

export default function DashboardPage() {
  const { user, logout } = useAuth()
  const navigate = useNavigate()

  useEffect(() => { navigate('/chat', { replace: true }) }, [])

  function handleLogout() {
    logout()
    navigate('/login')
  }

  return (
    <div style={styles.container}>
      <header style={styles.header}>
        <span style={styles.logo}>LearnOne</span>
        <div style={styles.userInfo}>
          <span style={styles.email}>{user?.email}</span>
          <button style={styles.logoutBtn} onClick={handleLogout}>Logout</button>
        </div>
      </header>
      <main style={styles.main}>
        <h2 style={styles.heading}>Welcome back.</h2>
        <p style={styles.body}>Phase 1 — AI Teaching Loop — coming soon.</p>
      </main>
    </div>
  )
}

const styles: Record<string, React.CSSProperties> = {
  container: { minHeight: '100vh', background: '#0f0f0f', color: '#fff' },
  header: { display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '1rem 2rem', borderBottom: '1px solid #2a2a2a' },
  logo: { fontSize: '1.2rem', fontWeight: 700, color: '#6366f1' },
  userInfo: { display: 'flex', alignItems: 'center', gap: '1rem' },
  email: { color: '#888', fontSize: '0.9rem' },
  logoutBtn: { padding: '0.4rem 0.9rem', borderRadius: 6, border: '1px solid #333', background: 'transparent', color: '#fff', cursor: 'pointer' },
  main: { padding: '4rem 2rem' },
  heading: { fontSize: '2rem', margin: 0 },
  body: { color: '#888', marginTop: '0.5rem' },
}
