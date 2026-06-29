import type {ReactNode} from 'react';
import clsx from 'clsx';
import Link from '@docusaurus/Link';
import useDocusaurusContext from '@docusaurus/useDocusaurusContext';
import Layout from '@theme/Layout';
import HomepageFeatures from '@site/src/components/HomepageFeatures';
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
          Unity 2022.3 · Lua 5.4 · Mono 全功能 · Il2Cpp MVP
        </p>
      </div>
    </header>
  );
}

function CodePreview() {
  const csharp = `public class Bootstrap : MonoBehaviour
{
    [RuntimeInitializeOnLoadMethod(
        RuntimeInitializeLoadType.BeforeSceneLoad)]
    private static void InitZLuaOnStartup()
    {
        LuaAppDomain.Initialize(LoadLuaModule);
    }

    [LuaInvoke("app", "main")]
    private static extern void AppMain();
}`;

  const lua = `CSharp['AC'] = CSharp['Assembly-CSharp']

local function main()
    local demo = CSharp.AC.Demo()
    demo.x = 10
    print("Demo.Add:", CSharp.AC.Demo.Add(3, 5))
end

return { main = main }`;

  return (
    <section className="codePreview container">
      <div className="codePreviewGrid">
        <div className="codePreviewPanel">
          <div className="codePreviewHeader">C# · LuaInvoke</div>
          <pre>
            <code>{csharp}</code>
          </pre>
        </div>
        <div className="codePreviewPanel">
          <div className="codePreviewHeader">Lua · CSharp 类型访问</div>
          <pre>
            <code>{lua}</code>
          </pre>
        </div>
      </div>
    </section>
  );
}

export default function Home(): ReactNode {
  const {siteConfig} = useDocusaurusContext();
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
