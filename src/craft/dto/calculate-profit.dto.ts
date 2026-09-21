export class MaterialRankAllocationDto {
  rank!: number;
  quantity!: number;
}

export class CalculateProfitDto {
  salePrice?: number;
  materialCost?: number;
  quantity?: number;
  /** Which rank of the finished craft to price for revenue. Defaults to 1. */
  outputRank?: number;
  /**
   * Per-material rank breakdown, keyed by material name (see `GET /craft/recipes`
   * for valid names/ranks). Each entry lists how many of a given rank to use for
   * that material, e.g. `{ "Sunglass Vial": [{ "rank": 2, "quantity": 2 }, { "rank": 1, "quantity": 3 }] }`.
   * The quantities for a material must add up to that material's total required
   * amount (recipe quantity × `quantity`). Materials left out default to rank 1
   * for their full required amount.
   */
  materialRanks?: Record<string, MaterialRankAllocationDto[]>;
}
