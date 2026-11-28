import { ProductIcon } from "../components/product-icon";
import styles from "./chat.module.css";

export function MessagesScreen() {
  return (
    <section className={styles.welcome}>
      <span className={styles.welcomeBadge}>
        <ProductIcon name="chat" size={34} />
      </span>
      <h2>Tin nhắn của bạn</h2>
      <p>
        Chọn một cuộc trò chuyện ở danh sách bên trái để trao đổi mục tiêu và
        lên lịch học cùng đối tác.
      </p>
    </section>
  );
}
