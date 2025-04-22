import { generateKey } from '@libp2p/pnet';
import * as fs from 'fs/promises';
import * as path from 'path';

const SWARM_KEY_FILE = process.env.SWARM_KEY_FILE || '/sp/secrets/SWARM_KEY';

/**
 * Генерирует ключ сети и сохраняет его в файл.
 * Если ключ уже существует, возвращает его.
 */
export async function getOrGenerateSwarmKey(): Promise<string> {
  try {
    // Проверяем, существует ли файл с ключом
    const secretsDir = path.dirname(SWARM_KEY_FILE);
    await fs.mkdir(secretsDir, { recursive: true });

    try {
      // Пытаемся прочитать существующий ключ
      const key = await fs.readFile(SWARM_KEY_FILE, 'utf-8');
      console.log('✅ SWARM_KEY loaded from file');
      return key;
    } catch (err) {
      if ((err as NodeJS.ErrnoException).code === 'ENOENT') {
        // Файл не существует, генерируем новый ключ
        console.log('⚠️ SWARM_KEY not found, generating new...');
        const swarmKey = new Uint8Array(95);
        generateKey(swarmKey);
        const key = Buffer.from(swarmKey).toString('base64');

        // Сохраняем ключ в файл
        await fs.writeFile(SWARM_KEY_FILE, key, 'utf-8');
        console.log('✅ New SWARM_KEY saved to file');
        return key;
      }
      throw err;
    }
  } catch (error) {
    console.error('Error generating/loading SWARM_KEY:', error);
    throw error;
  }
}
