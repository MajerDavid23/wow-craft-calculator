import {
  BadRequestException,
  CanActivate,
  ExecutionContext,
  Injectable,
} from '@nestjs/common';
import { RECIPES } from '../recipes/index.js';

@Injectable()
export class RecipeGuard implements CanActivate {
  canActivate(context: ExecutionContext): boolean {
    const request = context.switchToHttp().getRequest<{ params: { recipeKey?: string } }>();
    const recipeKey = request.params.recipeKey;

    if (!recipeKey || !(recipeKey in RECIPES)) {
      throw new BadRequestException(`Unknown recipe: ${recipeKey ?? ''}`);
    }

    return true;
  }
}