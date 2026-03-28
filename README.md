# Group Ironmen Tracker

> **Fork Notice:** This is a heavily modified fork of [christoabrown/group-ironmen](https://github.com/christoabrown/group-ironmen) with significant changes and improvements across the frontend, backend, cache tooling, and deployment infrastructure. While the core concept remains the same, much of the codebase has been rewritten or extended. See [What's Changed](#whats-changed) for details.

**Website:** [groupiron.men](https://groupiron.men)  
**RuneLite Plugin:** [group-ironmen-tracker](https://github.com/JoshuaALawrence/group-ironmen)  
**License:** BSD 2-Clause (original copyright Christopher Brown)

A real-time group tracking system for Old School RuneScape Group Ironman teams. A companion RuneLite plugin sends player data to a backend server, allowing all group members to view each other's stats, gear, bank, position, and more through an interactive web dashboard.

## Features

### Player Tracking
- **Containers** — Inventory, equipment, bank, rune pouch, seed vault, stash units, and shared bank
- **Skills** — Real-time XP with historical graphing and trend visualization
- **Live Status** — HP, prayer, energy, current world, and inactivity detection
- **World Map** — Interactive canvas-based map with player positions, zoom/pan, location labels, and player following
- **Quests & Diaries** — Quest state and achievement diary progress tracking
- **Collection Log** — Full collection log browsing with completion percentages and duplicate counts
- **Boss Kill Counts** — Via Wise Old Man API integration

### Tools & Utilities
- **Banked XP Calculator** — Estimate XP stored across all containers in the group
- **DPS Calculator** — Integrated calculator with equipment loadouts, prayers, potions, and combat styles
- **Grand Exchange Prices** — Background-cached GE price data

### Technical Highlights
- **Rust backend** (Actix-web) with batched update processing and real-time event broadcasting
- **PostgreSQL** persistence with historical skill data aggregation
- **Web Components** frontend with responsive multi-panel dashboard
- **OSRS cache pipeline** — Automated extraction of item data, sprites, map tiles, NPC icons, and collection log structure
- **Docker Compose** deployment with health checks, resource limits, and schema auto-initialization
- **Makefile & PowerShell** tooling for development, testing, linting, cache updates, and image publishing

## What's Changed

Key improvements over the upstream repository:

- Dashboard added
- Expanded tracking: collection log, achievement diaries, seed vault, stash units, boss KC
- Integrated DPS calculator with full equipment and prayer support
- Historical skill XP graphing with configurable time periods
- Banked XP estimation across group containers
- Comprehensive OSRS cache update pipeline (`update-cache.ps1`) with automated item data, sprite, map tile, and equipment stat extraction
- Hardened Docker Compose stack with health checks, resource limits, and structured logging
- Makefile with targets for dev, lint, test, coverage, build, cache update, and publishing
- Wise Old Man API integration for boss kill counts and activity data


Dashboard
<img width="1919" height="962" alt="image" src="https://github.com/user-attachments/assets/98298526-d107-4831-8ff0-72a4eba7f90f" />

DPS
<img width="1620" height="811" alt="image" src="https://github.com/user-attachments/assets/dc672a95-e60e-468b-bbc2-526c737b096d" />

Banked EXP
<img width="1608" height="962" alt="image" src="https://github.com/user-attachments/assets/94063cc9-cae9-4028-9358-c8f67e4a0e36" />

Events
<img width="1568" height="916" alt="image" src="https://github.com/user-attachments/assets/174f9cbc-be51-47b4-8f2a-4d88f2303d84" />

Blog
<img width="1595" height="972" alt="image" src="https://github.com/user-attachments/assets/5400cb13-d574-4c4e-897f-26745c873132" />

Clues
<img width="1612" height="966" alt="image" src="https://github.com/user-attachments/assets/788da914-6397-4975-b932-093005217f54" />


DISCORD
-----
Item Requests
<img width="633" height="236" alt="image" src="https://github.com/user-attachments/assets/a5e0c573-04af-48ba-88e9-137de8b409b5" />

Event Notifications
<img width="409" height="270" alt="image" src="https://github.com/user-attachments/assets/195f3cba-3c11-4780-85af-6ba0f9d9eb8a" />


---

## Self-Hosting

You can self-host the frontend and backend instead of using [groupiron.men](https://groupiron.men). In the RuneLite plugin settings, set the URL to your hosted instance. Leaving it blank defaults to `https://groupiron.men`.

![Plugin settings](https://i.imgur.com/0JFD7D5.png)

### Prerequisites

- [Docker](https://docs.docker.com/get-docker/)
- [Docker Compose](https://docs.docker.com/compose/install/)

### Quick Start (Docker Compose)

1. Copy `docker-compose.yml`, `.env.example`, and `server/src/sql/schema.sql` to your server.

2. Create a `.env` file from the example and fill in your secrets:
   ```sh
   cp .env.example .env
   ```
   See the comments in `.env.example` for an explanation of each variable.

3. Verify the `schema.sql` path in `docker-compose.yml` points to your copy of the file.

4. Start the stack:
   ```sh
   docker compose up -d
   ```

The frontend will be available on port **4000** and the backend on port **5000** (configurable in the compose file).

### Without Docker Compose

If you prefer to manage containers individually, set up a PostgreSQL database manually, then run each image with the required environment variables:

```sh
docker run -d -e HOST_URL=<your-url> <frontend-image>
```

```sh
docker run -d \
  -e PG_USER=<user> \
  -e PG_PASSWORD=<password> \
  -e PG_HOST=<host> \
  -e PG_PORT=<port> \
  -e PG_DB=<database> \
  -e BACKEND_SECRET=<secret> \
  <backend-image>
```

The backend listens on port **8081** and the frontend on port **4000**.

### Publishing Custom Docker Images

Build and publish your own images using the helper script:

```powershell
./scripts/publish-docker.ps1 -ImagePrefix your-dockerhub-user -Tag latest -Push
```

Or via Make:

```sh
make docker-publish IMAGE_PREFIX=your-dockerhub-user TAG=latest PUSH=1
```

For registries that require a hostname prefix:

```powershell
./scripts/publish-docker.ps1 -ImagePrefix ghcr.io/your-org -Tag latest -Push
```

Images are tagged as:

```
<image-prefix>/group-ironmen-tracker-frontend:<tag>
<image-prefix>/group-ironmen-tracker-backend:<tag>
```

Linux `amd64` is the default platform. Override with `-Platform linux/arm64` if needed.

After publishing, set `FRONTEND_IMAGE`, `BACKEND_IMAGE`, and `IMAGE_TAG` in your `.env` to use your custom images with `docker compose up -d`.

---

## Development

```sh
make dev       # Start local dev stack (Docker DB + Cargo server + npm frontend)
make lint      # Run all linters
make test      # Run all tests
make clean     # Remove build artifacts
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

## License

BSD 2-Clause — see [LICENSE](LICENSE). Original work copyright (c) 2022, Christopher Brown.
