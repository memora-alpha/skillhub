import { useIsFocused } from "expo-router";
import { useConnections } from "@/features/connections";
import { useProposalList } from "@/features/proposals/state";
import {
  useRequestList,
  useRefreshRequestDetails,
} from "@/features/learning-requests";
import { useConversationInbox } from "./use-conversation-inbox";
import { inboxGroups } from "../utils/inbox-groups";

export function useInboxGroups() {
  const focused = useIsFocused();
  const { userId } = useConnections();
  const refreshTitles = useRefreshRequestDetails({ preferOwnList: true });
  const ownRequests = useRequestList("mine", {}, focused, {
    firstPageOnly: true,
  });
  const inbox = useConversationInbox();
  const proposals = useProposalList("received", undefined, undefined, focused);
  const moreInbox = !!inbox.hasNextPage && !inbox.denied;
  const moreProposals = !!proposals.hasNextPage && !proposals.denied;
  return {
    items: inboxGroups(inbox.items, proposals.items, userId ?? "", {
      received:
        !!proposals.data &&
        !proposals.error &&
        !proposals.denied &&
        !moreProposals,
      chats: !!inbox.data && !inbox.error && !inbox.denied && !moreInbox,
    }),
    data: inbox.data && proposals.data,
    error: inbox.error ?? proposals.error,
    isPending: inbox.isPending || proposals.isPending,
    isFetching:
      inbox.isFetching || proposals.isFetching || ownRequests.isFetching,
    isRefetching:
      inbox.isRefetching || proposals.isRefetching || ownRequests.isRefetching,
    titlesPending:
      ownRequests.isFetching || (ownRequests.isPending && !ownRequests.error),
    hasNextPage: moreInbox || moreProposals,
    refetch: async () => {
      await Promise.all([
        inbox.refetch(),
        proposals.refetch({ cancelRefetch: false }),
        ownRequests.refetch(),
      ]);
      await refreshTitles();
    },
    loadMore: () =>
      Promise.all([
        moreInbox && !inbox.isFetching
          ? inbox.fetchNextPage({ cancelRefetch: false })
          : undefined,
        moreProposals && !proposals.isFetching
          ? proposals.fetchNextPage({ cancelRefetch: false })
          : undefined,
      ]),
  };
}
