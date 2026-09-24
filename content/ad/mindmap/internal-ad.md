---
title: Internal AD methodology
---

# Internal AD

## Recon
### No creds
- Network — nmap, `nxc smb/ldap` sweep, masscan → httpx → gowitness
- Null / guest — SMB shares (`smbclient -N`), RID cycling, `rpcclient` enumdomusers
- LDAP anon — namingContexts, sometimes objects
- Poisoning — Responder (LLMNR/NBT-NS/mDNS), mitm6 (DHCPv6/WPAD)
### With creds
- BloodHound — bloodhound-python / `nxc --bloodhound` / SharpHound
- `nxc` — --users --groups --pass-pol --gmsa --laps
- ADCS — `certipy find -vulnerable`
### Quick wins
- GPP cpassword (SYSVOL), user description fields
- Spray `Season+Year!`, Kerberoast, AS-REP roast

## Credentials
### Roasting
- Kerberoast (SPN accounts) → hashcat 13100
- AS-REP roast (DONT_REQ_PREAUTH) → hashcat 18200
- Targeted Kerberoast (WriteSPN edge)
### From the domain
- DCSync (DS-Replication rights) → `secretsdump -just-dc`
- NTDS.dit → `nxc --ntds`
### From a host (local admin)
- LSASS — nanodump / lsassy / mimikatz sekurlsa
- SAM + LSA — `nxc --sam --lsa`
- DPAPI — masterkeys, browser, DonPAPI
### Managed secrets
- gMSA (ReadGMSAPassword) → gMSADumper / `nxc --gmsa`
- Golden gMSA (KDS root key) — offline, forever
- LAPS (ReadLAPSPassword) → `nxc -M laps`

## Relay & coercion
### Find
- SMB signing off — `nxc --gen-relay-list`
- LDAP channel binding — ldap-checker
### Coerce
- PetitPotam (EFSR), PrinterBug (RPRN), DFSCoerce (DFSNM)
- WebDAV → HTTP (needed to reach LDAP)
### Relay to…
- SMB — dump-sam, exec, SOCKS + proxychains
- LDAP — RBCD, Shadow Credentials, dump-laps/gmsa
- ADCS ESC8 / ESC11 — DC cert → DCSync

## Privilege escalation
### ACL abuse (BloodHound edges)
- GenericAll / GenericWrite → Shadow Creds / targeted roast / RBCD
- WriteDacl / WriteOwner → grant yourself DCSync
- ForceChangePassword, AddMember / AddSelf
- Tools — bloodyAD, dacledit, owneredit, pyWhisker
### ADCS (ESC1–ESC16)
- `certipy find -vulnerable`
- ESC1 (SAN), ESC8/11 (relay), ESC9/10/16 (no SID ext)
### Delegation
- Unconstrained — coerce a DC → capture TGT
- Constrained (KCD) — S4U2Proxy, SPN swap
- RBCD — write msDS-AllowedToActOnBehalfOf
- KrbRelayUp — local → SYSTEM
### Services
- MSSQL — impersonation, linked servers, xp_cmdshell
- SCCM — NAA / PXE creds, client-push relay → site takeover
### CVE
- ZeroLogon, noPac, PetitPotam + ESC8, PrintNightmare, Certifried

## Lateral movement
- Exec — psexec / smbexec / wmiexec / atexec / dcomexec
- WinRM — evil-winrm
- Pass-the-Hash → OverPass (key → TGT) → Pass-the-Ticket
- Convert .kirbi ↔ .ccache (ticketConverter)

## Domain dominance
### Reach DA / EA
- DCSync the krbtgt
- Follow the BloodHound Tier-0 path
### Persistence
- Golden / Silver / Diamond / Sapphire tickets
- DSRM, AdminSDHolder, writable GPO
- ACL / DCSync backdoor, SID history

## Trusts
- Enumerate — direction, transitivity, SID filtering
- Child → parent — SID history (EA RID 519), raiseChild
- Cross-forest — foreign members, ACLs, trust key
- Kerberoast / unconstrained across the trust

## Hybrid & Entra ID
### Recon
- Unauth — tenant discovery, user enum (o365spray, AADInternals)
- Authed — ROADtools, AzureHound, msol / Graph
### Attacks
- Password spray, device-code phishing, consent grant
- Token / PRT theft & replay
### Hybrid pivots
- Entra Connect server = Tier-0; MSOL_ DCSync
- Golden SAML (ADFS token-signing cert)
- Seamless SSO — AZUREADSSOACC$ silver ticket
- Intune — cloud admin → SYSTEM on managed devices

## Post
- Loot — shares (Snaffler), DBs, source, secrets
- Cleanup + report — timeline, IOCs, remediation
