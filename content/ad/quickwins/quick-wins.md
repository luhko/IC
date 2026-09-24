---
title: Quick wins
category: AD / Quick wins
order: 10
tags: [quickwins, hitlist, checklist, methodology]
summary: >
  The high-value, low-effort checks to run first on an internal — the things that
  most often pop a domain fast. Each links to its full page. Work top to bottom:
  no-creds wins, then first-cred escalation checks, then the coerce→relay chains.
tools: [netexec, Responder, mitm6, certipy, BloodHound, impacket, bloodyAD]
refs:
  - { label: "The Hacker Recipes", url: "https://www.thehacker.recipes/" }
  - { label: "HackTricks — AD methodology", url: "https://book.hacktricks.xyz/windows-hardening/active-directory-methodology" }
---

## No creds yet (first 10 minutes)

- **Poison + relay** — Responder for NetNTLM, mitm6 for IPv6/WPAD → relay to a
  target with signing off. → *Relay & Coercion*

```sh
netexec smb $ip/24 --gen-relay-list relay_targets.txt   # signing-off = relay targets
responder -I $interface                                  # LLMNR/NBT-NS/mDNS
```

- **Anonymous / guest** — shares, users (RID cycling), password policy. → *Unauth access*

```sh
netexec smb $dc_ip -u '' -p '' --shares --rid-brute 10000 --pass-pol
```

- **GPP cpassword** in SYSVOL (any domain read). → *GPP passwords*

```sh
netexec smb $dc_ip -u $user -p $password -M gpp_password
```

- **Password spray** a likely one (`Season+Year!`, company name). → *Password spraying*

## First valid creds → instant-escalation checklist

Run these the moment you have any account — one of them usually shortcuts to DA:

```sh
certipy find -u $user@$domain -p $password -dc-ip $dc_ip -vulnerable -stdout   # ESC1/ESC8…
netexec ldap $dc_ip -u $user -p $password --asreproast a.txt --kerberoasting k.txt
netexec ldap $dc_ip -u $user -p $password -M maq -M laps --gmsa                # quota / LAPS / gMSA
```

| Check | If true → | Page |
|---|---|---|
| `certipy find -vulnerable` hits | ESC1 / ESC8 / ESC9… | ESC catalog |
| MachineAccountQuota > 0 | RBCD / Shadow Credentials | RBCD |
| LDAP signing + channel binding OFF | KrbRelayUp → local SYSTEM | KrbRelayUp |
| Unconstrained delegation host you own | coerce a DC → capture TGT | Unconstrained delegation |
| ReadGMSAPassword / ReadLAPSPassword | read the secret | gMSA / LAPS |
| BloodHound ACL edge from an owned user | GenericAll/WriteDacl/… | ACL abuse |
| WriteDacl on the domain object | grant yourself DCSync | WriteDacl / WriteOwner |
| Kerberoastable svc with weak pw | crack → creds | Kerberoasting |

## Coerce → relay (domain in one shot)

The two chains worth trying on almost every engagement:

- **PetitPotam → ADCS ESC8** — coerce `DC$`, relay to the CA web enrollment, get a
  DC cert, PKINIT → **DCSync**. → *PetitPotam → ESC8* attack path.
- **Coerce over WebDAV → LDAP → RBCD** — HTTP auth relays to LDAP even with SMB
  signing on; set RBCD on the victim computer and take it over. → *WebDAV relay*.

## Unpatched-DC CVEs to test fast

`ZeroLogon` · `noPac` · `PetitPotam (+ESC8)` · `PrintNightmare` · `Certifried` —
all quick to check and each is a straight line to domain compromise. → *CVE* section.

## Creds are usually just lying around

- User `description` / attributes, and readable **shares** (Snaffler / `-M spider_plus`)
- **LSASS / SAM** on any host where you're local admin → new creds → repeat
- **DPAPI** (browser, saved creds), GPP, gMSA/LAPS

> Golden rule: dump the domain into **BloodHound** early, mark everything you own
> as Owned, and let it show you the shortest path instead of guessing.
