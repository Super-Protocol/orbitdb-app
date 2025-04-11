import {
  BaseDatabase,
  DocumentsDatabase,
  OpenDatabaseOptions,
} from '@orbitdb/core';
import { OrbitDBService } from './orbitdb.service.js';
import { Injectable, OnModuleInit } from '@nestjs/common';

@Injectable()
export class Database implements OnModuleInit {
  private database: DocumentsDatabase;
  private initPromise: Promise<void>;

  constructor(
    private readonly orbitdbService: OrbitDBService,
    private readonly name: string,
    private readonly options?: OpenDatabaseOptions,
  ) {
    this.initPromise = this.initialize();
  }

  private async initialize() {
    this.database = (await this.orbitdbService.openDatabase(
      this.name,
      this.options,
    )) as DocumentsDatabase;
  }

  async onModuleInit() {
    await this.initPromise;
  }

  async getDatabase(): Promise<BaseDatabase> {
    await this.initPromise;
    return this.database;
  }

  async put(value: any) {
    await this.initPromise;
    return this.database.put(value);
  }

  async get(key: string) {
    await this.initPromise;
    const result = await this.database.get(key);

    if (result) {
      return result.value as unknown as Record<string, unknown>;
    }

    return null;
  }
}
