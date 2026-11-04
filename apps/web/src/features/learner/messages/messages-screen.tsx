import { ProductIcon } from "../components/product-icon";
export function MessagesScreen() {
  return (
    <section className="product-chat-welcome">
      <ProductIcon name="chat" size={54} />
      <h2>Bắt đầu một cuộc trò chuyện</h2>
      <p>
        Chọn một người đồng hành ở danh sách để trao đổi mục tiêu và kế hoạch
        học.
      </p>
    </section>
  );
}
