import Link from "next/link";
import styles from "./not-found.module.css";

export default function NotFound() {
  return (
    <div className={styles.wrap}>
      <h1>게임을 찾을 수 없습니다</h1>
      <p>주소가 올바른지 확인하거나 홈에서 다른 게임을 선택해 주세요.</p>
      <Link href="/" className="btn">
        홈으로
      </Link>
    </div>
  );
}
