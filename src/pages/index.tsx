import type {ReactNode} from 'react';
import clsx from 'clsx';
import Link from '@docusaurus/Link';
import useDocusaurusContext from '@docusaurus/useDocusaurusContext';
import Layout from '@theme/Layout';
import Tabs from '@theme/Tabs';
import TabItem from '@theme/TabItem';
import Translate, {translate} from '@docusaurus/Translate';
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
        <p className="hero__subtitle">
          <Translate id="homepage.tagline">
            Zero-config · Full C# interop · ~2.62× faster than xLua on Il2Cpp
          </Translate>
        </p>
        <div className={styles.runtimeRow}>
          <RuntimeBadge />
        </div>
        <div className={styles.buttons}>
          <Link
            className="button button--secondary button--lg"
            to="/docs/getting-started/quick-start">
            <Translate id="homepage.cta.quickStart">5-minute quick start</Translate>
          </Link>
          <Link
            className="button button--outline button--secondary button--lg"
            href="https://github.com/focus-creative-games/zlua-demo">
            <Translate id="homepage.cta.demo">View Demo</Translate>
          </Link>
        </div>
        <p className={styles.heroMeta}>
          <Translate id="homepage.heroMeta">
            Unity 2021+ · Tuanjie · Lua 5.1–5.5 / LuaJIT / Luau (luau branch)
          </Translate>
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

Action AppMain;
Func<int, int, int> AppAdd;

void Awake()
{
    AppMain = LuaAppDomain.GetFunction<Action>("app", "main");
    AppAdd = LuaAppDomain.GetFunction<Func<int, int, int>>("app", "add");
}`;

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
        <Translate id="homepage.codePreview.title">Bidirectional calls at a glance</Translate>
      </Heading>
      <Tabs groupId="homepage-code" className={styles.codeTabs}>
        <TabItem value="csharp" label="C# → Lua" default>
          <p className={styles.codeBlockLabel}>C# · GetFunction</p>
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
      title={translate({id: 'homepage.layout.title', message: 'Home'})}
      description={translate({
        id: 'homepage.layout.description',
        message:
          'ZLua — a modern native Lua stack for Unity Il2Cpp. Unified C# ↔ Lua calls, C++ direct bridge, no per-type Wrap bloat.',
      })}>
      <HomepageHeader />
      <main>
        <HomepageFeatures />
        <CodePreview />
      </main>
    </Layout>
  );
}
