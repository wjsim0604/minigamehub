/**
 * 블록 팡 블록 6종: 색과 모양을 함께 구분해 색약 사용자도 식별할 수 있게 한다 (FR-007).
 * 외부 에셋 없이 SVG 도형으로 직접 그린다.
 */

export interface BlockStyle {
  /** 접근성 이름 (예: "빨간 원") */
  name: string;
  color: string;
}

export const BLOCK_STYLES: readonly BlockStyle[] = [
  { name: "빨간 원", color: "#e03131" },
  { name: "파란 사각형", color: "#1971c2" },
  { name: "초록 삼각형", color: "#2f9e44" },
  { name: "보라 다이아몬드", color: "#9c36b5" },
  { name: "노란 별", color: "#f59f00" },
  { name: "분홍 하트", color: "#e64980" },
];

const STAR_POINTS =
  "50,8 61.8,35.8 91.8,38.4 69,58.2 75.9,87.6 50,72 24.1,87.6 31,58.2 8.2,38.4 38.2,35.8";
const HEART_PATH = "M50 88 C20 66 6 46 18 26 C28 10 46 14 50 28 C54 14 72 10 82 26 C94 46 80 66 50 88 Z";

function Shape({ kind }: { kind: number }) {
  switch (kind) {
    case 0:
      return <circle cx="50" cy="50" r="40" />;
    case 1:
      return <rect x="13" y="13" width="74" height="74" rx="12" />;
    case 2:
      return <path d="M50 10 L91 86 L9 86 Z" />;
    case 3:
      return <path d="M50 5 L93 50 L50 95 L7 50 Z" />;
    case 4:
      return <polygon points={STAR_POINTS} />;
    default:
      return <path d={HEART_PATH} />;
  }
}

export function blockStyle(kind: number): BlockStyle {
  return BLOCK_STYLES[kind] ?? { name: "블록", color: "#868e96" };
}

/** 블록 그림 (장식용: 이름은 셀 버튼의 aria-label로 제공) */
export function BlockShape({ kind }: { kind: number }) {
  const { color } = blockStyle(kind);
  return (
    <svg viewBox="0 0 100 100" aria-hidden="true" focusable="false" width="100%" height="100%">
      <g fill={color} stroke="rgba(255, 255, 255, 0.9)" strokeWidth="5" strokeLinejoin="round">
        <Shape kind={kind} />
      </g>
    </svg>
  );
}
