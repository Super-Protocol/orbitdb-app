import { Inject } from '@nestjs/common';

export const ORBITDB_DATABASE_TOKEN = 'ORBITDB_DATABASE_TOKEN';

export function InjectDatabase(name: string) {
  return Inject(`${ORBITDB_DATABASE_TOKEN}_${name}`);
}
