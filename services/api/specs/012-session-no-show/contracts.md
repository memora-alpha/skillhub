# Session attendance contract

Backend scope A+B+D; all routes use the existing authenticated response envelope.

`GET /api/v1/sessions/:id` replaces `attendanceStatus` and top-level
`teacherAttendanceSeconds`/`learnerAttendanceSeconds` with `attendance`.
This is a breaking change for SH-074 clients. No frontend files are changed here.

```json
{
  "attendance": {
    "state": "DETERMINED",
    "case": "LEARNER_ABSENT",
    "teacher": {
      "verdict": "PRESENT",
      "late": false,
      "seconds": "3600",
      "firstJoinedAt": "2026-11-02T10:00:00.000Z"
    },
    "learner": {
      "verdict": "ABSENT",
      "late": false,
      "seconds": "0",
      "firstJoinedAt": null
    },
    "absentUserIds": ["learner-user-id"],
    "outcomeStatus": "PROVISIONAL",
    "resolution": null,
    "determinedAt": "2026-11-02T11:20:00.000Z"
  },
  "deadlines": {
    "confirmBy": null,
    "excuseOrReportBy": "2026-11-04T11:00:00.000Z",
    "makeupBy": null
  },
  "excuse": null,
  "allowedActions": ["SUBMIT_EXCUSE", "REPORT_NO_SHOW"]
}
```

Attendance state is `null` before endAt, `PENDING_DATA` before determination,
then `DETERMINED` or `UNVERIFIABLE`. Seconds are decimal strings. Dates serialize
to UTC ISO strings; unknown dates and verdicts are null.
`GET /api/v1/sessions/mine` adds `attendance.state` and `allowedActions`.
Actions depend on the caller, Session/path state and deadlines; clients should use
these actions and still handle conflicts from the command endpoints.

| Command                                             | Input                                                       | Result / constraints                                                                                                                                                                                |
| --------------------------------------------------- | ----------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `POST /api/v1/sessions/:id/confirm-completion`      | `{ "note": "optional" }`                                    | 409 `ATTENDANCE_PENDING`, `SESSION_ATTENDANCE_NOT_MET`, or `CONFIRM_WINDOW_CLOSED` when ineligible; repeated accepted confirmation preserves the original note/time.                                |
| `POST /api/v1/sessions/:id/absence-excuse`          | `{ "reason": "10–1000 trimmed characters" }`                | 201 `{id,status:"PENDING"}`; only the absent participant, one excuse per outcome, before dispute deadline; unavailable for BOTH_ABSENT.                                                             |
| `POST /api/v1/sessions/:id/absence-excuse/decision` | `{ "accept": true, "note": "optional, <=1000 characters" }` | 200 `{id,status:"ACCEPTED"}` or `REJECTED`; only the opposite participant. Acceptance requires makeup without a no-show penalty.                                                                    |
| Existing Staff case resolve route                   | `{ "note": "reason", "noShowRuling": "UPHOLD" }`            | Ruling is UPHOLD, COMPLETE or EXCUSE. System cases require a ruling. Generic NO_SHOW violations on attendance-managed cases return `NO_SHOW_REQUIRES_ATTENDANCE_RULING`; use the occurrence ruling. |

Opening a report freezes no-show finalization even if it predates determination.
Resolved-case retries return their existing result without applying effects again.
Staff detail includes the occurrence outcome and evidence, with seconds as strings.

At timeout, BOTH_PRESENT completes; UNVERIFIABLE completes only if someone
confirmed, otherwise Staff reviews. Final learner absence consumes the Session;
teacher/both absence requires makeup on the same Session with a new occurrence.
The existing bilateral reschedule API applies makeup before its deadline and resets
confirmation, tokens, observation and attendance projections. Old outcomes remain.

Settlement still requires every Session completed and no blocking report. Per-Session
Credit penalties/refunds, production deployment and LiveKit Cloud smoke are outside
this implementation. Apply the new migration and seed configuration before rollout.
