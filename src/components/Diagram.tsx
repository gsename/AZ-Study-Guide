import type { ReactNode } from 'react'

type Tone = 'blue' | 'green' | 'amber' | 'red' | 'dark' | 'plain'

function DBox({ term, sub, tone = 'plain' }: { term: string; sub?: string; tone?: Tone }) {
  return (
    <div className={`dbox ${tone === 'plain' ? '' : tone}`}>
      <span className="dbox-term">{term}</span>
      {sub && <span className="dbox-sub">{sub}</span>}
    </div>
  )
}

function Conn({ symbol = '→' }: { symbol?: string }) {
  return <div className="dconn">{symbol}</div>
}

function Frame({ title, caption, children }: { title: string; caption?: string; children: ReactNode }) {
  return (
    <div className="diagram">
      <div className="diagram-title">{title}</div>
      {children}
      {caption && <div className="dcaption">{caption}</div>}
    </div>
  )
}

function Column({ label, children }: { label: string; children: ReactNode }) {
  return (
    <div className="diagram-col">
      <div className="dstack-label">{label}</div>
      {children}
    </div>
  )
}

const DIAGRAMS: Record<string, () => ReactNode> = {
  rbac: () => (
    <Frame
      title="Une attribution de rôle Azure RBAC"
      caption="Attribuée haut dans la hiérarchie → héritée par tout ce qui est en dessous."
    >
      <div className="diagram-row">
        <DBox term="Security principal" sub="qui (user / groupe / SP / MI)" tone="blue" />
        <Conn symbol="+" />
        <DBox term="Role definition" sub="quoi (permissions)" tone="green" />
        <Conn symbol="+" />
        <DBox term="Scope" sub="où (MG / sub / RG / ressource)" tone="amber" />
      </div>
    </Frame>
  ),

  pim: () => (
    <Frame
      title="PIM : d'éligible à actif, just-in-time"
      caption="PIM garde les admins éligibles plutôt que privilégiés en permanence — l'activation est contrôlée et limitée dans le temps."
    >
      <div className="diagram-row">
        <DBox term="Éligible" sub="assigné, pas encore actif" tone="dark" />
        <Conn />
        <DBox term="Activer" sub="MFA · approbation · justification" tone="amber" />
        <Conn />
        <DBox term="Actif (limité)" sub="expire automatiquement" tone="green" />
      </div>
    </Frame>
  ),

  'app-identity': () => (
    <Frame
      title="App registration vs Enterprise application"
      caption="Une app registration (blueprint global) crée un service principal (identité locale) dans chaque tenant qui l'utilise."
    >
      <div className="diagram-row">
        <DBox term="App registration" sub="blueprint global · redirect URIs, secrets, permissions" tone="blue" />
        <Conn symbol="⇒" />
        <DBox term="Service principal" sub="identité locale de l'app dans le tenant" tone="green" />
      </div>
      <div className="diagram-row" style={{ marginTop: '0.6rem' }}>
        <DBox term="Enterprise application" sub="où l'on gouverne ce SP : users/groupes, SSO, consentement" tone="dark" />
      </div>
    </Frame>
  ),

  'managed-identity': () => (
    <Frame
      title="Identités managées : deux types"
      caption="Aucun secret à gérer dans les deux cas — Azure gère les credentials."
    >
      <div className="diagram-row">
        <Column label="System-assigned">
          <DBox term="Liée à 1 ressource" sub="créée et supprimée avec elle · idéal 1:1" tone="blue" />
        </Column>
        <Column label="User-assigned">
          <DBox term="Ressource autonome" sub="partageable entre plusieurs ressources · survit indépendamment" tone="green" />
        </Column>
      </div>
    </Frame>
  ),

  'nsg-layers': () => (
    <Frame
      title="Le trafic doit être autorisé par les DEUX NSG"
      caption="Un refus au niveau subnet OU au niveau NIC bloque le trafic. Règles évaluées par priorité (numéro le plus bas d'abord)."
    >
      <div className="diagram-row">
        <DBox term="Trafic entrant" tone="dark" />
        <Conn />
        <DBox term="NSG du subnet" sub="doit autoriser" tone="blue" />
        <Conn />
        <DBox term="NSG de la NIC" sub="doit autoriser" tone="blue" />
        <Conn />
        <DBox term="VM" tone="green" />
      </div>
    </Frame>
  ),

  'forced-tunnel': () => (
    <Frame
      title="Forced tunnel via UDR"
      caption="Une route 0.0.0.0/0 avec next hop = IP privée du pare-feu force tout l'egress à être inspecté."
    >
      <div className="diagram-row">
        <DBox term="Subnet workload" tone="dark" />
        <Conn />
        <DBox term="UDR 0.0.0.0/0" sub="next hop = virtual appliance" tone="amber" />
        <Conn />
        <DBox term="Azure Firewall" sub="inspection" tone="blue" />
        <Conn />
        <DBox term="Internet" tone="dark" />
      </div>
    </Frame>
  ),

  endpoints: () => (
    <Frame
      title="Service endpoint vs Private endpoint"
      caption="Le private endpoint est plus sûr et fonctionne cross-network / on-prem ; le service endpoint est plus simple mais garde une IP publique."
    >
      <div className="diagram-row">
        <Column label="Service endpoint">
          <DBox term="IP publique conservée" sub="restreinte à ton subnet, via le backbone Azure" tone="amber" />
        </Column>
        <Column label="Private endpoint (Private Link)">
          <DBox term="IP privée dans ton VNet" sub="aucune exposition publique · cross-network" tone="green" />
        </Column>
      </div>
    </Frame>
  ),

  'appgw-vs-frontdoor': () => (
    <Frame
      title="Application Gateway vs Front Door"
      caption="Le scope décide : régional → App Gateway ; global/edge/CDN → Front Door. Le WAF s'attache à l'un ou l'autre."
    >
      <div className="diagram-row">
        <Column label="Application Gateway">
          <DBox term="Régional · L7" sub="load balancer HTTP/S dans une région" tone="blue" />
        </Column>
        <Column label="Front Door">
          <DBox term="Global · L7" sub="edge + CDN + accélération + failover" tone="green" />
        </Column>
      </div>
      <div className="diagram-row" style={{ marginTop: '0.6rem' }}>
        <DBox term="WAF" sub="s'attache à Application Gateway OU Front Door · bloque OWASP" tone="amber" />
      </div>
    </Frame>
  ),

  'firewall-vs-waf': () => (
    <Frame
      title="Azure Firewall vs WAF"
      caption="Deux périmètres différents : Firewall = trafic réseau général ; WAF = attaques applicatives web."
    >
      <div className="diagram-row">
        <Column label="Azure Firewall">
          <DBox term="Réseau (L3–L7)" sub="trafic VNet général · règles réseau/appli · threat intel" tone="blue" />
        </Column>
        <Column label="Web Application Firewall">
          <DBox term="Web (L7)" sub="SQLi, XSS · OWASP · sur App Gateway / Front Door" tone="amber" />
        </Column>
      </div>
    </Frame>
  ),

  'bastion-jit': () => (
    <Frame
      title="Bastion + JIT : zéro port de gestion ouvert en permanence"
      caption="À combiner : Bastion supprime l'IP publique / RDP-SSH exposés ; JIT garde les ports fermés jusqu'à une demande limitée dans le temps."
    >
      <div className="diagram-row">
        <DBox term="Azure Bastion" sub="RDP/SSH via le portail, sur TLS · pas d'IP publique sur la VM" tone="blue" />
        <Conn symbol="+" />
        <DBox term="Just-in-time (JIT)" sub="ports fermés, ouverts à la demande, source + durée limitées" tone="green" />
      </div>
    </Frame>
  ),

  'disk-encryption': () => (
    <Frame
      title="Chiffrement de disque (par-dessus le chiffrement plateforme par défaut)"
      caption="Choisir selon le besoin, pas 'plus = mieux'."
    >
      <div className="diagram-row">
        <DBox term="Azure Disk Encryption" sub="in-guest : BitLocker / DM-Crypt · clés dans Key Vault" tone="blue" />
        <DBox term="Encryption at host" sub="niveau hôte · couvre disques temp/cache · sans agent" tone="green" />
        <DBox term="Confidential disk" sub="clé liée au TEE matériel (VM confidentielles)" tone="amber" />
      </div>
    </Frame>
  ),

  'storage-auth': () => (
    <Frame
      title="Autorisation d'accès au stockage : du + sûr au − sûr"
      caption="Privilégier Entra ID + RBAC ; si un SAS est nécessaire, préférer un user-delegation SAS."
    >
      <div className="diagram-row">
        <DBox term="Entra ID + RBAC" sub="identité, aucune clé" tone="green" />
        <Conn symbol="›" />
        <DBox term="User-delegation SAS" sub="signé avec creds Entra" tone="blue" />
        <Conn symbol="›" />
        <DBox term="Account-key SAS" sub="signé avec la clé de compte" tone="amber" />
        <Conn symbol="›" />
        <DBox term="Shared account key" sub="comme un mot de passe root" tone="red" />
      </div>
    </Frame>
  ),

  'sql-protection': () => (
    <Frame
      title="TDE vs Always Encrypted vs Dynamic Data Masking"
      caption="La distinction la plus testée du domaine SQL."
    >
      <div className="diagram-row">
        <DBox term="TDE" sub="chiffre au repos (fichiers/backups) · transparent · activé par défaut" tone="blue" />
        <DBox term="Always Encrypted" sub="colonnes de bout en bout · invisible même du DBA / moteur" tone="green" />
        <DBox term="Dynamic Data Masking" sub="masque dans les résultats · PAS du chiffrement" tone="amber" />
      </div>
    </Frame>
  ),

  'policy-effects': () => (
    <Frame
      title="Azure Policy : associer l'effet au besoin"
      caption="La Policy impose la configuration/les standards ; Azure RBAC impose qui peut agir. Complémentaires."
    >
      <div className="diagram-row">
        <DBox term="Audit" sub="signale seulement" tone="amber" />
        <DBox term="Deny" sub="bloque la création non conforme" tone="red" />
        <DBox term="DeployIfNotExists" sub="remédie (identité managée requise)" tone="green" />
        <DBox term="Modify" sub="ajuste des propriétés" tone="blue" />
      </div>
    </Frame>
  ),

  'cspm-vs-cwp': () => (
    <Frame
      title="Defender for Cloud : deux rôles en un produit"
      caption="CSPM (gratuit) : « sommes-nous bien configurés ? » — CWP (payant) : « sommes-nous attaqués maintenant ? »"
    >
      <div className="diagram-row">
        <Column label="Posture (CSPM) — gratuit">
          <DBox term="Secure Score · recommandations" sub="inventaire · standards de conformité · MCSB" tone="blue" />
        </Column>
        <Column label="Protection (CWP) — payant">
          <DBox term="Plans Defender" sub="Servers / Storage / Databases / Containers · alertes" tone="green" />
        </Column>
      </div>
    </Frame>
  ),

  'sentinel-flow': () => (
    <Frame
      title="Microsoft Sentinel : connect → detect → respond"
      caption="SIEM = connect + detect (analytics rules → incidents) ; SOAR = automatiser la réponse (playbooks)."
    >
      <div className="diagram-row">
        <DBox term="Data connectors" sub="ingèrent logs/alertes" tone="blue" />
        <Conn />
        <DBox term="Analytics rules" sub="détectent → incidents" tone="green" />
        <Conn />
        <DBox term="Automation" sub="rules + playbooks" tone="amber" />
        <Conn />
        <DBox term="Réponse" sub="contenir / notifier" tone="dark" />
      </div>
    </Frame>
  ),

  'ca-decision': () => (
    <Frame
      title="Conditional Access : le moteur « si signaux, alors contrôle »"
      caption="Évalué après le premier facteur (mot de passe) — ce n'est pas une défense anti-DoS de première ligne."
    >
      <div className="diagram-row">
        <DBox term="Assignments (le « si »)" sub="users/groupes/rôles, ressources cibles, conditions de risque" tone="blue" />
        <Conn />
        <DBox term="Access controls (le « alors »)" sub="bloquer, exiger MFA/appareil conforme, contrôles de session" tone="green" />
      </div>
    </Frame>
  ),

  'consent-types': () => (
    <Frame
      title="Permission déléguée vs permission d'application"
      caption="Application = toujours un consentement admin, tenant-wide — la plus sensible des deux."
    >
      <div className="diagram-row">
        <Column label="Déléguée">
          <DBox term="Agit comme l'utilisateur connecté" sub="consentement utilisateur ou admin" tone="blue" />
        </Column>
        <Column label="Application">
          <DBox term="Agit seule, sans utilisateur" sub="consentement admin obligatoire, tenant-wide" tone="red" />
        </Column>
      </div>
    </Frame>
  ),

  asg: () => (
    <Frame
      title="Application Security Group : segmenter par rôle, pas par IP"
      caption="La règle NSG référence les groupes ASG une seule fois ; l'appartenance change sans jamais retoucher la règle."
    >
      <div className="diagram-row">
        <Column label="ASG : web">
          <DBox term="web1 · web2 · web3" tone="blue" />
        </Column>
        <Conn />
        <DBox term="Règle NSG" sub="Allow web ▸ db : TCP 1433" tone="dark" />
        <Conn />
        <Column label="ASG : db">
          <DBox term="db1 · db2" tone="green" />
        </Column>
      </div>
    </Frame>
  ),

  'agent-identity': () => (
    <Frame
      title="Entra Agent ID : deux portées distinctes"
      caption="Une policy CA qui cible l'identité de l'agent ne couvre PAS automatiquement le compte utilisateur lié à l'agent."
    >
      <div className="diagram-row">
        <DBox term="Agent identity" sub="l'identité non-humaine qui exécute les tâches de l'agent" tone="blue" />
        <DBox term="Agent's user account" sub="compte type utilisateur lié, pour les scénarios « collègue numérique »" tone="green" />
      </div>
    </Frame>
  ),

  'ai-layered-defense': () => (
    <Frame
      title="Défense en profondeur d'une charge de travail IA"
      caption="Identité → passerelle → garde-fous → modèle, le tout surveillé par Defender for Cloud + Purview, corrélé dans Defender XDR."
    >
      <div className="diagram-row">
        <Column label="Identité">
          <DBox term="Entra Agent ID + CA" tone="blue" />
        </Column>
        <Conn />
        <Column label="Passerelle">
          <DBox term="APIM : auth Entra, quotas" tone="green" />
        </Column>
        <Conn />
        <Column label="Garde-fous">
          <DBox term="Foundry : Prompt Shields, filtres" tone="amber" />
        </Column>
        <Conn />
        <Column label="Modèle">
          <DBox term="Microsoft Foundry" tone="dark" />
        </Column>
        <Conn />
        <Column label="Détection">
          <DBox term="Defender for AI Services" tone="red" />
        </Column>
      </div>
    </Frame>
  ),

  'defender-servers-plans': () => (
    <Frame
      title="Defender for Servers : Plan 1 vs Plan 2"
      caption="Plan 2 inclut tout Plan 1, plus la détection de vulnérabilités et le scan sans agent."
    >
      <div className="diagram-row">
        <Column label="Plan 1">
          <DBox term="EDR intégré (MDE)" sub="uniquement" tone="blue" />
        </Column>
        <Column label="Plan 2">
          <DBox term="EDR + MDVM + scan sans agent + FIM + JIT" sub="tout Plan 1, en plus" tone="green" />
        </Column>
      </div>
    </Frame>
  ),

  'mdvm-vs-easm': () => (
    <Frame
      title="MDVM (vers l'intérieur) vs EASM (vers l'extérieur)"
      caption="Deux directions complémentaires : hygiène des correctifs internes vs découverte d'exposition externe."
    >
      <div className="diagram-row">
        <Column label="MDVM">
          <DBox term="CVE / correctifs manquants" sub="sur machines et images connues" tone="blue" />
        </Column>
        <Column label="EASM">
          <DBox term="Actifs internet-facing inconnus" sub="shadow IT découvert de l'extérieur" tone="amber" />
        </Column>
      </div>
    </Frame>
  ),
}

export function hasDiagram(key: string): boolean {
  return key in DIAGRAMS
}

export default function Diagram({ id }: { id: string }) {
  const Comp = DIAGRAMS[id]
  if (!Comp) return null
  return <>{Comp()}</>
}
