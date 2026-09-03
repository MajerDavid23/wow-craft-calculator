import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { CraftModule } from './craft/craft.module.js';

@Module({
  imports: [
    ConfigModule.forRoot({ isGlobal: true }), // <--- EZT A SORT MÓDOSÍTSD
    CraftModule,
  ],
})
export class AppModule {}