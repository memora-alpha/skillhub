# Feature Specification: Session Recording

**Feature Branch**: `feat/session-recording`

**Created**: 2026-11-26

**Status**: Implemented on branch (backend, 2026-11-26). Decisions D1–D10 below are final for the
first release. The feature ships dark: `recording.enabled` defaults to `false`. Not yet run against
LiveKit Cloud (task T020); setup in [session-recording-setup.vi.md](../../docs/session-recording-setup.vi.md).

**Release gates** (before turning `recording.enabled` on in production, not before coding):

- Amend the SRS. SRS 1.7 M08 covers rooms, tokens and audio/video only, and
  [livekit-sessions.vi.md](../../docs/livekit-sessions.vi.md) states that sessions are not recorded.
- Legal review of the consent text against Decree 13/2023/ND-CP.
- A LiveKit Egress quote, to set `recording.monthlyAlertMinutes`.

**Input**: Session recording and whiteboard plan (2026-11-25), Phase 2. Phase 1, the whiteboard, is
[spec 019](../019-session-whiteboard/spec.md).

## Purpose

A recording lets the learner rewatch a Session and consolidate what they learned. It is a learning
resource first. As a secondary purpose it may serve as evidence when a report is opened on the
Session. A recording holds the voice, face and screen of two users, which is
personal data under Decree 13/2023: it needs a stated purpose, consent from each person recorded, a
retention limit, and a way to withdraw consent. Data may only serve the purpose it was collected for.

## Current-state findings

- LiveKit Cloud hosts the rooms. `LiveKitService` issues tokens and verifies webhooks at
  `/api/v1/livekit/webhook`; `OutboxConsumer.processOnce` dedupes each delivery by receipt.
- `livekit-server-sdk` 2.19 ships `EgressClient` (`startRoomCompositeEgress`, `stopEgress`,
  `listEgress`, `audioOnly`). Egress writes straight to S3-compatible storage and reports through the
  same webhook (`egress_started`, `egress_updated`, `egress_ended`).
- The `ObjectStorage` port already offers `signGet` (presigned GET) and `remove`.
- Notifications go through outbox events and handlers in the notifications module.
- Staff already read Session evidence through the case handler pattern: `staffEvidenceDownload`
  for report Evidence, and spec 019 P2 (`reportedSessionIds`, `WHITEBOARD_HOLD_REPORT_STATUSES`) for
  the whiteboard. Recordings reuse it.

## Decisions

| ID  | Decision                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                         |
| --- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| D1  | **Purpose: learning review first, evidence second.** The main purpose is for the learner to rewatch the Session. The secondary purpose is evidence when a report is opened on that Session. The consent screen states both purposes, in that order. Recordings are never used for anything else (moderation, marketing, quality scoring).                                                                                                                                                                                                                        |
| D2  | **Consent: both, per recording.** Recording is off by default. Either participant may ask from inside the room; it starts only after the other accepts. Either may stop it at any time, which ends the Egress. Restarting needs a new request and acceptance. A request expires after 2 minutes without an answer.                                                                                                                                                                                                                                               |
| D3  | **When.** A request is allowed only while the room is open (the join window of `sessionJoinWindow`) and the Session is `READY` or `ONGOING`. Egress stops when the join window closes, the room finishes, or the recording reaches the Session length plus `recording.overrunMinutes` (default 10).                                                                                                                                                                                                                                                              |
| D4  | **Kind.** Room composite MP4 with audio, video and screen share, because most teaching happens on the shared screen. `recording.kind = AUDIO_ONLY` switches every new recording to audio only.                                                                                                                                                                                                                                                                                                                                                                   |
| D5  | **Viewing: both participants, streamed.** Each participant may watch through a presigned URL that lives 5 minutes, served `inline`. The clients offer no download button. This is a deterrent, not DRM: a determined user can still save a stream.                                                                                                                                                                                                                                                                                                               |
| D6  | **Retention: 90 days, held by an open report.** `recording.retentionDays` (default 90, range 1–3650) after `endAt`. While a report in `OPEN`, `UNDER_REVIEW` or `NEED_MORE_INFO` targets or relates to the Session, the recording is not expired; it expires on the next sweep after the report closes, if the 90 days have passed. Expiry removes the object and marks the row `EXPIRED`.                                                                                                                                                                       |
| D7  | **Deletion: either participant, unless a report holds it.** Deleting withdraws that person's consent. The object is removed for both, the row is marked `DELETED` with who and when, and the other participant is notified. It cannot be undone. While an open report holds the recording (D6), deletion is refused with `409 RECORDING_HELD_BY_REPORT`; the participant may delete it once the report closes.                                                                                                                                                   |
| D8  | **No effects.** Recording never changes attendance, Credit, Reputation or settlement. Declining, stopping or deleting is not a fault.                                                                                                                                                                                                                                                                                                                                                                                                                            |
| D9  | **Cost and failure.** The platform pays. `recording.enabled` is the kill switch. The D3 cap bounds one recording; `recording.monthlyAlertMinutes` raises an ops alert. An Egress failure marks the recording `FAILED` and notifies both participants; the Session continues and is never cancelled or rescheduled for it.                                                                                                                                                                                                                                        |
| D10 | **Staff review: handler of an open report only.** Mirrors spec 019 P2. The caller needs `report:moderate`, the STAFF or ADMIN role, and must be the case `handlerId`. The case must be `OPEN`, `UNDER_REVIEW` or `NEED_MORE_INFO` and target the Session or have it as `relatedSessionId`. Staff watch through the same 5-minute inline URL and cannot delete or download through the API. Each URL issued writes `REPORT_EVIDENCE_READ` (target `SESSION_RECORDING`) in the same transaction; a refused request writes no audit entry. Admin has no other path. |

## Amendment by spec 021 (implemented)

[Spec 021](../021-subscriptions/spec.md) makes recording a plan entitlement. These points override D2, D6 and D9.

- D2 (spec 021 D11): only a participant whose active plan includes recording may request; the other participant
  still has to accept and keeps equal rights. New errors `403 RECORDING_PLAN_REQUIRED` and
  `409 RECORDING_MINUTES_EXHAUSTED`.
- D2 detail: the plan and remaining minutes are checked on request and again on accept. Accepting pins the
  requester's subscription and retention on the recording, so a plan that lapses inside the 2-minute request
  window stops the start.
- D6 (spec 021 D12): each recording stores a `retention_days` snapshot from the requester's plan at start (Creator
  30, Pro 90 by default). The snapshot replaces the config value, even when shorter. Rows without a snapshot keep
  using `recording.retentionDays`. The open-report hold is unchanged.
- D9 (spec 021 D11, D14): minutes are charged to the requester once at `egress_ended`,
  `ceil(durationMs / 60000)`, in the transaction that marks the recording `READY`. A recording in progress
  always finishes; minutes over the allowance are absorbed by the platform. A plan that ended before
  `egress_ended` absorbs them all. A failed Egress is not charged. Subscribers may buy add-on minutes.
  `recording.enabled` stays the kill switch.

## Deferred (not in the first release)

- A teacher preference to refuse all recordings. A teacher can decline each request meanwhile.
- Transcripts, AI summaries, chapters or notes on recordings.
- Recording the whiteboard canvas as video.
- Sharing recordings beyond the two participants and the handler of an open report on the Session.
