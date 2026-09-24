---
title: Internal AD methodology
---

# Internal AD

## Recon
### No creds
- **Network** — `nmap -sV`, `nxc smb/ldap <range>`, masscan → httpx → gowitness
- **Null / guest**
  - shares — `smbclient -N -L`, `nxc smb -u '' -p '' --shares`
  - users — RID cycling `--rid-brute`, `rpcclient` enumdomusers
- **LDAP anon** — namingContexts, `ldapsearch -x`
- **Poisoning** — Responder (LLMNR/NBT-NS/mDNS), mitm6 (DHCPv6/WPAD)
### With creds
- **BloodHound** — `bloodhound-python -c All` / `nxc --bloodhound`
- **Enum** — `nxc --users --groups --pass-pol --gmsa --laps`
- **ADCS** — `certipy find -vulnerable`
### Quick wins
- GPP cpassword (SYSVOL), user `description` fields
- Spray `Season+Year!`, Kerberoast, AS-REP roast

## Credentials
### Roasting
- **Kerberoast** — `GetUserSPNs -request` → hashcat `-m 13100`
- **AS-REP** — `GetNPUsers` (DONT_REQ_PREAUTH) → `-m 18200`
- **Targeted** — write an SPN via ACL, then roast
### From the domain
- **DCSync** — `secretsdump -just-dc-user krbtgt` (needs Get-Changes)
- **NTDS.dit** — `nxc --ntds`
### From a host (local admin)
- **LSASS** — nanodump / lsassy / `sekurlsa::logonpasswords`
- **SAM + LSA** — `nxc --sam --lsa`
- **DPAPI** — masterkeys, browser, DonPAPI
### Managed secrets
- **gMSA** — ReadGMSAPassword → gMSADumper / `nxc --gmsa`
- **Golden gMSA** — KDS root key → offline, forever
- **LAPS** — ReadLAPSPassword → `nxc -M laps`

## Relay & coercion
### Find targets
- SMB signing off — `nxc --gen-relay-list`
- LDAP channel binding — ldap-checker
### Coerce
- **PetitPotam** (MS-EFSR), **PrinterBug** (MS-RPRN), **DFSCoerce** (MS-DFSNM)
- **WebDAV** → HTTP auth (needed to reach LDAP)
### Relay to…
- **SMB** — `--dump-sam`, exec, `-socks` + proxychains
- **LDAP** — RBCD, Shadow Credentials, `--dump-laps` / `--dump-gmsa`
- **ADCS** — ESC8 (HTTP) / ESC11 (RPC) → DC cert → DCSync

## Privilege escalation
### ACL abuse (BloodHound edges)
- **GenericAll / GenericWrite** → Shadow Creds / targeted roast / RBCD
- **WriteDacl / WriteOwner** → grant yourself DCSync
- **ForceChangePassword**, AddMember / AddSelf
- Tools — `bloodyAD`, `dacledit`, `owneredit`, `pyWhisker`
### ADCS (ESC1–ESC16)
- `certipy find -vulnerable`
- **ESC1** enrollee SAN · **ESC8/11** relay · **ESC9/10/16** no SID ext
### Delegation
- **Unconstrained** — coerce a DC → capture TGT (`Rubeus monitor`)
- **Constrained (KCD)** — `getST -impersonate` (S4U2Proxy)
- **RBCD** — write msDS-AllowedToActOnBehalfOf → S4U
- **KrbRelayUp** — local → SYSTEM
### Services
- **MSSQL** — impersonation, linked servers, `xp_cmdshell`
- **SCCM** — NAA / PXE creds, client-push relay → site takeover
### CVE
- ZeroLogon · noPac · PetitPotam + ESC8 · PrintNightmare · Certifried

## Lateral movement
- **Exec** — psexec / smbexec / wmiexec / atexec / dcomexec
- **WinRM** — evil-winrm
- **Tickets** — PtH → OverPass (`getTGT`) → PtT (`-k`)
- **Convert** — `ticketConverter` .kirbi ↔ .ccache

## Domain dominance
### Reach DA / EA
- DCSync the **krbtgt**
- Follow the BloodHound Tier-0 path
### Persistence
- **Tickets** — Golden / Silver / Diamond / Sapphire
- DSRM, AdminSDHolder, writable GPO
- ACL / DCSync backdoor, SID history

## Trusts
- **Enumerate** — direction, transitivity, SID filtering
- **Child → parent** — SID history (EA RID 519), `raiseChild`
- **Cross-forest** — foreign members, ACLs, trust key
- Kerberoast / unconstrained across the trust

## Hybrid & Entra ID
### Recon
- Unauth — tenant discovery, user enum (o365spray, AADInternals)
- Authed — ROADtools, AzureHound, msol / Graph
### Attacks
- Password spray, device-code phishing, consent grant
- Token / **PRT** theft & replay
### Hybrid pivots
- Entra Connect = **Tier-0**; MSOL_ DCSync
- **Golden SAML** (ADFS token-signing cert)
- **Seamless SSO** — AZUREADSSOACC$ silver ticket
- **Intune** — cloud admin → SYSTEM on managed devices

## Post
- Loot — shares (Snaffler), DBs, source, secrets
- Cleanup + report — timeline, IOCs, remediation
