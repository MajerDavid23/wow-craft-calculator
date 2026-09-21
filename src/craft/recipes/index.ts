import { SILVERMOON_HEALTH_POTION_RECIPE } from './silvermoon-health-potion.recipe.js';

export const RECIPES = {
  [SILVERMOON_HEALTH_POTION_RECIPE.key]: SILVERMOON_HEALTH_POTION_RECIPE,
} as const;

export type RecipeKey = keyof typeof RECIPES;

export type RecipeRank = 1 | 2;
