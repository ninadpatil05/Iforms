# Manual Database Migrations

This project uses `Base.metadata.create_all(bind=engine)` on startup instead of Alembic.
`create_all` will automatically create **new** tables (e.g. `sections`, `section_branch_rules`, `form_views`) but will **not** add
columns to already-existing tables.

---

## Migration 001 — Add `section_id` to `fields`

The `sections` feature (added in this pass) introduces a nullable FK column on the `fields` table.
Because `create_all` cannot alter existing tables, you must run the following SQL **once** against
your development (and production) database before starting the server.

```sql
ALTER TABLE fields
    ADD COLUMN section_id INTEGER REFERENCES sections(id) ON DELETE SET NULL;
```

### When to run this

| Scenario | Action |
|---|---|
| Fresh database (no existing data) | Drop and recreate, or just run `create_all` — the new table + column appear automatically on a brand-new DB. |
| Existing dev database with data you want to keep | Run the `ALTER TABLE` above once. |
| Existing dev database with no important data | Drop the DB and let `create_all` rebuild it cleanly. |

### Verify the column was added

```sql
SELECT column_name, data_type, is_nullable
FROM information_schema.columns
WHERE table_name = 'fields' AND column_name = 'section_id';
```

Expected result: one row, `data_type = integer`, `is_nullable = YES`.

---

## Migration 002 — Add `default_next_section_id` to `sections`

The page-to-page branch logic feature introduces a self-referential nullable FK column `default_next_section_id` on the `sections` table.
Run the following SQL **once** against your database:

```sql
ALTER TABLE sections
    ADD COLUMN default_next_section_id INTEGER REFERENCES sections(id) ON DELETE SET NULL;
```

---

## Migration 003 — Add `last_section_id` to `submissions`

The analytics dashboard feature tracks section drop-off by recording the last section a respondent reached in their submission session.
Run the following SQL **once** against your database:

```sql
ALTER TABLE submissions
    ADD COLUMN last_section_id INTEGER REFERENCES sections(id) ON DELETE SET NULL;
```

---

---

## Migration 004 — Add `condition_groups` and `condition_group_conditions` tables

The Rule Groups feature introduces `condition_groups` and `condition_group_conditions` tables.
Because these are brand-new tables, `Base.metadata.create_all(bind=engine)` creates them automatically on application startup.
No manual `ALTER TABLE` statement is required for existing databases.

---

> [!NOTE]
> Future schema changes that alter existing tables should be added here until the project
> migrates to a proper migration tool such as Alembic.


---

## Migration 005 — Add `access_token` to `submissions`

The IDOR fix (Phase 1a of the security audit) introduces a 64-character random token column
on the `submissions` table. Respondents must supply this token on every public navigation
endpoint to read back their own in-progress answers.

Run the following SQL **once** against your database:

```sql
ALTER TABLE submissions
    ADD COLUMN access_token VARCHAR(64) UNIQUE;

CREATE INDEX IF NOT EXISTS ix_submissions_access_token ON submissions(access_token);
```

### Backfill note

Existing rows will have `access_token = NULL`. The application treats `NULL` as "no token issued"
and returns **403** for any access attempt against those submissions. Respondents with an
in-progress submission created before this migration must **start a new submission** — there is
no safe way to backfill tokens for old rows without issuing them to the respondent.

### Verify the column was added

```sql
SELECT column_name, data_type, is_nullable
FROM information_schema.columns
WHERE table_name = 'submissions' AND column_name = 'access_token';
```

Expected result: one row, `data_type = character varying`, `is_nullable = YES`.

---

## Migration 006 — Add `source` and `status` to `form_invites`

The Share Form via Email feature distinguishes between invites created via the invite UI (`invite_ui`) and share-via-email flow (`share_email`), and tracks invite lifecycle status (`pending`, `opened`, `submitted`, `revoked`).

Run the following SQL **once** against your database:

```sql
ALTER TABLE form_invites
    ADD COLUMN source VARCHAR(50) DEFAULT 'invite_ui',
    ADD COLUMN status VARCHAR(50) DEFAULT 'pending';
```

---

## Migration 007 — Add `scheduled_email_shares` table

The **Scheduled Sending for Share-via-Email** feature introduces a new table
`scheduled_email_shares` that persists deferred email-share jobs.

Because this is a brand-new table, `Base.metadata.create_all(bind=engine)`
creates it automatically on first application startup after the code update.
**No manual `ALTER TABLE` statement is required.**

For reference, the table DDL is:

