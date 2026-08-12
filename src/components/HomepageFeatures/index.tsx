import type {ReactNode} from 'react';
import clsx from 'clsx';
import Heading from '@theme/Heading';
import Translate from '@docusaurus/Translate';
import styles from './styles.module.css';

function Feature({
  title,
  icon,
  description,
}: {
  title: ReactNode;
  icon: string;
  description: ReactNode;
}) {
  return (
    <div className={clsx('col col--4')}>
      <div className="text--center padding-horiz--md">
        <div className="featureIcon">{icon}</div>
      </div>
      <div className="text--center padding-horiz--md">
        <Heading as="h3">{title}</Heading>
        <p>{description}</p>
      </div>
    </div>
  );
}

export default function HomepageFeatures(): ReactNode {
  return (
    <section className={styles.features}>
      <div className="container">
        <div className="row">
          <Feature
            icon="⚡"
            title={
              <Translate id="homepage.feature.easy.title">Easier · zero-config</Translate>
            }
            description={
              <Translate id="homepage.feature.easy.desc">
                Declarative GetFunction / [LuaMarshalAs], lazy CSharp loading; no per-type C#
                Wrap allowlist, no raw Lua C API.
              </Translate>
            }
          />
          <Feature
            icon="🚀"
            title={
              <Translate id="homepage.feature.fast.title">Faster · ~2.62×</Translate>
            }
            description={
              <Translate id="homepage.feature.fast.desc">
                Il2Cpp benchmarks: ~98% of aligned cases beat xLua; Lua→C# ~2.62× on average;
                common field / property access ~4×.
              </Translate>
            }
          />
          <Feature
            icon="📦"
            title={
              <Translate id="homepage.feature.small.title">
                Smaller bridge · less GC
              </Translate>
            }
            description={
              <Translate id="homepage.feature.small.desc">
                Signature-merged C++ stubs can be an order of magnitude smaller; reference
                types and structs default to 0 GC, with OpaqueValue and related strategies.
              </Translate>
            }
          />
        </div>
      </div>
    </section>
  );
}
