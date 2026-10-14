"use client";

import { useCallback, useState } from "react";
import styles from "./GameList.module.css";

/**
 * 게임 썸네일. 이미지 로드에 실패하면 게임 이름 텍스트로 대체한다 (FR-001 예외 상황).
 */
export function GameThumbnail({ src, name }: { src: string; name: string }) {
  const [failed, setFailed] = useState(false);

  // 하이드레이션 전에 이미 로드가 실패한 경우(onError를 놓친 경우)도 처리
  const checkAlreadyFailed = useCallback((img: HTMLImageElement | null) => {
    if (img && img.complete && img.naturalWidth === 0) setFailed(true);
  }, []);

  if (failed) {
    return (
      <span className={styles.thumbFallback} aria-hidden="true">
        {name}
      </span>
    );
  }

  return (
    // 정적 내보내기 + 로컬 SVG 썸네일이므로 next/image 최적화가 필요 없다
    // eslint-disable-next-line @next/next/no-img-element
    <img
      ref={checkAlreadyFailed}
      className={styles.thumbImage}
      src={src}
      alt=""
      width={320}
      height={200}
      loading="lazy"
      decoding="async"
      onError={() => setFailed(true)}
    />
  );
}
