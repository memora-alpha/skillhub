# Connections/dev merge validation — 2026-10-11

The merge of `c52ec74` (`dev`) into `c57f6af` (`feat/connections`) is recorded as `b66bfe3`. All seven conflict files are resolved, retaining the Connections API and the incoming learning-platform modules.

AppModule registers both sets of modules. Conversations exports its lifecycle service and the membership reader required by LearningPaths. FileAttachmentService retains CHAT manifests/status alongside Evidence, Report and Material bindings. LearningRequests retains the catalog/sharing-skill owner adapters and the Reputation dependency. The runtime schema contains 50 catalog models, eight technical models and Tag/RequestTag.

Follow-up integration fixes retain both `learning-request:create` and `CREATE_NEW_ACTIVITY` restrictions, import IdentityModule for the achievements authentication guard, and preserve the generated runtime header after the catalog header changed. Composition tests cover chat, LearningPath membership and achievements together. The local HTTP harness closes its own Mongoose connections after partial bootstrap failure and continues PostgreSQL cleanup if Mongo cleanup fails.

| Validation                                                     | Result                                                                               |
| -------------------------------------------------------------- | ------------------------------------------------------------------------------------ |
| Prisma format/validate, TypeScript check and Nest build        | Pass                                                                                 |
| API lint                                                       | Pass, zero warnings                                                                  |
| Connections suite                                              | 24 pass, zero failures; two explicitly gated store suites skipped in this invocation |
| API regression suite                                           | 190 pass, zero failures/skips                                                        |
| Final composition/eligibility tests after dependency fix       | 9 pass, zero failures/skips                                                          |
| Local PostgreSQL Connections integration                       | 1 pass, zero failures/skips                                                          |
| Configured Mongo replica-set integration through HTTP harness  | 1 pass, zero failures/skips                                                          |
| Full AppModule HTTP/SSE with configured Mongo and live storage | 13 grouped checks pass                                                               |

The HTTP harness exercises login, proposal decisions/retry, Learning Request adapters, chat publication/history/read, notifications, signed SSE replay and logout revocation. Real R2/ClamAV coverage includes CHAT upload, asynchronous READY/CLEAN scanning, file-message retry and authorized signed download. Acceptance/chat still creates no Session or Credit transactions. Test objects are deleted and disposable schemas/databases are cleaned up; Docker was not used.

MongoDB was stopped at the first HTTP attempt and was restarted using its existing service configuration. The failed attempt's isolated PostgreSQL fixture was identified by its exact three test users and fixture moderation rule, then removed. A later bootstrap failure exposed the missing Identity import; the final build, focused tests and complete HTTP/SSE run passed after that fix. An initial TypeScript attempt also failed because Windows exhausted memory; rerunning with one V8 worker and a 1536 MB heap limit passed. These process options are temporary verification settings.

This validates merge integration and Connections behavior, not the complete learning-platform business journeys. Application moderation policy, Path/Schedule lock-reader integration, multi-instance SSE/proxy behavior, recovery/cleanup races and performance remain subject to the existing feature release gates. No application migration or push is performed by this merge verification.
