import * as React from 'react';

import { SimWeixinLogoGlyph } from './channel-logos.js';
import { h } from './i18n.js';

/** Informational access-point page: the simulator runs in its own repository. */
export function SimWeixinSettings() {
  return h('section', { className: 'dxw-page dxw-jevPage', 'aria-label': '模拟微信接入点' },
    h('header', { className: 'dxw-jevHeader' },
      h('span', { className: 'dxw-eyebrow' }, '接入点'),
      h('h2', null, '模拟微信'),
      h('p', null, '与微信并列的本地模拟接入点，用于在独立仓库中运行和调试标准 iLink 协议。')),
    h('div', { className: 'dxw-card' },
      h('div', { className: 'dxw-cardBody' },
        h('div', { className: 'dxw-jevSwitchRow' },
          h('div', null,
            h('h3', null, '独立模拟服务'),
            h('p', { className: 'dxw-jevHint' }, '模拟微信不随本插件启动；请从 dsh-sim-weixin 仓库启动，再通过标准地址接入。')),
          h('span', { className: 'dxw-badge' },
            h('span', { className: 'dxw-dot', 'data-tone': 'success' }),
            h('span', null, '标准 iLink'))),
        h('div', { className: 'dxw-simBrand', 'aria-hidden': 'true' },
          h(SimWeixinLogoGlyph, { size: 44 })),
        h('p', { className: 'dxw-jevLabel' }, '模拟器地址'),
        h('code', { className: 'dxw-simAddress' }, 'http://127.0.0.1:42049/'),
        h('div', { className: 'dxw-actions' },
          h('a', {
            className: 'dxw-button', href: 'http://127.0.0.1:42049/',
            target: '_blank', rel: 'noopener noreferrer',
          }, '打开模拟微信'),
          h('a', {
            className: 'dxw-button',
            href: 'https://github.com/Pr1Stu/dsh-better-wechat/blob/main/docs/sim-weixin.md',
            target: '_blank', rel: 'noopener noreferrer',
          }, '查看接入说明')))),
    h('div', { className: 'dxw-card' },
      h('div', { className: 'dxw-cardBody' },
        h('h3', null, '启动方式'),
        h('p', { className: 'dxw-jevHint' }, '在独立仓库中运行模拟器，或将其作为单独的 DSH 插件加载。'),
        h('pre', { className: 'dxw-simCommand' }, 'node src/cli.mjs --port 42049 --token mock-token'),
        h('p', { className: 'dxw-jevHint' }, '插件只使用标准 iLink 端点，不会向模拟微信发送对话切换或路由事件。'))));
}
