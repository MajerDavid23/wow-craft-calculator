// Item IDs verified against live Blizzard commodity AH prices (rank 2 must
// price higher than rank 1 for the same material - that's the sanity check,
// since third-party sites have been seen mislabeling which ID is which rank).
// To look up a new material's rank IDs: search "<material name> wowhead item
// id" to find candidate IDs, then confirm rank by price - fetch both IDs from
// the /data/wow/auctions/commodities endpoint (or check the in-game tooltip's
// "Rank" line directly) and assign the cheaper one to rank 1.
export const SILVERMOON_HEALTH_POTION_RECIPE = {
  key: 'silvermoon-health-potion',
  name: 'Silvermoon Health Potion',
  output: {
    quantity: 5,
    ranks: {
      1: { itemId: 241305 },
      2: { itemId: 241304 },
    },
  },
  materials: [
    {
      name: 'Tranquility Bloom',
      quantity: 6,
      ranks: {
        1: { itemId: 236761 },
        2: { itemId: 236767 },
      },
    },
    {
      name: 'Sunglass Vial',
      quantity: 5,
      ranks: {
        1: { itemId: 240991 },
        2: { itemId: 240990 },
      },
    },
  ],
} as const;
