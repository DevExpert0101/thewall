import { createHash } from "node:crypto";
import { readdir, readFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { PGlite } from "@electric-sql/pglite";
import { pgcrypto } from "@electric-sql/pglite/contrib/pgcrypto";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const migrationsDir = path.join(root, "supabase", "migrations");
const seedPath = path.join(root, "supabase", "seed.sql");
const testsDir = path.join(root, "supabase", "tests");

const EVENT_ID = "a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a11";
const ADMIN_AUTH = "aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa";
const TREASURY = "0x00000000000000000000000000000000000000aa";
const SENDER = "0x00000000000000000000000000000000000000bb";
const HASH_A = "aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa";
const HASH_B = "bbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbb";
const HASH_C = "cccccccccccccccccccccccccccccccccccccccccccccccccccccccccccccccc";
const TX_1 = `0x${"11".repeat(32)}`;
const TX_2 = `0x${"22".repeat(32)}`;
const TX_3 = `0x${"33".repeat(32)}`;
const TX_4 = `0x${"44".repeat(32)}`;

let passed = 0;
let failed = 0;

function assert(condition, message) {
  if (condition) {
    passed += 1;
    console.log(`  ok  ${message}`);
    return;
  }
  failed += 1;
  console.error(`  FAIL  ${message}`);
}

function asJson(value) {
  return typeof value === "string" ? JSON.parse(value) : value;
}

function includesError(error, fragment) {
  const text = error instanceof Error ? `${error.message}\n${error.stack ?? ""}` : String(error);
  return text.toLowerCase().includes(fragment.toLowerCase());
}

async function expectError(fn, fragment, message) {
  try {
    await fn();
    failed += 1;
    console.error(`  FAIL  ${message} (no error)`);
  } catch (error) {
    if (includesError(error, fragment)) {
      passed += 1;
      console.log(`  ok  ${message}`);
      return;
    }
    failed += 1;
    console.error(`  FAIL  ${message} (wanted "${fragment}", got ${error})`);
  }
}

async function execFile(db, filePath) {
  const sql = await readFile(filePath, "utf8");
  await db.exec(sql);
}

async function bootstrapRoles(db) {
  await db.exec(`
    do $$
    begin
      if not exists (select 1 from pg_roles where rolname = 'anon') then
        create role anon nologin noinherit;
      end if;
      if not exists (select 1 from pg_roles where rolname = 'authenticated') then
        create role authenticated nologin noinherit;
      end if;
      if not exists (select 1 from pg_roles where rolname = 'service_role') then
        create role service_role nologin bypassrls;
      end if;
    end
    $$;
  `);
}

function sha256Hex(text) {
  return createHash("sha256").update(text, "utf8").digest("hex");
}

async function insertIntent(db, { message, expiresSql = "now() + interval '15 minutes'" }) {
  const result = await db.query(
    `
    insert into public.payment_intents (
      event_id, anonymous_user_id, message_text, message_hash,
      amount, currency, network, recipient_wallet, status, expires_at
    ) values (
      $1, gen_random_uuid(), $2, $3,
      1, 'USDC', 'base', $4, 'created', ${expiresSql}
    )
    returning id
    `,
    [EVENT_ID, message, sha256Hex(message), TREASURY],
  );
  return result.rows[0].id;
}

async function publish(db, intentId, txHash, tokenHash) {
  return db.query(
    `
    select public.publish_paid_message(
      $1::uuid, $2, $3, $4, 1, 'USDC', 'base', $5
    ) as result
    `,
    [intentId, txHash, SENDER, TREASURY, tokenHash],
  );
}

async function main() {
  console.log("Verifying Supabase migrations with PGlite…");
  const db = new PGlite({ extensions: { pgcrypto } });

  await bootstrapRoles(db);

  const files = (await readdir(migrationsDir))
    .filter((name) => name.endsWith(".sql"))
    .sort();

  if (files.some((name) => name.startsWith("0001_"))) {
    throw new Error("Legacy 0001_init.sql is still present; split migrations would double-apply.");
  }

  for (const file of files) {
    process.stdout.write(`Applying ${file}… `);
    await execFile(db, path.join(migrationsDir, file));
    console.log("done");
  }

  process.stdout.write("Applying seed.sql… ");
  await execFile(db, seedPath);
  console.log("done");

  console.log("\nSchema and seed");
  await execFile(db, path.join(testsDir, "verify.sql"));
  assert(true, "verify.sql completed");
  await execFile(db, path.join(testsDir, "monument.sql"));
  assert(true, "monument.sql completed");

  const tables = await db.query(`
    select table_name
    from information_schema.tables
    where table_schema = 'public'
      and table_name in (
        'events','event_counters','payment_intents','payments','messages',
        'reactions','message_ownership','reports','moderation_actions','admin_users',
        'admin_ops_actions','monument_entries','monument_state'
      )
    order by table_name
  `);
  assert(tables.rows.length === 13, "all 13 product tables exist");

  const viewCols = await db.query(`
    select column_name
    from information_schema.columns
    where table_schema = 'public' and table_name = 'public_messages'
    order by ordinal_position
  `);
  const colNames = viewCols.rows.map((row) => row.column_name);
  assert(
    ["id", "event_id", "public_number", "text", "is_removed", "reaction_count", "published_at", "final_rank"].every(
      (name) => colNames.includes(name),
    ),
    "public_messages exposes only public columns",
  );
  assert(!colNames.includes("text_hash"), "public_messages does not expose text_hash");

  const rls = await db.query(`
    select relname, relrowsecurity, relforcerowsecurity
    from pg_class
    where relname in ('payment_intents','payments','message_ownership','admin_users')
  `);
  assert(
    rls.rows.every((row) => row.relrowsecurity && row.relforcerowsecurity),
    "sensitive tables have RLS forced",
  );

  console.log("\nConstraints");
  await expectError(
    () =>
      db.exec(`
        insert into public.events (slug, title, starts_at, ends_at)
        values ('bad-window', 'x', now(), now() - interval '1 hour')
      `),
    "events_window_valid",
    "rejects inverted event window",
  );
  await expectError(
    () =>
      db.query(
        `
        insert into public.payment_intents (
          event_id, anonymous_user_id, message_text, message_hash,
          amount, currency, network, recipient_wallet, expires_at
        ) values (
          $1, gen_random_uuid(), 'hello', $2,
          2, 'USDC', 'base', $3, now() + interval '15 minutes'
        )
        `,
        [EVENT_ID, HASH_A, TREASURY],
      ),
    "payment_intents_amount_one_usdc",
    "rejects payment intent amount other than 1 USDC",
  );

  console.log("\nAtomic publish");
  await expectError(
    async () => {
      const intentId = await insertIntent(db, { message: "too soon", messageHash: HASH_A });
      await publish(db, intentId, TX_1, HASH_A);
    },
    "event_upcoming",
    "publish is refused while the event is upcoming",
  );

  await db.exec(`
    update public.events
    set
      starts_at = now() - interval '1 minute',
      ends_at = now() + interval '24 hours',
      archived_at = null,
      finalized_at = null
    where id = '${EVENT_ID}'
  `);

  const intent1 = await insertIntent(db, { message: "first sentence on the wall", messageHash: HASH_A });
  const intent2 = await insertIntent(db, { message: "second sentence on the wall", messageHash: HASH_B });

  const first = await publish(db, intent1, TX_1, HASH_A);
  const second = await publish(db, intent2, TX_2, HASH_B);
  const n1 = asJson(first.rows[0].result).public_number;
  const n2 = asJson(second.rows[0].result).public_number;
  assert(n1 === 1, "first publish receives #1");
  assert(n2 === 2, "second publish receives #2");

  await expectError(
    () => publish(db, intent1, TX_3, HASH_C),
    "intent_already_fulfilled",
    "same intent cannot publish twice",
  );

  const intent3 = await insertIntent(db, { message: "replayed transaction", messageHash: HASH_C });
  await expectError(
    () => publish(db, intent3, TX_1, HASH_C),
    "tx_already_used",
    "same transaction hash cannot publish twice",
  );

  const expiredId = await insertIntent(db, {
    message: "expired window",
    messageHash: HASH_A,
  });
  await db.query(
    `
    update public.payment_intents
    set created_at = now() - interval '20 minutes',
        expires_at = now() - interval '1 second'
    where id = $1
    `,
    [expiredId],
  );
  await expectError(
    () => publish(db, expiredId, TX_3, HASH_C),
    "intent_expired",
    "expired intent cannot publish",
  );

  const wrongRecipient = await insertIntent(db, { message: "wrong destination", messageHash: HASH_B });
  await expectError(
    () =>
      db.query(
        `
        select public.publish_paid_message(
          $1::uuid, $2, $3, $4, 1, 'USDC', 'base', $5
        )
        `,
        [wrongRecipient, TX_3, SENDER, "0x00000000000000000000000000000000000000cc", HASH_C],
      ),
    "wrong_recipient",
    "recipient must match the intent treasury",
  );

  const messageId = (
    await db.query(`select id from public.messages where public_number = 1`)
  ).rows[0].id;
  const userA = "11111111-1111-1111-1111-111111111111";
  const idem = "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa";
  const fire = await db.query(
    `select public.add_fire_reaction($1::uuid, $2::uuid, $3::uuid) as result`,
    [messageId, userA, idem],
  );
  assert(asJson(fire.rows[0].result).reaction_count === 1, "first fire increments to 1");
  const replay = await db.query(
    `select public.add_fire_reaction($1::uuid, $2::uuid, $3::uuid) as result`,
    [messageId, userA, idem],
  );
  assert(asJson(replay.rows[0].result).reaction_count === 1, "idempotent replay does not increment");
  assert(asJson(replay.rows[0].result).replayed === true, "idempotent replay is marked");
  await expectError(
    () => db.query(`select public.add_fire_reaction($1::uuid, $2::uuid)`, [messageId, userA]),
    "duplicate_reaction",
    "one fire per anonymous user per message",
  );

  console.log("\nClose, refuse writes, persist ranks");
  await expectError(
    () => db.query(`select public.finalize_event_rankings($1::uuid)`, [EVENT_ID]),
    "event_still_live",
    "rankings cannot persist while The Wall is live",
  );

  await db.exec(`
    update public.events
    set ends_at = now() - interval '1 second'
    where id = '${EVENT_ID}'
  `);

  const lateIntent = await insertIntent(db, { message: "too late", messageHash: HASH_C });
  await expectError(
    () => publish(db, lateIntent, TX_4, HASH_C),
    "event_ended",
    "publish is refused after ends_at",
  );
  await expectError(
    () => db.query(`select public.add_fire_reaction($1::uuid, $2::uuid)`, [messageId, "22222222-2222-2222-2222-222222222222"]),
    "event_ended",
    "reactions are refused after ends_at",
  );

  await db.query(`select public.finalize_event_rankings($1::uuid)`, [EVENT_ID]);
  const ranks = await db.query(`
    select public_number, final_rank, reaction_count
    from public.messages
    where event_id = '${EVENT_ID}'
    order by final_rank
  `);
  assert(ranks.rows[0].public_number === 1 && ranks.rows[0].final_rank === 1, "highest 🔥 receives final rank #1");
  assert(ranks.rows[1].public_number === 2 && ranks.rows[1].final_rank === 2, "lower 🔥 receives final rank #2");

  const monument = await db.query(`
    select monument_number, position, x, y, width, height, sentence_snapshot,
           original_public_number, final_rank, winning_margin, event_id, message_id
    from public.monument_entries
  `);
  assert(monument.rows.length === 1, "one Monument entry after finalize");
  assert(monument.rows[0].monument_number === 1, "first Monument number is 1");
  const expectedPlot = await db.query(`select * from public.monument_plot(1)`);
  assert(monument.rows[0].position === 1, "first canvas position is 1");
  assert(monument.rows[0].x === expectedPlot.rows[0].x && monument.rows[0].y === expectedPlot.rows[0].y, "first sentence uses the assigned plot");
  assert(monument.rows[0].width === expectedPlot.rows[0].width && monument.rows[0].height === expectedPlot.rows[0].height, "every plot uses the equal cell size");
  assert(monument.rows[0].x >= 0 && monument.rows[0].y >= 0, "plot stays on the canvas");
  assert(monument.rows[0].sentence_snapshot === "first sentence on the wall", "canvas stores the winning sentence");
  assert(monument.rows[0].original_public_number === 1, "Victor is the rank #1 inscription");
  assert(monument.rows[0].final_rank === 1, "Monument stores rank 1");
  assert(monument.rows[0].winning_margin === 1, "winning margin is winner 🔥 minus second");
  const sealedEvent = await db.query(`
    select winning_message_id, monument_entry_id from public.events where id = '${EVENT_ID}'
  `);
  assert(sealedEvent.rows[0].winning_message_id === monument.rows[0].message_id, "event stores the Victor");
  assert(Boolean(sealedEvent.rows[0].monument_entry_id), "event stores the Monument entry");

  await db.query(`select public.finalize_event_rankings($1::uuid)`, [EVENT_ID]);
  const ranksAgain = await db.query(`
    select public_number, final_rank from public.messages
    where event_id = '${EVENT_ID}'
    order by public_number
  `);
  assert(
    ranksAgain.rows[0].final_rank === 1 && ranksAgain.rows[1].final_rank === 2,
    "finalize is idempotent",
  );
  const monumentAgain = await db.query(`
    select count(*)::int as n, min(monument_number)::int as first
    from public.monument_entries
  `);
  assert(monumentAgain.rows[0].n === 1, "second finalize does not create another Monument entry");
  assert(monumentAgain.rows[0].first === 1, "Monument number is unchanged");
  const plotAgain = await db.query(`select position, x, y, sentence_snapshot from public.monument_entries`);
  assert(plotAgain.rows[0].position === 1 && plotAgain.rows[0].x === monument.rows[0].x && plotAgain.rows[0].y === monument.rows[0].y, "repeat finalize does not move the sentence");
  assert(plotAgain.rows[0].sentence_snapshot === "first sentence on the wall", "repeat finalize does not rewrite the sentence");
  const state = await db.query(`select next_number from public.monument_state where singleton = true`);
  assert(state.rows[0].next_number === 2, "next Monument number advanced once");
  await expectError(
    () =>
      db.exec(`
        insert into public.monument_entries (
          monument_number, position, x, y, width, height, sentence_snapshot,
          event_id, message_id, original_public_number,
          final_reaction_count, winning_margin, wall_total_messages, wall_total_reactions, sealed_at
        ) values (
          2, 2, 280, 0, 280, 168, 'duplicate',
          '${EVENT_ID}', '${messageId}', 1, 1, 0, 2, 1, now()
        )
      `),
    "monument_entries_event_unique",
    "duplicate Monument entry for the same Wall is impossible",
  );

  await db.exec(`
    update public.messages
    set removed_at = now(), removal_reason_code = 'spam', moderation_status = 'removed'
    where public_number = 2 and event_id = '${EVENT_ID}'
  `);
  const redacted = await db.query(`
    select public_number, text, is_removed, final_rank
    from public.public_messages
    where public_number = 2
  `);
  assert(redacted.rows[0].public_number === 2, "removed messages keep their number");
  assert(Boolean(redacted.rows[0].is_removed), "removed flag is public");
  assert(
    redacted.rows[0].text === "Message removed under archive policy.",
    "removed text is archival, not original",
  );
  assert(redacted.rows[0].final_rank === 2, "removed messages keep their final rank");

  console.log("\nAdmin moderation audit");
  await db.exec(`
    insert into public.admin_users (auth_user_id, email)
    values ('${ADMIN_AUTH}', 'ops@example.com')
  `);
  const liveId = (await db.query(`select id from public.messages where public_number = 1`)).rows[0].id;
  await expectError(
    () =>
      db.query(
        `select public.moderate_message($1::uuid, $2::uuid, 'remove', 'spam', 'promo', false)`,
        [liveId, ADMIN_AUTH],
      ),
    "confirmation_required",
    "remove requires confirmation",
  );
  await db.query(
    `select public.moderate_message($1::uuid, $2::uuid, 'remove', 'spam', 'promo', true)`,
    [liveId, ADMIN_AUTH],
  );
  const moderated = await db.query(
    `select moderation_status, removal_reason_code from public.messages where id = '${liveId}'`,
  );
  assert(moderated.rows[0].moderation_status === "removed", "confirmed remove updates the message");
  const eventFanout = await db.query(
    `select text from public.public_message_events where public_number = 1`,
  );
  if (eventFanout.rows.length > 0) {
    assert(
      eventFanout.rows.every((row) => row.text === "Message removed under archive policy."),
      "remove redacts public_message_events text",
    );
  }
  const audit = await db.query(
    `select action, reason from public.moderation_actions where message_id = '${liveId}' order by created_at`,
  );
  assert(audit.rows.length === 1 && audit.rows[0].action === "remove", "remove is audited in the same transaction");
  assert(String(audit.rows[0].reason).includes("spam"), "audit stores the moderation reason");

  await db.exec(`
    insert into public.reports (message_id, reporter_user_id, category, status)
    values ('${liveId}', gen_random_uuid(), 'spam', 'open')
  `);
  const reportId = (await db.query(`select id from public.reports where message_id = '${liveId}'`)).rows[0].id;
  await expectError(
    () =>
      db.query(
        `select public.review_report($1::uuid, $2::uuid, 'other', 'not a violation', false)`,
        [reportId, ADMIN_AUTH],
      ),
    "confirmation_required",
    "dismissing a report requires confirmation",
  );
  await db.query(
    `select public.review_report($1::uuid, $2::uuid, 'other', 'not a violation', true)`,
    [reportId, ADMIN_AUTH],
  );
  const dismissed = await db.query(`select status from public.reports where id = '${reportId}'`);
  assert(dismissed.rows[0].status === "dismissed", "confirmed dismiss updates the report");
  const dismissAudit = await db.query(
    `select action from public.moderation_actions where action = 'dismiss' and message_id = '${liveId}'`,
  );
  assert(dismissAudit.rows.length === 1, "report dismiss is audited");

  await db.query(
    `select public.moderate_message($1::uuid, $2::uuid, 'restore', 'other', 'false positive', true)`,
    [liveId, ADMIN_AUTH],
  );
  const restored = await db.query(
    `select removed_at, moderation_status from public.messages where id = '${liveId}'`,
  );
  assert(restored.rows[0].removed_at == null, "restore clears removal");
  const auditCount = await db.query(
    `select count(*)::int as n from public.moderation_actions where message_id = '${liveId}'`,
  );
  assert(auditCount.rows[0].n === 3, "restore is audited");

  await execFile(db, path.join(testsDir, "numbering.sql"));
  const dupes = await db.query(`
    select event_id, public_number, count(*)
    from public.messages
    group by event_id, public_number
    having count(*) > 1
  `);
  assert(dupes.rows.length === 0, "no duplicate public numbers");

  const drift = await db.query(`
    select c.event_id
    from public.event_counters c
    where c.total_messages is distinct from (
      select count(*) from public.messages m where m.event_id = c.event_id
    )
  `);
  assert(drift.rows.length === 0, "event_counters.total_messages matches row count");

  console.log("\nRLS as anon");
  async function asAnon(fn) {
    await db.exec("begin; set local role anon;");
    try {
      return await fn();
    } finally {
      try {
        await db.exec("rollback;");
      } catch {
        // Transaction may already be aborted.
      }
    }
  }

  const visibleEvents = await asAnon(() => db.query("select count(*)::int as n from public.events"));
  assert(visibleEvents.rows[0].n === 1, "anon can read events");
  const visibleCounters = await asAnon(() => db.query("select total_messages from public.event_counters"));
  assert(visibleCounters.rows.length === 1, "anon can read event_counters");
  const visibleView = await asAnon(() =>
    db.query("select public_number, text, is_removed from public.public_messages"),
  );
  assert(visibleView.rows.length === 2, "anon can read public_messages");

  await expectError(
    () => asAnon(() => db.query("select * from public.payment_intents")),
    "permission denied",
    "anon cannot read payment_intents",
  );
  await expectError(
    () => asAnon(() => db.query("select * from public.payments")),
    "permission denied",
    "anon cannot read payments",
  );
  await expectError(
    () => asAnon(() => db.query("select * from public.messages")),
    "permission denied",
    "anon cannot read messages directly",
  );
  await expectError(
    () => asAnon(() => db.query("select * from public.message_ownership")),
    "permission denied",
    "anon cannot read ownership tokens",
  );
  await expectError(
    () => asAnon(() => db.query("select * from public.message_claims")),
    "permission denied",
    "anon cannot read wall key hashes",
  );
  await expectError(
    () => asAnon(() => db.query("select * from public.prize_nominations")),
    "permission denied",
    "anon cannot read prize payouts",
  );
  await expectError(
    () => asAnon(() => db.query("select * from public.claim_challenges")),
    "permission denied",
    "anon cannot read claim challenges",
  );
  await expectError(
    () => asAnon(() => db.query("select * from public.claim_sessions")),
    "permission denied",
    "anon cannot read claim sessions",
  );
  await expectError(
    () => asAnon(() => db.query("select * from public.claim_attempts")),
    "permission denied",
    "anon cannot read claim attempts",
  );
  await expectError(
    () => asAnon(() => db.query("select * from public.reaction_signals")),
    "permission denied",
    "anon cannot read reaction signals",
  );
  await expectError(
    () => asAnon(() => db.query("select * from public.reactions")),
    "permission denied",
    "anon cannot read reactions",
  );
  await expectError(
    () =>
      asAnon(() =>
        db.query(`select public.add_fire_reaction($1::uuid, $2::uuid)`, [
          "11111111-1111-4111-8111-111111111111",
          "22222222-2222-4222-8222-222222222222",
        ]),
      ),
    "permission denied",
    "anon cannot execute add_fire_reaction",
  );
  await expectError(
    () => asAnon(() => db.query("select * from public.admin_users")),
    "permission denied",
    "anon cannot read admin_users",
  );
  await expectError(
    () => asAnon(() => db.query("select * from public.reports")),
    "permission denied",
    "anon cannot read reports",
  );
  await expectError(
    () => asAnon(() => db.query("select * from public.moderation_actions")),
    "permission denied",
    "anon cannot read moderation audit",
  );
  await expectError(
    () => asAnon(() => db.query("select * from public.admin_ops_actions")),
    "permission denied",
    "anon cannot read operations audit",
  );
  await expectError(
    () =>
      asAnon(() =>
        db.exec(`
          insert into public.messages (
            event_id, public_number, payment_intent_id, text, text_hash
          ) values (
            '${EVENT_ID}', 99, gen_random_uuid(), 'should fail', '${HASH_A}'
          )
        `),
      ),
    "permission denied",
    "anon cannot insert messages",
  );
  await expectError(
    () =>
      asAnon(() =>
        db.query(
          `select public.publish_paid_message(
            gen_random_uuid(), $1, $2, $3, 1, 'USDC', 'base', $4
          )`,
          [TX_3, SENDER, TREASURY, HASH_C],
        ),
      ),
    "permission denied",
    "anon cannot execute publish_paid_message",
  );
  await expectError(
    () =>
      asAnon(() =>
        db.query(
          `select public.moderate_message(
            gen_random_uuid(), gen_random_uuid(), 'remove', 'spam', 'x', true
          )`,
        ),
      ),
    "permission denied",
    "anon cannot execute moderate_message",
  );
  await expectError(
    () => asAnon(() => db.exec(`update public.events set title = 'hacked'`)),
    "permission denied",
    "anon cannot update events",
  );
  const visibleMonument = await asAnon(() =>
    db.query("select monument_number, original_public_number from public.public_monument_entries"),
  );
  assert(visibleMonument.rows.length === 1, "anon can read public Monument entries");
  assert(visibleMonument.rows[0].monument_number === 1, "public Monument number is sequential");
  await expectError(
    () => asAnon(() => db.query("select next_number from public.monument_state")),
    "permission denied",
    "anon cannot read monument_state",
  );
  await expectError(
    () =>
      asAnon(() =>
        db.exec(`
          insert into public.monument_entries (
            monument_number, position, x, y, width, height, sentence_snapshot,
            event_id, message_id, original_public_number,
            final_reaction_count, winning_margin, wall_total_messages, wall_total_reactions, sealed_at
          ) values (
            99, 99, 0, 0, 280, 168, 'forged',
            '${EVENT_ID}', '${messageId}', 1, 1, 0, 2, 1, now()
          )
        `),
      ),
    "permission denied",
    "anon cannot create a Monument entry",
  );
  await expectError(
    () => asAnon(() => db.exec(`update public.monument_entries set monument_number = 8`)),
    "permission denied",
    "anon cannot modify a Monument entry",
  );
  await expectError(
    () => asAnon(() => db.exec(`update public.events set winning_message_id = null`)),
    "permission denied",
    "anon cannot change the Victor",
  );
  await expectError(
    () => asAnon(() => db.exec(`update public.messages set final_rank = 9`)),
    "permission denied",
    "anon cannot change final ranks",
  );
  await expectError(
    () => asAnon(() => db.query(`select public.finalize_event_rankings($1::uuid)`, [EVENT_ID])),
    "permission denied",
    "anon cannot execute finalize_event_rankings",
  );

  console.log("\nFrozen checkout terms and text hash");
  await expectError(
    () =>
      db.query(`update public.payment_intents set message_text = 'hacked after pay' where id = $1`, [
        intent1,
      ]),
    "intent_terms_frozen",
    "payment intent message cannot be changed after insert",
  );
  await expectError(
    () =>
      db.query(
        `update public.payment_intents set recipient_wallet = $1 where id = $2`,
        ["0x00000000000000000000000000000000000000cc", intent1],
      ),
    "intent_terms_frozen",
    "payment intent recipient cannot be changed after insert",
  );
  const mismatchIntent = await insertIntent(db, { message: "bound sentence" });
  await expectError(
    () =>
      db.query(
        `
        insert into public.messages (
          event_id, public_number, payment_intent_id, text, text_hash
        ) values (
          $1, 99, $2, 'bound sentence', $3
        )
        `,
        [EVENT_ID, mismatchIntent, HASH_A],
      ),
    "hash_mismatch",
    "message text_hash must equal sha256 of text",
  );

  console.log("\nRead-path helpers");
  const pulse = await db.query(`select public.wall_pulse($1::uuid, $2::uuid[]) as result`, [
    EVENT_ID,
    [messageId],
  ]);
  const pulseJson = asJson(pulse.rows[0].result);
  assert(pulseJson.total_messages === 2, "wall_pulse returns counter totals");
  assert(pulseJson.latest_public_number === 2, "wall_pulse returns the latest public number");
  assert(Number(pulseJson.counts[messageId]) === 1, "wall_pulse returns requested reaction counts");
  const hour = await db.query(
    `select hour_count, hour_minutes from public.hour_reaction_counts($1::uuid, now() - interval '1 hour', 200)`,
    [EVENT_ID],
  );
  assert(hour.rows.length >= 1, "hour_reaction_counts aggregates in the database");
  assert(Number(hour.rows[0].hour_count) >= 1, "hour_reaction_counts returns unique 🔥 in the window");
  assert(Number(hour.rows[0].hour_minutes) >= 1, "hour_reaction_counts returns distinct minutes");
  await expectError(
    () => asAnon(() => db.query(`select public.wall_pulse($1::uuid, '{}'::uuid[])`, [EVENT_ID])),
    "permission denied",
    "anon cannot execute wall_pulse",
  );

  console.log(`\n${passed} passed, ${failed} failed`);
  if (failed > 0) {
    process.exitCode = 1;
  }
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
