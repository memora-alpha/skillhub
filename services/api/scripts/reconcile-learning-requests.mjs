import { pathToFileURL } from "node:url";
import { isDeepStrictEqual } from "node:util";
import pg from "pg";
import { postgresConnectionString } from "../dist/infrastructure/database/postgres-connection.js";

const uuid = /^[0-9a-f]{8}-(?:[0-9a-f]{4}-){3}[0-9a-f]{12}$/i;

export function parseArguments(args, env) {
  const options = {
    limit: 200,
    after: null,
    connectionString: env.LEARNING_REQUEST_RECONCILIATION_DATABASE_URL,
  };
  const seen = new Set();
  for (let i = 0; i < args.length; i += 2) {
    const key = args[i],
      value = args[i + 1];
    if (
      !["--limit", "--after"].includes(key) ||
      seen.has(key) ||
      value === undefined
    )
      throw new Error(
        "Usage: reconcile-learning-requests.mjs [--limit 1..1000] [--after request-uuid]; dry-run only",
      );
    seen.add(key);
    if (key === "--limit") {
      if (!/^\d+$/.test(value) || Number(value) < 1 || Number(value) > 1000)
        throw new Error("Invalid limit");
      options.limit = Number(value);
    } else {
      if (!uuid.test(value)) throw new Error("Invalid request cursor");
      options.after = value;
    }
  }
  if (!options.connectionString)
    throw new Error(
      "LEARNING_REQUEST_RECONCILIATION_DATABASE_URL required; DATABASE_URL is never used",
    );
  return options;
}

export function classifyLifecycle(snapshot) {
  const committed = snapshot.paths.filter((path) => path.committed);
  const result = {
    requestId: snapshot.requestId,
    expectedRequestVersion: snapshot.version,
    currentStatus: snapshot.status,
    classification: "MANUAL_REVIEW",
    candidatePathId: null,
    evidence: {
      sourceValid: snapshot.sourceValid,
      committedPathCount: committed.length,
      paths: snapshot.paths,
    },
    proposedTransitions: [],
  };
  if (
    !snapshot.sourceValid ||
    committed.length > 1 ||
    snapshot.paths.some((path) => !path.consistent)
  )
    return result;
  if (!committed.length) {
    if (!["MATCHED", "CLOSED"].includes(snapshot.status))
      result.classification = "NO_CHANGE";
    return result;
  }
  const path = committed[0];
  if (
    !["NEGOTIATING", "MATCHED", "CLOSED"].includes(snapshot.status) ||
    (snapshot.status === "CLOSED" && !path.settled)
  )
    return result;
  result.candidatePathId = path.pathId;
  if (snapshot.status === "NEGOTIATING")
    result.proposedTransitions.push("MATCHED");
  if (path.settled && snapshot.status !== "CLOSED")
    result.proposedTransitions.push("CLOSED");
  result.classification = result.proposedTransitions.length
    ? "NEEDS_REPAIR"
    : "NO_CHANGE";
  return result;
}

function ledgerMatches(rows, expected) {
  return (
    rows.length === expected.length &&
    expected.every((entry) =>
      rows.some(
        (row) =>
          row.user_id === entry.userId &&
          row.type === entry.type &&
          Number(row.count) === 1 &&
          BigInt(row.amount) === entry.amount,
      ),
    )
  );
}

