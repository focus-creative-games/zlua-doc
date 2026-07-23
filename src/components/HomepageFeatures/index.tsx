import type {ReactNode} from 'react';
import clsx from 'clsx';
import Heading from '@theme/Heading';
import styles from './styles.module.css';

type FeatureItem = {
  title: string;
  icon: string;
  description: ReactNode;
};

const FeatureList: FeatureItem[] = [
  {
    title: '更易用 · 零配置',
    icon: '⚡',
    description: (
      <>
        声明式 <code>[LuaInvoke]</code> / <code>[LuaMarshalAs]</code>，<code>CSharp</code>{' '}
        懒加载；无需 per-type C# Wrap 白名单，屏蔽底层 Lua C API。
      </>
    ),
  },
  {
    title: '更快 · 约 2.62×',
    icon: '🚀',
    description: (
      <>
        Il2Cpp 实测：约 98% 对齐用例快于 xLua；Lua→C# 平均约 2.62×；常见字段 /
        属性与调用约 4×。
      </>
    ),
  },
  {
    title: '更小桥接 · 更少 GC',
    icon: '📦',
    description: (
      <>
        同签名合并的 C++ stub，体积可小一个数量级；引用类型与 struct 默认 0
        GC，并提供 OpaqueValue 等策略。
      </>
    ),
  },
];

function Feature({title, icon, description}: FeatureItem) {
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
          {FeatureList.map((props, idx) => (
            <Feature key={idx} {...props} />
          ))}
        </div>
      </div>
    </section>
  );
}
