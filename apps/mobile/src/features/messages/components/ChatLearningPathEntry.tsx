import { Copy, Panel, RouteButton } from "@/components/feature-page";

export function ChatLearningPathEntry({
  conversationId,
}: Readonly<{ conversationId: string }>) {
  return (
    <Panel title="Trao đổi xong, cùng lập Learning Path">
      <Copy muted>
        Thống nhất nội dung và Credit, xác nhận Learning Path rồi cả hai xác
        nhận lịch học. Tin nhắn trong Chat chưa thay cho xác nhận.
      </Copy>
      <RouteButton
        href={{
          pathname: "/agreement-type",
          params: { conversationId, mode: "api" },
        }}
      >
        Tiếp tục với Learning Path
      </RouteButton>
    </Panel>
  );
}
