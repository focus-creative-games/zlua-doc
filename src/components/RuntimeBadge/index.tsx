import type {ReactNode} from 'react';
import clsx from 'clsx';
import styles from './styles.module.css';

type RuntimeBadgeProps = {
  mono?: string;
  il2cpp?: string;
  className?: string;
};

/** 全站统一的 Mono / Il2Cpp 运行时状态徽章 */
export default function RuntimeBadge({
  mono = '全功能',
  il2cpp = 'MVP',
  className,
}: RuntimeBadgeProps): ReactNode {
  return (
    <span className={clsx(styles.wrapper, className)}>
      <span className={clsx(styles.badge, styles.mono)} title="Unity Editor (Mono)">
        Mono · {mono}
      </span>
      <span className={clsx(styles.badge, styles.il2cpp)} title="Il2Cpp Player">
        Il2Cpp · {il2cpp}
      </span>
    </span>
  );
}
