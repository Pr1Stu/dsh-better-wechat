import { readFile } from 'node:fs/promises';

await readFile(0);
process.stdout.write(JSON.stringify(Math.random() < 0.5));
