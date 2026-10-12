import { useCallback, useRef } from "react";
import { RequestFields } from "../components/request-fields";
import { useRequestForm } from "../hooks/use-request-form";
import { Redirect, useLocalSearchParams, useRouter } from "expo-router";
import { Button } from "@/components/Button";
import { Copy } from "@/components/feature-page";
import { FormNotice } from "@/components/FormNotice";
import { useAuthSession } from "@/features/auth";
import { RequestPage } from "../components/request-page";
import {
  RequestFailure,
  RequestLoading,
  RequestUnavailable,
  RequestReadDenied,
} from "../components/request-state";
import { useRequestDetail } from "../hooks/use-requests";
import {
  editableRequest,
  isOwnRequest,
  requestError,
} from "../utils/request-policy";
import { type OwnerRequest } from "../types";
import { AppError } from "@/lib/http/errors";
import { RequestConflict } from "../components/request-conflict";
import type { EditorRead } from "../hooks/use-request-recovery";

export function RequestEditorScreen() {
  const { id } = useLocalSearchParams<{ id?: string | string[] }>();
  const { session, runtime } = useAuthSession();
  const query = useRequestDetail(typeof id === "string" ? id : undefined);
  const baseline = useRef<OwnerRequest | undefined>(undefined);
  const identity = `${runtime.controller.generation}:${session?.userId}:${id}`;
  const previousIdentity = useRef(identity);
  if (previousIdentity.current !== identity) {
    baseline.current = undefined;
    previousIdentity.current = identity;
  }
  const read = useCallback(async () => {
    const result = await query.refetch({
      cancelRefetch: false,
      throwOnError: true,
    });
    if (!result.data) throw new AppError("protocol");
    return result.data;
  }, [query.refetch]);
  if (
    !baseline.current &&
    query.data &&
    isOwnRequest(query.data) &&
    editableRequest(query.data)
  )
    baseline.current = query.data;
  const owner = baseline.current;
  if (!session) return <Redirect href="/login" />;
  if (
    id !== undefined &&
    (!query.valid ||
      (!owner &&
        query.data &&
        (!isOwnRequest(query.data) || !editableRequest(query.data))))
  )
    return (
      <RequestPage title="Sửa yêu cầu học">
        <RequestUnavailable />
      </RequestPage>
    );
  if (id !== undefined && !owner)
    return (
      <RequestPage title="Sửa yêu cầu học">
        {query.readDenied ? (
          <RequestReadDenied
            denial={query.readDenied}
            retry={() => void query.refetch()}
            pending={query.isFetching}
          />
        ) : query.error ? (
          <RequestFailure
            error={query.error}
            retry={() => void query.refetch()}
          />
        ) : (
          <RequestLoading />
        )}
      </RequestPage>
    );
  return (
    <RequestForm
      key={`${runtime.controller.generation}:${id ?? "new"}`}
      initial={owner}
      source={id === undefined ? undefined : { ...query, read }}
    />
  );
}
function RequestForm({
  initial,
  source,
}: {
  initial?: OwnerRequest;
  source?: EditorRead;
}) {
  const router = useRouter();
  const {
    form,
    initial: baseline,
    pending,
    error,
    blocked,
    save,
    recovery,
    acceptLatest,
  } = useRequestForm(initial, source);
  return (
    <RequestPage
      title={initial ? "Sửa yêu cầu học" : "Tạo yêu cầu học"}
      pending={pending}
      fallback={initial ? `/requests/${initial.id}` : "/requests"}
    >
      <Copy muted>
        {initial
          ? "Bài đã đăng sẽ được duyệt lại khi sửa."
          : "Lưu nháp, sau đó đăng bài."}
      </Copy>
      <RequestConflict
        initial={baseline}
        latest={recovery.latest}
        mode={recovery.mode}
        denied={recovery.denied}
        error={recovery.error}
        pending={pending}
        load={() => void recovery.loadLatest()}
        keep={() => acceptLatest()}
        discard={() => acceptLatest(false)}
        leave={() =>
          router.dismissTo(initial ? `/requests/${initial.id}` : "/requests")
        }
      />
      {!recovery.denied && (
        <RequestFields
          form={form}
          pending={pending || blocked}
          initial={baseline}
        />
      )}
      {!!error && !recovery.denied && (
        <FormNotice tone="error">{requestError(error, true)}</FormNotice>
      )}
      {!recovery.denied && (
        <Button
          variant="craft"
          disabled={pending || blocked || !!form.watch("weeklyAvailability")}
          onPress={() => void form.handleSubmit(save)()}
        >
          {pending ? "Đang lưu..." : initial ? "Lưu thay đổi" : "Lưu bản nháp"}
        </Button>
      )}
    </RequestPage>
  );
}
