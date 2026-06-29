import type {ReactNode} from 'react';
import clsx from 'clsx';
import Link from '@docusaurus/Link';
import useDocusaurusContext from '@docusaurus/useDocusaurusContext';
import Layout from '@theme/Layout';
import Tabs from '@theme/Tabs';
import TabItem from '@theme/TabItem';
import HomepageFeatures from '@site/src/components/HomepageFeatures';
import RuntimeBadge from '@site/src/components/RuntimeBadge';
import Heading from '@theme/Heading';

import styles from './index.module.css';

function HomepageHeader() {
  const {siteConfig} = useDocusaurusContext();
  return (
    <header className={clsx('hero hero--primary', styles.heroBanner)}>
      <div className="container">
        <Heading as="h1" className="hero__title">
          {siteConfig.title}
          <span className="badgeAlpha">Alpha</span>
        </Heading>
        <p className="hero__subtitle">{siteConfig.tagline}</p>
        <div className={styles.runtimeRow}>
          <RuntimeBadge />
        </div>
        <div className={styles.buttons}>
          <Link
            className="button button--secondary button--lg"
            to="/docs/getting-started/quick-start">
            5 分钟快速开始
          </Link>
          <Link
            className="button button--outline button--secondary button--lg"
            href="https://github.com/focus-creative-games/zlua-demo">
            查看 Demo
          </Link>
        </div>
        <p className={styles.heroMeta}>
          Unity 2022.3 · Lua 5.4
        </p>
      </div>
    </header>
  );
}

const CSHARP_INVOKE_CSHARP = `// Bootstrap.cs
[RuntimeInitializeOnLoadMethod(RuntimeInitializeLoadType.BeforeSceneLoad)]
private static void InitZLuaOnStartup()
{
    LuaAppDomain.Initialize(LoadLuaModule);
}

[LuaInvoke("app", "main")]
private static extern void AppMain();

[LuaInvoke("app", "add")]
private static extern int AppAdd(int a, int b);`;

const CSHARP_INVOKE_LUA = `-- app.lua
local function main()
    print("lua main start")
end

local function add(a, b)
    return a + b
end

return {
    main = main,
    add = add,
}`;

const LUA_TO_CSHARP = `CSharp['AC'] = CSharp['Assembly-CSharp']

local function main()
    local demo = CSharp.AC.Demo()
    demo.x = 10
    print("Demo.Add:", CSharp.AC.Demo.Add(3, 5))
end

return { main = main }`;

function CodePreview() {
  return (
    <section className={clsx('container', styles.codePreview)}>
      <Heading as="h2" className={styles.codePreviewTitle}>
        双向调用一览
      </Heading>
      <Tabs groupId="homepage-code" className={styles.codeTabs}>
        <TabItem value="csharp" label="C# → Lua" default>
          <p className={styles.codeBlockLabel}>C# · LuaInvoke</p>
          <pre className={styles.codeBlock}>
            <code>{CSHARP_INVOKE_CSHARP}</code>
          </pre>
          <p className={styles.codeBlockLabel}>Lua · app.lua</p>
          <pre className={styles.codeBlock}>
            <code>{CSHARP_INVOKE_LUA}</code>
          </pre>
        </TabItem>
        <TabItem value="lua" label="Lua → C#">
          <pre className={styles.codeBlock}>
            <code>{LUA_TO_CSHARP}</code>
          </pre>
        </TabItem>
      </Tabs>
    </section>
  );
}

export default function Home(): ReactNode {
  return (
    <Layout
      title="首页"
      description="ZLua — Unity Il2Cpp 极致优化的现代原生 Lua 方案。统一 C# 与 Lua 双向调用，C++ 层直桥，零 Wrapper 膨胀。">
      <HomepageHeader />
      <main>
        <HomepageFeatures />
        <CodePreview />
      </main>
    </Layout>
  );
}
