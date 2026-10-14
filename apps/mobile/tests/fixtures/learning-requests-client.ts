import { createHttpClient } from "../../src/lib/http/client";
import { createRequestsApi } from "../../src/features/learning-requests/api/requests-api";
import { fixtureUsers } from "./learning-requests-data";

export function fixtureClient(
  url: string,
  userIndex = 0,
  isCurrent = () => true,
) {
  const http = createHttpClient(() => `${url}/api/v1`);
  http.bindSession({
    generation: 1,
    getToken: () => Promise.resolve(fixtureUsers[userIndex]!.token),
    renew: () => Promise.resolve(),
    expire: () => Promise.resolve(),
  });
  return createRequestsApi(http, isCurrent);
}
