/* eslint-disable @typescript-eslint/no-unsafe-return */
import {
  BaseDatabase,
  DocumentsDatabase,
  OpenDatabaseOptions,
} from '@orbitdb/core';
import { OrbitDBService } from './orbitdb.service.js';
import { Injectable, OnModuleInit } from '@nestjs/common';

@Injectable()
export class Database<T extends { id: string }> implements OnModuleInit {
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

    // this.database.events.on('close', () => {
    //   console.log('close');
    // });

    // this.database.events.on('drop', () => {
    //   console.log('drop');
    // });

    // this.database.events.on('join', (peerId, heads) => {
    //   console.log('join', peerId, heads);
    // });

    // this.database.events.on('update', (entry) => {
    //   console.log('update', entry);
    // });
  }

  async onModuleInit() {
    await this.initPromise;
  }

  async getDatabase(): Promise<BaseDatabase> {
    await this.initPromise;
    return this.database;
  }

  async put(value: T): Promise<T> {
    await this.initPromise;
    await this.database.put({
      ...value,
      _id: value.id || crypto.randomUUID(),
    });
    return value;
  }

  async get(key: string): Promise<T | null> {
    await this.initPromise;
    const result = await this.database.get(key);

    if (result) {
      return result.value as unknown as T;
    }

    return null;
  }

  async all(): Promise<T[]> {
    await this.initPromise;

    const result = await (this.database as any).all();
    return result.map(({ value: { _id, ...offer } }) => ({
      id: _id,
      ...offer,
    }));
  }

  async del(key: string) {
    await this.initPromise;
    await this.database.del(key);
  }
}
