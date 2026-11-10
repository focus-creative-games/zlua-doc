import type {ReactNode} from 'react';
import clsx from 'clsx';
import Heading from '@theme/Heading';
import Translate from '@docusaurus/Translate';
import Link from '@docusaurus/Link';
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
              <Link to="/docs/compare/PERFORMANCE/">
                <Translate id="homepage.feature.fast.title">Native C++ interop</Translate>
              </Link>
            }
            description={
              <Translate id="homepage.feature.fast.desc">
                Il2Cpp uses native C++ bridges. See the performance report for measured results,
                test environment, and workload limits.
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
                Signature-shared C++ stubs reduce duplicated bridge code. Low-allocation Marshal
                paths depend on data types, call direction, and warm-up.
              </Translate>
            }
          />
        </div>
      </div>
    </section>
  );
}
