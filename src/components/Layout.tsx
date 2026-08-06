import { useEffect, useState } from 'react'
import { NavLink, Navigate, Outlet, useNavigate } from 'react-router-dom'
import { applyTheme, getStoredTheme, type Theme } from '../lib/theme'
import { certIds, getCertContent } from '../content/registry'
import { getCertCosmetics, rememberCertId, useCertId } from '../certifications'

export default function Layout() {
  const [theme, setTheme] = useState<Theme>(() => getStoredTheme())
  const certId = useCertId()
  const navigate = useNavigate()
  const content = getCertContent(certId)

  useEffect(() => {
    if (content) {
      rememberCertId(certId)
      document.title = `${content.examMeta.code} Study Guide`
    }
  }, [certId, content])

  function toggleTheme() {
    const next: Theme = theme === 'dark' ? 'light' : 'dark'
    setTheme(next)
    applyTheme(next)
  }

  function switchCert(newCertId: string) {
    navigate(`/${newCertId}`)
  }

  if (!content) {
    return <Navigate to={`/${certIds[0]}`} replace />
  }

  const cosmetics = getCertCosmetics(certId)

  return (
    <div className="app-shell">
      <nav className="top-nav">
        <span className="brand">
          <span className="brand-badge" style={{ backgroundColor: cosmetics.color }}>
            {cosmetics.badge}
          </span>
          Study Guide
        </span>
        <select
          className="cert-select"
          value={certId}
          onChange={(e) => switchCert(e.target.value)}
          aria-label="Choisir la certification"
        >
          {certIds.map((id) => {
            const c = getCertContent(id)
            return (
              <option key={id} value={id}>
                {c?.examMeta.code ?? id}
              </option>
            )
          })}
        </select>
        <NavLink to="" className="nav-link" end>
          Dashboard
        </NavLink>
        <NavLink to="domains" className="nav-link">
          Domaines
        </NavLink>
        <NavLink to="review" className="nav-link">
          À revoir
        </NavLink>
        <NavLink to="exam" className="nav-link">
          Examen blanc
        </NavLink>
        <NavLink to="labs" className="nav-link">
          Labs
        </NavLink>
        <button className="theme-toggle" onClick={toggleTheme} title="Changer de thème" aria-label="Changer de thème">
          {theme === 'dark' ? '☀️' : '🌙'}
        </button>
      </nav>
      <div className="page">
        <Outlet />
      </div>
    </div>
  )
}