function pathEvidence(path, data) {
  const sessions = data.sessions.filter((row) => row.path_id === path.path_id);
  const holds = data.holds.filter((row) => row.path_id === path.path_id);
  const plans = data.plans.filter(
    (row) =>
      row.path_id === path.path_id && row.path_version === path.locked_version,
  );
  const pathSchedules = data.schedules.filter(
    (row) => row.path_id === path.path_id,
  );
  const lockedSchedule = pathSchedules.some((row) => row.status === "LOCKED");
  const appliedSchedule = pathSchedules.some(
    (row) => row.applied_version !== null,
  );
  const schedulesConsistent =
    appliedSchedule &&
    pathSchedules.every(
      (row) =>
        (row.status !== "LOCKED" && row.applied_version === null) ||
        row.applied_consistent,
    );
  const committed =
    path.locked_version !== null ||
    path.settled_at !== null ||
    ["SCHEDULED", "ACTIVE", "COMPLETED"].includes(path.status) ||
    lockedSchedule ||
    appliedSchedule ||
    sessions.length > 0 ||
    holds.length > 0;
  if (!committed)
    return {
      pathId: path.path_id,
      committed: false,
      consistent: true,
      settled: false,
    };
  const settled = path.settled_at !== null;
  const twoWay = path.exchange_type === "TWO_WAY";
  const requiredUsers = twoWay
    ? [path.participant_a_id, path.participant_b_id]
    : [path.agreement_learner_id];
  const planConsistent =
    plans.length === (twoWay ? 2 : 1) &&
    plans.every(
      (plan) =>
        plan.learner_confirmed_at !== null &&
        plan.total_sessions > 0 &&
        (twoWay
          ? [path.participant_a_id, path.participant_b_id].includes(
              plan.teacher_id,
            ) &&
            [path.participant_a_id, path.participant_b_id].includes(
              plan.learner_id,
            ) &&
            plan.teacher_id !== plan.learner_id
          : plan.teacher_id === path.agreement_teacher_id &&
            plan.learner_id === path.agreement_learner_id),
    );
  const sessionsConsistent =
    planConsistent &&
    sessions.length ===
      plans.reduce((sum, plan) => sum + plan.total_sessions, 0) &&
    sessions.every(
      (session) =>
        session.history_consistent &&
        plans.some(
          (plan) =>
            plan.plan_id === session.plan_id &&
            plan.plan_version === session.plan_version &&
            plan.teacher_id === session.teacher_id &&
            plan.learner_id === session.learner_id &&
            session.outline_session_no >= 1 &&
            session.outline_session_no <= plan.total_sessions,
        ),
    );
  const expectedCredit = BigInt(path.expected_credit ?? 0);
  const holdsConsistent =
    expectedCredit > 0n &&
    holds.length === requiredUsers.length &&
    new Set(holds.map((hold) => hold.user_id)).size === requiredUsers.length &&
    holds.every(
      (hold) =>
        requiredUsers.includes(hold.user_id) &&
        hold.locked_path_version === path.locked_version &&
        BigInt(hold.amount) === expectedCredit &&
        hold.purpose === (twoWay ? "COMMITMENT" : "TEACHING_PAYMENT") &&
        hold.beneficiary_id === (twoWay ? null : path.agreement_teacher_id) &&
        hold.status === (settled ? "SETTLED" : "ACTIVE") &&
        BigInt(hold.remaining_held) === (settled ? 0n : expectedCredit),
    );
  const holdOperation = data.operations.filter(
    (op) =>
      op.reference_id === path.path_id &&
      op.operation_type === "PATH_HOLD" &&
      op.status === "SUCCESS" &&
      op.idempotency_key ===
        `path-hold:${path.path_id}:v${path.locked_version}`,
  );
  const holdLedger = data.ledger.filter(
    (row) => row.operation_id === holdOperation[0]?.operation_id,
  );
  const holdLedgerConsistent = ledgerMatches(
    holdLedger,
    requiredUsers.map((userId) => ({
      userId,
      type: "HOLD",
      amount: expectedCredit,
    })),
  );
  let settlementConsistent =
    path.status !== "COMPLETED" &&
    path.settlement_operation_id === null &&
    path.completed_at === null;
  if (settled) {
    const op = data.operations.find(
      (row) => row.operation_id === path.settlement_operation_id,
    );
    const fees = data.ledger
      .filter(
        (row) =>
          row.operation_id === path.settlement_operation_id &&
          row.type === "PLATFORM_FEE",
      )
      .reduce((sum, row) => sum + BigInt(row.amount), 0n);
    const fee = (expectedCredit * 400n) / 10000n;
    const expectedLedger = requiredUsers.flatMap((userId) => [
      {
        userId,
        type: twoWay ? "PATH_RETURN" : "TEACHING_PAYMENT",
        amount: expectedCredit - fee,
      },
      ...(fee > 0n ? [{ userId, type: "PLATFORM_FEE", amount: fee }] : []),
    ]);
    if (!twoWay)
      expectedLedger.push({
        userId: path.agreement_teacher_id,
        type: "TEACHING_EARNING",
        amount: expectedCredit - fee,
      });
    const ledgerConsistent = ledgerMatches(
      data.ledger.filter(
        (r) => r.operation_id === path.settlement_operation_id,
      ),
      expectedLedger,
    );
    const policyValid =
      path.policy_snapshot?.policyCode === path.exchange_type &&
      path.policy_snapshot?.calculationRule?.feeBps === 400 &&
      path.policy_snapshot?.calculationRule?.returnedBps === 9600 &&
      path.policy_snapshot?.roundingRule?.mode === "DOWN" &&
      path.policy_snapshot?.roundingRule?.precision === 2;
    settlementConsistent =
      path.status === "COMPLETED" &&
      path.completed_at !== null &&
      path.settled_path_version === path.locked_version &&
      op?.operation_type === "PATH_SETTLEMENT" &&
      op.reference_type === "LEARNING_PATH" &&
      op.reference_id === path.path_id &&
      op.status === "SUCCESS" &&
      sessions.every(
        (s) =>
          s.status === "COMPLETED" &&
          s.teacher_confirmation_status === "CONFIRMED" &&
          s.learner_confirmation_status === "CONFIRMED",
      ) &&
      path.settlement_exchange_type === path.exchange_type &&
      path.settlement_fee_policy_id === path.fee_policy_id &&
      isDeepStrictEqual(path.settlement_fee_snapshot, path.policy_snapshot) &&
      policyValid &&
      ledgerConsistent &&
      BigInt(path.settlement_gross_amount ?? -1) ===
        expectedCredit * BigInt(requiredUsers.length) &&
      BigInt(path.settlement_fee_amount ?? -1) === fees &&
      fees === fee * BigInt(requiredUsers.length);
  }
  return {
    pathId: path.path_id,
    committed,
    consistent: Boolean(
      path.locked_version &&
      schedulesConsistent &&
      path.participant_a_confirmed_at &&
      path.participant_b_confirmed_at &&
      planConsistent &&
      sessionsConsistent &&
      holdsConsistent &&
      holdOperation.length === 1 &&
      holdLedgerConsistent &&
      settlementConsistent,
    ),
    settled,
    sessionsComplete:
      sessions.length > 0 && sessions.every((s) => s.status === "COMPLETED"),
  };
}

