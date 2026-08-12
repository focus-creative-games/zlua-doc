/** Guide learning-path order (matches guides/ sidebar_position). */
export type GuideNavItem = {
  slug: string;
  title: string;
  titleEn: string;
};

export const GUIDE_NAV: GuideNavItem[] = [
  {slug: 'install', title: '安装与 Lua 版本', titleEn: 'Install & Lua version'},
  {slug: 'hello-interop', title: '初始化与最小互调', titleEn: 'Init & minimal interop'},
  {slug: 'build', title: '构建流程', titleEn: 'Build pipeline'},
  {slug: 'debugger', title: 'EmmyLua 调试器', titleEn: 'EmmyLua debugger'},
  {slug: 'lua-calling-csharp', title: 'Lua 调用 C#', titleEn: 'Lua calling C#'},
  {slug: 'csharp-calling-lua', title: 'C# 调用 Lua', titleEn: 'C# calling Lua'},
  {slug: 'value-types', title: '值类型', titleEn: 'Value types'},
  {slug: 'functions', title: 'Function 与 Delegate', titleEn: 'Function & Delegate'},
  {slug: 'arrays', title: '数组', titleEn: 'Arrays'},
  {slug: 'generics', title: '泛型', titleEn: 'Generics'},
  {slug: 'ref-out-in', title: 'ref / in / out', titleEn: 'ref / in / out'},
  {slug: 'lua-marshal-as', title: 'LuaMarshalAs', titleEn: 'LuaMarshalAs'},
  {slug: 'zero-gc-marshal', title: '0GC Marshal', titleEn: '0GC Marshal'},
  {slug: 'overloads', title: '方法重载', titleEn: 'Method overloads'},
  {slug: 'lua-alias', title: 'LuaAlias', titleEn: 'LuaAlias'},
  {slug: 'extension-methods', title: 'Extension 方法', titleEn: 'Extension methods'},
  {slug: 'zlua-lib', title: '常用 zlua 库', titleEn: 'Common zlua APIs'},
  {slug: 'native-modules', title: '第三方原生插件', titleEn: 'Third-party native modules'},
  {slug: 'migration', title: '迁移指南', titleEn: 'Migration'},
  {slug: 'troubleshooting', title: '排错指南', titleEn: 'Troubleshooting'},
  {slug: 'editor-vs-player', title: 'Editor 与 Player', titleEn: 'Editor vs Player'},
];

export const GUIDE_NAV_EN: GuideNavItem[] = GUIDE_NAV.map((item) => ({
  ...item,
  title: item.titleEn,
}));

export const QUICK_START: GuideNavItem = {
  slug: '../getting-started/quick-start',
  title: '快速开始',
  titleEn: 'Quick start',
};

export const DESIGN_OVERVIEW: GuideNavItem = {
  slug: '../concepts/design-overview',
  title: '设计概览',
  titleEn: 'Design overview',
};
