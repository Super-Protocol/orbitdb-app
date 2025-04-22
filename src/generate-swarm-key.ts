import { getOrGenerateSwarmKey } from './common/swarm-key.util.js';

async function run() {
  try {
    const swarmKey = await getOrGenerateSwarmKey();
    console.log(
      'SWARM_KEY успешно сгенерирован и сохранен в /sp/secrets/SWARM_KEY',
    );
    console.log('Значение ключа:');
    console.log(swarmKey);
  } catch (error) {
    console.error('Ошибка при генерации SWARM_KEY:', error);
    process.exit(1);
  }
}

await run();
