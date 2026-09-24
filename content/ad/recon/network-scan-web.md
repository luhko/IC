---
title: Network scan → web screenshots
category: AD / Recon
order: 4
tags: [nmap, masscan, httpx, gowitness, recon, discovery, screenshots]
summary: >
  Not AD-specific, but step zero on internal: discover live hosts and ports fast
  (masscan/nmap), pull out the web services (httpx), and screenshot them all
  (gowitness) so you can eyeball the whole estate in one gallery.
tools: [nmap, masscan, httpx, gowitness, aquatone, eyewitness]
refs:
  - { label: "httpx", url: "https://github.com/projectdiscovery/httpx" }
  - { label: "gowitness", url: "https://github.com/sensepost/gowitness" }
---

## 1. Discover hosts + ports

```sh
# quick ping sweep to build a host list
nmap -sn $ip/24 -oG - | awk '/Up$/{print $2}' > hosts.txt
```

```sh
# masscan — full range, very fast (tune --rate to the network)
masscan $ip/24 -p1-65535 --rate 10000 -oL masscan.txt
# targeted service/version scan on what you found
nmap -Pn -sVC -iL hosts.txt --top-ports 1000 -oA nmap_top1k
```

## 2. Find the web services (httpx)

```sh
# probe common web ports, keep title / status / tech
httpx -l hosts.txt -ports 80,443,8080,8443,8000,8888 \
  -title -status-code -tech-detect -o web_alive.txt
```

```sh
# or feed masscan's ip:port pairs straight in
awk '/open/{print $4":"$3}' masscan.txt | httpx -title -tech-detect -o web_alive.txt
```

## 3. Screenshot everything (gowitness)

```sh
# gowitness v3
gowitness scan file -f web_alive.txt --screenshot-path ./shots --write-db
gowitness report server            # browse the gallery at http://localhost:7171
```

```sh
# alternatives
cat web_alive.txt | aquatone -out aquatone_report
eyewitness --web -f web_alive.txt -d eyewitness_report
```

> The gallery is where you spot the quick wins: default install pages, printers,
> old Tomcat/Jenkins, IPMI/iDRAC, and login portals worth a password spray.
