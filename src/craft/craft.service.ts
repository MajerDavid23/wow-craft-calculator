import { Injectable } from '@nestjs/common';
import { CalculateProfitDto } from './dto/calculate-profit.dto.js';

@Injectable()
export class CraftService {
	calculate(dto: CalculateProfitDto) {
		const quantity = dto.quantity ?? 1;
		const revenue = (dto.salePrice ?? 0) * quantity;
		const profit = revenue - (dto.materialCost ?? 0);

		return { revenue, profit };
	}
}
