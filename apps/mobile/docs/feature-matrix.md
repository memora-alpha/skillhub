# Mobile feature matrix

| SRS module                                              | Mobile feature                          | Notes                                                                |
| ------------------------------------------------------- | --------------------------------------- | -------------------------------------------------------------------- |
| M01 Authentication & Account                            | `auth`                                  | Register, OTP, login, reset password, logout and account state.      |
| M02 Profile & Skill                                     | `profile`, `skills`                     | Public profile must hide private fields and evidence files.          |
| M03 Learning Request & Moderation                       | `learning-requests`                     | Publish, moderation state, reject reason and cancel before lock.     |
| M04 Proposal / Direct Exchange & Matching               | `proposals`, `discovery`                | Accept opens negotiation; no Credit hold yet.                        |
| M05 Chat, Learning Path, Scheduling & Dual Confirmation | `chat`, `learning-paths`, `scheduling`  | SRS 1.6 LearningPlan rules are central.                              |
| M06 Credit & Transaction                                | `wallet`, `payments`                    | Show backend balances and ledger; no withdrawal.                     |
| M07 1:1 Session                                         | `sessions`                              | Session list, detail, confirmation and report entry points.          |
| M08 LiveKit Integration                                 | `livekit`                               | Token from backend; no secret in client.                             |
| M09 Review, Reputation & Achievement                    | `reviews`, `reputation`, `achievements` | Review after completion only; reputation server controlled.          |
| M10 Report & Dispute                                    | `reports`                               | Session reports and material reports have different required fields. |
| M11 Notification                                        | `notifications`                         | Deep link to allowed resources and refetch state.                    |
| Digital materials                                       | `materials`                             | Free and paid materials, entitlement, purchase, library and report.  |

## First implementation order

Spec 003 checkpoint (2026-10-09): own/edit profile uses the real account API;
public self-preview uses saved data. Other public profiles remain fixtures, and
avatar selection/upload/status/removal uses the existing API. Only CLEAN updates
the published image; real scan completion needs a running ClamAV service.
The real skill list/title flows are pending. Track work in
[tasks](../specs/003-profile-public-profile/tasks.md) and acceptance in
[checklist](../specs/003-profile-public-profile/checklist.md).

Own profile shows action shortcuts before bio and skills. `settings` owns the
account details, privacy/help/version and security entry points; `auth` owns
OTP recovery and session revocation. Password recovery also opens from signed-in
Settings, with no new endpoint or legal-policy content.

1. Mobile foundation.
2. Auth and account shell.
3. Profile and public profile.
4. Discovery, skills and Learning Request read flows.
5. Proposal and chat negotiation.
6. Learning Path, LearningPlan and schedule confirmation.
7. Sessions, LiveKit and completion confirmation.
8. Wallet, payment status and transaction history.
9. Review, reputation, reports and materials.
