import { RequestPage } from "../components/request-page";
import { MyRequestsContent } from "../components/my-requests-content";
export function MyRequestsScreen() {
  return (
    <RequestPage title="Yêu cầu của tôi" fallback="/profile" list>
      <MyRequestsContent />
    </RequestPage>
  );
}