async function loadEvidence(client, requestIds) {
  const { rows: sources } = await client.query(
    `SELECT c.*, q.request_id AS proposal_request_id, q.status AS proposal_status, q.source_type, q.proposer_id, q.recipient_id
    FROM conversations c JOIN proposals q ON q.proposal_id = c.proposal_id
    WHERE c.request_id = ANY($1::uuid[]) OR q.request_id = ANY($1::uuid[])`,
    [requestIds],
  );
  const { rows: paths } = await client.query(
    `SELECT p.*, v.exchange_type, v.teacher_id AS agreement_teacher_id, v.learner_id AS agreement_learner_id, v.fee_policy_id,
      v.participant_a_confirmed_at, v.participant_b_confirmed_at,
      CASE WHEN v.exchange_type::text = 'TWO_WAY' THEN v.total_credit_per_user ELSE v.negotiated_credit END AS expected_credit,
      CASE WHEN f.policy_id IS NULL THEN NULL ELSE jsonb_build_object('policyCode',f.policy_code,'versionNo',f.version_no,'calculationRule',f.calculation_rule,'roundingRule',f.rounding_rule) END AS policy_snapshot
    FROM learning_paths p LEFT JOIN learning_path_versions v ON v.path_id = p.path_id AND v.version_no = p.locked_version
    LEFT JOIN fee_policy_versions f ON f.policy_id = p.settlement_fee_policy_id
    WHERE p.conversation_id = ANY($1::uuid[])`,
    [sources.map((source) => source.conversation_id)],
  );
  const ids = paths.map((path) => path.path_id);
  // These bounded-by-page reads share one repeatable-read snapshot; no per-Request queries.
  const sessions = await client.query(
    `SELECT s.path_id,s.plan_id,s.plan_version,s.outline_session_no,s.teacher_id,s.learner_id,s.status,s.teacher_confirmation_status,s.learner_confirmation_status,
      (SELECT count(*) = 1 FROM session_schedule_history h WHERE h.session_id = s.session_id AND h.superseded_at IS NULL)
      AND EXISTS (SELECT 1 FROM session_schedule_history h
        JOIN schedule_items i ON i.schedule_item_id = h.schedule_item_id
        JOIN schedule_versions v ON v.schedule_proposal_id = i.schedule_proposal_id AND v.version_no = i.schedule_version
        JOIN schedule_proposals sp ON sp.schedule_proposal_id = v.schedule_proposal_id
        JOIN learning_paths p ON p.path_id = s.path_id
        WHERE h.session_id = s.session_id AND h.superseded_at IS NULL
          AND v.path_id = s.path_id AND v.path_version = p.locked_version AND sp.path_id = s.path_id AND sp.applied_version = i.schedule_version
          AND i.plan_id = s.plan_id AND i.plan_version = s.plan_version AND i.session_no = s.outline_session_no
          AND i.start_at = s.start_at AND i.end_at = s.end_at) AS history_consistent
      FROM sessions s WHERE s.path_id = ANY($1::uuid[])`,
    [ids],
  );
  const holds = await client.query(
    "SELECT path_id,user_id,beneficiary_id,purpose,amount,remaining_held,status,locked_path_version FROM held_credit_allocations WHERE path_id = ANY($1::uuid[])",
    [ids],
  );
  const schedules = await client.query(
    `SELECT sp.path_id,sp.status,sp.applied_version,
      EXISTS (SELECT 1 FROM schedule_versions v JOIN learning_paths p ON p.path_id = sp.path_id
        WHERE v.schedule_proposal_id = sp.schedule_proposal_id AND v.version_no = sp.applied_version
          AND v.path_id = sp.path_id AND v.path_version = p.locked_version
          AND v.participant_a_confirmed_at IS NOT NULL AND v.participant_b_confirmed_at IS NOT NULL
          AND EXISTS (SELECT 1 FROM schedule_items i WHERE i.schedule_proposal_id = v.schedule_proposal_id AND i.schedule_version = v.version_no)
          AND NOT EXISTS (SELECT 1 FROM schedule_items i
            LEFT JOIN path_version_plans link ON link.path_id = v.path_id AND link.path_version = v.path_version AND link.plan_id = i.plan_id AND link.plan_version = i.plan_version
            LEFT JOIN learning_plan_versions pv ON pv.plan_id = link.plan_id AND pv.version_no = link.plan_version
            WHERE i.schedule_proposal_id = v.schedule_proposal_id AND i.schedule_version = v.version_no
              AND (link.plan_id IS NULL OR i.session_no < 1 OR i.session_no > pv.total_sessions))) AS applied_consistent
      FROM schedule_proposals sp WHERE sp.path_id = ANY($1::uuid[])`,
    [ids],
  );
  const plans = await client.query(
    `SELECT pv.*, p.teacher_id,p.learner_id,v.total_sessions,v.learner_confirmed_at
    FROM path_version_plans pv JOIN learning_plans p ON p.plan_id = pv.plan_id
    JOIN learning_plan_versions v ON v.plan_id = pv.plan_id AND v.version_no = pv.plan_version WHERE pv.path_id = ANY($1::uuid[])`,
    [ids],
  );
  const operations = await client.query(
    "SELECT operation_id,reference_id,reference_type,operation_type,status,idempotency_key FROM credit_operations WHERE reference_type::text = 'LEARNING_PATH' AND reference_id = ANY($1::text[])",
    [ids],
  );
  const ledger = await client.query(
    "SELECT operation_id,user_id,type,SUM(amount)::text AS amount,COUNT(*)::int AS count FROM credit_transactions WHERE operation_id = ANY($1::uuid[]) AND status::text = 'SUCCESS' GROUP BY operation_id,user_id,type",
    [operations.rows.map((op) => op.operation_id)],
  );
  return {
    sources,
    paths,
    sessions: sessions.rows,
    holds: holds.rows,
    schedules: schedules.rows,
    plans: plans.rows,
    operations: operations.rows,
    ledger: ledger.rows,
  };
}

