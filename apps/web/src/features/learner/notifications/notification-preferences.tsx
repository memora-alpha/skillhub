"use client";
import { useUserResource } from "../hooks/use-user-resource";
import { useUserSession } from "../auth/session";
import { useUserCommand } from "../hooks/use-user-command";
import { CommandFeedback, Feedback, Panel } from "../components/common";
type Preferences = { learning: boolean; credit: boolean; community: boolean };
export function NotificationPreferences() {
  const query = useUserResource<Preferences>("me/notification-preferences"),
    command = useUserCommand(true),
    { request } = useUserSession();
  return (
    <Panel title="Nội dung thông báo">
      <Feedback
        loading={query.loading}
        error={query.error}
        reload={query.reload}
      />
      {query.data && (
        <div className="learner-stack">
          {(
            [
              ["learning", "Học tập"],
              ["credit", "Credit và thanh toán"],
              ["community", "Cộng đồng"],
            ] as const
          ).map(([key, label]) => (
            <label key={key} className="product-consent">
              <input
                type="checkbox"
                checked={query.data![key]}
                disabled={query.loading || command.pending || command.uncertain}
                onChange={(e) => {
                  const checked = e.target.checked;
                  void command
                    .run(key + checked, () =>
                      request("me/notification-preferences", {
                        method: "PATCH",
                        body: { [key]: checked },
                      }),
                    )
                    .then(() => query.reload());
                }}
              />
              {label}
            </label>
          ))}
        </div>
      )}
      <CommandFeedback command={command} />
      {command.uncertain && (
        <button
          className="btn"
          onClick={async () => {
            try {
              await request<Preferences>("me/notification-preferences");
              query.reload();
              command.resetAfterRead();
            } catch {
              query.reload();
            }
          }}
        >
          Kiểm tra cài đặt
        </button>
      )}
    </Panel>
  );
}
