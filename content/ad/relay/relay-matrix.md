---
title: Relay matrix & gates
category: AD / Relay & Coercion
order: 12
tags: [relay, matrix, signing, epa, mic, cross-protocol]
summary: >
  What you can relay to what, and why. The source protocol of the captured auth
  (SMB vs HTTP) and the target's signing / channel-binding settings decide the
  whole game.
tools: [netexec, impacket (ntlmrelayx)]
refs:
  - { label: "dirkjanm — Relaying to greatness (drop the MIC)", url: "https://dirkjanm.io/worst-of-both-worlds-ntlm-relaying-and-kerberos-delegation/" }
  - { label: "hackndo — NTLM relay", url: "https://en.hackndo.com/ntlm-relay/" }
  - { label: "TrustedSec — NTLM relaying", url: "https://www.trustedsec.com/blog/" }
---

## The three gates

1. **Reflection is dead.** You cannot relay a host's auth back to itself
   (MS08-068 and follow-ups). Relay to a *different* target.
2. **Signing / channel binding on the target** decides if the relayed session
   is accepted:
   - SMB signing **required** → cannot relay to that SMB service (DCs require it).
   - LDAP signing / **LDAP channel binding (EPA)** enforced → cannot relay to LDAP(S).
   - AD CS web enrollment with **EPA** → cannot relay to HTTPS ESC8.
3. **The MIC / source protocol** decides where an auth can go. SMB clients
   negotiate signing, which sets flags + a MIC that LDAP rejects. HTTP clients
   do not sign — so HTTP-sourced auth relays to LDAP cleanly.

## Matrix

Rows = protocol of the **captured/coerced** auth. Columns = **target** service.

| Captured ↓ / Target → | SMB (signing off) | LDAP / LDAPS | AD CS HTTP (ESC8) |
|---|---|---|---|
| **SMB** (Responder, PetitPotam default) | ✓ exec / SOCKS / dump-sam | ✗ (MIC; only pre-CVE-2019-1040 with `--remove-mic`) | ✓ if no EPA |
| **HTTP** (WebDAV, mitm6/WPAD) | ✓ | ✓ RBCD / shadow creds / dump | ✓ if no EPA |

**Takeaway:** to reach **LDAP** (RBCD, Shadow Credentials, LAPS/gMSA dump) you
almost always want an **HTTP** source — i.e. coerce over **WebDAV** or poison
with **mitm6/WPAD**. Pure SMB coercion is for SMB exec and AD CS.

## Find relayable SMB targets

```sh
# hosts where SMB signing is not required = SMB relay candidates
netexec smb $ip/24 --gen-relay-list relay_targets.txt
# quick eyeball
netexec smb $ip/24 | grep -i "signing:False"
```

## Check the LDAP side

```sh
# is LDAP signing / channel binding enforced on the DC?
netexec ldap $dc_ip -u $user -p $password -M ldap-checker
```

> If LDAP channel binding is enforced, HTTP→LDAP relay stops working — pivot to
> AD CS (ESC8/ESC11) or a pure SMB-exec relay instead.
