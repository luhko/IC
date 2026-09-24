---
title: Internal AD methodology
---

# Internal AD

## Recon (no creds)
### Network
- `nmap` sweep — 445/139/88/389/636/3268/5985/135
- `netexec smb <range>` — hosts, signing, OS, domain
- Identify DCs — 88/389 + `_ldap._tcp.dc._msdcs`
### Anonymous / null
- SMB null session — shares, users (RID cycling)
- LDAP anonymous bind — naming context, sometimes objects
- RPC — `rpcclient -U "" -N` enumdomusers
### Poisoning
- Responder — LLMNR / NBT-NS / mDNS → NetNTLM
- mitm6 — DHCPv6 → WPAD → NTLM
- Relay the captured auth (see Relay & Coercion)
### Passwords
- Guess: `Season+Year!`, company name, `Welcome1`
- Spray low-and-slow, respect lockout (badPwdCount)

## First creds
### Validate
- `netexec smb/ldap/winrm $dc_ip -u $user -p $password`
- Note: (Pwn3d!) = local admin
### Domain map
- BloodHound — `bloodhound-python` / `nxc ... --bloodhound` / SharpHound
- Find: shortest path to DA, kerberoastable, unconstrained, ACLs
### Cheap wins
- Kerberoasting — SPN accounts, crack offline
- AS-REP roasting — DONT_REQ_PREAUTH
- GPP cpassword in SYSVOL (MS14-025)
- LAPS / gMSA read rights
- Password in description / user attributes

## Credential access
### From a host (local admin)
- LSASS dump — comsvcs / nanodump / procdump
- SAM + LSA secrets — `nxc ... --sam --lsa`
- DPAPI — masterkeys, creds, browser
### From the domain
- DCSync — replicate hashes (needs DS-Replication)
- NTDS.dit — `secretsdump`, vss, `nxc ... --ntds`
### Tickets
- Pass-the-Hash / OverPass-the-Hash → TGT
- Pass-the-Ticket — inject .kirbi/.ccache

## Privilege escalation
### ACL abuse (BloodHound edges)
- GenericAll / GenericWrite / WriteDACL / WriteOwner
- ForceChangePassword, AddMember, AddSelf
- Shadow Credentials (msDS-KeyCredentialLink)
- Targeted Kerberoast (write SPN)
- Tools: bloodyAD, dacledit, owneredit, pyWhisker, targetedKerberoast
### ADCS (ESC1–ESC16)
- Misconfigured templates → enroll as anyone
- ESC8 / ESC11 — relay to CA
- Certipy find / req
### Delegation
- Unconstrained — coerce + capture TGT
- Constrained (KCD) — S4U2Proxy
- RBCD — write msDS-AllowedToActOnBehalfOfOtherIdentity
### CVE
- ZeroLogon, noPac, PetitPotam, PrintNightmare, KrbRelayUp…

## Lateral movement
- Exec — psexec / smbexec / wmiexec / atexec
- WinRM — evil-winrm
- DCOM / MMC20
- RDP — restricted admin, pass-the-hash

## Domain dominance
### Get to DA / Enterprise Admin
- DCSync the krbtgt
- Abuse a Tier-0 path from BloodHound
### Persistence
- Golden / Silver / Diamond / Sapphire ticket
- DSRM, AdminSDHolder, GPO, ACL backdoor
- Skeleton key, certificate (THEFT/persistence)

## Post
- Loot: shares, DBs, code, secrets
- Trusts — parent/child, forest, SID history
- Cleanup + report — timeline, IOCs, remediation
