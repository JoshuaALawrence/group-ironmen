# Group Ironmen Tracker

[![CI](https://github.com/JoshuaALawrence/group-ironmen/actions/workflows/ci.yml/badge.svg)](https://github.com/JoshuaALawrence/group-ironmen/actions/workflows/ci.yml)
[![CodeQL](https://github.com/JoshuaALawrence/group-ironmen/actions/workflows/codeql.yml/badge.svg)](https://github.com/JoshuaALawrence/group-ironmen/actions/workflows/codeql.yml)
[![License: BSD-2-Clause](https://img.shields.io/badge/License-BSD_2--Clause-blue.svg)](LICENSE)
[![Node.js](https://img.shields.io/badge/Node.js-20-339933?logo=node.js&logoColor=white)](https://nodejs.org/)
[![TypeScript](https://img.shields.io/badge/TypeScript-5-3178C6?logo=typescript&logoColor=white)](https://www.typescriptlang.org/)
[![Docker](https://img.shields.io/badge/Docker-ready-2496ED?logo=docker&logoColor=white)](https://hub.docker.com/r/joshuaalawrence/osrs-group-ironman-tracker)

> **Fork Notice:** This is a heavily modified fork of [christoabrown/group-ironmen](https://github.com/christoabrown/group-ironmen) with significant changes and improvements across the frontend, backend, cache tooling, and deployment infrastructure. While the core concept remains the same, much of the codebase has been rewritten or extended. See [What's Changed](#whats-changed) for details.

<table>
  <tr>
    <td><strong>Website</strong></td>
    <td><a href="https://groupiron.men">groupiron.men</a></td>
  </tr>
  <tr>
    <td><strong>RuneLite Plugin</strong></td>
    <td><a href="https://github.com/JoshuaALawrence/group-ironmen">group-ironmen-tracker</a></td>
  </tr>
</table>

A real-time group tracking system for Old School RuneScape Group Ironman teams. A companion RuneLite plugin sends player data to a backend server, allowing all group members to view each other's stats, gear, bank, position, and more through an interactive web dashboard.

---

**Contents:** [Screenshots](#screenshots) · [Features](#features) · [What's Changed](#whats-changed) · [Self-Hosting](#self-hosting) · [Development](#development) · [Acknowledgments](#acknowledgments) · [License](#license)

---

## Screenshots

<details>
<summary><strong>Click to expand screenshots</strong></summary>

### Dashboard
<img width="1919" alt="Dashboard" src="https://github.com/user-attachments/assets/98298526-d107-4831-8ff0-72a4eba7f90f" />

### DPS Calculator
<img width="1620" alt="DPS Calculator" src="https://github.com/user-attachments/assets/dc672a95-e60e-468b-bbc2-526c737b096d" />

### Banked XP
<img width="1608" alt="Banked XP" src="https://github.com/user-attachments/assets/94063cc9-cae9-4028-9358-c8f67e4a0e36" />

### Events
<img width="1568" alt="Events" src="https://github.com/user-attachments/assets/174f9cbc-be51-47b4-8f2a-4d88f2303d84" />

### Blog
<img width="1595" alt="Blog" src="https://github.com/user-attachments/assets/5400cb13-d574-4c4e-897f-26745c873132" />

### Clues
<img width="1612" alt="Clues" src="https://github.com/user-attachments/assets/788da914-6397-4975-b932-093005217f54" />

### Discord Integration

| Item Requests | Event Notifications |
|---|---|
| <img width="633" alt="Item Requests" src="https://github.com/user-attachments/assets/a5e0c573-04af-48ba-88e9-137de8b409b5" /> | <img width="409" alt="Event Notifications" src="https://github.com/user-attachments/assets/195f3cba-3c11-4780-85af-6ba0f9d9eb8a" /> |

</details>

## Features

### Dashboard
- **Group Overview** - Total wealth, XP gains, quest points, and collection log completion at a glance
- **Member Activity** - Online status, current world, and inactivity detection
- **OSRS News** - Latest Jagex blog posts via RSS, YouTube videos, and Twitch stream status
- **Upcoming Events** - Countdown banners for scheduled group events

### Player Tracking
- **Containers** - Inventory, equipment, bank, rune pouch, seed vault, stash units, and shared bank
- **Skills** - All 24 skills with real-time XP drops, level progress bars, and historical graphing (day/week/month/year)
- **Live Status** - HP, prayer, run energy bars, current world, and combat interaction display
- **World Map** - Canvas-based interactive map with player markers, 6 zoom levels, 4 planes, follow mode, and NPC interaction visualization
- **Quests** - All quests grouped by category with per-member state tracking and quest point totals
- **Achievement Diaries** - 12 regions × 4 tiers with bit-packed completion tracking and individual task display
- **Collection Log** - 5 tabs (Bosses, Raids, Clues, Minigames, Other) with per-page completion percentages, multi-player unlock status, and wiki links
- **Boss Kill Counts** - Via Jagex Hiscores (Normal, Ironman, HCIM, UIM) with 5-minute cache, plus clue scroll and activity tracking

### Tools & Utilities
- **Banked XP Calculator** - 12 skills, 500+ items, multiple activities per item, equipment modifier support (outfit bonuses), and secondary item tracking
- **DPS Calculator** - Full combat simulator with 35+ prayers, potion modifiers, special attacks, bolt effects, raid scaling (CoX/ToB/ToA), hit distribution histograms, and loadout saving
- **Items Browser** - Group-wide item aggregation with search, sort, GE/HA price display, and per-member filtering
- **Grand Exchange Prices** - Auto-updated every 4 hours from the OSRS Wiki API

### Group Events & Discord
- **Event System** - 7 event types (Boss, Skilling, Minigame, Quest, Raid, PK Trip, Other) with 50+ configurable icons, event banners, and Discord webhook reminders
- **Discord Integration** - Rich embed event notifications with @mentions, item request messages with holder info, and per-member Discord ID linking
- **OSRS Blog** - Categorized news feed (Game Updates, Community, Dev Blogs, Future Updates, Events)

### Group Management
- **Create/Join Groups** - Up to 5 members per group with optional hCaptcha verification
- **Member Management** - Add, rename, and remove members with cascading data cleanup
- **Settings** - Panel dock position, dark/light theme with system preference detection, Discord webhook configuration
- **Demo Mode** - Try the app with simulated XP drops, HP changes, and coordinate updates

### Technical Highlights
- **Unified Node.js/Express backend** with batched update processing and Server-Sent Events for real-time push
- **PostgreSQL** with time-series skill aggregation (hourly/daily/monthly retention)
- **Web Components** frontend with SPA routing and responsive multi-panel layout
- **OSRS cache pipeline** - Automated extraction of item data, sprites, map tiles, NPC icons, and collection log structure
- **Single Docker image** with health checks, rate limiting, gzip compression, and auto-initialized schema

## What's Changed

Key changes over the [upstream repository](https://github.com/christoabrown/group-ironmen):

- **Unified architecture** - Merged separate frontend/backend into a single Node.js/TypeScript application and Docker image
- **TypeScript migration** - Converted codebase from JavaScript to TypeScript
- **Dashboard** - New home page with group wealth, XP gains, quest points, collection log completion, OSRS news feed, YouTube videos, and Twitch live status
- **DPS Calculator** - Full combat simulator with prayers, potions, special attacks, bolt effects, raid scaling, and hit distribution
- **Banked XP Calculator** - 12 skills with 500+ items, equipment modifiers, and activity selection
- **Group events** - Scheduled events with 7 types, 50+ icons, event banners, and Discord webhook reminders
- **Discord integration** - Event notifications with rich embeds, item request messages with @mentions
- **Skill XP graphing** - Chart.js historical graphs with day/week/month/year periods and server-side aggregation
- **OSRS blog page** - Categorized Jagex RSS feed with YouTube and Twitch integration
- **Real-time updates** - Server-Sent Events with batched update processing and deduplication
- **OSRS cache pipeline** - Automated extraction via `update-cache.ps1` for item data, sprites, map tiles, and equipment stats
- **Hardened deployment** - Docker Compose with health checks, resource limits, rate limiting, and structured logging

---

## Self-Hosting

You can self-host the tracker instead of using [groupiron.men](https://groupiron.men). In the RuneLite plugin settings, set the URL to your hosted instance. Leaving it blank defaults to `https://groupiron.men`.

![Plugin settings](https://i.imgur.com/0JFD7D5.png)

### Prerequisites

- [Docker](https://docs.docker.com/get-docker/)
- [Docker Compose](https://docs.docker.com/compose/install/)

### Quick Start (Docker Compose)

1. Copy `docker-compose.yml` and `.env.example` to your server.

2. Create a `.env` file from the example and fill in your secrets:
   ```sh
   cp .env.example .env
   ```
   See the comments in `.env.example` for an explanation of each variable.

3. Start the stack:
   ```sh
   docker compose up -d
   ```

The app will be available on port **4000** (configurable in the compose file). The PostgreSQL database is managed automatically.

### Without Docker Compose

If you prefer to manage containers individually, set up a PostgreSQL database manually, then run the image with the required environment variables:

```sh
docker run -d -p 4000:4000 \
  -e PG_USER=<user> \
  -e PG_PASSWORD=<password> \
  -e PG_HOST=<host> \
  -e PG_PORT=<port> \
  -e PG_DB=<database> \
  -e BACKEND_SECRET=<secret> \
  joshuaalawrence/osrs-group-ironman-tracker:latest
```

---

## Development

```sh
npm install    # Install dependencies
npm run dev    # Start local dev server with hot reload
npm run build  # Build server + site for production
npm test       # Run tests (via vitest)
```

### Cache Updates

The OSRS cache pipeline downloads the game cache, extracts item data, sprites, map tiles, and equipment stats, then syncs everything to the frontend:

```sh
make update-cache         # Full cache update
make update-cache-push    # Full cache update with git commit & push
make update-equipment     # Re-import equipment.json from existing cache dump
```

See `scripts/update-cache.ps1` for detailed options and flags.

---

## Acknowledgments

- [christoabrown/group-ironmen](https://github.com/christoabrown/group-ironmen) — Original group ironman tracker this project is forked from
- [weirdgloop/osrs-dps-calc](https://github.com/weirdgloop/osrs-dps-calc) — Referenced for the DPS calculator implementation
- [TheStonedTurtle/banked-experience](https://github.com/TheStonedTurtle/banked-experience) — Referenced for the banked XP calculator

## License

BSD 2-Clause - see [LICENSE](LICENSE). Original work copyright (c) 2022, Christopher Brown.
