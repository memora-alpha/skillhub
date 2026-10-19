# Approved connection policies

User approved these values on 2026-10-09:

| Policy                     | Value                                                           |
| -------------------------- | --------------------------------------------------------------- |
| Proposal lifetime          | 7 days; editing preserves original expiry                       |
| Proposal sends per User    | 10 per rolling hour and 50 per rolling day                      |
| Direct invitation cooldown | 24 hours per proposer/recipient/skill                           |
| Chat sends                 | 30 per rolling minute/User; 120 per rolling minute/Conversation |
| Files per message          | 5 unique files                                                  |
| File bytes                 | 15,000,000 per file; 50,000,000 total per message               |

Persisted idempotent retries do not consume another send quota. Optional
initialSessionCount maximum and ONE_WAY Credit suggestion bounds still require
explicit configuration; absent configuration rejects only the supplied hint.
Retention, deletion, report/case access and external notification channels remain
production gates. No automatic message/file purge or staff chat browsing.
