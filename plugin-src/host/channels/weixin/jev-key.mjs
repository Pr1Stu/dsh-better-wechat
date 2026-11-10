import { randomUUID } from 'node:crypto';
import { mkdir, readFile, rename, rm, writeFile } from 'node:fs/promises';
import { homedir } from 'node:os';
import { dirname, join } from 'node:path';

export const SET_JEV_KEY = 'router.jev-key.set';

export function jevKeyPath(config) {
  return config.sessionRouter?.jevKeyFile ?? process.env.DSH_IM_JEV_KEY_FILE
    ?? join(config.dataDir ?? join(config.dshHome ?? process.env.DSH_HOME ?? join(homedir(), '.dsh'),
      'integrations', 'dsh-weixin'), 'session-router', 'jev.key');
}

export function validJevKey(value) {
  return typeof value === 'string' && value.length > 0 && value.length <= 1024 && !/\s/.test(value);
}

export async function readJevKey(path) {
  try {
    const key = (await readFile(path, 'utf8')).trim();
    return validJevKey(key) ? key : null;
  } catch (error) {
    if (error?.code === 'ENOENT') return null;
    throw error;
  }
}

/** Only the suffix reaches the settings page; the full key stays on the Host. */
export function jevKeyPreview(key) {
  if (typeof key !== 'string' || !key) return '';
  return key.length <= 4 ? '••••' : `••••${key.slice(-4)}`;
}

export async function saveJevKey(path, key) {
  if (!validJevKey(key)) throw new TypeError('Invalid Jev API key');
  await mkdir(dirname(path), { recursive: true, mode: 0o700 });
  const temporary = `${path}.${randomUUID()}`;
  try {
    await writeFile(temporary, key, { mode: 0o600, flag: 'wx' });
    await rename(temporary, path);
  } finally {
    await rm(temporary, { force: true }).catch(() => {});
  }
}
