import assert from 'node:assert/strict';
import { access, readFile, readdir, stat } from 'node:fs/promises';
import { resolve } from 'node:path';
import { pathToFileURL } from 'node:url';

const root = resolve(import.meta.dirname, '..');
const required = [
  'lib/index.js',
  'lib/client.js',
  'bin/dsh-im.mjs',
  'cordis.patch.yml',
  'README.md',
  'README.en.md',
  'CONTEXT.md',
  'PROACTIVE_DELIVERY.md',
  'PROACTIVE_DELIVERY.en.md',
  'docs/README.md',
  'docs/bot-commands.md',
  'docs/client-integration.md',
  'examples/weixin-router/README.md',
  'examples/weixin-router/jev-classify.mjs',
  'plugin-src/client/channels/weixin/index.js',
  'plugin-src/host/channels/weixin/index.mjs',
  'src/channels/weixin/weixin-runtime.mjs',
];
await Promise.all(required.map((path) => access(resolve(root, path))));

async function folders(path) {
  return (await readdir(resolve(root, path), { withFileTypes: true }))
    .filter((entry) => entry.isDirectory())
    .map((entry) => entry.name)
    .sort();
}

for (const path of [
  'plugin-src/client/channels',
  'plugin-src/host/channels',
  'src/channels',
  'test/channels',
]) {
  assert.deepEqual(await folders(path), ['shared', 'weixin'], `${path} must contain only shared code and Weixin`);
}

const [manifestText, lockText, hostSource, clientSource, host, client, patch] = await Promise.all([
  readFile(resolve(root, 'package.json'), 'utf8'),
  readFile(resolve(root, 'package-lock.json'), 'utf8'),
  readFile(resolve(root, 'plugin-src/host/index.mjs'), 'utf8'),
  readFile(resolve(root, 'plugin-src/client/index.js'), 'utf8'),
  readFile(resolve(root, 'lib/index.js'), 'utf8'),
  readFile(resolve(root, 'lib/client.js'), 'utf8'),
  readFile(resolve(root, 'cordis.patch.yml'), 'utf8'),
]);
const manifest = JSON.parse(manifestText);
const lock = JSON.parse(lockText);

assert.equal(lock.packages?.['']?.version, manifest.version, 'package lock version must match package.json');
assert.equal(manifest.bin?.['dsh-im'], 'bin/dsh-im.mjs');
assert.ok(manifest.files.includes('examples/weixin-router'));
assert.ok(manifest.files.includes('scripts/verify-package.mjs'));
assert.match(hostSource, /applyWeixin/u);
assert.doesNotMatch(hostSource, /apply(?:Feishu|Dingtalk|Wecom|Qq|Slack|Telegram|Discord|Whatsapp|Matrix|IMessage|Email|Office)/u);
assert.match(clientSource, /id: 'weixin'/u);
assert.match(clientSource, /id: 'jev'/u);
assert.doesNotMatch(clientSource, /channels\/(?:feishu|dingtalk|wecom|qq|slack|telegram|discord|whatsapp|matrix|imessage|office|email)\//u);
assert.match(host, /router\.jev-key\.set/u);
assert.match(host, /\/weixin/u);
assert.match(client, /Jev API Key/u);
assert.match(client, /xmanrui-dsh-im/u);
assert.ok(patch.includes("name: '@xmanrui/dsh-im'"));

const removedPackages = [
  '@matrix-org/olm', '@tencent-connect/qqbot-connector', '@tencent-connect/qqbot-nodejs',
  '@wecom/aibot-node-sdk', '@larksuiteoapi/node-sdk', '@whiskeysockets/baileys',
  'dingtalk-stream', 'imapflow', 'mailparser', 'nodemailer', 'https-proxy-agent',
];
for (const name of removedPackages) {
  for (const section of ['dependencies', 'devDependencies', 'optionalDependencies']) {
    assert.equal(manifest[section]?.[name], undefined, `${name} must not remain in ${section}`);
  }
  assert.equal(lock.packages?.[`node_modules/${name}`], undefined, `${name} must not remain in the lockfile`);
}
for (const section of ['dependencies', 'devDependencies', 'optionalDependencies', 'peerDependencies']) {
  for (const name of Object.keys(manifest[section] ?? {})) {
    assert.ok(!/^@deepseek-ai\/dsh-/u.test(name), `${name} must be provided by the DSH Host`);
  }
}
assert.equal(manifest.dependencies?.qrcode, '1.5.4');
assert.equal(manifest.dependencies?.undici, '7.30.1');
assert.doesNotMatch(host + client, /private-bot-token|must-be-rolled-back|DEEPSEEK_API_KEY=/u);

if (process.platform !== 'win32') {
  assert.notEqual((await stat(resolve(root, 'bin/dsh-im.mjs'))).mode & 0o111, 0, 'CLI must be executable');
}

const { createImHostPlugin } = await import(pathToFileURL(resolve(root, 'lib/index.js')).href);
let deliveryApi;
await createImHostPlugin().apply({
  provide(name, service) {
    if (name === 'dshIm') deliveryApi = service;
  },
  inject() {},
});
assert.equal(typeof deliveryApi?.createTarget, 'function', 'Host must expose dshIm.createTarget');

console.log('Verified Weixin-only dsh-im package artifacts.');
