import { readFile } from 'node:fs/promises';
import { readFileSync } from 'node:fs';
import routeQuestion from './jev-route-prompt.json' with { type: 'json' };

let stage = 'input';
try {
  const input = JSON.parse(readFileSync(0, 'utf8'));
  stage = 'credentials';
  const keyFile = process.env.DSH_IM_JEV_KEY_FILE;
  let key;
  if (keyFile) {
    try {
      key = (await readFile(keyFile, 'utf8')).trim();
    } catch (error) {
      if (error.code !== 'ENOENT') throw error;
    }
  }
  key ||= process.env.DSH_IM_JEV_API_KEY;
  const threshold = Number(process.env.DSH_IM_JEV_SWITCH_THRESHOLD);
  if (!key || !Number.isFinite(threshold) || threshold <= 0 || threshold > 1) {
    throw new Error('Configure the Jev API key and switch threshold');
  }

  stage = 'fetch';
  const endpoint = process.env.DSH_IM_JEV_ENDPOINT || 'https://api.typesafe.ai/v1/systemone';
  const response = await fetch(endpoint, {
    method: 'POST',
    headers: { Authorization: `Bearer ${key}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({
      model: 'jev-latest',
      state: JSON.stringify(input),
      questions: { route: routeQuestion },
    }),
  });

  if (process.env.DSH_IM_JEV_ROUTE_ID) console.error('jev-http', response.status);
  if (!response.ok) throw new Error(`Jev request failed (${response.status})`);
  stage = 'response';
  const answer = (await response.json()).answers?.route;
  const probability = answer?.probabilities?.switch;
  if (!['continue', 'switch', 'unclear', '/new'].includes(answer?.choice)
    || !Number.isFinite(probability) || probability < 0 || probability > 1) {
    throw new Error('Invalid Jev classification');
  }
  const decision = answer.choice === '/new' ? '/new'
    : answer.choice === 'continue' ? false
    : answer.choice === 'switch' && probability >= threshold ? true : null;
  if (process.env.DSH_IM_JEV_ROUTE_ID) console.error('jev-result', answer.choice, probability, threshold);
  process.stdout.write(JSON.stringify(decision));
} catch (error) {
  const code = error?.cause?.code ?? error?.code ?? error?.name ?? 'unknown';
  if (process.env.DSH_IM_JEV_ROUTE_ID) {
    console.error('jev-error', stage, /^[A-Za-z0-9_-]{1,64}$/.test(code) ? code : 'unknown');
  }
  process.exitCode = 1;
}
