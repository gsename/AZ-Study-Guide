/**
 * SC-500 blueprint traceability table.
 *
 * One entry per verbatim "Skills measured" bullet in the official study guide
 * (12 sub-skill areas, 87 bullets), each with the objective that owns it, its
 * label, and a discriminating pattern.
 *
 * The patterns exist to MEASURE coverage, not to define it. A match means an
 * item mentions the technology; it does not prove the item tests the skill. So:
 *
 *   - a bullet with zero matches is certainly uncovered — that is a fact
 *   - a bullet with many matches is *probably* covered — that is a ceiling
 *
 * Used by `coverage.mjs` (report) and `check-bank.mjs` (validate that every
 * authored `skillRef` resolves to a real bullet owned by the item's objective).
 *
 * Keep this file in step with `src/content/sc500/domains.json`: every ref code
 * here must appear in exactly one objective's `skillRefs`, and vice versa.
 * `check-bank.mjs` asserts that both ways round.
 */

/** Fact-sheet section (tools/facts-sc500.md §E) each objective's facts come from. */
export const SRC_BY_OBJECTIVE = {
  'o1-1': 'kb-entra',
  'o1-2': 'kb-appid',
  'o1-3': 'kb-kv',
  'o1-4': 'kb-gov',
  'o2-1': 'kb-storage',
  'o2-2': 'kb-sql',
  'o2-3': 'kb-network',
  'o3-1': 'kb-aisec',
  'o3-2': 'kb-vm',
  'o3-3': 'kb-appsvc',
  'o4-1': 'kb-dfc',
  'o4-2': 'kb-sentinel',
  'o4-3': 'kb-seccopilot',
}

