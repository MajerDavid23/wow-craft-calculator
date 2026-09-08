import { BadRequestException, ExecutionContext } from '@nestjs/common';
import { RecipeGuard } from './recipe.guard.js';

describe('RecipeGuard', () => {
  const guard = new RecipeGuard();

  function contextWithRecipeKey(recipeKey: string): ExecutionContext {
    return {
      switchToHttp: () => ({
        getRequest: () => ({ params: { recipeKey } }),
      }),
    } as ExecutionContext;
  }

  it('allows a registered recipe', () => {
    expect(guard.canActivate(contextWithRecipeKey('silvermoon-health-potion'))).toBe(true);
  });

  it('rejects an unknown recipe', () => {
    expect(() => guard.canActivate(contextWithRecipeKey('unknown-recipe'))).toThrow(
      BadRequestException,
    );
  });
});
