import { useParams } from 'react-router-dom'
import { certIds } from './content/registry'

const LAST_CERT_KEY = 'study-guide-last-cert'

export function useCertId(): string {
  const { certId } = useParams<{ certId: string }>()
  return certId ?? getDefaultCertId()
}

export function getDefaultCertId(): string {
  const stored = localStorage.getItem(LAST_CERT_KEY)
  if (stored && certIds.includes(stored)) return stored
  return certIds[0]
}

export function rememberCertId(certId: string) {
  localStorage.setItem(LAST_CERT_KEY, certId)
}

interface CertCosmetics {
  badge: string
  color: string
}

// Optional manual overrides for known certifications. Any certId without an
// entry here falls back to a deterministic badge/color below, so a brand new
// content/<certId>/ folder is usable immediately.
const COSMETICS: Record<string, CertCosmetics> = {
  az500: { badge: 'AZ', color: '#0ea5e9' },
  sc500: { badge: 'SC', color: '#dc2626' },
}

const FALLBACK_COLORS = ['#0ea5e9', '#8b5cf6', '#f97316', '#10b981', '#ef4444', '#eab308']

function hashString(s: string): number {
  let h = 0
  for (let i = 0; i < s.length; i++) h = (h * 31 + s.charCodeAt(i)) >>> 0
  return h
}

export function getCertCosmetics(certId: string): CertCosmetics {
  const known = COSMETICS[certId]
  if (known) return known
  return {
    badge: certId.slice(0, 2).toUpperCase(),
    color: FALLBACK_COLORS[hashString(certId) % FALLBACK_COLORS.length],
  }
}