export async function previewLifecycle(client, { limit, after }) {
  await client.query("BEGIN ISOLATION LEVEL REPEATABLE READ READ ONLY");
  try {
    await client.query("SET LOCAL statement_timeout = '30s'");
    const { rows: clock } = await client.query(
      "SELECT CURRENT_TIMESTAMP AS now",
    );
    const { rows } = await client.query(
      "SELECT request_id,owner_id,status,content_version FROM learning_requests WHERE ($1::uuid IS NULL OR request_id > $1::uuid) ORDER BY request_id LIMIT $2",
      [after, limit + 1],
    );
    const page = rows.slice(0, limit);
    const data = await loadEvidence(
      client,
      page.map((r) => r.request_id),
    );
    const items = page.map((request) => {
      const sources = data.sources.filter(
        (source) =>
          source.request_id === request.request_id ||
          source.proposal_request_id === request.request_id,
      );
      const sourceValid =
        sources.length === 0
          ? !["NEGOTIATING", "MATCHED", "CLOSED"].includes(request.status)
          : sources.length === 1 &&
            sources.every(
              (s) =>
                s.request_id === request.request_id &&
                s.proposal_request_id === request.request_id &&
                s.proposal_status === "ACCEPTED" &&
                s.source_type === "LEARNING_REQUEST" &&
                s.proposer_id !== s.recipient_id &&
                s.participant_a_id === s.proposer_id &&
                s.participant_b_id === s.recipient_id &&
                request.owner_id === s.recipient_id,
            );
      const paths = data.paths
        .filter((path) =>
          sources.some((s) => s.conversation_id === path.conversation_id),
        )
        .map((path) => {
          const evidence = pathEvidence(path, data);
          const source = sources.find(
            (s) => s.conversation_id === path.conversation_id,
          );
          evidence.consistent &&=
            path.participant_a_id === source.participant_a_id &&
            path.participant_b_id === source.participant_b_id;
          return evidence;
        });
      return classifyLifecycle({
        requestId: request.request_id,
        version: request.content_version,
        status: request.status,
        sourceValid,
        paths,
      });
    });
    await client.query("COMMIT");
    return {
      mode: "dry-run",
      scannedAt: clock[0].now.toISOString(),
      nextCursor: rows.length > limit ? page.at(-1).request_id : null,
      items,
    };
  } catch (error) {
    await client.query("ROLLBACK");
    throw error;
  }
}

if (
  process.argv[1] &&
  import.meta.url === pathToFileURL(process.argv[1]).href
) {
  let client;
  try {
    const options = parseArguments(process.argv.slice(2), process.env);
    client = new pg.Client({
      connectionString: postgresConnectionString(options.connectionString),
      connectionTimeoutMillis: 5000,
    });
    await client.connect();
    console.log(
      JSON.stringify(await previewLifecycle(client, options), null, 2),
    );
  } catch {
    console.error(
      "Reconciliation failed. Use --limit 1..1000 and optional --after UUID; set LEARNING_REQUEST_RECONCILIATION_DATABASE_URL explicitly. No data was changed.",
    );
    process.exitCode = 1;
  } finally {
    await client?.end();
  }
}
