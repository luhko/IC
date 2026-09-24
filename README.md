# IC — Internal Cheatsheet

A local, offline cheat sheet for **authorized** internal / Active Directory
security assessments. A mix of Notion (rich, searchable, organized content) and
Exegol (a variable engine that fills your target details — `$ip`, `$user`,
`$domain`, … — into every command).

> ⚠️ For use on engagements you are authorized to perform (pentests, red team,
> CTF, lab study) only. You are responsible for staying within scope and the law.

## Features

- **Variable engine** — set your target context once (`$ip`, `$user`,
  `$domain`, `$dc_ip`, …); every command renders filled in, one‑click copy,
  unset variables highlighted.
- **Notion‑like content** — techniques written in Markdown, organized by
  category, with structured metadata (prerequisites, tooling, detection).
- **Interactive mindmap** — the internal AD methodology as a zoomable,
  collapsible mind map (authored in Markdown).
- **Attack paths** — chained, step‑by‑step internal attack paths (YAML).
- **Search** — full‑text fuzzy search over everything (`Ctrl‑K`).
- **100% local** — no telemetry, no backend; runs on `localhost`.

## Stack

Vite + React + TypeScript, Tailwind, zustand, react-markdown, markmap, Fuse.js.

## Run

```bash
npm install
npm run dev      # http://localhost:5173
```

Build a static bundle you can open anywhere:

```bash
npm run build && npm run preview
```

## Content

Content lives in `content/` and is loaded at build time — edit a file, save,
hot‑reload.

```
content/
  variables.yaml            # canonical variables ($ip, $user, …) → context bar + autocomplete
  ad/
    relay/*.md              # NTLM relay, ADCS/ESC, delegation …
    cve/*.md                # one CVE per file, prerequisites in frontmatter
    mindmap/internal-ad.md  # markmap source for the AD mindmap
  attack-paths/*.yaml       # chained attack paths
```

### Adding a technique (Markdown)

Frontmatter drives the sidebar and search; fenced ` ```sh ` code blocks become
copyable, variable‑substituted commands.

```markdown
---
title: Kerberoasting
category: AD / Credentials
tags: [kerberos, credentials]
prerequisites:
  - Any domain account
  - A reachable Domain Controller ($dc_ip)
tools: [netexec, impacket]
---

Request service tickets for accounts with an SPN, then crack offline.

​```sh
netexec ldap $dc_ip -u $user -p $password --kerberoasting hashes.txt
​```
```

### Variables

Any `$name` token in a command is substituted from the context bar. Declare the
well‑known ones in `content/variables.yaml` so they show up in the bar and in
autocomplete.
