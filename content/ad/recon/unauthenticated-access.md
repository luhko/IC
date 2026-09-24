---
title: Unauthenticated access
category: AD / Recon
order: 6
tags: [null-session, smb, shares, rpcclient, rid-cycling, ldap-anon, guest]
summary: >
  Before you have any creds, squeeze the domain for anonymous data: readable
  shares, user/group lists over RPC, RID cycling to enumerate accounts, and
  anonymous LDAP. A single username often bootstraps a password spray.
prerequisites:
  - Network access to a target ($ip) / a DC ($dc_ip)
  - Anonymous / guest access not fully locked down (RestrictAnonymous)
tools: [smbclient, smbmap, netexec, rpcclient, impacket (lookupsid), enum4linux-ng, ldapsearch]
detection:
  - Null/guest SMB session setups; SAMR/LSARPC enumeration; sequential RID lookups
mitigation:
  - RestrictAnonymous=1, RestrictNullSessAccess=1; remove Guest access; restrict anonymous LDAP
refs:
  - { label: "HackTricks — SMB", url: "https://book.hacktricks.xyz/network-services-pentesting/pentesting-smb" }
  - { label: "netexec wiki", url: "https://www.netexec.wiki/" }
---

## SMB shares without auth

```sh
# list shares (null, then guest as fallback)
smbclient -N -L //$ip
netexec smb $ip -u '' -p '' --shares
netexec smb $ip -u 'guest' -p '' --shares
# read/write matrix across a range
smbmap -H $ip -u '' -p ''
```

```sh
# connect + pull files from a readable share
smbclient -N //$ip/Share
#   smb> recurse ON; prompt OFF; mget *
# spider every readable share for interesting files
netexec smb $ip -u '' -p '' -M spider_plus
```

## Users & groups over RPC (null session)

```sh
rpcclient -U '' -N $ip
#   enumdomusers        # users (+ RIDs)
#   enumdomgroups       # groups
#   querydispinfo       # users with descriptions (password hints!)
#   getdompwinfo        # password policy
#   queryuser 0x<rid>   # detail on a user
#   lsaenumsid          # known SIDs
```

## RID cycling (enumerate accounts by SID)

When `enumdomusers` is blocked, brute the RIDs — often still allowed.

```sh
netexec smb $ip -u 'guest' -p '' --rid-brute 10000
# impacket, fully anonymous
lookupsid.py guest@$ip -no-pass
```

## Anonymous LDAP

```sh
netexec ldap $dc_ip -u '' -p ''
# naming contexts, then dump base if anon bind is allowed
ldapsearch -x -H ldap://$dc_ip -s base namingcontexts
ldapsearch -x -H ldap://$dc_ip -b "$base_dn" '(objectClass=user)' sAMAccountName
```

## One tool to sweep it

```sh
enum4linux-ng -A $ip
```

> Turn any harvested usernames into a spray list and try `Season+Year!`, the
> company name, or `username = password` — respecting the lockout policy you saw
> in `getdompwinfo`.
