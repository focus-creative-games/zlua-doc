import {themes as prismThemes} from 'prism-react-renderer';
import type {Config} from '@docusaurus/types';
import type * as Preset from '@docusaurus/preset-classic';

const config: Config = {
  title: 'ZLua Docs',
  tagline: 'Zero-config · Full C# interop · ~2.62× faster than xLua on Il2Cpp',

  favicon: 'img/logo.jpg',

  future: {
    v4: true,
  },

  url: 'https://doc.zlua.cn',
  baseUrl: '/',
  // GitHub Pages + nginx: no trailing slash → 301; keep true to avoid mobile 404s.
  trailingSlash: true,

  organizationName: 'focus-creative-games',
  projectName: 'zlua-doc',

  onBrokenLinks: 'throw',

  markdown: {
    format: 'detect',
    mermaid: true,
    hooks: {
      onBrokenMarkdownLinks: 'throw',
    },
  },

  i18n: {
    defaultLocale: 'zh-CN',
    locales: ['zh-CN', 'en'],
    localeConfigs: {
      'zh-CN': {label: '中文', htmlLang: 'zh-CN'},
      en: {label: 'English', htmlLang: 'en'},
    },
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
          // Keep numbered filenames in URLs so synced Docs links (00-OVERVIEW etc.) resolve.
          numberPrefixParser: false,
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
        src: 'img/logo.jpg',
      },
      items: [
        {
          type: 'docSidebar',
          sidebarId: 'docsSidebar',
          position: 'left',
          label: 'Docs',
        },
        {
          type: 'docSidebar',
          sidebarId: 'architectureSidebar',
          position: 'left',
          label: 'Architecture',
        },
        {
          type: 'localeDropdown',
          position: 'right',
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
          title: 'Docs',
          items: [
            {label: 'Comparison', to: '/docs/category/compare/'},
            {label: 'Spec', to: '/docs/category/spec/'},
            {label: 'Quick start', to: '/docs/getting-started/quick-start/'},
            {label: 'Guides', to: '/docs/guides/install/'},
            {label: 'API reference', to: '/docs/reference/overview/'},
          ],
        },
        {
          title: 'Community',
          items: [
            {
              label: 'GitHub Issues',
              href: 'https://github.com/focus-creative-games/zlua/issues',
            },
            {
              label: 'Discord',
              href: 'https://discord.gg/htmr44jW6A',
            },
            {label: 'Contact & FAQ', to: '/docs/community/contact/'},
          ],
        },
        {
          title: 'More',
          items: [
            {
              label: 'ZLua source',
              href: 'https://github.com/focus-creative-games/zlua',
            },
            {
              label: 'Demo project',
              href: 'https://github.com/focus-creative-games/zlua-demo',
            },
          ],
        },
      ],
      copyright: `Copyright © ${new Date().getFullYear()} Code Philosophy. ZLua is MIT-licensed.`,
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
