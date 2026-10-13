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

export function RequestDetailScreen({ own = false }: { own?: boolean }) {
  const params = useLocalSearchParams<{ id?: string | string[] }>();
  const id = typeof params.id === "string" ? params.id : undefined;
  const query = useRequestDetail(id);
  const action = useRequestAction(query);
  const request = query.data;
  const ownerRequest =
    query.valid && !query.readDenied && request && isOwnRequest(request)
      ? request
      : undefined;
  if (!query.readDenied && !own && request && isOwnRequest(request))
    return <Redirect href={`/requests/${request.id}`} />;
  return (
    <RequestPage
      title={own ? "Chi tiết yêu cầu của tôi" : "Chi tiết yêu cầu học"}
      pending={action.pending}
      feed={!own}
      fallback="/discover"
      footer={
        ownerRequest ? (
          <RequestOwnerFooter
            request={ownerRequest}
            pending={action.pending || query.isFetching}
            blocked={action.blocked}
            run={action.run}
            error={action.error}
            refresh={() => void action.refresh()}
          />
        ) : query.valid &&
          !query.readDenied &&
          !own &&
          request &&
          !isOwnRequest(request) ? (
          <RequestPublicFooter request={request} />
        ) : undefined
      }
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
          {!!action.error &&
            (!ownerRequest || requestState(ownerRequest) !== "DRAFT") && (
              <RequestActionError
                error={action.error}
                pending={action.pending || query.isFetching}
                refresh={() => void action.refresh()}
              />
            )}
          {isOwnRequest(request) ? (
            <RequestDetailActions
              key={request.id}
              request={request}
              pending={action.pending || query.isFetching}
              blocked={action.blocked}
              run={action.run}
            />
          ) : null}
        </>
      )}
    </RequestPage>
  );
}
export function OwnRequestScreen() {
  return <RequestDetailScreen own />;
}
