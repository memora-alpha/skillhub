import { useLocalSearchParams, Redirect } from "expo-router";
import { RequestPage } from "../components/request-page";
import { RequestContent } from "../components/request-content";
import {
  RequestDetailActions,
  RequestOwnerFooter,
  RequestActionError,
} from "../components/request-detail-actions";
import { RequestPublicFooter } from "../components/request-public-details";
import {
  RequestFailure,
  RequestLoading,
  RequestUnavailable,
  RequestReadDenied,
} from "../components/request-state";
import { useRequestDetail } from "../hooks/use-requests";
import { useRequestAction } from "../hooks/use-request-action";
import { isOwnRequest, requestState } from "../utils/request-policy";

type DetailProps = Readonly<{
  own: boolean;
  query: ReturnType<typeof useRequestDetail>;
  action: ReturnType<typeof useRequestAction>;
}>;

export function RequestDetailScreen({
  own = false,
}: Readonly<{ own?: boolean }>) {
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
      fallback="/discover"
      footer={<RequestDetailFooter own={own} query={query} action={action} />}
    >
      <RequestDetailBody own={own} query={query} action={action} />
    </RequestPage>
  );
}

function RequestDetailFooter({ own, query, action }: DetailProps) {
  const request = query.data;
  if (!query.valid || query.readDenied || !request) return null;
  if (isOwnRequest(request))
    return (
      <RequestOwnerFooter
        request={request}
        pending={action.pending || query.isFetching}
        blocked={action.blocked}
        run={action.run}
        error={action.error}
        refresh={() => void action.refresh()}
      />
    );
  if (!own) return <RequestPublicFooter request={request} />;
  return null;
}

function RequestDetailBody({ own, query, action }: DetailProps) {
  const request = query.data;
  const pending = action.pending || query.isFetching;
  const refresh = () => void action.refresh();
  if (!query.valid || (own && request && !isOwnRequest(request)))
    return <RequestUnavailable />;
  if (query.readDenied)
    return (
      <RequestReadDenied
        denial={query.readDenied}
        retry={refresh}
        pending={pending}
      />
    );
  if (!request) {
    if (query.error)
      return (
        <RequestFailure error={query.error} retry={refresh} pending={pending} />
      );
    return <RequestLoading />;
  }
  const ownerRequest = isOwnRequest(request) ? request : undefined;
  return (
    <>
      {query.error && (
        <RequestFailure
          error={query.error}
          stale
          retry={refresh}
          pending={pending}
        />
      )}
      <RequestContent request={request} />
      {!!action.error &&
        (!ownerRequest || requestState(ownerRequest) !== "DRAFT") && (
          <RequestActionError
            error={action.error}
            pending={pending}
            refresh={refresh}
          />
        )}
      {ownerRequest && (
        <RequestDetailActions
          key={request.id}
          request={ownerRequest}
          pending={pending}
          blocked={action.blocked}
          run={action.run}
        />
      )}
    </>
  );
}
export function OwnRequestScreen() {
  return <RequestDetailScreen own />;
}
