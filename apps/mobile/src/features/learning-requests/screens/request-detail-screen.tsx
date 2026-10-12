import { useLocalSearchParams, Redirect } from "expo-router";
import { Button } from "@/components/Button";
import { FormNotice } from "@/components/FormNotice";
import { RequestPage } from "../components/request-page";
import { RequestContent } from "../components/request-content";
import { RequestDetailActions } from "../components/request-detail-actions";
import {
  RequestFailure,
  RequestLoading,
  RequestUnavailable,
  RequestReadDenied,
} from "../components/request-state";
import { useRequestDetail } from "../hooks/use-requests";
import { useRequestAction } from "../hooks/use-request-action";
import { isOwnRequest, requestError } from "../utils/request-policy";

export function RequestDetailScreen({ own = false }: { own?: boolean }) {
  const params = useLocalSearchParams<{ id?: string | string[] }>();
  const id = typeof params.id === "string" ? params.id : undefined;
  const query = useRequestDetail(id);
  const action = useRequestAction(query);
  const request = query.data;
  if (!query.readDenied && !own && request && isOwnRequest(request))
    return <Redirect href={`/requests/${request.id}`} />;
  return (
    <RequestPage
      title={own ? "Chi tiết yêu cầu của tôi" : "Chi tiết yêu cầu học"}
      pending={action.pending}
      feed={!own}
      fallback={own ? "/requests" : "/discover"}
    >
      {!query.valid || (own && request && !isOwnRequest(request)) ? (
        <RequestUnavailable />
      ) : query.readDenied ? (
        <RequestReadDenied
          denial={query.readDenied}
          retry={() => void action.refresh()}
          pending={action.pending || query.isFetching}
        />
      ) : !request ? (
        query.error ? (
          <RequestFailure
            error={query.error}
            retry={() => void action.refresh()}
            pending={action.pending || query.isFetching}
          />
        ) : (
          <RequestLoading />
        )
      ) : (
        <>
          {query.error && (
            <RequestFailure
              error={query.error}
              stale
              retry={() => void action.refresh()}
              pending={action.pending || query.isFetching}
            />
          )}
          <RequestContent request={request} />
          {!!action.error && (
            <FormNotice tone="error">
              {requestError(action.error, true)}
            </FormNotice>
          )}
          <Button
            variant="paper"
            disabled={action.pending || query.isFetching}
            onPress={() => void action.refresh()}
          >
            {action.pending ? "Đang tải lại..." : "Tải lại trạng thái"}
          </Button>
          {isOwnRequest(request) ? (
            <RequestDetailActions
              key={request.id}
              request={request}
              pending={action.pending || query.isFetching}
              blocked={action.blocked}
              run={action.run}
            />
          ) : (
            <FormNotice tone="info">
              Gửi đề xuất trao đổi và xem hồ sơ người đăng sẽ được bổ sung sau.
            </FormNotice>
          )}
        </>
      )}
    </RequestPage>
  );
}
export function OwnRequestScreen() {
  return <RequestDetailScreen own />;
}
