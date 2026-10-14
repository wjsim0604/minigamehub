/**
 * 게임별 로컬 최고 점수 저장소 (FR-005).
 *
 * - 키 규칙: `mgh:{gameId}:bestScore` (architecture.md 게임 레지스트리 원칙 5)
 * - localStorage를 쓸 수 없는 환경(사생활 보호 모드, 용량 초과, SSR 등)에서는
 *   예외를 던지지 않고 현재 세션 동안만 메모리에 유지한다.
 * - 저장된 값이 손상(숫자가 아님, 음수 등)되었으면 0으로 간주하고, 다음 저장 시 덮어쓴다.
 * - 서버로 어떤 데이터도 전송하지 않는다.
 */

export function bestScoreKey(gameId: string): string {
  return `mgh:${gameId}:bestScore`;
}

/** localStorage를 쓸 수 없을 때 사용하는 세션(메모리) 저장소 */
const sessionFallback = new Map<string, number>();

function getStorage(): Storage | null {
  try {
    if (typeof window === "undefined") return null;
    const storage = window.localStorage;
    return storage ?? null;
  } catch {
    // 접근 자체가 SecurityError를 던지는 브라우저가 있음
    return null;
  }
}

/** 저장된 원본 문자열을 안전한 점수로 변환. 손상된 값이면 0. */
export function parseStoredScore(raw: string | null | undefined): number {
  if (raw === null || raw === undefined) return 0;
  const trimmed = raw.trim();
  if (!/^\d+$/.test(trimmed)) return 0;
  const value = Number(trimmed);
  return Number.isSafeInteger(value) ? value : 0;
}

function normalizeScore(score: number): number {
  if (!Number.isFinite(score) || score < 0) return 0;
  return Math.min(Math.floor(score), Number.MAX_SAFE_INTEGER);
}

export function readBestScore(gameId: string): number {
  const key = bestScoreKey(gameId);
  const fallback = sessionFallback.get(key) ?? 0;
  const storage = getStorage();
  if (!storage) return fallback;
  try {
    const stored = parseStoredScore(storage.getItem(key));
    // 저장이 실패했던 세션 값이 더 크면 그것을 우선한다
    return Math.max(stored, fallback);
  } catch {
    return fallback;
  }
}

export interface BestScoreResult {
  /** 갱신 후의 최고 점수 */
  bestScore: number;
  /** 이번 점수로 최고 기록을 새로 세웠는지 */
  isNewBest: boolean;
}

/**
 * 게임이 끝났을 때 점수를 기록한다. 기존 최고 점수보다 높을 때만 갱신한다.
 */
export function recordScore(gameId: string, score: number): BestScoreResult {
  const key = bestScoreKey(gameId);
  const normalized = normalizeScore(score);
  const previous = readBestScore(gameId);

  if (normalized <= previous) {
    // 손상된 값이 남아 있으면 정상 값으로 덮어쓴다
    repairIfCorrupted(key, previous);
    return { bestScore: previous, isNewBest: false };
  }

  sessionFallback.set(key, normalized);
  const storage = getStorage();
  if (storage) {
    try {
      storage.setItem(key, String(normalized));
    } catch {
      // 용량 초과 등: 세션 값만 유지 (오류 화면을 띄우지 않음)
    }
  }
  notify();
  return { bestScore: normalized, isNewBest: true };
}

type Listener = () => void;
const listeners = new Set<Listener>();

function notify(): void {
  listeners.forEach((listener) => listener());
}

/**
 * 최고 점수 변경 구독 (같은 탭의 recordScore, 다른 탭의 storage 이벤트).
 * useSyncExternalStore의 subscribe로 사용한다.
 */
export function subscribeBestScore(listener: Listener): () => void {
  listeners.add(listener);
  const onStorage = (event: StorageEvent) => {
    if (event.key === null || event.key.startsWith("mgh:")) listener();
  };
  if (typeof window !== "undefined") window.addEventListener("storage", onStorage);
  return () => {
    listeners.delete(listener);
    if (typeof window !== "undefined") window.removeEventListener("storage", onStorage);
  };
}

function repairIfCorrupted(key: string, value: number): void {
  const storage = getStorage();
  if (!storage) return;
  try {
    const raw = storage.getItem(key);
    if (raw !== null && raw !== String(value)) {
      storage.setItem(key, String(value));
    }
  } catch {
    // 무시
  }
}

/** 테스트 전용: 세션 저장소 초기화 */
export function __resetBestScoreSessionForTests(): void {
  sessionFallback.clear();
}
