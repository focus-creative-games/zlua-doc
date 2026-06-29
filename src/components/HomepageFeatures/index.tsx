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
    title: '极致易用',
    icon: '⚡',
    description: (
      <>
        统一 C# 与 Lua 双向调用，类比 P/Invoke 的 <code>[LuaInvoke]</code>、
        <code>[LuaCallback]</code>、<code>[LuaMarshalAs]</code>，对开发者完全屏蔽底层 Lua C API。
      </>
    ),
  },
  {
    title: '极致性能',
    icon: '🚀',
    description: (
      <>
        Il2Cpp 内嵌 Lua，C++ 层直桥：字段按偏移直读、函数经 <code>methodPointer</code>{' '}
        调用，数倍甚至十倍以上优化传统 xLua 式 Wrapper 路径。
      </>
    ),
  },
  {
    title: '零 Wrapper 膨胀',
    icon: '📦',
    description: (
      <>
        不生成 C# Wrap 函数，相同签名的桥接函数共享复用，彻底解决传统方案 wrapper
        体积庞大的问题。
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