/** refCode -> { objectiveId, label, pattern } */
export const BULLETS = {
  // ---- d1a Secure access to resources by using Microsoft Entra ID ----
  d1a1: { objectiveId: 'o1-1', label: 'Implement and configure Privileged Identity Management (PIM)', pattern: /\bPIM\b|Privileged Identity Manage/i },
  d1a2: { objectiveId: 'o1-1', label: 'Implement conditional access policies', pattern: /conditional access/i },
  d1a3: { objectiveId: 'o1-1', label: 'Implement and configure authentication methods, including MFA and passwordless', pattern: /passwordless|FIDO2|Authenticator app|authentication method|\bMFA\b|multifactor|Temporary Access Pass|authentication strength|Windows Hello|certificate.based authentication/i },
  d1a4: { objectiveId: 'o1-2', label: 'Implement and configure identity for applications, including enterprise applications and app registrations', pattern: /app registration|enterprise application|service principal|application object/i },
  d1a5: { objectiveId: 'o1-2', label: 'Manage OAuth permission grants and consent settings', pattern: /consent|OAuth|permission grant|\.default scope|illicit consent/i },
  d1a6: { objectiveId: 'o1-2', label: 'Implement and configure managed identities for Azure resources', pattern: /managed identit/i },

  // ---- d1b Secure secrets and keys by using Azure Key Vault ----
  d1b1: { objectiveId: 'o1-3', label: 'Deploy Key Vault', pattern: /(creat|deploy|provision|new).{0,40}key vault|key vault.{0,40}(creat|deploy|provision)/i },
  d1b2: { objectiveId: 'o1-3', label: 'Configure Key Vault settings', pattern: /soft.delete|purge protection|RBAC authorization|premium tier|managed HSM|retention (period|days)/i },
  d1b3: { objectiveId: 'o1-3', label: 'Configure access to Key Vault', pattern: /access polic|Key Vault (Secrets|Crypto|Certificates) (User|Officer)|RBAC/i },
  d1b4: { objectiveId: 'o1-3', label: 'Configure firewall settings on Key Vault', pattern: /firewall|trusted (Microsoft )?service|private endpoint|network (rule|restrict|ACL)/i },
  d1b5: { objectiveId: 'o1-3', label: 'Manage keys, secrets, and certificates', pattern: /rotat|certificate|key version|expir|auto.renew|BYOK|CMK|customer.managed key/i },
  d1b6: { objectiveId: 'o1-3', label: 'Scan for secrets by using Defender CSPM', pattern: /secret scanning|scan.{0,20}for secrets|plaintext secret|hardcoded (secret|credential)|exposed secret/i },
  d1b7: { objectiveId: 'o1-3', label: 'Implement Defender for Key Vault', pattern: /defender for key vault/i },

  // ---- d1c Implement governance to enforce security and regulatory compliance ----
  d1c1: { objectiveId: 'o1-4', label: 'Implement and configure security controls by using Azure Policy, including built-in and custom policy definitions', pattern: /azure policy|policy definition|policy initiative|policy assignment|DeployIfNotExists|AuditIfNotExists|\bModify\b effect|deny effect|remediation task/i },
  d1c2: { objectiveId: 'o1-4', label: 'Evaluate regulatory compliance by using Microsoft Defender for Cloud', pattern: /regulatory compliance|compliance dashboard|PCI.DSS|ISO 27001|NIST|SOC 2|CIS benchmark|HIPAA/i },
  d1c3: { objectiveId: 'o1-4', label: 'Implement and configure security controls in Defender for Cloud, including security standards and recommendations', pattern: /security standard|recommendation|cloud security benchmark|\bMCSB\b|secure score/i },
  d1c4: { objectiveId: 'o1-4', label: 'Implement resource locks', pattern: /resource lock|CanNotDelete|ReadOnly lock|delete lock/i },
  d1c5: { objectiveId: 'o1-4', label: 'Manage Azure built-in role assignments', pattern: /built.in role|role assignment|User Access Administrator/i },
  d1c6: { objectiveId: 'o1-4', label: 'Manage custom roles, including Azure roles and Microsoft Entra roles', pattern: /custom role|custom directory role|notActions|role definition/i },
  d1c7: { objectiveId: 'o1-4', label: 'Evaluate and remediate overprivileged access assignments by using Azure RBAC', pattern: /over.?privileged|excessive permission|unused (permission|role|assignment)|access review|least privilege|permission creep|right.siz|entitlement management/i },
  d1c8: { objectiveId: 'o1-4', label: 'Configure security controls for backup protection by using Azure Backup security features', pattern: /azure backup|recovery services vault|backup vault|immutable vault|multi.user authorization|\bMUA\b|resource guard/i },
  d1c9: { objectiveId: 'o1-4', label: 'Implement and configure security controls by using infrastructure as code', pattern: /infrastructure as code|\bIaC\b|bicep|ARM template|terraform|deployment template/i },

  // ---- d2a Implement security for storage accounts ----
  d2a1: { objectiveId: 'o2-1', label: 'Implement and configure security for storage accounts', pattern: /secure transfer|\bTLS\b|anonymous (blob |public )?access|allow blob public access|shared key|infrastructure encryption|cross.tenant replication/i },
  d2a2: { objectiveId: 'o2-1', label: 'Configure Azure Storage firewall rules', pattern: /firewall|network rule|service endpoint|selected network|resource instance rule|trusted (Microsoft )?service/i },
  d2a3: { objectiveId: 'o2-1', label: 'Implement Defender for Storage threat protection configurations', pattern: /defender for storage|malware scanning|sensitive data threat/i },
  d2a4: { objectiveId: 'o2-1', label: 'Manage access to storage, including access policies', pattern: /\bSAS\b|shared access signature|stored access policy|user delegation|access polic/i },

  // ---- d2b Implement security for databases ----
  d2b1: { objectiveId: 'o2-2', label: 'Implement platform-level security configurations in Azure SQL', pattern: /\bTDE\b|transparent data encryption|always encrypted|dynamic data masking|row.level security|entra.only|firewall rule|ledger|vulnerability assessment/i },
  d2b2: { objectiveId: 'o2-2', label: 'Configure database auditing for Azure SQL Database and Azure SQL Managed Instance', pattern: /audit/i },
  d2b3: { objectiveId: 'o2-2', label: 'Configure Defender for Databases protection across Azure database services', pattern: /defender for (azure )?sql|defender for databases|defender for open.source|defender for (mysql|postgresql|mariadb)|cosmos db/i },

  // ---- d2c Implement security for Azure network services ----
  d2c1: { objectiveId: 'o2-3', label: 'Implement and manage network security groups (NSGs) and application security groups (ASGs)', pattern: /network security group|\bNSG\b|application security group|\bASG\b/i },
  d2c2: { objectiveId: 'o2-3', label: 'Implement and configure network access policies by using Azure Virtual Network Manager', pattern: /virtual network manager|\bAVNM\b|security admin rule|network group/i },
  d2c3: { objectiveId: 'o2-3', label: 'Configure security for an Azure Virtual WAN', pattern: /virtual wan|\bvWAN\b|secured virtual hub|firewall manager|routing intent/i },
  d2c4: { objectiveId: 'o2-3', label: 'Implement and configure security for virtual private network (VPN) connections', pattern: /\bVPN\b|site.to.site|point.to.site|IKEv2|IPsec|virtual network gateway/i },
  d2c5: { objectiveId: 'o2-3', label: 'Implement and configure Microsoft Entra Private Access', pattern: /private access|global secure access|\bGSA\b/i },
  d2c6: { objectiveId: 'o2-3', label: 'Configure Azure private endpoints to secure access to Azure PaaS resources', pattern: /private endpoint|privatelink|private dns zone/i },
  d2c7: { objectiveId: 'o2-3', label: 'Configure Azure Private Link services to secure access to network resources', pattern: /private link service/i },
  d2c8: { objectiveId: 'o2-3', label: 'Implement and configure Azure Firewall', pattern: /azure firewall|\bIDPS\b|FQDN|firewall policy|application rule|network rule collection|\bDNAT\b|threat intelligence.{0,20}mode/i },
  d2c9: { objectiveId: 'o2-3', label: 'Evaluate effective security rules by using Azure Network Watcher diagnostics', pattern: /network watcher|effective security rule|NSG diagnostic|IP flow verify|connection troubleshoot|next hop|packet capture|flow log/i },

  // ---- d3a Implement security for AI ----
  d3a1: { objectiveId: 'o3-1', label: 'Identify overexposure of data in SharePoint', pattern: /sharepoint|onedrive|overshar|overexpos|over.expos|site permission|everyone except external/i },
  d3a2: { objectiveId: 'o3-1', label: 'Identify risks related to Microsoft Copilot and AI apps by using Microsoft Purview DSPM', pattern: /\bDSPM\b|data security posture management|data risk assessment/i },
  d3a3: { objectiveId: 'o3-1', label: 'Enable and configure real-time protection for Microsoft Copilot Studio agents', pattern: /copilot studio/i },
  d3a4: { objectiveId: 'o3-1', label: 'Implement conditional access for Microsoft Entra Agent ID', pattern: /agent id[\s\S]{0,200}conditional access|conditional access[\s\S]{0,200}agent id/i },
  d3a5: { objectiveId: 'o3-1', label: 'Analyze blast radius for security risks related to Entra Agent ID by using Defender XDR', pattern: /blast radius/i },
  d3a6: { objectiveId: 'o3-1', label: 'Manage Entra Agent ID access', pattern: /agent id|agent identit/i },
  d3a7: { objectiveId: 'o3-1', label: 'Configure and deploy AI Gateway in Azure API Management for Microsoft Foundry', pattern: /ai gateway|token.{0,20}(rate limit|limit polic)|semantic cach|token metric/i },
  d3a8: { objectiveId: 'o3-1', label: 'Enable Defender for AI Service in Cloud Workload Protection in Defender for Cloud', pattern: /defender for ai/i },
  d3a9: { objectiveId: 'o3-1', label: 'Configure guardrails for agent security in Foundry', pattern: /prompt shield|content filter|blocklist|guardrail|groundedness|jailbreak|prompt injection|\bXPIA\b/i },
  d3a10: { objectiveId: 'o3-1', label: 'Monitor AI security by using the Data and AI security dashboard in Defender for Cloud', pattern: /(data and ai|ai security) (security )?dashboard/i },
  d3a11: { objectiveId: 'o3-1', label: 'Manage agents in Microsoft 365 admin center', pattern: /microsoft 365 admin center|m365 admin center/i },

  // ---- d3b Implement security for servers and virtual machines (VMs) ----
  d3b1: { objectiveId: 'o3-2', label: 'Implement and configure disk encryption', pattern: /disk encryption|encryption at host|\bADE\b|disk encryption set|confidential disk/i },
  d3b2: { objectiveId: 'o3-2', label: 'Plan and implement Azure Bastion', pattern: /bastion/i },
  d3b3: { objectiveId: 'o3-2', label: 'Enable and enforce use of just-in-time (JIT) VM access', pattern: /just.in.time|\bJIT\b/i },
  d3b4: { objectiveId: 'o3-2', label: 'Extend security controls to hybrid and multicloud servers by using Azure Arc', pattern: /azure arc|arc.enabled|arc.connected/i },
  d3b5: { objectiveId: 'o3-2', label: 'Onboard servers to Defender for Servers in Defender for Cloud, including hybrid and multicloud scenarios', pattern: /defender for servers/i },
  d3b6: { objectiveId: 'o3-2', label: 'Configure Defender for Servers settings, including vulnerability scanning, and EDR', pattern: /defender for endpoint|\bEDR\b|\bMDE\b|vulnerability (scan|assessment|management)/i },
  d3b7: { objectiveId: 'o3-2', label: 'Implement and manage agentless scanning for VMs in Defender for Servers', pattern: /agentless/i },
  d3b8: { objectiveId: 'o3-2', label: 'Configure security features on a VM, including secure boot, vTPM, integrity monitoring, and security type', pattern: /secure boot|\bvTPM\b|trusted launch|integrity monitoring|security type|file integrity|guest attestation/i },
  d3b9: { objectiveId: 'o3-2', label: 'Enforce security configuration of Azure-managed servers by using Azure Machine Configuration', pattern: /machine configuration|guest configuration/i },

  // ---- d3c Implement security for application platform services ----
  d3c1: { objectiveId: 'o3-3', label: 'Detect misconfigurations and runtime risks in container workloads by using Defender for Containers', pattern: /defender for containers/i },
  d3c2: { objectiveId: 'o3-3', label: 'Implement and configure security controls for Azure Kubernetes Service (AKS)', pattern: /\bAKS\b|kubernetes/i },
  d3c3: { objectiveId: 'o3-3', label: 'Implement and configure security controls for Azure Container Registry', pattern: /container registry|\bACR\b/i },
  d3c4: { objectiveId: 'o3-3', label: 'Implement and configure security controls for Azure Container Instances and Azure Container Apps', pattern: /container instances|container apps|\bACI\b/i },
  d3c5: { objectiveId: 'o3-3', label: 'Implement and configure security controls for Azure Functions, including authentication and network access', pattern: /azure function|function app|function key/i },
  d3c6: { objectiveId: 'o3-3', label: 'Implement and configure security controls for Azure Logic Apps', pattern: /logic app/i },
  d3c7: { objectiveId: 'o3-3', label: 'Implement and configure security controls for Azure App Service', pattern: /app service|easy auth|deployment slot/i },
  d3c8: { objectiveId: 'o3-3', label: 'Implement and configure Azure Web Application Firewall', pattern: /web application firewall|\bWAF\b|OWASP|application gateway|front door|managed rule set/i },
  d3c9: { objectiveId: 'o3-3', label: 'Implement security policies for back-end API protection by using API Management', pattern: /api management|\bAPIM\b|validate.jwt|subscription key|rate.limit|quota polic/i },

  // ---- d4a Manage security posture by using Defender for Cloud ----
  d4a1: { objectiveId: 'o4-1', label: 'Identify security risks by using Defender CSPM', pattern: /defender cspm|attack path|cloud security explorer|security graph/i },
  d4a2: { objectiveId: 'o4-1', label: 'Evaluate compliance against security frameworks by using Defender for Cloud', pattern: /compliance|framework|benchmark|secure score|\bMCSB\b/i },
  d4a3: { objectiveId: 'o4-1', label: 'Enable and configure Defender for Cloud workload protection plans', pattern: /workload protection|defender plan|\bCWPP\b|enable defender for/i },
  d4a4: { objectiveId: 'o4-1', label: 'Connect hybrid cloud and multicloud environments to Defender for Cloud, including AWS and GCP', pattern: /\bAWS\b|\bGCP\b|google cloud|amazon web services|multicloud|multi.cloud|security connector/i },
  d4a5: { objectiveId: 'o4-1', label: 'Configure Microsoft Defender Vulnerability Management settings for Azure VMs', pattern: /vulnerability management|\bMDVM\b|vulnerability assessment|\bCVE\b/i },
  d4a6: { objectiveId: 'o4-1', label: 'Discover unprotected assets and vulnerabilities by using Microsoft Defender EASM', pattern: /\bEASM\b|external attack surface/i },

  // ---- d4b Implement activity and event collection in Microsoft Sentinel ----
  d4b1: { objectiveId: 'o4-2', label: 'Create and connect workspaces in Microsoft Sentinel', pattern: /log analytics workspace|workspace/i },
  d4b2: { objectiveId: 'o4-2', label: 'Assign roles in Microsoft Sentinel', pattern: /sentinel (reader|responder|contributor)|playbook operator|automation contributor|sentinel role/i },
  d4b3: { objectiveId: 'o4-2', label: 'Implement and use content hub solutions', pattern: /content hub|solution/i },
  d4b4: { objectiveId: 'o4-2', label: 'Configure and use Microsoft data connectors for Azure resources', pattern: /data connector|diagnostic setting/i },
  d4b5: { objectiveId: 'o4-2', label: 'Implement and configure syslog and Common Event Format (CEF) event collections', pattern: /syslog|\bCEF\b|common event format|CommonSecurityLog/i },
  d4b6: { objectiveId: 'o4-2', label: 'Implement and configure collection of Windows Security events by using data collection rules, including WEF', pattern: /data collection rule|\bDCR\b|windows security event|windows event forwarding|\bWEF\b|azure monitor agent|\bAMA\b|\bXPath\b/i },
  d4b7: { objectiveId: 'o4-2', label: 'Create custom log tables in the workspace to store ingested data', pattern: /custom (log )?table|_CL\b|table plan/i },
  d4b8: { objectiveId: 'o4-2', label: 'Implement automation rules and playbooks in Microsoft Sentinel', pattern: /automation rule|playbook/i },
  d4b9: { objectiveId: 'o4-2', label: 'Implement data retention in Microsoft Sentinel data stores', pattern: /retention|archive|auxiliary|basic log|long.term|search job|restore/i },
  d4b10: { objectiveId: 'o4-2', label: 'Query Microsoft Purview Audit in Defender XDR', pattern: /purview audit|unified audit log|audit log search/i },

  // ---- d4c Implement Microsoft Security Copilot ----
  d4c1: { objectiveId: 'o4-3', label: 'Configure workspaces for Security Copilot', pattern: /security compute unit|\bSCU\b|capacity|provision/i },
  d4c2: { objectiveId: 'o4-3', label: 'Manage permissions and roles in Security Copilot', pattern: /owner|contributor|\brole\b|permission/i },
  d4c3: { objectiveId: 'o4-3', label: 'Enable and configure plugins', pattern: /plugin/i },
  d4c4: { objectiveId: 'o4-3', label: 'Enable and configure Microsoft agents and Security Store agents', pattern: /security store|promptbook|\bagent/i },
}

