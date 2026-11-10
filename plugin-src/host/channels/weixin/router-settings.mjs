import { randomUUID } from 'node:crypto';
import { mkdir, readFile, rename, rm, writeFile } from 'node:fs/promises';
import { dirname, join } from 'node:path';

import { jevKeyPath } from './jev-key.mjs';

export const ROUTER_STATUS_ENDPOINT = 'router.status';
export const SET_ROUTER_SETTINGS_ENDPOINT = 'router.settings.set';
export const TEST_JEV_SERVICE_ENDPOINT = 'router.jev.test';

export const DEFAULT_JEV_ENDPOINT = 'https://api.typesafe.ai/v1/systemone';

export function routerSettingsPath(config = {}) {
  return join(dirname(jevKeyPath(config)), 'settings.json');
}

/** Accept only an absolute HTTP(S) URL without embedded credentials. */
export function validJevEndpoint(value) {
  if (typeof value !== 'string' || value.length === 0 || value.length > 2048 || value.trim() !== value) {
    return false;
  }
  let url;
  try {
    url = new URL(value);
  } catch {
    return false;
  }
  return (url.protocol === 'https:' || url.protocol === 'http:')
    && !url.username
    && !url.password;
}

function normalized(value, fallback) {
  return {
    version: 1,
    enabled: typeof value?.enabled === 'boolean' ? value.enabled : fallback.enabled,
    endpoint: validJevEndpoint(value?.endpoint) ? value.endpoint : fallback.endpoint,
  };
}

/**
 * Persist the two settings the smart-switching page owns. The API key stays in
 * its separate owner-only file so a settings reset can never delete it.
 */
export function createRouterSettingsStore(config = {}, { enabled = false } = {}) {
  const path = routerSettingsPath(config);
  const fallback = Object.freeze({
    version: 1,
    enabled,
    endpoint: validJevEndpoint(config.sessionRouter?.endpoint)
      ? config.sessionRouter.endpoint
      : DEFAULT_JEV_ENDPOINT,
  });
  let current = fallback;

  return Object.freeze({
    path,
    defaults: fallback,
    get() {
      return current;
    },
    async load() {
      try {
        current = normalized(JSON.parse(await readFile(path, 'utf8')), fallback);
      } catch {
        // A missing, unreadable or damaged settings file means "keep the
        // defaults"; the page can still save a replacement.
        current = fallback;
      }
      return current;
    },
    async update(patch) {
      if (!patch || typeof patch !== 'object' || Array.isArray(patch)) {
        throw new TypeError('Router settings must be an object');
      }
      const next = { ...current };
      if ('enabled' in patch) {
        if (typeof patch.enabled !== 'boolean') throw new TypeError('enabled must be a boolean');
        next.enabled = patch.enabled;
      }
      if ('endpoint' in patch) {
        if (!validJevEndpoint(patch.endpoint)) throw new TypeError('Invalid Jev endpoint');
        next.endpoint = patch.endpoint;
      }
      const value = normalized(next, fallback);
      await mkdir(dirname(path), { recursive: true, mode: 0o700 });
      const temporary = `${path}.${randomUUID()}`;
      try {
        await writeFile(temporary, JSON.stringify(value), { mode: 0o600, flag: 'wx' });
        await rename(temporary, path);
      } finally {
        await rm(temporary, { force: true }).catch(() => {});
      }
      current = value;
      return current;
    },
  });
}
