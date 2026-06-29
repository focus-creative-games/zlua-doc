/** 使用指南学习路径顺序（与 guides/ sidebar_position 一致） */
export type GuideNavItem = {
  slug: string;
  title: string;
};

export const GUIDE_NAV: GuideNavItem[] = [
  {slug: 'csharp-to-lua', title: 'C# 调用 Lua'},
  {slug: 'lua-to-csharp-basics', title: 'Lua 访问 C# 基础'},
  {slug: 'fields-and-properties', title: '字段与属性'},
  {slug: 'methods-and-overloads', title: '方法重载'},
  {slug: 'callbacks-and-delegates', title: '回调与 Delegate'},
  {slug: 'generics-and-arrays', title: '泛型与数组'},
  {slug: 'marshal-ref-out-in', title: 'ref / out / in'},
  {slug: 'lua-module-loading', title: 'Lua 模块加载'},
  {slug: 'events', title: 'Event'},
  {slug: 'enums-and-structs', title: 'enum 与 struct'},
  {slug: 'troubleshooting', title: '排错指南'},
  {slug: 'editor-vs-player', title: 'Editor 与 Player'},
  {slug: 'best-practices', title: '最佳实践'},
];

export const QUICK_START: GuideNavItem = {
  slug: '../getting-started/quick-start',
  title: '快速开始',
};

export const DESIGN_OVERVIEW: GuideNavItem = {
  slug: '../concepts/design-overview',
  title: '设计概览',
};
