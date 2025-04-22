import { z } from 'zod';

// Схема для IPFS конфигурации
export const ipfsSchema = z.object({
  host: z.string().default('0.0.0.0'),
  tcpPort: z.number().int().positive().default(4001),
  wsPort: z.number().int().positive().default(4002),
});

// Схема для баз данных OrbitDB
export const databasesSchema = z
  .object({
    offers: z.string().default('offers'),
  })
  .catchall(z.string());

// Схема для OrbitDB конфигурации
export const orbitdbSchema = z.object({
  bootstrapNodes: z.string().optional(),
  directory: z.string().default('./data/orbitdb'),
  swarmKey: z.string().optional(),
  databases: databasesSchema.default({ offers: 'offers' }),
});

// Схема для конфигурации приложения
export const appConfigSchema = z.object({
  nodeEnv: z.enum(['development', 'production', 'test']).default('development'),
  port: z.number().int().positive().default(3000),
  runMode: z.enum(['node', 'bootstrap']).default('node'),
  ipfs: ipfsSchema.default({}),
  orbitdb: orbitdbSchema.default({}),
});

// Схема для общей конфигурации
export const configSchema = z.object({
  solution: appConfigSchema,
  data: z.array(z.any()).default([]),
});

// Схема для минимальной конфигурации bootstrap ноды с учетом всех полей
export const bootstrapConfigSchema = appConfigSchema.extend({
  runMode: z.literal('bootstrap'),
  // Остальные поля наследуются от appConfigSchema со значениями по умолчанию
});

// Типы на основе схем
export type IpfsConfig = z.infer<typeof ipfsSchema>;
export type OrbitdbConfig = z.infer<typeof orbitdbSchema>;
export type DatabasesConfig = z.infer<typeof databasesSchema>;
export type AppConfig = z.infer<typeof appConfigSchema>;
export type Config = z.infer<typeof configSchema>;
export type BootstrapConfig = z.infer<typeof bootstrapConfigSchema>;
