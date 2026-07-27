/** 使用指南学习路径顺序（与 guides/ sidebar_position 一致） */
export type GuideNavItem = {
  slug: string;
  title: string;
};

export const GUIDE_NAV: GuideNavItem[] = [
  {slug: 'install', title: '安装与 Lua 版本'},
  {slug: 'hello-interop', title: '初始化与最小互调'},
  {slug: 'build', title: '构建流程'},
  {slug: 'debugger', title: 'EmmyLua 调试器'},
  {slug: 'lua-calling-csharp', title: 'Lua 调用 C#'},
  {slug: 'csharp-calling-lua', title: 'C# 调用 Lua'},
  {slug: 'value-types', title: '值类型与基础 0GC'},
  {slug: 'functions', title: 'Function 与 Delegate'},
  {slug: 'arrays', title: '数组'},
  {slug: 'generics', title: '泛型'},
  {slug: 'ref-out-in', title: 'ref / in / out'},
  {slug: 'lua-marshal-as', title: 'LuaMarshalAs 与高级 0GC'},
  {slug: 'overloads', title: '方法重载'},
  {slug: 'zlua-lib', title: '常用 zlua 库'},
  {slug: 'migration', title: '迁移指南'},
  {slug: 'troubleshooting', title: '排错指南'},
  {slug: 'editor-vs-player', title: 'Editor 与 Player'},
];

export const QUICK_START: GuideNavItem = {
  slug: '../getting-started/quick-start',
  title: '快速开始',
};

export const DESIGN_OVERVIEW: GuideNavItem = {
  slug: '../concepts/design-overview',
  title: '设计概览',
};
