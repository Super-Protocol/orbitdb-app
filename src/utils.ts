import * as fs from 'fs/promises';
import { fromString as uint8ArrayFromString } from 'uint8arrays/from-string';
import { toString as uint8ArrayToString } from 'uint8arrays/to-string';
import { keys } from '@libp2p/crypto';

const privateKeyFile = './keys.json';

export async function loadOrCreatePrivateKey() {
  try {
    const raw = await fs.readFile(privateKeyFile, 'utf-8');
    const json = JSON.parse(raw);
    const privKeyBytes = uint8ArrayFromString(json.privKey, 'base64pad');
    const privateKey = keys.privateKeyFromRaw(privKeyBytes);
    console.log('✅ Приватный ключ загружен из файла');
    return privateKey;
  } catch {
    console.log('⚠️ Приватный ключ не найден, создаём новый...');
    const key = await keys.generateKeyPair('Ed25519', 2048);
    const privKeyBytes = key.raw;
    await fs.writeFile(
      privateKeyFile,
      JSON.stringify(
        {
          privKey: uint8ArrayToString(privKeyBytes, 'base64pad'),
        },
        null,
        2,
      ),
    );
    console.log('✅ Новый приватный ключ сохранён в файл');
    return key;
  }
}
