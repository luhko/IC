---
title: mitm6 (IPv6 / WPAD → relay)
category: AD / Relay & Coercion
order: 18
tags: [mitm6, ipv6, dhcpv6, wpad, relay, ldap, rbcd]
summary: >
  Windows prefers IPv6 and ships it enabled. mitm6 answers DHCPv6 to become each
  client's IPv6 DNS server, then hands out a WPAD record — the client
  authenticates (HTTP, unsigned) to your proxy, which you relay to LDAP for RBCD
  or a domain-info dump. The classic "do nothing and wait" internal win.
prerequisites:
  - A position on the LAN segment (link-local IPv6 reaches the clients)
  - IPv6 enabled on clients (default) and WPAD not disabled
  - A relay target that doesn't enforce signing/EPA — usually LDAP(S) on a DC
tools: [mitm6, impacket (ntlmrelayx)]
detection:
  - Rogue DHCPv6 replies / a new IPv6 DNS server pushed to clients
  - WPAD lookups over IPv6; machine accounts authenticating to an unexpected host
mitigation:
  - Disable IPv6 if unused, or enable DHCPv6 Guard / RA Guard on switches
  - Disable WPAD (WpadOverride) + the WinHTTP Auto Proxy service; block proxy autodiscovery via DNS
  - Enforce LDAP signing + channel binding (breaks the relay to LDAP) and SMB signing
refs:
  - { label: "dirkjanm — mitm6: compromising IPv4 via IPv6", url: "https://dirkjanm.io/mitm6-compromising-ipv4-networks-via-ipv6/" }
  - { label: "mitm6 (GitHub)", url: "https://github.com/dirkjanm/mitm6" }
  - { label: "HackTricks — Relay", url: "https://book.hacktricks.xyz/windows-hardening/active-directory-methodology/relaying-credentials" }
---

Windows sends periodic **DHCPv6 solicits** and prefers IPv6 DNS. mitm6 replies,
assigning itself as the client's DNS server, then answers the client's **WPAD**
query with your host. The client fetches `wpad.dat` over HTTP and authenticates
with NTLM — **HTTP auth is unsigned**, so it relays straight to **LDAP** (see the
Relay matrix for why HTTP is the good source).

## Run it

Two shells: mitm6 poisons, ntlmrelayx relays.

```sh
# poison IPv6 DNS — scope to the target domain to limit blast radius
mitm6 -d $domain -i $interface
```

```sh
# relay the HTTP auth to LDAP(S); set RBCD on the relayed computer
ntlmrelayx.py -6 -t ldaps://$dc_ip -wh attacker-wpad --delegate-access
```

- `-6` — listen on IPv6.
- `-wh <host>` — the WPAD host to serve (any name; mitm6 resolves it to you).
- `--delegate-access` — on a **computer** auth, create/configure RBCD so a
  controlled account can take the host over (then S4U — see RBCD).

## What you get

- **Computer auth** (a workstation rebooting / Group Policy refresh) → relayed to
  LDAP → **RBCD** on that machine → S4U → SYSTEM on it.
- **User auth** → relayed to LDAP → dump the directory, or escalate via an ACL
  the user holds (`--dump-laps`, `--dump-gmsa`, add-to-group…).

> Very effective against default AD, but **noisy** — you become DNS for every
> host on the segment. Scope with `-d $domain`, and prefer off‑hours (machines
> re‑auth on reboot). If LDAP channel binding is enforced, pivot to AD CS (ESC8).