```sql
CREATE TABLE scheduled_email_shares (
    id                 SERIAL PRIMARY KEY,
    form_id            INTEGER NOT NULL REFERENCES forms(id) ON DELETE CASCADE,
    user_id            INTEGER REFERENCES users(id) ON DELETE SET NULL,
    subject            VARCHAR(255) NOT NULL,
    recipient_payloads JSON NOT NULL,      -- [{"email": str, "body": str}, ...]
    recipient_emails   JSON NOT NULL,      -- [str, ...] — display list
    scheduled_at       TIMESTAMPTZ NOT NULL,
    status             VARCHAR(20) NOT NULL DEFAULT 'pending',
    created_at         TIMESTAMPTZ DEFAULT now(),
    sent_at            TIMESTAMPTZ,
    error_message      TEXT
);

CREATE INDEX ON scheduled_email_shares(form_id);
```

### Status values

| Status | Meaning |
|---|---|
| `pending` | Awaiting delivery at `scheduled_at` |
| `sent` | Delivered (all or some recipients). Partial failures stored as JSON in `error_message`. |
| `failed` | Every recipient failed. `error_message` contains details. |
| `cancelled` | Owner cancelled before send time. |

### Restart durability

On backend restart, APScheduler re-starts fresh and immediately discovers any
`pending` rows with `scheduled_at <= now()` on the first poll tick, sending
them (possibly late). This is the intended behaviour — the DB is the source
of truth.

---

## Migration 008 — Add `ai_form_drafts` table

The **AI Form Creation** feature introduces a new table `ai_form_drafts` that stores pending, accepted, and discarded AI-generated form drafts.

Because this is a brand-new table, `Base.metadata.create_all(bind=engine)` creates it automatically on first application startup after the code update.
**No manual `ALTER TABLE` statement is required.**

For reference, the table DDL is:

```sql
CREATE TABLE ai_form_drafts (
    id             SERIAL PRIMARY KEY,
    user_id        INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    prompt         TEXT NOT NULL,
    generated_json JSON NOT NULL,
    status         VARCHAR(20) NOT NULL DEFAULT 'pending',
    form_id        INTEGER REFERENCES forms(id) ON DELETE SET NULL,
    created_at     TIMESTAMPTZ DEFAULT now(),
    accepted_at    TIMESTAMPTZ
);

CREATE INDEX ON ai_form_drafts(user_id);
```

### Status values

| Status | Meaning |
|---|---|
| `pending` | Draft generated and awaiting user review/acceptance |
| `accepted` | Draft converted into a real form |
| `discarded` | Draft rejected by the user |

---

## Migration 009 — Add `ai_analysis_reports` table

The **AI Form Analyzer** feature introduces a new table `ai_analysis_reports` that stores generated AI analysis reports for form versions.

Because this is a brand-new table, `Base.metadata.create_all(bind=engine)` creates it automatically on first application startup after the code update.
**No manual `ALTER TABLE` statement is required.**

For reference, the table DDL is:

```sql
CREATE TABLE ai_analysis_reports (
    id                      SERIAL PRIMARY KEY,
    form_version_id         INTEGER NOT NULL REFERENCES form_versions(id) ON DELETE CASCADE,
    user_id                 INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    submission_count_at_run INTEGER NOT NULL,
    report_json             JSON NOT NULL,
    created_at              TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX ON ai_analysis_reports(form_version_id);
```

---

## Migration 010 — Add `starts_at`/`ends_at` to `forms`

The **Form Scheduling** feature introduces open/close window time columns on the `forms` table.

Run the following SQL **once** against your database:

```sql
ALTER TABLE forms
    ADD COLUMN starts_at TIMESTAMPTZ,
    ADD COLUMN ends_at TIMESTAMPTZ;
```

---

## Migration 011 — Add duplicate detection settings to forms

The **Duplicate Response Detection** feature introduces settings on the `forms` table.

Run the following SQL **once** against your database:

```sql
ALTER TABLE forms
    ADD COLUMN duplicate_check_field_id INTEGER REFERENCES fields(id) ON DELETE SET NULL,
    ADD COLUMN duplicate_policy VARCHAR(20) NOT NULL DEFAULT 'allow';
```

---

## Migration 012 — Add `duplicate_override_requests` table

The **Duplicate Override Flow** introduces a new table `duplicate_override_requests` allowing respondents to request an owner override when their submission is blocked by a duplicate detection rule.

`Base.metadata.create_all(bind=engine)` creates this table automatically on startup.

For reference, the table DDL is:

```sql
CREATE TABLE duplicate_override_requests (
    id              SERIAL PRIMARY KEY,
    form_id         INTEGER NOT NULL REFERENCES forms(id) ON DELETE CASCADE,
    submission_id   INTEGER NOT NULL UNIQUE REFERENCES submissions(id) ON DELETE CASCADE,
    duplicate_value VARCHAR(500),
    status          VARCHAR(20) NOT NULL DEFAULT 'pending',
    requested_at    TIMESTAMPTZ DEFAULT now(),
    decided_at      TIMESTAMPTZ
);

CREATE INDEX ON duplicate_override_requests(form_id);
```





