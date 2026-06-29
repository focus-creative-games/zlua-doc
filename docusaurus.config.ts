import {themes as prismThemes} from 'prism-react-renderer';
import type {Config} from '@docusaurus/types';
import type * as Preset from '@docusaurus/preset-classic';

const config: Config = {
  title: 'ZLua Docs',
  tagline: 'Unity Il2Cpp 极致优化的现代原生 Lua 方案',

  // favicon: 'img/favicon.ico',

  future: {
    v4: true,
  },

  url: 'https://doc.zlua.cn',
  baseUrl: '/',

  organizationName: 'focus-creative-games',
  projectName: 'zlua-doc',

  onBrokenLinks: 'warn',
  onBrokenMarkdownLinks: 'warn',

  i18n: {
    defaultLocale: 'zh-CN',
    // 英文文档：添加 'en' 至 locales 并创建 i18n/en/ 翻译文件（P5 预留）
    locales: ['zh-CN'],
  },

  markdown: {
    format: 'detect',
    mermaid: true,
  },

  themes: ['@docusaurus/theme-mermaid'],

  plugins: [
    [
      require.resolve('@easyops-cn/docusaurus-search-local'),
      {
        hashed: true,
        language: ['zh', 'en'],
        highlightSearchTermsOnTargetPage: true,
        explicitSearchResultPath: true,
      },
    ],
  ],

  presets: [
    [
      'classic',
      {
        docs: {
          sidebarPath: './sidebars.ts',
          editUrl: 'https://github.com/focus-creative-games/zlua-doc/tree/main/',
        },
        blog: false,
        theme: {
          customCss: './src/css/custom.css',
        },
      } satisfies Preset.Options,
    ],
  ],

  themeConfig: {
    image: 'img/zlua-social-card.jpg',
    colorMode: {
      respectPrefersColorScheme: true,
    },
    navbar: {
      title: 'ZLua Docs',
      logo: {
        alt: 'ZLua Logo',
        src: 'img/logo.svg',
      },
      items: [
        {
          type: 'docSidebar',
          sidebarId: 'docsSidebar',
          position: 'left',
          label: '文档',
        },
        {
          type: 'docSidebar',
          sidebarId: 'architectureSidebar',
          position: 'left',
          label: '架构',
        },
        {
          href: 'https://github.com/focus-creative-games/zlua-demo',
          label: 'Demo',
          position: 'right',
        },
        {
          href: 'https://github.com/focus-creative-games/zlua',
          label: 'GitHub',
          position: 'right',
        },
      ],
    },
    footer: {
      style: 'dark',
      links: [
        {
          title: '文档',
          items: [
            {label: '快速开始', to: '/docs/getting-started/quick-start'},
            {label: '使用指南', to: '/docs/guides/csharp-to-lua'},
            {label: 'API 参考', to: '/docs/reference/overview'},
          ],
        },
        {
          title: '社区',
          items: [
            {
              label: 'GitHub Issues',
              href: 'https://github.com/focus-creative-games/zlua/issues',
            },
            {
              label: 'Discord',
              href: 'https://discord.gg/htmr44jW6A',
            },
            {label: '联系与 FAQ', to: '/docs/community/contact'},
          ],
        },
        {
          title: '更多',
          items: [
            {
              label: 'ZLua 源码',
              href: 'https://github.com/focus-creative-games/zlua',
            },
            {
              label: '示例项目',
              href: 'https://github.com/focus-creative-games/zlua-demo',
            },
          ],
        },
      ],
      copyright: `Copyright © ${new Date().getFullYear()} Code Philosophy. ZLua 采用 MIT 许可证。`,
    },
    prism: {
      theme: prismThemes.github,
      darkTheme: prismThemes.dracula,
      additionalLanguages: ['csharp', 'lua'],
    },
    mermaid: {
      theme: {light: 'neutral', dark: 'dark'},
    },
  } satisfies Preset.ThemeConfig,
};

export default config;
