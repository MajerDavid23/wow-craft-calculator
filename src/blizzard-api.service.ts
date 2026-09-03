import { Injectable, Logger } from '@nestjs/common';
import { HttpService } from '@nestjs/axios';
import { ConfigService } from '@nestjs/config';
import { firstValueFrom } from 'rxjs';

@Injectable()
export class BlizzardApiService {
  private readonly logger = new Logger(BlizzardApiService.name);
  private accessToken: string | null = null;
  private readonly TRANQUILITY_BLOOM_ID = 236761; 

  constructor(
    private readonly httpService: HttpService,
    private readonly configService: ConfigService,
  ) {}

  async getAccessToken(): Promise<string> {
    if (this.accessToken) return this.accessToken;

    const clientId = this.configService.get<string>('BLIZZARD_CLIENT_ID');
    const clientSecret = this.configService.get<string>('BLIZZARD_CLIENT_SECRET');
    const credentials = Buffer.from(`${clientId}:${clientSecret}`).toString('base64');

    try {
      const response = await firstValueFrom(
        this.httpService.post(
          'https://oauth.battle.net/token',
          'grant_type=client_credentials',
          {
            headers: {
              Authorization: `Basic ${credentials}`,
              'Content-Type': 'application/x-www-form-urlencoded',
            },
          }
        )
      );
      
      const accessToken = response.data.access_token as string;
      this.accessToken = accessToken;
      return accessToken;
    } catch (error) {
      this.logger.error('Hiba a Blizzard token lekérésekor', error);
      throw error;
    }
  }

  async getTranquilityBloomPrice(): Promise<number> {
    const token = await this.getAccessToken();
    const region = this.configService.get<string>('BLIZZARD_REGION'); 
    
    const url = `https://${region}.api.blizzard.com/data/wow/auctions/commodities?namespace=dynamic-${region}&locale=en_US`;

    try {
      const response = await firstValueFrom(
        this.httpService.get(url, {
          headers: { Authorization: `Bearer ${token}` },
        })
      );

      const itemAuctions = response.data.auctions.filter(
        (auction: { item: { id: number; }; }) => auction.item.id === this.TRANQUILITY_BLOOM_ID
      );

      if (itemAuctions.length === 0) return 0; 

      let lowestPriceCopper = itemAuctions[0].unit_price;
      for (const auction of itemAuctions) {
        if (auction.unit_price < lowestPriceCopper) {
          lowestPriceCopper = auction.unit_price;
        }
      }

      const lowestPriceGold = lowestPriceCopper / 10000;
      return lowestPriceGold;

    } catch (error) {
      this.logger.error('Hiba az aukciók letöltésekor', error);
      throw error;
    }
  }
}