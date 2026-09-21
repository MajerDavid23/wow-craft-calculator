# WoW Craft Calculator

A small NestJS API for estimating WoW crafting profit margins: it pulls live Auction House commodity prices from the Blizzard API and computes `revenue - material cost` for a recipe, with support for the two-quality-rank system introduced in WoW: Midnight and an expected-value Multicraft adjustment.

## What it does

- Fetches live commodity prices from the Blizzard API (region-configurable).
- Calculates profit for a recipe: revenue from the crafted item minus the cost of its reagents.
- Models the 2 quality ranks (Rank 1 / Rank 2) that materials and finished crafts have — each rank is a distinct item ID on the Auction House, not just a quality flag.
- Lets you mix ranks *within* a single material (e.g. 2× Rank 2 Sunglass Vial + 3× Rank 1), not just pick one rank for the whole craft.
- Folds an expected-value Multicraft bonus directly into revenue/profit, based on your own character's Multicraft %.
- Publishes a price snapshot to Kafka every time it fetches AH prices, as an optional, non-blocking side channel (the API works fine with no broker running).
- Keeps a small in-memory rolling history of recent prices per item, built by consuming that same Kafka topic, queryable via `GET /craft/prices`.

## Requirements

- Node.js 24+
- A Blizzard API client ID/secret — create one at [develop.battle.net](https://develop.battle.net/)
- Docker (optional — only needed if you want to run the Kafka broker locally)

## Setup

```bash
npm install
```

Create a `.env` file in the project root:

```
BLIZZARD_CLIENT_ID=<your client id>
BLIZZARD_CLIENT_SECRET=<your client secret>
BLIZZARD_REGION=eu

# optional - only used if you're running the Kafka broker
KAFKA_BROKERS=localhost:9092
KAFKA_PRICE_TOPIC=wow-craft.item-prices
```

Run it:

```bash
npm run start:dev
```

The API listens on `http://localhost:3000` (override with `PORT`).

## API

### `GET /craft/recipes`

Lists available recipes, their valid output ranks, and each material's name/quantity/valid ranks — use this to know what to pass to `materialRanks`.

### `POST /craft/recipes/:recipeKey/profit`

Calculates profit for a recipe using live AH prices.

**Body (all fields optional):**

| Field | Type | Default | Description |
|---|---|---|---|
| `quantity` | number | `1` | How many crafts to calculate for. Everything below scales with this. |
| `outputRank` | `1` \| `2` | `1` | Which rank of the finished item to price for revenue. |
| `materialRanks` | `{ [materialName]: { rank, quantity }[] }` | — | Per-material rank breakdown. Quantities for a material must sum to its total required amount (`recipe quantity × quantity`). Materials left out default to 100% Rank 1. |
| `multicraftChance` | number (0–100) | — | Your Multicraft proc chance %. When given, the expected-value bonus (cost-free extra items) is folded directly into `revenue`/`profit`, and a `multicraft` breakdown is added to the response. |

**Example — defaults (Rank 1 everything):**
```json
POST /craft/recipes/silvermoon-health-potion/profit
{}
```

**Example — Rank 2 output, mixed-rank materials, your real Multicraft chance:**
```json
POST /craft/recipes/silvermoon-health-potion/profit
{
  "outputRank": 2,
  "materialRanks": {
    "Sunglass Vial": [
      { "rank": 2, "quantity": 2 },
      { "rank": 1, "quantity": 3 }
    ]
  },
  "multicraftChance": 34
}
```

**Response shape:**
```json
{
  "recipe": "Silvermoon Health Potion",
  "outputRank": 1,
  "revenue": 21.06,
  "multicraft": {
    "chancePercent": 34,
    "multicraftAmount": 3,
    "multicraftExtraProfit": 8.37
  },
  "materialCost": 20.79,
  "profit": 0.27,
  "materials": [
    { "name": "Tranquility Bloom", "rank": 1, "quantity": 6, "itemId": 236761, "unitPrice": 0.99, "cost": 5.94 },
    { "name": "Sunglass Vial", "rank": 1, "quantity": 5, "itemId": 240991, "unitPrice": 2.97, "cost": 14.85 }
  ]
}
```
(`multicraft` is only present when `multicraftChance` was given; the bonus it describes is already included in `revenue`/`profit`, not on top of it.)

### `POST /craft/profit`

Standalone calculator that doesn't touch the Blizzard API — pass `salePrice`, `materialCost`, and `quantity` directly. Useful for a quick manual check.

### `GET /craft/price-test`

Sanity-check endpoint that fetches the live price of a single hardcoded item (Tranquility Bloom).

### `GET /craft/prices`

Returns the in-memory price history built from consuming the Kafka price-snapshot topic, keyed by item ID (up to the last 20 entries per item). Empty (`{}`) if Kafka isn't running or nothing's been published yet — see [Kafka](#kafka-optional) below.

```json
{
  "236761": [
    { "priceGold": 0.99, "fetchedAt": "2026-09-21T12:26:32.729Z" },
    { "priceGold": 0.99, "fetchedAt": "2026-09-21T12:26:36.733Z" }
  ]
}
```

## Adding a new recipe

Recipes live in `src/craft/recipes/` (see `silvermoon-health-potion.recipe.ts` for the shape) and are registered in `src/craft/recipes/index.ts`. Each material and the output need an item ID **per rank**.

To find rank item IDs: search `"<material name>" wowhead item id` for candidates, then confirm which candidate is which rank by price — **Rank 2 must price higher than Rank 1 for the same material**. Fetch both IDs from `/data/wow/auctions/commodities` (or check the in-game tooltip's "Rank" line) rather than trusting a third-party site's label at face value — that sanity check caught a real bug once already (a site had Sunglass Vial's ranks backwards).

## The Multicraft math

`multicraftChance` uses an expected-value formula sourced from community testing (not an official Blizzard formula): `1% Multicraft ≈ +1.5% expected output value`. Concretely:

```
expectedTotalItems = baseItems × (1 + multicraftChance/100 × 1.5)
```

This is an *average*, not a per-craft simulation — any single craft has real variance around it (a 34% chance doesn't mean "34% chance of exactly this many items"; it means a proc, which happens some fraction of crafts, averages a much bigger bonus, and the formula above is the expected value across many crafts). Your Multicraft/Resourcefulness rating-to-% conversion is also gear-dependent — read the actual % off your own profession window rather than guessing.

Resourcefulness is not implemented yet.

## Kafka (optional)

Price snapshots are published to Kafka on every AH fetch, and the app also consumes that same topic itself to build the in-memory history behind `GET /craft/prices`. None of this is required — the app works completely fine with no broker running; connection/publish/consume failures are all caught and logged as a warning, never thrown.

To run it locally:

```bash
docker compose up -d      # starts a single-node Kafka broker (KRaft mode) on localhost:9092
npm run kafka:tail        # (optional) watches the wow-craft.item-prices topic from a separate process and pretty-prints messages
```

The in-app consumer (`PriceHistoryService`) starts automatically with the app — no extra step needed for `GET /craft/prices` to start populating once the broker is up. Its history is in-memory only (nothing persists to disk), and resets whenever the app restarts.

## Testing

```bash
npm test          # unit tests (Blizzard API and Kafka are mocked)
npm run test:e2e  # boots the full app
npm run test:cov  # with coverage
```

## Project structure

```
src/
  blizzard-api.service.ts       # Blizzard OAuth + commodity price fetching
  kafka/
    kafka-producer.service.ts   # thin, failure-tolerant Kafka producer wrapper
    price-history.service.ts    # consumes the price topic into an in-memory rolling window
  craft/
    craft.controller.ts         # HTTP routes
    craft.service.ts            # profit calculation logic (ranks, splits, Multicraft)
    dto/calculate-profit.dto.ts
    guards/recipe.guard.ts      # validates :recipeKey against known recipes
    recipes/                    # recipe definitions (item IDs per rank)
scripts/
  kafka-tail.mjs                 # standalone consumer for manually watching the price topic
docker-compose.yml               # local Kafka broker
```

## Known limitations

- Only one recipe exists so far (Silvermoon Health Potion) — it's a proof of concept for the rank/split/Multicraft mechanics, not a full recipe database.
- Targets WoW: Midnight, which was still in beta/PTR at the time this was built — item IDs, prices, and the Multicraft formula above may drift before/after release.
- Resourcefulness isn't factored in yet, only Multicraft.
- The Blizzard OAuth token is cached in memory for the process lifetime with no expiry/refresh handling.
