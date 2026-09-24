---
title: Windows offensive toolbox
category: AD / Windows tooling
order: 40
tags: [ghostpack, certify, seatbelt, sharphound, whisker, inveigh, snaffler]
summary: >
  A field guide to the Windows binaries you'll reach for on an internal — what
  each one is for and its Linux equivalent, so you can pick the right tool for the
  host you're on.
tools: [Rubeus, Certify, SharpHound, Seatbelt, SharpUp, Whisker, PowerMad, SharpGPOAbuse, Inveigh, Snaffler]
detection:
  - Known GhostPack/SharpXxx signatures; unmanaged .NET assembly loads; 4104 script logging
mitigation:
  - App control (WDAC), AMSI, EDR, Constrained Language Mode
refs:
  - { label: "GhostPack", url: "https://github.com/GhostPack" }
  - { label: "The Hacker Recipes", url: "https://www.thehacker.recipes/" }
---

| Tool | Purpose | Linux equivalent |
|---|---|---|
| Rubeus | Kerberos (roast, S4U, ptt, monitor) | impacket, targetedKerberoast |
| Certify | ADCS enum + ESC abuse | Certipy |
| SharpHound | BloodHound collection | bloodhound-python, nxc |
| Seatbelt | host situational awareness | (manual) |
| SharpUp / PowerUp | local privesc checks | (manual, linpeas-style) |
| Whisker | Shadow Credentials | pyWhisker, certipy shadow |
| PowerMad | create machine accounts, ADIDNS | addcomputer.py, dnstool.py |
| StandIn | lightweight AD manipulation | bloodyAD |
| SharpGPOAbuse | abuse writable GPOs | pyGPOAbuse |
| Inveigh | LLMNR/NBNS/mDNS poisoning | Responder |
| Snaffler | hunt creds in shares | nxc spider_plus, MANSPIDER |
| SharpDPAPI / SharpChrome | DPAPI + browser secrets | impacket-dpapi, DonPAPI |
| KrbRelay / KrbRelayUp | local privesc via Kerberos relay | (see KrbRelayUp) |

## Execution notes

- Most are .NET assemblies — run in-memory (`execute-assembly`, reflective load)
  to avoid touching disk, but they're **heavily signatured**; expect AMSI + EDR.
- On a hardened host, prefer running the **Linux equivalents** from your box
  against the DC over the network (impacket / netexec / bloodyAD / certipy).

> Rule of thumb: enumerate and abuse **over the network from Linux** when you can;
> reach for the Windows binaries only for host-local actions (LSASS, DPAPI,
> in-memory ticket ops, local privesc).
