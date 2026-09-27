import { INITIAL_PIP_COUNT } from '@/lib/game/pip';
import styles from './PipProgress.module.css';

interface PipProgressProps {
  completedPip: number;
  playerName: string;
}

export function PipProgress({ completedPip, playerName }: PipProgressProps) {
  return (
    <div
      className={styles.progress}
      role="progressbar"
      aria-label={`${playerName} pip progress`}
      aria-valuemin={0}
      aria-valuemax={INITIAL_PIP_COUNT}
      aria-valuenow={completedPip}
      aria-valuetext={`${completedPip} / ${INITIAL_PIP_COUNT} pips completed`}
    >
      <span className={styles.value}>{completedPip} / {INITIAL_PIP_COUNT}</span>
      <span className={styles.track} aria-hidden="true">
        <span className={styles.fill} style={{ width: `${completedPip / INITIAL_PIP_COUNT * 100}%` }} />
      </span>
    </div>
  );
}