/** Every searchable string of an item: stem, options, explanation, typed payloads. */
export function itemText(q) {
  return [
    q.prompt,
    q.explanation,
    ...(q.choices ?? []),
    ...(q.reorderItems ?? []),
    ...(q.poolItems ?? []),
    q.screenTitle ?? '',
    q.template ?? '',
    ...(q.fields ?? []).flatMap((f) => [f.label, ...(f.options ?? []), f.correctValue]),
    ...(q.statements ?? []).map((s) => s.text),
    ...(q.sources ?? []),
    ...(q.targets ?? []).flatMap((t) => [t.label, t.correctSource]),
    ...(q.blanks ?? []).flatMap((b) => [...(b.options ?? []), b.correctValue]),
  ].join('  ')
}

/** Ref codes owned by an objective, in declaration order. */
export function bulletsFor(objectiveId) {
  return Object.entries(BULLETS)
    .filter(([, b]) => b.objectiveId === objectiveId)
    .map(([ref]) => ref)
}

/**
 * The bullets an item plausibly tests. Returns every match, because picking one
 * automatically is exactly the judgement call a pattern cannot make: an item on
 * "restrict Key Vault to a private endpoint" legitimately touches d1b3 and d1b4.
 */
export function matchingBullets(q) {
  const text = itemText(q)
  return bulletsFor(q.objectiveId).filter((ref) => BULLETS[ref].pattern.test(text))
}
