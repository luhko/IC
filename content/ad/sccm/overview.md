---
title: SCCM/MECM attack surface
category: AD / SCCM
order: 10
tags: [sccm, mecm, configmgr, recon, ntlm-relay, lateral-movement]
summary: >
  SCCM/MECM is a high-value internal target because its site roles are
  over-permissioned by default. This maps the roles and the SpecterOps
  TAKEOVER/CRED/ELEVATE/EXEC/RECON taxonomy, and how to find SCCM in a domain.
prerequisites:
  - Authenticated foothold as any domain user (most RECON/CRED), or unauth LAN access (PXE)
  - Reachability to site systems (SMB 445, HTTP/S 80/443, MSSQL 1433)
tools: [sccmhunter, SharpSCCM, netexec, ntlmrelayx, PXEThief]
detection:
  - LDAP queries against the System Management container; MSSQL/HTTP enum from non-admin hosts
  - New/anomalous device enrollments and computer-policy requests to a management point
mitigation:
  - Require PKI (HTTPS-only) client auth; enable Enhanced HTTP + token auth
  - Disable automatic site-wide client push, or scope it to a low-priv account (never the site-server account)
  - SMB signing + EPA on site systems and the site DB
refs:
  - { label: "Misconfiguration Manager (docs)", url: "https://docs.specterops.io/misconfiguration-manager-docs/README" }
  - { label: "Misconfiguration Manager (GitHub)", url: "https://github.com/subat0mik/Misconfiguration-Manager" }
  - { label: "sccmhunter", url: "https://github.com/garrettfoster13/sccmhunter" }
  - { label: "SharpSCCM", url: "https://github.com/Mayyhem/SharpSCCM" }
---

## SCCM roles you attack

- **Site server** — the site's brain. Its **machine account is effectively
  domain-privileged inside the hierarchy**: `db_owner` on the site DB and local
  admin on every site system. Coercing + relaying it drives takeover.
- **Management Point (MP)** — serves policies (incl. obfuscated NAA creds) and
  accepts client enrollment/policy requests. Primary CRED target.
- **Distribution Point (DP)** — hosts content and, if PXE/OSD is on, boot media
  with task-sequence secrets. PXE credential theft target.
- **SMS Provider** — the WMI/AdminService layer; membership in the local **SMS
  Admins** group grants ConfigMgr control. Relay target for takeover.
- **Site database (MSSQL)** — the RBAC store; writing `RBAC_Admins` = Full Admin.

## Attack classes (SpecterOps taxonomy)

| Code | Meaning | Representative techniques |
|---|---|---|
| **RECON** | Enumerate SCCM (or use it to enumerate) | LDAP, SMB, HTTP, SMS Provider |
| **CRED** | Credential access (most common path) | PXE media, policy/NAA request, local DPAPI/WMI, site DB |
| **ELEVATE** | Local/domain privesc via coercion | relay to SMB site system, relay via automatic client push |
| **TAKEOVER** | Full hierarchy compromise | coerce+relay site-server acct to site DB (MSSQL/SMB), AD CS, SMS Provider, LDAP |
| **EXEC** | Post-takeover code exec | app / script deployment (SYSTEM on clients) |

High level: **CRED** harvests NAA/policy/PXE secrets (often instant lateral
movement); **coercion + NTLM relay** of the site-server or client account drives
**ELEVATE/TAKEOVER**; **EXEC** weaponises Full Administrator to push code to any
managed host.

## Find SCCM in a domain

`sccmhunter find` reads the **System Management container DACL**, resolves
published sites/MPs, flags PXE-enabled DPs, and keyword-hunts SCCM principals:

```sh
sccmhunter.py find -u '$user' -p '$password' -d $domain -dc-ip $dc_ip
sccmhunter.py smb  -u '$user' -p '$password' -d $domain -dc-ip $dc_ip   # profile hosts
```

```powershell
# from a Windows client
SharpSCCM.exe local site-info
SharpSCCM.exe get management-points -d $domain
```

Corroborating signals: objects under `CN=System Management,CN=System,$base_dn`;
the `mSSMSManagementPoint` / `mSSMSSite` classes; the 3-char site code (e.g.
`PS1`) in policy/MP URLs; boundary groups.

> See **SCCM credential harvesting** for the CRED / ELEVATE / TAKEOVER chains.
