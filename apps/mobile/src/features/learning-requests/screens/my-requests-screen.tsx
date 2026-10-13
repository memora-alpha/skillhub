import { RequestPage } from "../components/request-page";
import { MyRequestsContent } from "../components/my-requests-content";
import { RequestCreateButton } from "../components/request-list-controls";
export function MyRequestsScreen() {
  return (
    <RequestPage
      title="Yêu cầu của tôi"
      fallback="/profile"
      rightAction={<RequestCreateButton compact />}
      list
    >
      <MyRequestsContent />
    </RequestPage>
  );
}
