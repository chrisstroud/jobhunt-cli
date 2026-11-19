## Shared pipeline selection

`hunts selection` reads the same saved Active Hunts / All Hunts view used by the
website Campaigns drawer, its original fingerprint, and eligible owned IDs/slugs.
`hunts selection-save --file INPUT_JSON` saves a reviewed view. Include the verified
`expected_account_id`, original `expected_fingerprint`, `selection` (`version: 1`,
`view`, `activeIds`), and `selected_hunt_ids` in the same order as those slugs.
Keep `request_id` and the unchanged file after an interrupted reply. A stale view
conflicts; an exact receipt retry returns current selection without reapplying an
older view. Selection changes no lifecycle, default Hunt, application, or other
preference. Read requires profile/campaign read; save adds profile write.
These commands are source/local-package candidates until hosted and distribution
acceptance is recorded.

## Exact PDF preparation originals

- `packages check-original --file ORIGINAL_JSON` reads the same accepted job.
- `packages close-original --file ORIGINAL_JSON` explicitly fences unused retry
  or reports historical acceptance/expiry. It never cancels accepted jobs or PDFs.
- The file contains captured `expected_account_id` and the complete `original`
  preparation input. Preserve request ID, workflow/fingerprint, application and
  selected document revisions, including legacy omitted/null account fields.
- Keep the original after an unconfirmed response. Pending/running/failed work
  is acceptance evidence, not a ready PDF. Check needs application/document-read;
  close additionally needs both write grants. Inspect saved packages separately.

## Exact checkpoint and restore recovery

- `documents check-version --file VERSION_ORIGINAL_JSON` reads the exact original
  outcome, including its original revision and version/recovery IDs.
- `documents close-version --file VERSION_ORIGINAL_JSON --confirm DOCUMENT_ID`
  fences unused retry or reports recorded/expired evidence. It never deletes a
  checkpoint, rolls back a restore or treats expiry as proof of no effect.
- The private JSON object contains `expected_account_id`, `operation_name`
  (`create_document_checkpoint_v2` or `restore_document_revision`) and `original`
  with the unchanged canonical mutation fields. Legacy omitted/null account fields
  retain their exact receipt identity. Check needs document-read; close also needs
  document-write. Keep the file after an unconfirmed reply.

## Current section-original recovery

- `documents check-section-save --file ORIGINAL_OR_INPUT_JSON` reads the exact
  receipt, including its original saved revision, even after source removal.
- `documents close-section-save --file ORIGINAL_OR_INPUT_JSON --confirm DOCUMENT_ID`
  explicitly fences unused retry or reports recorded/expired evidence. Keep the
  private file if no matching reply arrives. Closure never rolls back a document.
- The file is a compact section descriptor, or the exact canonical SDK input
  (including `value`) used by the current session editor. Arbitrary formatting of
  manually submitted raw native JSON is not reconstructed; use its exact descriptor.
- Checking needs `read:documents`; closure also needs `write:documents`. These
  commands do not add a native career-fact writer or infer human attribution.
- Modern current-editor originals support a 16MiB native value plus a 64KiB
  request envelope. Full merged content and snapshot metadata remain bounded;
  large originals use the same compact checks and explicit closure fences.

## Complete resume/profile saves

- `documents save-profile --file INPUT_JSON` applies a full native save. Keep this
  private file unchanged: account/document/request IDs, slug, displayed revision,
  and explicit fields bind the original. The command never automatically retries.
- `documents check-profile-save --file INPUT_JSON` checks the same original after
  a lost reply. It also accepts the compact original returned by a successful save.
  A recorded save does not claim that its revision is still the latest document.
- `documents close-profile-save --file INPUT_OR_ORIGINAL_JSON --confirm DOCUMENT_ID`
  fences an unused retry or reports `recorded`/`expired` evidence. Saved documents
  stay intact. A missing closure reply is not confirmation; retain the file.
- `documents save-profile-host-file --file DESCRIPTOR_JSON` uses an approved host
  carrier containing the exact native JSON body. This differs from the logical
  input above; use SDK `prepareResumeSave` for the body and original descriptor.
- `operations find --operation native_save_resume_profile_v1 --request-id UUID
  --payload-hash SHA256` optionally binds receipt lookup to the logical descriptor
  hash. `operations get UUID --payload-hash SHA256` also works.

Both `read:documents` and `write:documents` are required for saves; checking needs
read access. Full content stays in its native source, not audit/receipt metadata.
Source updates can affect an existing live Hunt Page. No publication setting is
changed and no application is sent. These commands remain prerelease pending
public distribution, supported-OS and hosted acceptance.

## Reviewed webhook test delivery and reconciliation

Use explicit `read:webhooks` and `write:webhooks` grants; job list/get needs read
only. Nothing changes default login grants or automatically repeats a mutation.

```sh
jobhunt webhooks review-test --file PLAN_JSON --output ORIGINAL_JSON
jobhunt webhooks send-test --file ORIGINAL_JSON --confirm SUBSCRIPTION_ID
jobhunt webhooks check-test --file ORIGINAL_JSON
jobhunt webhooks close-test --file ORIGINAL_JSON --confirm SUBSCRIPTION_ID
jobhunt webhooks jobs SUBSCRIPTION_ID --account-id ACCOUNT_ID
jobhunt webhooks job JOB_ID --subscription-id SUBSCRIPTION_ID --account-id ACCOUNT_ID
jobhunt webhooks review-reconciliation --file PLAN_JSON --output ORIGINAL_JSON
jobhunt webhooks reconcile --file ORIGINAL_JSON --confirm SUBSCRIPTION_ID
jobhunt webhooks check-reconciliation --file ORIGINAL_JSON
jobhunt webhooks close-reconciliation --file ORIGINAL_JSON --confirm SUBSCRIPTION_ID
```

Test plans contain expected_account_id, subscription_id, request_id (UUID), and
expected_metadata_sha256 from the complete metadata manifest. Review saves a new
private original; output contains metadata only. Retain it after interrupted replies.
The test queues a synthetic event only; no application/document payload is supplied.
An accepted queue result does not prove receiver success. Closing an accepted
original preserves its work; only an unused original is blocked.

Reconciliation plans contain account/subscription/job/request IDs and the exact
expected_fingerprint from job status. Review/reconcile only accepts a matching
committed HTTP2xx receipt without a live worker; it never sends or overwrites that
receipt. Unconfirmed delivery stays unconfirmed. New synthetic tests preserve
native paused-endpoint diagnostics and do not reset real delivery health counters.
Current Next controls, actual hosted/OS acceptance and unknown-outcome/legacy queue
closeout remain required; public package distribution remains prerelease.

## Complete webhook configuration files

Use a private UTF-8 JSON file up to **16 MiB** when configuration exceeds compact
message limits. Creation fields are `url` and `events`; updates accept `url`,
`events`, and `is_active`. Native validation and permissions remain authoritative.
Do not include signing keys or private recipients in configuration files.

- For file creation, the preparation plan contains only `expected_account_id`.
  Add `--attributes-file FIELDS_JSON` to `webhooks prepare-recipient`,
  `review-create`, and `issue`. The recipient retains an exact SHA-256/byte-count
  descriptor. Keep the unchanged fields file, private recipient, and original.
- `webhooks review-fields-update --file PLAN_JSON --attributes-file FIELDS_JSON
  --output ORIGINAL_JSON` reviews a patch and saves its exact private original.
  The plan contains account/request/subscription IDs, `action: "update"`, and
  `expected_metadata_sha256` from `metadata-manifest`. Source descriptors are
  computed locally; supplied descriptors must match the file exactly.
- `webhooks update-fields --file ORIGINAL_JSON --attributes-file FIELDS_JSON
  --confirm SUBSCRIPTION_ID` applies the reviewed patch. Omitted fields stay as-is.
  These commands never send a test event or disclose a signing key.
- Existing creation `check-create`, `check-delivery`, `receive`, `acknowledge`,
  and `close-create` commands recognize compact and file originals. Use
  `check-fields-update --file ORIGINAL_JSON` or `close-fields-update --file
  ORIGINAL_JSON --confirm SUBSCRIPTION_ID` for a file update. Recovery and closure
  need the original descriptor, not a live attributes download. They never create
  a replacement webhook. Unknown outcomes require reconciliation before retry.

Recipient/original/signing files use the existing private-file checks and exclusive
creation. Keep fields files private too. Signing keys are decrypted locally into
a new private file; stdout contains metadata only. No automatic mutation retries.
The public CLI remains prerelease until registry/OS/hosted acceptance is verified.

## Protected webhook creation and signing delivery

`client.webhooks.issuance` provides `review`, `issue`, `get`, `check`,
`acknowledge` and `close`. Use explicit read/write webhook grants; new outbound
subscriptions also require the affected event-data read grants. The exact
actor/account/request/recipient-bound original is reviewed for 15 minutes.

- Local `webhooks prepare-recipient --file PLAN_JSON --output RECIPIENT_JSON
  --confirm ACCOUNT_ID` creates a private recipient. `recipient --recipient-file
  RECIPIENT_JSON` exposes public material only; neither command uses login/network.
- `review-create --recipient-file RECIPIENT_JSON --output ORIGINAL_JSON` saves the
  exact private original before creation. `issue --file ORIGINAL_JSON
  --recipient-file RECIPIENT_JSON --confirm ACCOUNT_ID` creates once. Keep both files.
- `check-create --file ORIGINAL_JSON` resolves the receipt; `check-delivery --file
  ORIGINAL_JSON` reads delivery state. Unknown replies require checking/reusing
  that exact original, never another request ID or blind automatic retry.
- `receive --file ORIGINAL_JSON --recipient-file RECIPIENT_JSON --output
  PRIVATE_SIGNING_FILE --confirm SUBSCRIPTION_ID` decrypts only into a new private
  file. Output is metadata only. Retain the recipient securely; losing it prevents
  decryption. Delivery expires after 24 hours.
- `acknowledge --file ORIGINAL_JSON --recipient-file RECIPIENT_JSON --secret-file
  PRIVATE_SIGNING_FILE --confirm SUBSCRIPTION_ID` verifies the retained local file
  before server ciphertext redaction. `close-create --file ORIGINAL_JSON --confirm
  ACCOUNT_ID` fences unused intent or reports recorded work; it never deletes a
  created subscription. No file overwrite, secret stdout or automatic write retry.
- Additive `jh_webhook_signing_deliveries` migration is required before traffic.
  Current Next webhook UI, complete native-size files, test/status/worker recovery,
  public distribution and supported-OS acceptance remain required. The signing
  delivery receipt is kept in the repository at the Git tag `archive/process-docs`
  (`docs/project-simplification/2026-10-23-webhook-signing-delivery.md`).

## Interrupted Quick Add originals

## Reviewed webhook changes

`client.webhooks.changes` supports `review`, `apply`, `check` and `close`.
Optional `read:webhooks` + `write:webhooks` do not expand login defaults. Active
edits also require read access to the old/new/queued event data.

- Plan JSON: captured `expected_account_id`, UUID `subscription_id`/`request_id`,
  `expected_metadata_sha256` from the subscription metadata manifest, `action`
  (`update`/`delete`) and changed `attributes` for update only (`url`, `events`,
  strict boolean `is_active`). Compact limit:2048 URL characters and1000 events;
  complete native-capacity configuration transport remains required work.
- `webhooks review-change --file PLAN_JSON --output ORIGINAL_JSON` reviews the
  current source and saves a new private original before any change. Review output
  contains counts/IDs/hash/expiry; it never prints the proof or destination.
- `webhooks update|remove --file ORIGINAL_JSON --confirm SUBSCRIPTION_ID` explicitly
  applies that saved original. `webhooks check-change --file ORIGINAL_JSON` checks
  the exact receipt; `webhooks close-change --file ORIGINAL_JSON --confirm
  SUBSCRIPTION_ID` fences an unused intent. No automatic retry or file overwrite.
- Preserve the exact original, including omitted fields. Review lasts15 minutes;
  exact accepted replay/check does not overwrite later changes or need a live
  deleted target. Deletion refuses live workers and removes owned delivery history
  and private queued payloads. Receipts contain no signing secret/event body.
- Protected creation/delivery is covered above. Full-size configuration files,
  reviewed test/status/recovery, current Next UI and hosted/OS/distribution
  acceptance remain open. New queued events refuse changed destinations; retained
  legacy unbound jobs still need explicit cutover drain/reconciliation.

## Nonfinancial webhook reads

`client.webhooks` and CLI `webhooks` read owned subscriptions and delivery-attempt
history using explicit `read:webhooks`. Ordinary login grants are unchanged.

- `list` / `deliveries` return stable ID pages of at most 25 summaries, including
  inactive subscriptions and failed attempts. `get` / `delivery` return native
  metadata. Oversized compact reads return `needs_input` directing you to the
  complete file; nothing is truncated. Signing secrets, event payloads and response
  bodies are excluded.
- Every read requires the captured `expected_account_id`; CLI uses `--account-id`.
  `webhooks get UUID`, `webhooks deliveries UUID`, and
  `webhooks delivery UUID --subscription-id UUID` bind exact owned parent/record.
- Complete native URL/events/error details beyond compact tool limits use
  `webhooks.metadata.manifest` / `.download` and CLI
  `webhooks metadata-manifest --file JSON` /
  `webhooks metadata --file JSON --output PATH --confirm ACCOUNT_ID`.
  Selection JSON contains `expected_account_id`, `subscription_id`, and an optional
  `delivery_id`. Chunks and complete bytes are checksummed; changed sources fail.
  CLI saves a new private file, never overwrites or prints its contents.
- Reads create no subscription, delivery, test request or worker job. Attempt history
  is not a queue/completion guarantee. Configuration, signing-secret delivery,
  reviewed test dispatch and delivery recovery remain migration work. These local
  interfaces do not establish hosted/public distribution or supported-OS acceptance.


## Deletion recovery

Save the private recovery file from the current browser confirmation/progress
flow. Downloading never requests deletion; a draft receipt does not authorize
recovery until its separate password/email-confirmed acceptance. Keep the file
private (POSIX mode0600 or a protected Windows owner-only ACL) and bound to its
exact product origin.

- `ErasureRecoveryClient(file).status()` / `.retry(requestId, true)` use separate
  restricted HTTP authority; ordinary account credentials and browser cookies are
  not used. CLI: `account erasure-status --recovery-file PRIVATE_JSON` and
  `account retry-erasure --recovery-file PRIVATE_JSON --confirm REQUEST_ID`.
- For MCP use a separate `/mcp/account-erasure` connection with the receipt in
  private Bearer configuration, never chat/tool arguments. Only status and retry
  tools exist on that connection; it cannot read account records or start deletion.
- Replaced/expired receipts fail. Retry never displaces a live worker or revives
  access. No automatic retry, ordinary vault lookup or private credential output.
  Native fresh identity proof remains in the browser. Public registry, actual
  rendered and hosted acceptance remain unverified.

## Application-only exports

- `applications export-manifest --file query.json` reads all-Hunt JSON/CSV metadata.
- `applications export --file query.json --output private.csv --confirm ACCOUNT_ID`
  verifies all chunks and saves a new private file; no overwrite or private bodies
  on stdout. Query: `{ "expected_account_id": "jh_<account UUID>", "format": "csv" }`.
- CSV preserves the native seven columns and requires `read:applications`.
  JSON also includes saved resume content and requires `read:documents`.
- These are application-only exports. Account JSON/ZIP is separate. No automatic
  retries or saved snapshots. Windows private downloads use native protected ACLs.


`workspaceOriginals` and CLI `captures` recover the same private task, interview,
Hunt (`search`), company and contact create originals as the current browser.
They preserve the native request/receipt and real bearer credential.

- Stage complete original arguments JSON with `stageFile(intent, bytes)` or
  `captures stage-file --file INTENT_JSON --original ARGUMENTS_JSON --confirm ACCOUNT_ID`.
  The intent contains kind, account, request and application ID for task/interview.
  Those identity fields must match the full file. Approved private host staging
  uses `stageHostFile` / `captures stage-host-file`, with exact size/SHA-256.
- `list` requires a kind and account. Other methods use a pointer containing
  `expected_account_id`, `kind`, `request_id`, `expected_payload_hash`. List/check
  create nothing. Complete input fits the native 16 MiB command envelope; compact
  public task-create limits and no-Calendar behavior remain unchanged.
- `captures download --file POINTER_JSON --output PATH` verifies every chunk,
  canonical original hash and final manifest before writing an exclusive mode0600
  file. It never prints private bodies or replaces a file/symlink.
- Review every Calendar-effect page. Retry requires the credential-bound15-minute
  review and confirmed total. Task/interview require calendar-read; nonzero effects
  also require calendar-write. Provider delivery is separate. Zero stays zero.
- `captures retry|resolve --file JSON --confirm ACCOUNT_ID` is explicit. Unknown
  responses require checking this original, never a new request. Confirmation
  requires an accepted native receipt; discard clears temporary bytes, keeps
  saved records and fences late retries. No command automatically retries writes.

# JobHunt CLI

This is an early prerelease of the JobHunt CLI. Use it with a JobHunt
account; your account ownership, grants and publication choices still apply.
The current commands cover account identity, application/contact records and
versioned task workflows (including recurring dates and schedules), and application
workspace records (notes, tasks, follow-ups, interviews and linked people), and
saved job-search website bookmarks and account task preferences. It also covers
job capture, revision-safe pipeline moves, explicit user-reported submissions and
document authoring/library/history with reviewed text/PDF/DOCX imports, role-specific
application documents, verified private PDF preparation/download, and temporary saved-document PDF/DOCX and Hunt Page PDF/DOCX/Markdown/plain-text exports. Other
JobHunt workflows are still being mapped and implemented; this is not full
HTTP/MCP/CLI parity or a stable release. Registry installation, native credential
stores and hosted workflows are separate release checks; source tests alone do
not establish them. Use the exact verified package version from the release
receipt, and keep your saved originals until an uncertain write is resolved.

## Account data export

- Request `read:account-export` explicitly when connecting; CLI OAuth also needs
  `read:profile`. Ordinary login defaults do not include whole-account exports.
- `account export-manifest --file query.json` inspects counts, size and checksum.
  The query contains `expected_account_id` (`jh_` plus the verified account UUID)
  and `format` (`json` or `zip`). Optional `exported_at` pins the export timestamp;
  it does not freeze saved records. Reads create no records or jobs.
- `account export --file query.json --output private.zip --confirm ACCOUNT_ID`
  checks every chunk and the final source, then writes a new private file. It
  refuses existing files/symlinks, unsafe directories and account changes. Private
  bytes never enter stdout; an interrupted or conflicting read is not retried.
- Both formats contain the same eleven native record groups as Settings:
  account profile, applications, resume templates, job searches, contacts,
  companies, tasks, interview steps, change receipts, resume import records and
  job-search preferences. Uploaded/generated files and some newer document
  models are excluded. This is not a complete backup or restore feature.
- JSON/ZIP renders use consistent read-only snapshots. An edit during download
  invalidates the checksum; request a fresh manifest rather than combine sources.
  Windows private files require native ACL validation; no Unix-mode substitution
  is allowed. Public distribution and hosted/OS acceptance remain.

Requires Node.js 22.23.3 or newer. The manual package lane checks Linux, macOS and
Windows. Package checks are separate from native login-vault and hosted product
acceptance. Build from the product repository:

```sh
cd packages
npm ci --ignore-scripts
npm run verify
npm run pack:smoke
node cli/dist/jobhunt.js --help
```

The smoke check builds twice, checks identical package integrity and an exact
file allowlist, installs local CLI/client tarballs with anonymous npm configuration
into a clean directory, and checks the executable, Node import and TypeScript
declarations without workspace source or special compiler flags. It does not prove that
the CLI is downloadable from the public registry. After publication, install the prerelease with:

```sh
npm install --global jobhunt@0.1.2
jobhunt --version
jobhunt --help
```

Prereleases use the `next` tag, leaving `latest` for a future stable release. Pin
the exact version in automation. There is no earlier verified public version to
fall back to; preserve private originals and follow forward-fix release notes.

## Interrupted Studio originals

The additive `studioOriginals` client namespace and `originals` CLI commands share
the current browser's durable private originals and native receipt. Ordinary
public record-save methods keep their existing no-implicit-Calendar contracts.
This separate workflow never substitutes a session for a bearer credential.

1. Stage a complete UTF-8 fields object using `stageFile(intent, bytes)` /
   `originals stage-file --file INTENT_JSON --fields FIELDS_JSON --confirm ACCOUNT_ID`.
   Approved private-host staging uses `stageHostFile` / `originals stage-host-file`.
   Staging stores input only. Preserve the original account, application revision,
   request and optional saved-record fingerprint. Every kind field is required;
   the full command must fit the native 16 MiB envelope.
2. `list` / `originals list --file JSON` discovers metadata without private bodies.
   Use optional `kind` to discover only originals covered by that kind's write
   grant. `check` reads the original save receipt and performs no write.
3. `manifest` and `download` / `originals download --file POINTER_JSON --output PATH`
   verify every chunk, complete SHA-256, canonical original payload and final
   manifest. The CLI publishes an exclusive mode-0600 file only after verification;
   it never prints the body or overwrites a file/symlink.
4. `review` returns a credential-bound 15-minute proof and every current potential
   Calendar handoff in pages of 25. Review all pages. Task/interview policy review
   needs calendar-read access. `retry` requires that proof plus the exact
   `confirm_calendar_handoff_count`; Calendar-write access is needed when handoffs
   exist. A reviewed zero-effect retry admits no Calendar job. CLI retries also
   require `--confirm ACCOUNT_ID`. Provider delivery is a later worker outcome.
5. `resolve` accepts `disposition: confirmed` only after the exact successful
   receipt, or explicit `discarded` to retire the draft and fence a late retry.
   It keeps any saved record. CLI resolution requires `--confirm ACCOUNT_ID`.

Pointers contain `expected_account_id`, `application_id`, `request_id` and
`expected_payload_hash` from discovery/staging. No command automatically retries
writes. After an unknown reply, check the original; never choose a new key to
work around it. Private bytes expire after 24 hours while the no-recreation fence
remains. Expired receipts require saved-work review, never recreation. Public
registry/OS/provider/hosted acceptance and full migration remain outstanding.

## Complete application record files

- `applications record-files --file query.json`: paginate one application's
  notes, ordinary tasks, follow-ups, interviews or linked contacts by `kind`.
- `applications record-file --file target.json`: review the exact record manifest.
- `applications record-download --file target.json --output private.json`:
  verify complete bytes and source before writing a new private file; never
  overwrite an existing file or symlink.
- `applications record-save-file --file intent.json --fields fields.json --confirm ACCOUNT_ID`:
  save full fields up to 16 MiB after explicit account confirmation.
- `applications record-save-host-file --file host-intent.json --confirm ACCOUNT_ID`:
  use a verified approved private host reference through the same operation.

Read targets contain `application_id`, `kind` and `record_id`. Queries omit
`record_id` and add optional `page`/`per_page`. Writes require `application_id`,
`kind`, `expected_account_id`, `expected_revision` and `request_id`; existing
records also require `record_id` and `expected_fingerprint`. The fields file is a
JSON object using the ordinary record field names, without authority fields.
For uncertain writes, use the exact original intent/file or read its
`save_application_record_file_v1` receipt. Never automatically start a replacement
request. Public writes preserve task/interview history but do not implicitly
change Calendar events. Recurring tasks retain their specialized workspace.

## Document defaults

`jobhunt document-settings get` reads the same account download and page-size
preferences as Settings → Resumes & sharing → Documents. Reads create nothing.
`jobhunt document-settings update --file intent.json` accepts the exact
`expected_account_id`, `expected_fingerprint`, a fresh UUID `request_id`, and a
nonempty `patch`: `default_download` (`combined`, `resume`, `separate`) and/or
`default_page_size` (`us-letter`, `a4`). Omission preserves a value; null is rejected.
Read requires `read:profile`; editing also requires `write:profile`.

Keep the complete original file and UUID after an interrupted response. An exact
retry returns the original receipt and current settings; a stale fingerprint
requires a fresh read and a new explicit intent. Linen/Balanced remain fixed;
this command does not edit documents, regenerate prepared files or change UI
palettes. Current Studio and private exports apply the saved paper size; package-composition
defaults, remaining native consumers and hosted acceptance remain under review.

## Export paper size

Document export inspection/preparation accepts optional `page_size`: `a4` or
`us-letter`. Document/application bundle selections accept the same field.
Omit it to use the account paper default. Explicit null and other values fail.
The inspection's review label states the resolved paper; its fingerprint includes
that choice. A changed default requires a new review unless an explicit override
was selected. Overrides never save preferences or edit documents.

Keep the same optional fields, request UUID and complete original input after an
interrupted preparation. Accepted jobs retain their captured size after later
settings changes. Previously prepared jobs keep their original renderer size.
Hunt Page layout/publication and library JSON archives remain separate choices.

## Complete compensation

`applications compensation APPLICATION_UUID` returns the saved JSON revision,
checksum and complete download manifest. Use
`applications compensation-download APPLICATION_UUID --output compensation.json`
to save every verified chunk privately (0600), without overwriting an existing
file. Custom fields, long notes, zero values and historical JSON integers are
preserved; the CLI never parses and re-serializes the value file.

Replace compensation with
`applications compensation-replace APPLICATION_UUID --intent intent.json --file compensation.json --confirm APPLICATION_UUID`.
The intent file contains `request_id`, `expected_account_id`, `application_id`,
`expected_revision` and `expected_sha256` from the reviewed manifest. The value file
is a complete UTF-8 JSON object or `null`, at most 16 MiB. This replaces the whole
compensation object; omitted keys are removed. It never moves the application stage.

The client reserves private input, uploads bounded chunks and commits once.
Temporary input expires after 15 minutes; at most three open inputs are allowed.
Unfinished staging never edits the application. After an uncertain reply, rerun
with the **same intent and identical value bytes**; do not generate a new request
ID or silently refresh the reviewed revision/checksum. A stale review requires
reviewing current work before a new intent. Applied/cancelled/expired input bytes
are cleared; receipt storage contains only IDs, hashes and status facts.

Low-level `compensation-prepare`, `compensation-append`, `compensation-draft`,
`compensation-commit` and `compensation-cancel` commands expose the same public
workflow. Read and write grants remain required for staged input; complete saved
compensation downloads require only `read:applications`. These local contracts
do not establish current browser editing, hosted migration or public distribution.

## Today and search routines

```sh
jobhunt auth login --profile routine --scopes read:profile,write:profile,read:tasks,read:applications,read:interviews,read:activity
jobhunt today get --date 2026-10-21 --profile routine --json
jobhunt routine list --links-page 1 --targets-page 1 --aggregators-page 1 --profile routine --json
jobhunt routine get --kind aggregator --id "Custom" --profile routine --json
jobhunt routine save --file reviewed-change.json --profile routine --json
```

Supply your local calendar date explicitly for Today. It uses the browser agenda
composer, current recurring-date status and recent factual activity. Its existing
1 MiB response budget remains; this composition is not an account export.
Routine reads do not create defaults. Each directory has independent pages,
`total` and `has_more`; the default page size is 25, maximum 100, without a
1,000-record directory ceiling. Use the returned full-state `fingerprint` when
reviewing any edit, including records on a later page.

A change JSON carries `request_id`, `expected_account_id` from `account connected`,
`expected_fingerprint`, `kind` (`link`, `target`, `aggregator`) and `action`.
Create/update use typed `fields`: links accept label, URL, aggregator and enabled;
targets accept name, careers URL and pinned; aggregators accept a name on create.
Omitted fields remain. Null clears optional careers URLs or a link's aggregator.
Move requires an exact `entity_id` and `direction` (`up` or `down`). A link's
`opened` action records a user-reported opening and moves it to the end; it does
not fetch or launch the URL. Unknown saved metadata is retained.

Delete requires `action: "delete"`, `entity_id`, `confirm_delete: true` and
`--confirm EXACT_ENTITY_ID`. Aggregator IDs are their exact names, including
spaces and case. Keep the original request ID and complete intent after an
uncertain response. Replaying returns the original receipt with current owned
record state; it never repeats the change. A changed browser record invalidates
an old fingerprint. Native workspace names retain their existing envelopes and
receipt namespaces. Never replay a native intent under `change_search_routine`: the
operation names and input envelopes differ. Use `operations find` with the original
operation name/request ID to recover an uncertain native save.

## Private saved-record references

```sh
jobhunt auth login --profile references --scopes read:profile,read:applications,read:documents,read:campaigns
jobhunt references find --query "supplied role or document name" --profile references --json
jobhunt references get --uri "EXACT_RETURNED_JOBHUNT_URI" --profile references --json
```

Lookup returns at most 20 lightweight owned application/document resource links.
An empty query returns recent suggestions; `has_more` means refine the query,
not a complete account list. Use the exact returned URI even when labels match.
`get` reads its selected revision and rejects changed, deleted, archived or foreign
records; run lookup again on a stale reference. Role drafts retain their owned
application context, while masters never guess one. Reads never edit or submit.
Private document facts can appear in `get` output; keep it out of shared logs.
HTTP and MCP use the same services, including MCP resource reads and the optional
host mention picker. No embedded UI is required for the CLI.

## Saved Hunt preferences and context

```sh
jobhunt auth login --profile preferences --scopes read:profile,write:profile,read:campaigns,read:documents,read:applications
jobhunt hunt-settings get --profile preferences --json
jobhunt hunt-settings update --file reviewed-preferences.json --profile preferences --json
jobhunt context get --profile preferences --json
jobhunt context get --hunt-id HUNT_UUID --profile preferences --json
```

`hunt-settings get` returns the connected account, exact preference revision,
current Hunt IDs and bounded Hunt/master-resume choices. Check `more_hunts` and
`more_resumes`; use `hunts list` and `documents list` for further discovery.
Unavailable defaults remain explicit. Reads never initialize settings or choose
a default. `context get` resumes from saved work; `--hunt-id` selects only this
request's context and does not change the saved current Hunt. Ambiguous searches
return `needs_input`. Saved targeting is preserved even when legacy values exceed
new preference-write limits. Role-specific drafts never become master defaults.

A reviewed preference intent uses this shape (identifiers are examples):

```json
{
  "request_id": "11111111-1111-4111-8111-111111111111",
  "expected_account_id": "jh_22222222-2222-4222-8222-222222222222",
  "expected_revision": 1,
  "set": { "work_pattern": "remote", "quiet": false, "follow_up_days": 0 },
  "clear_fields": ["preferred_resume_id"]
}
```

Read your actual account and revision first. Only supply choices the user asked
to save. Omitted fields stay unchanged; explicit `null` remains a saved value;
`clear_fields` forgets a field. Clearing the preferred resume also suppresses an
implicit master fallback. A field cannot be both set and cleared. Preferences
cover timezone, tone, length, role interests, locations, work pattern, master
resume, follow-up days and quiet mode. Account preference lists allow 20 entries;
per-Hunt criteria use `hunts save` and their separate full-field contract.

Keep the complete original intent and request ID after an uncertain response.
Use `operations find --request-id UUID --operation update_job_hunt_preferences`
and retry that exact intent. A stale revision requires a fresh read and review;
never silently replace its revision or connected account. Selecting a master
requires `read:documents`, including exact receipt retries. No publication,
application move, billing action or task completion follows from these preferences.

## Pipeline stages

```sh
jobhunt auth login --profile pipeline --scopes read:profile,read:applications,write:applications,read:tasks,write:tasks
jobhunt pipeline get --page 1 --profile pipeline --json
jobhunt pipeline create-stage --file reviewed-stage.json --profile pipeline --json
jobhunt pipeline rename-stage --file reviewed-rename.json --profile pipeline --json
jobhunt pipeline reorder-stage --file reviewed-order.json --profile pipeline --json
jobhunt pipeline remove-stage --file reviewed-removal.json --confirm STAGE_UUID --profile pipeline --json
```

Configuration reads return 25 stages per page, stable IDs/types, system/terminal
flags and application/task/checklist-assignment counts. Follow `has_more`. The
fingerprint covers the complete pipeline and related application/checklist state,
independently of page; related changes invalidate a write review. Reads never
initialize stages. `applications stages` remains a simpler reference read.

Every write carries the original `request_id`, verified `expected_account_id` and
`expected_fingerprint`. Create also takes `name` and zero-based `position`; rename
takes `stage_id` and `name`; reorder takes `stage_id` and `position`; removal takes
`stage_id` and optional `migrate_to_id`. Large positions append. Creation initializes
the existing default pipeline first when none exists, matching the browser add
action. It only adds custom, non-system, non-terminal stages. No task is created.

Stage names allow 1–100 characters. Renaming preserves the stable stage ID/type,
changes current application labels and versions together, and records no new
submission or stage milestone. Applied cannot be first or last. System stages
can be renamed but not removed. A nonempty removed stage requires another owned
migration target; moving into Applied requires an already reported submission.

Removing a stage detaches and preserves **all** backing tasks, including unassigned
templates, and keeps existing checklist notes, dates and completion records. It
requires `write:tasks` in addition to stage grants. Automatic task generation and
completion remain retired. Existing templates can be reviewed with
`stage-templates list --include-detached`.

Keep the exact original intent after an uncertain reply. Recover with
`operations find --request-id UUID --operation create_pipeline_stage_v2` (or the
corresponding rename/reorder/remove operation), then retry unchanged. Returned
`current` is a fresh projection and may be null if the stage was removed later.
Never replace a stale fingerprint or account silently. A new change needs a fresh
review and request ID. Receipt resource IDs here identify pipeline stages within
the application permission family, not application records.

## Reassign every application to a Hunt

```sh
jobhunt auth login --profile hunts --scopes read:profile,read:campaigns,write:campaigns,read:applications,write:applications
jobhunt hunts assignment-review HUNT_UUID --profile hunts --json
jobhunt hunts assign-all --file reviewed-assignment.json --confirm HUNT_UUID --profile hunts --json
```

Review the exact connected account, destination, total application count, moving
count and fingerprint before requesting this account-wide change. It includes
applications without a Hunt and those already assigned elsewhere. Existing owned
destination lifecycle states are supported, matching the browser bulk action.
Neither this action nor its review selects the saved current Hunt.

```json
{
  "request_id": "11111111-1111-4111-8111-111111111111",
  "expected_account_id": "jh_22222222-2222-4222-8222-222222222222",
  "search_id": "33333333-3333-4333-8333-333333333333",
  "scope": "all",
  "expected_fingerprint": "<exact fingerprint from assignment-review>",
  "expected_application_count": 12,
  "expected_moving_count": 8
}
```

Use your actual IDs, counts and fingerprint. Changes to destination or application
state invalidate the review. The operation changes only Hunt associations,
application versions and update timestamps; stages, documents, tasks, publication
and application activity remain intact. Other accounts' applications never move.

Keep the complete original intent/request ID after an uncertain reply. Use
`operations find --request-id UUID --operation assign_all_hunt_applications_v2`,
then retry that exact intent. A receipt retry identifies the original operation
and returns current counts; it does **not** repeat the move if applications were
added or moved later. `all_assigned: false` on a replay means current state has
changed since the accepted action. A new move requires a fresh review and request.

## Hunt management

```sh
jobhunt auth login --profile hunts --scopes read:profile,read:campaigns,write:campaigns,read:companies,read:documents,read:applications,write:applications
jobhunt hunts list --profile hunts --page 1 --json
jobhunt hunts get HUNT_UUID --profile hunts --json
jobhunt hunts create --file create.json --profile hunts --json
jobhunt hunts save --file reviewed-hunt.json --profile hunts --json
jobhunt hunts set-current --file current-hunt.json --confirm HUNT_UUID --profile hunts --json
jobhunt hunts delete --file delete-hunt.json --confirm HUNT_UUID --profile hunts --json
jobhunt pipeline initialize --file initialize.json --profile hunts --json
```

All writes carry a stable `request_id` and may include the verified
`expected_account_id`. Creation takes `name` and optional `start_date`. Listing
returns 25 Hunts per page, including archived/completed Hunts, and exact
`current_ids`. Detail returns metadata, complete saved `fields` and a fingerprint;
company/resume choices stay in their paginated commands. Reads preserve legacy
criteria/notes without silently repairing them. New criteria writes obey the
current complete-field schema: copy and explicitly review every field rather
than treating the payload as a patch. No omitted criteria are cleared implicitly.

`hunts save` takes `search_id`, `expected_fingerprint` and `action`: `update`
requires the complete `fields`; `pause`, `resume`, `archive`, `restore`, `complete`
and `reopen` use the existing browser rules. `complete` requires the user-chosen
`outcome` (`no_offer` or `cancelled`). Accepted-offer completion remains part of the
explicit offer workflow; this command never invents an offer. The saved current
Hunt cannot be paused, archived, completed or deleted.

Current selection takes `search_id`, `expected_revision`, and the exact
`expected_current_ids` from the list. Deletion takes `search_id`,
`expected_revision`, and `expected_application_count`. When applications exist,
supply an owned active `migrate_to_id` and its `expected_target_revision`;
applications move and retain their contents, never disappear. Current selection
and deletion require matching CLI confirmation. Pipeline initialization takes only
the mutation intent; it reuses existing stages and never resets a pipeline.

Keep the original input after a lost response. Recover using `operations find`
with the original request ID and `create_job_search_v2`, `save_hunt_details_v2`,
`set_current_job_search_v2`, `delete_hunt_record_v2`, or
`initialize_job_pipeline_v2`, then retry that exact intent. A changed payload
requires a new request ID. Default login permissions remain unchanged. These are
locally verified prerelease commands; hosted/public distribution, account-wide
preferences, bulk application reassignment and the remaining pipeline-operation
inventory still need acceptance.

## Authentication

```sh
jobhunt auth login
jobhunt auth status --json
jobhunt whoami --json
jobhunt auth logout
```

### Local MCP bridge

`jobhunt mcp` runs a local MCP server on standard input and output for apps that
cannot sign in to `https://jobhunt.app/mcp` themselves (LM Studio, Jan). Run
`jobhunt auth login` once. The bridge forwards each message to `/mcp` with the saved
sign-in, refreshing it as needed; the token stays in the credential store and never
appears in the app's config. It grants the same scopes as the saved sign-in. If the
sign-in is revoked, requests fail with a message to run `jobhunt auth login` again.
It does not follow redirects or print the token.

```json
{ "mcpServers": { "jobhunt": { "command": "npx", "args": ["-y", "jobhunt", "mcp"] } } }
```

Login opens JobHunt's existing browser consent flow. The public client uses
S256 PKCE, random state and an ephemeral IPv4 loopback callback; no client secret
or password is requested. `--no-browser` prints the authorization URL and waits
for you to open it. The URL contains a short-lived authorization challenge; do
not paste it into tickets or shared logs. Login requests `read:profile`,
`read:applications` and `write:applications`. Browser cookies are used only by
the browser during consent, never by application commands.

Use `--scopes` to replace those defaults with explicit permissions. For contact-only
access, use a separate profile:

```sh
jobhunt auth login --profile contacts --scopes read:profile,read:contacts,write:contacts
jobhunt contacts list --profile contacts --json
```

API-key metadata and delegated issuance/revocation use explicit `read:developer`
and `write:developer` grants. These are optional login permissions; defaults stay
unchanged. A delegated credential can only create keys with scopes it already
holds. Reviewed issuance, encrypted delivery and original recovery use the commands
below; plaintext keys never appear in command output.

For complete native-size records, use `api-keys list-summary [--after KEY_ID]`
and `api-keys get-summary KEY_ID`. These bounded replies include exact permission
counts and a source-bound full-file manifest. `api-keys download-permissions
KEY_ID --output PRIVATE_FILE` verifies the complete private JSON before exclusive
mode0600 creation, fsync and readback. It refuses existing files/symlinks. Stdout
contains counts/hash/target metadata only, never the permission body or a key.

`api-keys review-revoke-summary --file review.json` uses the same three input
fields and actor-bound proof as `review-revoke` below, with a bounded summary.
Keep that original for the existing revoke/check/close commands. Current Account
controls use these shared summary/file services. Full native browser attribute-file
creation, hosted/client and protected-store/OS acceptance remain required.

`api-keys list [--after KEY_ID]` reads customer key metadata, native quota usage
and expiry/revocation facts. Follow `next_after` while `has_more` is true.
`api-keys get KEY_ID` reads one key and its management fingerprint. Neither
command returns plaintext credentials or hashes. Operator keys retain their
separate registry and authorization.

`api-keys review-revoke --file review.json` reviews an exact `key_id`,
`expected_account_id` and `expected_fingerprint`. Preserve the returned
`review_token` with those fields, one UUID `request_id`, and `confirm_revoke: true`
in your original revoke JSON. Then use
`api-keys revoke --file revoke.json --confirm KEY_ID`.
The review expires after 15 minutes and binds the current connection and key.
Do not replace the original request after a lost response. Use
`api-keys check-revoke --file locator.json` with its `request_id` and
`expected_account_id`, or explicitly retry the identical original JSON.
An accepted original never changes later key state. Self-revocation disconnects
that credential; checking a lost result needs another authorized connection.

`api-keys close-revoke --file revoke.json --confirm KEY_ID` explicitly closes the
unchanged original. It either fences a never-recorded request against late writes
or acknowledges the already recorded outcome. It never undoes a revocation or
revokes a replacement key. Keep the full original JSON until closure is confirmed.

Current Next metadata and revocation controls use the same shared services.
Current Next creation controls retain a nonextractable recipient and original
through reload, with masked local delivery and verified acknowledgment. Native issuance still reveals
its secret once and is not automatically retried. Public registry, hosted limits
and supported-OS acceptance remain separate.

### Create and receive a key privately

Use an existing private directory you own. The commands create exclusive mode0600
files on POSIX and protected owner-only files on Windows. They reject existing
output, symlinks, hardlinked inputs and unsafe ownership or permissions. Windows
requires Windows PowerShell's native ACL APIs and local filesystem paths; network
shares, alternate streams and device aliases are refused. Bytes are flushed and
verified before exclusive publication. An unavailable ACL API fails closed.
Private recipient and secret files must stay outside public/static folders and
repositories. Native credential-manager and hosted acceptance remain separate.
No command here touches the default keychain.

Start with `plan.json` containing `expected_account_id` from your connected account
and `attributes` (`name`, explicit `scopes`, optional legacy `tier`/`expires_at`).
Replace `ACCOUNT_ID` and `KEY_ID` below with the returned exact IDs. Your current
credential must hold `write:developer` and every scope you delegate.

```sh
jobhunt api-keys prepare-recipient --file plan.json --output recipient.private.json --confirm ACCOUNT_ID --json
jobhunt api-keys review-create --recipient-file recipient.private.json --output issue.original.json --json
jobhunt api-keys issue --file issue.original.json --recipient-file recipient.private.json --confirm ACCOUNT_ID --json
jobhunt api-keys check-delivery --file issue.original.json --json
jobhunt api-keys receive --file issue.original.json --recipient-file recipient.private.json --output key.private.txt --confirm KEY_ID --json
jobhunt api-keys acknowledge --file issue.original.json --recipient-file recipient.private.json --secret-file key.private.txt --confirm KEY_ID --json
```

For full native attributes, keep a private mode0600 `attributes.json` containing
only `name`, optional `scopes`, `tier` and `expires_at` (up to 16 MiB). Use:

```sh
jobhunt api-keys prepare-file-recipient --account ACCOUNT_ID --file attributes.json --output recipient.private.json --confirm ACCOUNT_ID --json
jobhunt api-keys review-file-create --recipient-file recipient.private.json --attributes-file attributes.json --output issue.original.json --json
jobhunt api-keys issue-file --file issue.original.json --recipient-file recipient.private.json --attributes-file attributes.json --confirm ACCOUNT_ID --json
```

Use the same check/receive/acknowledge/close commands below. Source SHA-256/size
and the retained recipient bind the exact original. A changed file is rejected
before sending; never edit or replace the original after an uncertain result.
For MCP, export the public descriptor with `recipient`, then use
`review_api_key_fields_file`/`issue_api_key_fields_file` with an approved private
host reference to those exact bytes. Retain its returned proof in the full private
original. Host URLs are excluded from original identity and receipt content.
`close_api_key_fields_file_creation` fences the exact file original without a
host download. Existing compact contracts and the native quota remain unchanged.

Preparation is entirely local and needs no authentication. It retains one random
request ID and recipient key pair before any remote action. Review saves the full
native original request privately. Issuance requires explicit account confirmation
and never automatically retries or selects a new nonce after an unknown reply.
Keep both files: check delivery or explicitly retry the exact original. Re-running
review after an uncertain issue is not recovery.

To issue through an authorized MCP connection instead, run
`api-keys recipient --recipient-file recipient.private.json --json`. This offline
command exports only the public review input. Give that input to
`review_api_key_creation`, retain the complete original arguments with its returned
review token in a new private mode0600 `issue.original.json`, then explicitly call
`issue_api_key_record` through that same reviewing connection. Use the original
local recipient and original request with CLI `receive` and `acknowledge` above.
The private recipient file and decrypted key never belong in MCP arguments or
chat. A different currently authorized connection may receive the delivery; it
still needs the account, request, recipient and exact key confirmation.

`receive` decrypts only into the new private output file; it never prints the key
and does not acknowledge delivery. `acknowledge` verifies that file against the
original encrypted delivery before clearing server ciphertext. If an acknowledgment
reply is lost, repeat the acknowledgment command: an already-recorded result is
reported without another write (`local_file_verified:false` then means no new local
comparison was possible). Receipt expiry never creates another key.

`api-keys close-create --file issue.original.json --confirm ACCOUNT_ID` requires
no private recipient key. It fences unrecorded creation or reports the recorded
key ID; it does not revoke a key. If recipient recovery is lost, inspect and
explicitly revoke that recorded key before starting over. Status checks also accept
a minimal account/request locator and never return encrypted or plaintext bytes.

For read-only access, omit `write:contacts`. `read:profile` is required to verify
which account was connected. The currently supported login scopes are
`read:profile`, `read:applications`, `write:applications`, `read:contacts` and
`write:contacts`, `read:tasks`, `write:tasks` and `read:campaigns`.
Workspace profiles may also request `read:interviews`, `write:interviews`,
`read:documents` and `read:companies`. Bookmark editing may explicitly request
`write:profile` (a profile-wide grant, not a bookmark-only permission).
The list is comma-separated without spaces or duplicates.
Existing saved grants and login defaults are unchanged. Login's JSON result lists
the approved scopes; refresh must retain exactly that grant. Reauthorizing the
same profile replaces and revokes its previous connection after successful consent.

Saved connections are separated by exact origin and `--profile NAME`. The CLI
prefers macOS Keychain, Windows Credential Manager or Linux Secret Service. If
the native store is unavailable at first login on POSIX, it warns on stderr and
uses an owner-only directory (0700) and credential file (0600). Windows fails
closed without a credential vault; it never silently writes tokens to a file.
An existing keyring-backed connection never downgrades when its vault is locked.
On macOS, native vault calls run in a short-lived helper with a five-second hard
deadline. A locked or stalled Keychain returns `credential_store_unavailable`
without leaving the refresh lock behind. Credentials pass through private pipes;
they are never put in helper arguments, environment variables or temporary files.
Headless automation can avoid local persistence entirely.

The manual package lane includes an installed-artifact native-vault check on
disposable GitHub-hosted macOS and Windows runners. It checks login, cold reads,
profile separation, refresh, logout and refusal without a fallback copy when the
installed native adapter becomes unavailable. Its loopback OAuth issuer is
synthetic; it does not establish hosted JobHunt OAuth or Windows-vault locking.
macOS additionally uses an owned temporary Keychain to check lock/unlock refusal
and recovery, then restores the runner's previous keychain settings.
The check refuses ordinary local and self-hosted execution. Do not run it against
a personal keychain; ordinary source tests continue to use injected vaults.

The local directory is `$XDG_CONFIG_HOME/jobhunt/cli` (default
`~/.config/jobhunt/cli`) on Linux, `~/Library/Application Support/JobHunt/cli`
on macOS, or `%LOCALAPPDATA%/JobHunt/cli` on Windows. File names hash the origin
and profile. Do not copy credential files or inspect them in shared logs.

Near-expiry credentials rotate before the operation and are saved atomically.
One process per profile may refresh or use a saved credential at a time. A second
process receives `credential_busy`. Normal Ctrl-C/termination releases the lock.
After a hard kill, first confirm no JobHunt CLI process is running, then remove
only that profile's stale `.json.lock` file in the directory above. Never delete
the `.json` credential while another process is using it. A network failure
during rotation may require a fresh login because the server could already have
consumed the old refresh token.

Logout revokes the saved OAuth connection remotely before deleting it locally.
If revocation fails, the connection is retained so logout can be retried.
`auth logout --local-only` explicitly removes the local credential without
confirming remote revocation. Existing server credentials can also be revoked
from JobHunt's connected-app settings.

For automation, supply a scoped credential via a protected environment variable
`JOBHUNT_TOKEN`, or pipe it from your secret manager into `--token-stdin`. Do not
put secrets in command arguments, shell history, examples or output files.
`--non-interactive` rejects login before opening the browser and never prompts.
Ephemeral credentials are not stored and `auth logout` does not revoke them.

Production defaults to `https://jobhunt.app`. Explicit `--origin HTTPS_ORIGIN`
uses only that host's saved profile. An environment credential defaults to the
production origin; using it with an override requires matching
`JOBHUNT_TOKEN_ORIGIN`. `--allow-loopback` permits explicit `http://127.0.0.1:PORT`
or `http://[::1]:PORT` origins for local tests. Redirects are never followed. The
current OAuth contract uses resource `https://jobhunt.app/mcp` for both HTTP and
MCP credentials. The client uses product-owned same-origin OAuth endpoints;
deployed issuer discovery and local metadata generalization remain release work.

## Application records

```sh
jobhunt applications list --page 1 --page-size 20 --json
jobhunt applications list --search 'Example' --json
jobhunt applications create --title 'Engineer' --company 'Example' --json
jobhunt applications get example-engineer --json
jobhunt applications update example-engineer --revision 1 --title 'Senior Engineer' --json
jobhunt applications delete example-engineer --confirm example-engineer --json
```

Use the slug and `attributes.version` returned by the API. A stale update fails
with conflict; read the latest record before deciding whether to retry. List
returns one bounded page (maximum 100), preserving API pagination metadata.
`--status` uses the exact configured stage display name. Legacy `update` covers
title, company, job URL and source. The versioned commands below handle capture,
pipeline moves, submission records and reviewed private PDF packages. Complete
import management and other workflows remain separate coverage work.

Create currently has no general idempotency receipt. The CLI never automatically
retries mutations. After an uncertain create result, search for the application
before creating again. Delete requires the exact slug twice even in unattended
mode, and still uses the server's ownership checks. This is real deletion, not
a preview or dry run.

## Archive and restore document packages

```sh
jobhunt library documents --status archived --page 1 --json
jobhunt library documents --status all --page 1 --json
jobhunt library archive-review DOCUMENT_UUID --page 1 --json
jobhunt library archive --file reviewed-archive.json --json
jobhunt library unarchive --file reviewed-restore.json --json
```

Discovery returns 50 owned metadata rows per page, including role copies and
standalone supporting documents. Use `active`, `archived` or `all`; follow
`has_more`. It omits internal contact cards, career bodies and linked application
details, and never initializes defaults.

Archive and unarchive act on the **whole package**, including when you select a
sibling. Review `anchor_id`, the fingerprint and every page of visible members.
`member_count` and `archived_count` include internal cards; `internal_contact_count`
explains their omission from `items`. All pages use the same complete-package
fingerprint. There is no 1,000-member limit on archive/restore.

The reviewed JSON contains a new UUID `request_id`, optional
`expected_account_id`, the selected `document_id`, the reviewed anchor as
`expected_anchor_id`, and `expected_fingerprint`. Read/write document grants are
required. Changes to membership or any reviewed member revision reject a stale
intent. The browser and machine adapters use the same owned package operation.

These actions change archive flags and advance affected document revisions.
They preserve document content, identities, default choices, stored publication
settings, application bindings and saved evidence. Archiving does not unpublish;
use the existing visibility controls for that purpose. Unrelated role copies
remain as they were. Repeating an already-current flag is a no-op.

Keep the original file/request ID after interruptions. Use `operations find
--request-id UUID --operation archive_document_package_v2` or
`unarchive_document_package_v2`. Exact retries never repeat the flag change after
a later restore/archive. Returned `current` describes the package now, even if
the originally selected sibling was removed; it is null if the package is no
longer available. Public distribution and hosted acceptance remain pending.

## Master document packages and usage

```sh
jobhunt auth login --profile library --scopes read:profile,read:documents,write:documents,read:applications
jobhunt library packages --page 1 --profile library --json
jobhunt library packages --package-id PACKAGE_UUID --documents-page 1 --profile library --json
jobhunt library add-document --file reviewed-member.json --profile library --json
jobhunt documents usage DOCUMENT_UUID --page 1 --profile library --json
jobhunt library delete-package --file reviewed-package-deletion.json --confirm PACKAGE_UUID --profile library --json
```

Master packages hold reusable career documents. `application-documents` and
`packages` manage role-specific selections and prepared PDFs. Library reads do
not initialize documents or defaults. Package pages contain 20 anchors; selected
member pages contain 100 documents. Follow `has_more` and `documents_have_more`
independently, keeping the exact `--package-id` while paging members. Lists contain
metadata, owned usage/version counts and existing sharing URLs, without resume
bodies. Role packages remain in their applications. Document usage requires
application-read access and returns 50 owned live-source references per page;
follow `next_page` until null. It does not enumerate immutable application copies.

To add a blank private document, supply `request_id` (new UUID), optional
`expected_account_id`, the selected anchor's `document_id` and `expected_revision`,
`name`, and `archetype` (`structured`, `letter`, `reference`, `statement`). The
existing creation service selects Linen and preserves the package's explicit
identity. No document is generated, published or submitted. Names and content
rules remain server-owned.

Package deletion is permanent and stops its public links. Review all member pages
and supply the anchor's `document_id`, `expected_revision`, `request_id`, optional
`expected_account_id`, and the complete `expected_document_ids` list (1–1000).
Include archived members returned in the selected package; internal contact
cards are omitted from that list and removed with their package. Missing, changed
or duplicate membership is rejected. The CLI also requires the exact anchor ID
in `--confirm`. Saved application versions and reusable contact profiles remain.
Legacy live application sources are preserved as clearly marked snapshots;
detachment advances the application's revision so old reviews cannot overwrite it.

Writes require document-write authority; lists require document-read authority,
plus application-read authority for usage. For lost replies, keep the exact file
and request ID; use `operations find --request-id UUID --operation
add_package_document_v2` or `delete_document_package_v2`. Retries never add or
delete again. Add retries return the current created document; if it was later
removed or archived, use the original receipt to distinguish that from a new
failed creation. Public npm/hosted acceptance remains pending.

## Screening answers and interview status

```sh
jobhunt auth login --profile screening --scopes read:profile,read:applications,write:applications,read:documents,read:interviews,write:interviews
jobhunt applications answers APPLICATION_UUID --profile screening --json
jobhunt applications save-answers --file reviewed-answers.json --profile screening --json
jobhunt interviews list --page 1 --profile screening --json
jobhunt interviews set-status --file reviewed-status.json --profile screening --json
```

Screening saves replace the complete set, up to 30 questions. Use the application
UUID and current revision from `applications answers`, a new UUID `request_id`
and, preferably, the connected `expected_account_id`. `answers: []` explicitly
clears the set. Each answer contains `question_id`, `question_text`,
`employer_limit` (integer or null), `answer` (string or null), `state`
(`draft`, `confirmed`, `unanswered`) and `source_refs`. Do not copy the read-only
`character_count`, `manual_on_employer_site` or `sources_changed` fields into a
save. The file may be up to 512 KiB; the server also enforces its 300,000-byte
normalized answer-set budget and all content/source rules.

Employer limits count Unicode code points: `é😀` is two characters. Unknown
answers stay unanswered with null text. Confirmation requires the user's actual
confirmation and `user_statement` provenance. Document/import references need
their owned record ID, fact field, current revision and `read:documents`.
Changed cited facts project a confirmed answer as draft without mutating the
stored set. Attestations, eligibility and self-identification stay unanswered for
the employer site. These commands save private drafts; they never submit them.

Interviews return 20 rounds per page; follow `has_more`. Review the round's
`id`, `revision` and `fingerprint` and supply them as `interview_id`,
`expected_revision` and `expected_fingerprint`, with `request_id`, optional
`expected_account_id`, and `status`. Supported actions are `Pending`, `Completed`,
`Skipped`, `Cancelled`, `No_Show` and `Rescheduling`. Pending clears completion,
skip and override state; a retained scheduled date then reports `Scheduled`.
Overrides preserve historical completion/skip timestamps, matching the browser.
Status changes preserve participants, schedule, notes, preparation and other
interview fields. No invitations or external-calendar updates are sent. System
milestones are protected; contact names require the separate participant editor.

Reads need application/interview read grants as applicable; status changes need
both application and interview write grants. Screening writes need application
write authority and current document-read grants when references use sources.
All grants remain subject to revocation. For interrupted saves, keep the exact
file/request ID and use `operations find --request-id UUID --operation
save_application_answers` or `update_interview_status_v2`. Retry never repeats
the original write; returned data describes current saved state after later edits.
The older `set_interview_status_v2` MCP/HTTP contract retains its original three
actions; the complete CLI uses the new `update_interview_status_v2` operation.

## Capture, pipeline moves and submission reports

These commands use the existing HTTP/MCP product services. They require their
server release flag, `JH_JOURNEY_ENABLED`; the CLI never enables it. Grant only the
permissions required for your workflow. Capture needs `write:applications` and
`read:campaigns`; reads need `read:applications`; edits/moves/reporting need
`write:applications`. Submission choices and selected files also need
`read:documents`. Target-company capture additionally needs `write:companies`
and `write:campaigns`. `account connected` uses `read:profile`.
Add these permissions through explicit consent; the default login grants stay
unchanged. For the complete workflow below, including target companies and files:

```sh
jobhunt auth login --scopes read:profile,read:applications,write:applications,read:campaigns,write:campaigns,read:companies,write:companies,read:documents
```

```sh
jobhunt account connected --json
jobhunt applications capture-url --file capture.json --json
jobhunt applications capture-details --file details.json --json
jobhunt applications target-company --file company.json --json
jobhunt applications inspect APPLICATION_ID --json
jobhunt applications stages --page 1 --page-size 100 --json
jobhunt applications edit-details --file changes.json --json
jobhunt applications move --file move.json --json
```

Every write file includes a fresh UUID `request_id`. Retain the original file and
ID for a retry after a timeout; never generate a new ID just because the response
was lost. Supply `expected_account_id` from `account connected` to bind the intent
to that account. No command automatically retries a mutation or replaces an account
ID/revision. For example, `capture.json` contains:

```json
{
  "request_id": "11111111-1111-4111-8111-111111111111",
  "url": "https://careers.example.com/jobs/123"
}
```

Replace the sample request ID for each new intent. URL capture saves to the
current Hunt's Backlog by default, without a preflight read. Optional `search_id`
or `job_search_slug` selects one exact Hunt; do not supply both. A `pending` result
with `data.id` means the job is saved and enrichment is still running. Use
`operations get OPERATION_ID` and `applications inspect APPLICATION_ID` to read
progress and the current record; respect `retry_after_seconds` and stop on a
terminal receipt. A duplicate returns `needs_input` and the existing job. Only
use `save_separately: true` for an explicitly distinct opportunity.

`details.json` supplies `title` and `company`, or the user's `posting_text` when
those facts are unknown. Optional source URL, search/company/contact IDs, location,
employment and compensation preserve supplied context. No employer is contacted.
`company.json` supplies `name`, optional `website`, `notes` and `search_id`; this
uses the existing company-only application workflow.

`edit-details` requires `application_id`, `expected_revision` from `inspect`,
`request_id` and at least one of `title`, `company`, `posting_text`, `source_url`.
Omitted fields stay unchanged; null posting/source URL clears that field. `move`
requires the same ID/revision/intent plus an exact `stage_id` from `stages`.
Closed requires `closed_reason`. Moving to Applied requires an existing explicit
submission report. A stage move is never evidence of a submission or an offer.

```sh
jobhunt applications submission-options APPLICATION_ID --json
jobhunt applications submissions APPLICATION_ID --json
jobhunt applications record-submission --file submitted.json --confirm APPLICATION_ID --json
```

Record a submission only after the user says they submitted it. The JSON file
contains `application_id`, its current `expected_revision`, a stable `request_id`,
the actual `date` (`YYYY-MM-DD`), `user_confirmed: true`, and `document_knowledge`:

- `unknown`: omit both document selection fields; never guess the latest file.
- `prepared`: supply exactly one `prepared_id` from the choices.
- `external`: supply one to five distinct `external_document_ids` from the choices.

The CLI also requires the exact application ID in `--confirm`. The result records
`evidence: "user_report"`; it does not send an application or prove employer
delivery. Optional `destination` is the actual public HTTPS destination, otherwise
it remains unknown. The report and move to Applied are atomic; later stages are
preserved. Set `move_to_applied: false` to retain any current stage. Correct a
report by supplying `supersedes_id` and a fresh intent; the original stays in history.

Choices page independently with `--prepared-before-id` and `--external-before-id`;
history pages with `--before-id`. Use returned cursors, not guessed IDs. Missing
document permission is an error, not an empty list. Selected files must belong to
the account and the exact application.

After a lost response, `operations find --request-id UUID --operation NAME` can
recover the receipt. Names are `save_job_url_v2`, `save_job_details`,
`save_target_company_v2`, `edit_job_details`, `move_job_stage`, and
`record_submission`. An exact retry can show a newer saved job while retaining
the original receipt; inspect both and do not replay the old stage over later work.

## Documents and reviewed resume imports

Author resumes from the user's facts using the existing document services. Read
and write grants are separate; linking a saved contact profile also requires
`read:profile`. Enable document writes through explicit OAuth consent:

```sh
jobhunt auth login --scopes read:profile,read:documents,write:documents
jobhunt documents list --page 1 --page-size 20 --json
jobhunt documents get DOCUMENT_ID --json
jobhunt documents create --file resume.json --json
jobhunt documents update-section --file section.json --json
jobhunt documents revisions DOCUMENT_ID --before-id VERSION_ID --json
jobhunt documents checkpoint --file checkpoint.json --json
jobhunt documents restore --file restore.json --confirm DOCUMENT_ID --json
```

Omit `--before-id` for the first history page. `documents list` is a bounded library
summary: JSON:API `id` is the **slug**, while `attributes.template_id` is the
**document ID** used by `get`, history and library actions. The detailed document
returns both, plus its current `revision`, career sources, uncertainty and display
settings. History returns at most 30 versions; follow `next_before_id` while
`has_more`. A null revision identifies a legacy checkpoint and does not mean its
content is missing.

Create a Linen master with a fresh `request_id`, a `name`, and
`content.sections`. For example, replace the sample request ID for each new intent:

```json
{
  "request_id": "11111111-1111-4111-8111-111111111111",
  "name": "My resume",
  "content": {
    "sections": [{
      "name": "summary",
      "text": null,
      "entries": [{"fields": [{
        "field": "/summary",
        "value": "The user's reviewed career statement",
        "state": "confirmed",
        "sources": [{"kind": "user_statement"}]
      }]}]
    }]
  }
}
```

Confirm only facts actually reviewed by the user. Use `draft` or `uncertain` for
unreviewed content; a section supplied as plain `text` is a draft. Preserve exact
returned fact paths and source references. The server checks owned source records
and rejects unsupported confirmation. It validates canonical career paths and
content shapes; the CLI never invents achievements, qualifications or dates.

`update-section` takes `template_slug`, `section`, `data` (one complete section),
`expected_revision`, and `request_id`. It replaces the selected section; include
all facts you want to retain in that section. Other sections remain unchanged.
Choose text or entries, never both. To edit display options, use section
`resume_settings`, empty `entries` and `settings` containing `section_titles`,
`section_order` or `section_visibility`; omitted display options remain unchanged.
A linked contact profile owns personal details and cannot be overwritten through
this section command. Profile management remains separate coverage work;
application package commands are described below.

`checkpoint` takes `document_id`, `expected_revision`, a `name` and `request_id`.
It saves an immutable named version without changing document content or revision.
`restore` takes those identity/revision/intent fields plus the exact `version_id`
instead of a name. It requires `--confirm DOCUMENT_ID` and creates a new revision;
existing history and prepared/submitted files stay unchanged. Never infer the
newest version as the user's selected restore target.

```sh
jobhunt documents rename --file rename.json --json
jobhunt documents duplicate --file copy.json --json
jobhunt documents set-default --file default.json --json
jobhunt documents delete --file delete.json --confirm DOCUMENT_ID --json
```

These files contain `document_id`, `expected_revision` and `request_id`; rename
and duplicate also require `name`. Duplication creates a private standalone copy,
without publication, application links, sibling documents, files or history.
Default selection affects future applications and accepts only an owned master
resume. Deletion is permanent: review the name and effects with the user first.
Shared links and a Hunt Page using that source stop working; the server preserves
exact versions already saved to applications and other package documents. The
CLI requires the exact document ID again in `--confirm`.

```sh
jobhunt resume-imports text --file source.json --json
jobhunt resume-imports get IMPORT_ID --json
jobhunt resume-imports confirm --file reviewed.json --confirm IMPORT_ID --json
```

`source.json` contains `request_id` and the user's `text` (up to 100,000 characters).
It stages existing durable extraction and returns an import/operation ID. Use
`operations get` and `resume-imports get` to read progress, respecting the receipt's
retry interval. Importing never creates or confirms a resume automatically. A
`needs_input` result contains unconfirmed facts for review. A terminal extraction
failure returns a safe structured error; it is not an empty successful import.

`reviewed.json` contains `import_id`, `expected_revision`, `request_id`, and
`accepted_facts` copied from the review with each supplied fact explicitly marked
`confirmed` or `declined`. At least one must be confirmed; do not infer unknown
facts. Retain original source paths and record IDs when correcting wording. The
command requires `--confirm IMPORT_ID` and creates one master; an exact retry
does not create another. Rendered PDF preparation/download uses the package
commands below.

For a local PDF or DOCX, use the same explicit `write:documents` grant and keep
the original file and request ID until the result is known:

```sh
jobhunt resume-imports file --file resume.pdf --request-id UUID --account-id ACCOUNT_ID --transport direct --timeout 60000 --json
jobhunt operations find --request-id UUID --operation import_uploaded_resume --json
jobhunt resume-imports get IMPORT_ID --json
```

Replace `UUID` with a new UUID for each intended import and `ACCOUNT_ID` with
the connected account ID. `--account-id` is optional but guards against using the
wrong account. After a timeout, look up the original receipt or retry with the
same bytes, request ID and account; do not create a new intent. Changing the
source bytes under that ID is a conflict, even if the extracted text is identical.
`--file -` reads bounded binary stdin and cannot be combined with `--token-stdin`.
Local input must be a regular file, not a symlink. Original filenames and local
paths are never transmitted.

The application ceiling is 10 MiB; encrypted PDFs, PDFs over 20 pages, invalid
documents and excessive DOCX expansion are rejected. The server extracts text
and stages the same durable fact-review workflow as text imports. Nothing is
confirmed automatically. `--timeout 60000` allows time for the existing parser;
timeouts remain uncertain writes and are never retried automatically.

The default `--transport auto` uses multipart up to 4 MiB and direct private
storage above that, through the existing 10 MiB application ceiling. This keeps
large bytes outside [Vercel's 4.5 MB function request-body
limit](https://vercel.com/docs/functions/limitations#request-body-size).
`--transport direct` selects private storage for smaller files too;
`--transport multipart` retains the existing adapter for a compatible server.
The server release must support direct imports before distributing this client.
Actual hosted provider/route acceptance remains unverified.

Direct mode prepares an owned upload, sends exactly the size/checksum-bound bytes
to a short-lived storage grant, then starts the existing review job. The CLI
forwards no product credential or cookies to storage, follows no redirects,
and prints only the import result. Grants are reusable until expiry (at most
60 seconds); revocation prevents completion/new grants but cannot retract a grant
already issued. The overall upload intent expires after 15 minutes. Temporary
bytes are retired by existing worker maintenance after expiry plus a five-minute
grace; bounded sweeps retry failures and recheck deleted keys for late uploads.

For uncertain direct uploads, look up `prepare_resume_file_upload` and
`import_uploaded_resume` using the original request ID, or rerun the exact file
command. An accepted import is never uploaded again. Multipart receipt lookup
uses `import_resume_upload`. Keep the original transport on a retry: switching
transports under the same request ID is rejected to prevent duplicate imports.
An expired, unaccepted upload requires a new request ID; do not replace an ID
while an accepted operation's outcome is still unknown.

For an explicitly supplied file from an agent host:

```sh
jobhunt resume-imports host-file --file host-file.json --json
```

The JSON contains `request_id`, optional `expected_account_id`, and `file` with
`download_url`, `file_id`, and optional `mime_type`/`file_name`. Treat download
URLs as private credentials; do not print or commit them. This calls the existing
`import_resume_file` HTTP/MCP service. The server fetches only configured allowed
HTTPS hosts with its existing size, redirect and network protections; the CLI
never downloads the URL itself. This is not an arbitrary URL importer or a way
to upload a local file through an MCP host. Follow the same get/review/confirm
steps above; use `import_resume_file` for receipt lookup.

## Screening-answer retry recovery

`applications save-answers` saves a complete reviewed set. Keep its complete input
and request ID after an interrupted response. Use
`operations find --operation save_application_answers --request-id UUID --payload-hash SHA256`
to check the exact original without resending. SDK `prepareAnswerOriginal` computes
the canonical hash from the typed input.

`applications close-answers-original --file original.json` explicitly ends retry.
The file is `{ "expected_account_id": "jh_…", "original": { … } }`, wrapping the
complete original save input, including its answer set. An unused request becomes
fenced; a recorded result is historical evidence and never undoes saved answers.
Keep your wording until exact closure is confirmed. Closure requires application
read/write grants and never reads cited documents. Saving with cited document or
import facts still requires current document-read access.

The browser privately retains complete originals on the device before dispatch;
Hunt Docs can discover them even if the application is missing. Conflict, expired
receipts and interrupted cleanup preserve those originals. Older locator-only
journals lack answer wording and are never guessed, silently replayed or cleared.
Public interfaces share the existing source-review, Unicode limits and unanswered
employer-attestation rules. No employer send or submission occurs.

## Application documents and private PDFs

Use a profile explicitly granted `read:profile,read:applications,write:applications,read:documents,write:documents`.
Default login permissions do not change. Read-only package access needs both
`read:applications` and `read:documents`; `read:profile` verifies the CLI connection.
The ordinary product services enforce ownership, current credentials, revisions
and source provenance. No command submits files to an employer or marks Applied.

```sh
jobhunt application-documents get APPLICATION_SLUG --json
jobhunt application-documents choices APPLICATION_SLUG --query 'Resume name' --page 1 --json
jobhunt application-documents select --file selection.json --json
jobhunt application-documents customize --file role-copy.json --json
jobhunt application-documents letter --file letter.json --json
jobhunt application-documents close-original --file original.json --json
jobhunt packages prepare --file preparation.json --json
jobhunt packages get PACKAGE_ID --json
jobhunt packages list APPLICATION_ID --json
jobhunt packages download PACKAGE_ID --version-id VERSION_ID --output ./application.pdf --json
```

The workflow envelope's integer `revision` is the application revision. Its
`data.revision` is the workflow fingerprint; `data.fingerprint` identifies the
current document package. Keep these distinct. Choices return exact document IDs,
revisions and fingerprints. Follow `has_more` with the next `--page`; package
history uses `--before-id` with the previous page's last package ID.

`selection.json` contains `app_slug`, `package_id` (the chosen resume ID),
`revision` (workflow), `expected_revision` (application), and `request_id`.
Selection does not copy or edit the master. `role-copy.json` has the same app and
revision fields, plus `source_document_id`, `source_revision`, `source_fingerprint`
and `request_id`. Optional `include_cover_letters: true` also requires the current
`source_package_fingerprint`. The existing service creates private role copies and
preserves the master. Use `documents update-section` to edit a role copy from
supplied facts, then reread the workflow before preparing or adding a letter.

`letter.json` contains `template_slug` (the selected role resume),
`expected_revision`, `expected_application_revision`, `workflow_revision`, `name`,
`request_id`, `source_refs` and `content`. Content requires `body_paragraphs` and
optionally accepts recipient, company, position, date, salutation, closing and
signoff. Sources use the document provenance format above. The supplied wording
is stored as a draft for review; no career facts are inferred from a job posting.

For an interrupted change, keep the complete original input and its `request_id`.
Use `operations find --operation NAME --request-id UUID --payload-hash SHA256`
to check it; checking never resends a write. `original.json` wraps that input as
`{ "expected_account_id": "jh_…", "operation_name": "select_application_documents_v2", "original": { … } }`.
The operation name must match selection, customization or letter creation.
`close-original` explicitly ends retries: an unused original is fenced so later
resends fail; a recorded original returns its saved resource ID. Closure never
undoes saved work. An expired receipt is not proof that nothing was saved.
Preserve your wording until the exact closure is confirmed. The browser retains
full originals privately on the device and exposes recovery in Hunt Docs, including
when the application is no longer available. Older locator-only journals cannot
reconstruct missing letter wording and are never silently replayed or cleared.

`preparation.json` contains `application_id`, `expected_revision`,
`workflow_revision`, `fingerprint`, `request_id` and one to five distinct
`documents`, each with `document_id` and `revision`. It freezes those exact inputs
in the durable preparation worker. Poll `packages get` explicitly until ready.
Keep the request ID for an exact retry or `operations find` after interruption.
Subsequent source edits do not change accepted snapshots. `sources_changed`
identifies that difference. Failed preparation is an error, never a successful file.

Download requires an exact version ID from that ready package. The CLI obtains a
short-lived private storage grant through `get_prepared_document_download`, then
fetches the PDF without forwarding product credentials, cookies or following
redirects. It bounds the transfer to 25 MB and verifies the expected byte count,
PDF signature and SHA-256. Only verified bytes are published to a new local file
using an exclusive atomic link; existing files and symlinks are preserved. On
POSIX the new file has mode 0600. The parent directory must already exist.
Success reports IDs, size and checksum; it omits the grant URL and local path.

HTTP/MCP clients can call `get_prepared_document_download` directly with
`package_id` and `version_id`. Its URL is a bearer grant, reusable for at most
60 seconds. Do not log, share or persist it. Credential revocation prevents new
grants; object storage cannot retract an already issued grant before expiry.
The service rechecks account, credential and snapshot ownership after provider
verification, before returning the URL. An expired transfer needs a new grant.
This reuses existing private object storage and its presigned-download convention;
no new storage service or public sharing record is created.

The existing `direct_host_download_supported: false` field remains accurate:
these are client-fetchable links, not an automatic chat-host attachment feature.
Authenticated website PDF links remain compatible and serve the same snapshots.
Local verification uses real Typst with a synthetic storage emulator. Hosted S3/R2
transfer, supported-OS verification and public CLI distribution remain unverified.

All writes support optional `expected_account_id` from `account connected` and
require the existing server release flag. Input files/stdin are bounded to 512 KiB.
Retain the complete original JSON and request ID after a timeout; inspect the
receipt before deciding what to do next. Use `operations find --request-id UUID
--operation NAME` with the corresponding service name: `create_resume_template_v2`,
`update_resume_section_v2`, `create_document_checkpoint_v2`,
`restore_document_revision`, `rename_document_v2`, `duplicate_document_v2`,
`set_default_document_v2`, `delete_document_v2`, `import_resume_text`, or
`confirm_resume_import`. Readback after an exact retry can show newer document
content alongside the original receipt; it must not overwrite later work.
Default OAuth grants remain unchanged, and no mutation is automatically retried.

## Private document and Hunt Page exports

Use `exports` for a saved document or one selected Hunt Page document. These
operations require `read:documents`; Hunt Page exports also require `read:profile`.
They do not edit the source or change publication. Keep the same reviewed input,
account and request ID when recovering an interrupted preparation.

```sh
jobhunt exports inspect --file selection.json
jobhunt exports prepare --file export-intent.json
jobhunt exports get EXPORT_ID
jobhunt exports download EXPORT_ID --output ./document.pdf
jobhunt exports cancel --file cancellation.json --confirm ACCOUNT_ID
```

`selection.json` contains `document_id`, optional `format` (`pdf` or `docx`,
default `pdf`), and optional `mode` (default `resume`). Preparation adds
`request_id`, the verified `expected_account_id`, and the `expected_revision`
and `expected_fingerprint` returned by inspection. Unknown fields are rejected.
Read the source before preparing; a changed render fingerprint requires a new
review, not automatically replacing the expected value.

PDF preserves the existing `resume`, `cover`, `cover_only`, `references` and `all`
modes. Standalone DOCX supports `resume` and `cover_only`. Other DOCX combinations
fail explicitly. Use `bundles` below for selected multiple documents and archives.

For a Hunt Page, first run `hunt-page get`. Put its current `expected_revision`
and `expected_preview_revision`, optional selected `document_id`, and `format`
in a selection file. `exports inspect-page --file selection.json` returns the
source revision and fingerprint. `exports prepare-page --file export-intent.json`
uses the same selection plus `expected_document_revision`, `expected_fingerprint`,
`request_id` and the verified `expected_account_id`. Hunt Page `format` accepts
`pdf`, `docx`, `md` (Markdown), or `txt` (plain text). Text exports use the same
selected content, visible sections and headings as the browser downloads.
Statement and combined page DOCX/text formats remain unsupported. Standalone
`exports inspect`/`prepare` still accept only PDF/DOCX; page export support does
not imply new standalone or bundle formats.

The existing worker renders a frozen source, including its captured render date.
Later source edits do not change the accepted export. Use `operations find` with
`prepare_document_export` or `prepare_hunt_page_export` to recover a lost response,
then reuse the exact original request. Limits are three active exports and twenty
new exports per hour. An export expires 24 hours after acceptance; poll `exports
get` for progress. Cancellation JSON contains `export_id`, `request_id`,
`expected_account_id` and `confirm_cancel: true`. Cancellation can also retire a
ready export and never changes the source document or page visibility.

Downloads use a private grant valid for at most 60 seconds and never beyond export
expiry. The client checks media type, bounded length, file signature and SHA-256;
text transfers additionally require nonempty UTF-8 without null bytes. Binary
file signatures remain required; the server validates the full rendered file
before storage. Product credentials
and cookies are never forwarded to storage, and redirects are rejected. Only
verified bytes are saved to a new private file; existing files and symlinks are
preserved. Output excludes the grant URL. Cancellation prevents new grants;
already issued grants remain usable until expiry. Background cleanup removes
objects and rechecks late provider writes. Hosted storage and public distribution
still require release verification.

## Document bundles and library ZIPs

`bundles` exports an ordered selection from one saved document or application,
or a JSON archive of explicitly selected saved documents. It requires
`read:documents`; application bundles also require `read:applications` for
inspection, preparation, progress, download, cancellation and receipt recovery.

```sh
jobhunt bundles inspect --file bundle-selection.json
jobhunt bundles prepare --file bundle-intent.json
jobhunt bundles get EXPORT_ID
jobhunt bundles download EXPORT_ID --output ./documents.zip
jobhunt bundles cancel --file cancellation.json --confirm ACCOUNT_ID
```

A saved-document selection looks like this; replace the synthetic ID with an
owned document returned by `documents list`:

```json
{
  "selection": {
    "source": "document",
    "document_id": "11111111-1111-4111-8111-111111111111",
    "documents": ["resume", "cover_only", "references"],
    "format": "zip"
  }
}
```

For an application use `source: "application"` and `application_id` instead of
`document_id`. Its current linked content and application overrides are frozen.
For a library archive use `selection: { "source": "library", "document_ids":
["OWNED_UUID"], "format": "json_zip" }`, with one to fifty unique IDs.

`pdf` merges the selected pages in order. `zip` contains individual PDF files.
`docx` returns one DOCX for one selected member or a ZIP of DOCX files for multiple
members, including references. Inspect the returned `format`, `members` and
`download_name`; choose your output path explicitly. Unsafe legacy library names
use stable document IDs, preserving every selected record's JSON contents.

Preparation adds `expected_sources` copied from inspection's `sources`,
`expected_fingerprint`, `request_id` and the verified `expected_account_id`.
Any changed content, identity or selection requires another review. All selected
members must succeed; failures do not produce a partial download. Recover an
interrupted request with `operations find --operation prepare_document_bundle
--request-id REQUEST_UUID`, then reuse the exact intent. Cancellation uses the
same JSON fields and explicit account confirmation as single exports.

Bundles share the single-export limits, 24-hour expiry, current credential checks
and private download behavior above. Archives are saved intact and never extracted
automatically. These commands do not export the whole account or alter prepared
application-package submission records.

## Companies, contact relationships and CRM work

The `crm` commands use the existing shared browser/HTTP/MCP services. List and
detail commands preserve bounded pages; follow `has_more` or `related_has_more`
rather than treating the first page as a complete account export.

```sh
jobhunt crm companies --page 1
jobhunt crm contacts --page 1
jobhunt crm company COMPANY_ID --related-page 1
jobhunt crm contact CONTACT_ID --related-page 1
jobhunt crm save-company --file company-intent.json
jobhunt crm save-contact --file contact-intent.json
```

For creation, supply `kind`, `action: "create"`, a new `request_id`, the verified
`expected_account_id` and `fields` containing a name and the applicable contact or
company fields. Company fields include description, website, industry, location,
size, status and `is_target`. Contact fields include identity, company association
and public contact links. Explicit null clears nullable fields; omission preserves
them. `is_target: false` is retained.

For an existing record, copy `entity_id` and `expected_fingerprint` from its
current detail result. Set `action` to `update` with changed `fields`, `note_save`
or `note_delete` for notes, or `task_create` with a title and optional body. A
contact additionally supports `interaction_save`/`interaction_delete`; these
record a conversation and do not send a message. Saves return an exact
`changed_item` when needed even if it is outside the first related page.

Contact application links use `link_application`, `update_relationship` or
`unlink_application`, with `application_id`, the current
`expected_application_revision`, `role` and `is_primary` as appropriate. Obtain
application identities/revisions with `applications list` and `applications get`.
Deletion uses `action: "delete"`; applications survive removal of a contact or
company. The CLI requires `--confirm ENTITY_ID` for record deletion,
`--confirm ITEM_ID` for note/interaction deletion, and `--confirm APPLICATION_ID`
for unlinking. All changes retain exact-state and original-request replay checks.

Listing requires `read:contacts`, `read:companies` and `read:applications`.
Details also require `read:tasks`. Saves retain those existing read requirements
plus `write:contacts` or `write:companies`; creating a task adds `write:tasks`,
and changing application relationships adds `write:applications`. Request these
grants explicitly during login; default scopes are not expanded. Recover an
uncertain save with `operations find --operation save_workspace_contact_v2`
(or `save_workspace_company_v2`) and the original `--request-id`, then replay
the identical JSON. A changed fingerprint requires review, not an automatic retry.

The four CRM MCP tools are available when the journey service is enabled,
independently of the embedded UI flag. UI-only cards retain their separate gate.
Public installation and hosted acceptance remain release checks.

## Application workspace and related records

```sh
jobhunt auth login --profile workspace --scopes read:profile,read:applications,write:applications,read:tasks,write:tasks,read:contacts,write:contacts,read:interviews,write:interviews,read:documents,read:companies,read:campaigns
jobhunt applications workspace APPLICATION_UUID --profile workspace --json
jobhunt applications record-save --profile workspace --file record.json --json
jobhunt applications record-delete --profile workspace --file removal.json --confirm RECORD_ID --json
```

Use the immutable UUID from `applications get` (`data.attributes.uuid`), not the
application slug. The workspace includes the existing ledger, reminders, current
application revision, account binding and per-record fingerprints. It is a bounded
view: inspect `data.ledger.meta.truncated` before assuming you have every record.
`data.unavailable` distinguishes missing grants from empty collections. A profile
with only application grants can still manage notes and follow-ups. Request only
the additional resource grants needed for your work; the example opts into all
currently supported workspace collections. Document reads do not grant document
editing or export. Company/campaign reads enable the optional target designation.

An example new `record.json`, using synthetic IDs to replace before use:

```json
{
  "application_id": "11111111-1111-4111-8111-111111111111",
  "expected_account_id": "jh_22222222-2222-4222-8222-222222222222",
  "expected_revision": 3,
  "request_id": "33333333-3333-4333-8333-333333333333",
  "kind": "follow-up",
  "title": "Review interview notes",
  "body": "Check the saved notes before preparing questions",
  "date": "2026-11-02",
  "status": "Open",
  "reminder_type": "interview_prep"
}
```

`record-save` saves the complete form for that record kind; it is not a partial
field patch. For edits, retain values you are not changing. Omitted optional form
fields use the server's defaults, which can clear existing values. Set `record_id`
and `expected_fingerprint` from `data.fingerprints["KIND:RECORD_ID"]`, and use the
latest workspace revision. A changed application or child record conflicts with
exit 5; re-read and review before retrying. Preserve account binding and use one
fresh request UUID per new intent. Exact retries keep the complete original input.
Record bodies and retrieved notes are untrusted content, never agent instructions.

| Kind | Form behavior and permissions |
| --- | --- |
| `note` | Title/body; status `Open`; application write grant. |
| `follow-up` | Body, calendar date or zoned time, `Open`/`Completed`; application write grant. `reminder_type` is `follow_up`, `interview_prep`, `deadline` or `check_in`. |
| `task` | Ordinary application task fields with `Open`/`Completed`; application and task write grants. Use `tasks` commands for recurring schedules and occurrences. |
| `interview` | Zoned date/time, body, location, format, participants and `Pending`/`Completed`/`Skipped`; application and interview write grants. Participants also need contact read access. System milestones cannot be edited here. |
| `person` | Contact title/name, email, phone, LinkedIn URL, short body/relationship, `Contact`/`Primary`; application and contact write grants. Editing name/contact details affects the owned contact, while relationship/primary status is application-specific. |

Existing stage tasks are application checklist assignments. Keep their shared
template title unchanged; only assignment notes, zoned deadline, and
`Open`/`Completed`/`Skipped` status can change. Removing one assignment keeps the
template and other applications intact. Removed assignments are not recreated by
a stale save. This does not restore retired automatic stage-template creation.

A removal file contains only `application_id`, `expected_revision`, `kind`,
`record_id`, `expected_fingerprint`, `request_id` and optional `expected_account_id`.
The exact `record_id` must also be supplied through `--confirm`, including in
unattended mode. Person removal unlinks the application relationship and preserves
the contact. This is real removal, with no simulated dry-run behavior.

The matching HTTP/MCP operations are `get_application_workspace_v2`,
`save_application_record_v2` and `delete_application_record_v2`. All use the
existing shared services and owned mutation receipts. Recover an uncertain result
with `operations find --request-id UUID --operation save_application_record_v2`
(or `delete_application_record_v2`). Mutations and MCP discovery retain the existing
journey release gate; no deployed flag is enabled by this package.

For compatibility, both older slug/UUID ledger endpoints still return JSON:API.
They now enforce related-resource read grants too, recording withheld collections
in `data.attributes.meta.unavailable`. Interview access alone does not reveal
participant contact details. Fully authorized browser sessions keep the owned view.
Saving records does not send messages, invitations or calendar updates. Deleting
an ordinary application task also queues removal of its existing synced calendar
event when the connection is enabled; inspect `calendar_cleanup` and its operation
receipt as described below. Removing a stage assignment keeps its shared template.

## Reusable contact profiles

Hunt Profiles contain the identity used on resumes and Hunt Pages. They are
separate from your account login and from the CRM contacts described below.
Reads never initialize a default profile. Lists and linked-package discovery
return at most 20 records per page; use the returned pagination fields.

```sh
jobhunt auth login --scopes read:profile,write:profile,read:documents,write:documents
jobhunt profiles list --json
jobhunt profiles get PROFILE_ID --json
jobhunt profiles links PROFILE_ID --page 1 --json
jobhunt profiles create --file new-profile.json --json
jobhunt profiles update --file reviewed-profile.json --json
jobhunt profiles set-default --file default-selection.json --json
```

Create input includes `request_id`, `name`, complete `personal_data`, `is_default`,
`expected_default_profile_id` from the list (or explicit `null` when none exists),
and `acknowledge_linked_updates: true`. Include the connected `expected_account_id`
to bind the intent to your chosen account. The first profile becomes the default.
Updates additionally include `profile_id` and its exact `expected_updated_at`.
Preserve every unedited personal field when preparing the complete replacement.
Changing personal details updates explicitly linked live documents and public
Hunt Pages immediately; the acknowledgment applies to that existing behavior.
It does not publish an unpublished page or edit account login details.

Default-selection input includes `request_id`, `profile_id`, exact
`expected_updated_at` and `expected_default_profile_id`. It changes only the
default choice. A different intervening default selection is a conflict;
documents are never automatically moved to the new default.

```sh
jobhunt profiles link --file reviewed-link.json --json
jobhunt profiles link-many --file reviewed-links.json --json
jobhunt profiles unlink --file reviewed-unlink.json --confirm DOCUMENT_ID --json
jobhunt profiles delete --file reviewed-deletion.json --confirm PROFILE_ID --json
```

Single-link input includes `document_id`, `expected_revision`, `profile_id`,
`expected_profile_updated_at`, `acknowledge_linked_updates: true` and the original
mutation identity. Bulk linking replaces the single document fields with up to
20 distinct `documents: [{ document_id, expected_revision }]`. Every target must
be an owned package anchor; bulk linking also supports role-specific and archived
packages. The retained single-link operation selects master packages. One invalid
or stale target rejects the whole batch. Linked live identities update;
historical prepared PDFs stay intact.

Unlink input includes the document ID/revision, `expected_profile_id`, exact
`expected_profile_updated_at`, `acknowledge_retained_copies: true` and mutation
identity. The package retains the profile's contact details, including intentional
blanks. An independently linked Hunt Page keeps its profile link.

Deletion additionally requires the profile's exact `expected_updated_at`, current
`expected_default_profile_id`, `expected_usage_revision` from the profile read,
`confirm_delete: true`, and `acknowledge_retained_copies: true`. New or changed
links invalidate an old deletion intent. Deletion detaches document links and
removes references to the deleted profile from the saved Hunt Page. The page's
saved content, photo references and publication choice remain. Existing document
copies and historical PDFs are retained; this is not account erasure. Deletion
requires both profile-write and document-write grants.

```sh
jobhunt profiles photo-save --file photo-intent.json --image selected.png --confirm PROFILE_ID --json
jobhunt profiles photo-download PROFILE_ID --output private-preview.png --json
```

Photo intent includes `profile_id`, exact `expected_updated_at`, mutation identity
and `acknowledge_linked_updates: true`. Supply a selected PNG of at most 367,500
bytes and 1024×1024 pixels. The existing server sanitizer strips metadata and
produces a bounded PNG. No local filename is transmitted. Downloads save the
private preview to a new file with restrictive permissions; an existing file or
symlink is never overwritten. A photo change updates linked public pages under
the same explicit acknowledgment. Removing a photo uses a reviewed profile update
with `personal_data.hunt_photo_id: null`, preserving other fields.

Every mutation retains the original request ID, account, target, versions and
source bytes for exact retry. A recovered result includes the original operation
receipt and a fresh current projection; a deleted profile is returned as `null`,
never recreated. Use `operations find` with the corresponding HTTP/MCP operation
name after an interrupted reply (`save_contact_profile`, `set_default_contact_profile`,
`delete_contact_profile`, `link_document_package_profile_v2`,
`link_document_packages_profile`, `unlink_document_package_profile`, or
`save_profile_photo`). Reuse the same input; changed retry contents are rejected.
Default OAuth grants remain unchanged; request the scopes above explicitly.
These adapters remain local prerelease work until hosted and public-install checks pass.

## Workspace composition, search and exact locations

```sh
jobhunt auth login --profile workspace --scopes read:profile,read:applications,read:contacts,read:companies,read:documents,read:tasks,read:campaigns
jobhunt workspace get --profile workspace --json
jobhunt workspace get --hunt-id HUNT_ID --page 2 --documents-page 2 --hunts-page 2 --profile workspace --json
jobhunt workspace get --application-id APPLICATION_ID --include-records --profile workspace --json
jobhunt workspace get --document-id DOCUMENT_ID --section summary --profile workspace --json
jobhunt workspace search --query "supplied terms" --profile workspace --json
jobhunt workspace search --kind "Saved search" --query "supplied terms" --profile workspace --json
jobhunt workspace resolve --kind document --identifier DOCUMENT_ID_OR_SLUG --profile workspace --json
jobhunt workspace resolve --kind search --identifier HUNT_ID_OR_SLUG --profile workspace --json
```

`workspace get` (SDK `getWorkspaceView`) reads the existing composed workspace:
account/Hunt context, independently paged applications, Hunts and document
navigation, selected document sections, role workflow, screening drafts, prepared
packages, reported submissions and next steps. It requires the four profile,
campaign, document and application read grants. Multiple possible Hunts return
`needs_input` instead of mixing their applications or saving a guessed default.
The application list accepts `--status` and a literal `--query` (120 characters).
Each independent page is 1–10000; applications/documents contain up to 20 items,
Hunts up to 25. Follow the corresponding `has_more` flag; this composition is not
a complete account export. Selecting a master retains its master identity.
The composed response retains the server's existing 1 MiB JSON budget. A result
that exceeds it fails explicitly; the CLI never drops requested sections to
manufacture success. Use the named paginated domain readers for large collections.

`--include-records` adds the selected application's existing permission-aware
ledger, except when a document is selected. Task summaries require `read:tasks`;
without it, `available:false` differs from an empty list. Ledger task, interview,
contact and company-target data retain their conditional source grants. Request
`read:interviews` explicitly if needed; default OAuth grants remain unchanged.
Selection never authorizes editing or records a submission. Changed projected
revisions/parents, lost ownership or revoked relevant grants fail and require a
fresh read. No read changes preferences or creates product records.

Search uses the existing browser metadata service: up to ten ranked matches across
`Application`, `Company`, `Contact`, `Document`, `Saved search` and `Task`. It is
not a complete inventory or document-content search. Empty queries return recent
saved metadata. Literal wildcard characters remain literal. Inactive tasks and
stage templates remain excluded under the browser rules. A kind-filtered search
requires that source's read grant; an unfiltered search requires all six. Returned
links are metadata only; the command never opens a browser or changes selection.

Resolve accepts one owned document/Hunt UUID or slug. It requires `read:documents`
or `read:campaigns` for the selected kind. Foreign/missing or ambiguous ID/slug
matches fail explicitly; there is no fallback to another account or record.
Current credentials and relevant source grants are rechecked after each read.
SDK methods: `searchWorkspace` and `resolveWorkspaceLocation`. Existing MCP names,
schemas, scopes and UI metadata remain; these data tools also work without an
embedded app. Other workspace/daily-work workflows, legacy/core reconciliation
and public/hosted/OS acceptance remain required.

## Career highlights

Full native text/tag capacity is also available through private JSON files:

```sh
jobhunt highlights files --page 1 --per-page 50 --json
jobhunt highlights file-manifest HIGHLIGHT_UUID --json
jobhunt highlights download-record HIGHLIGHT_UUID --output private-highlight.json --json
jobhunt highlights save-file --file original-intent.json --fields supplied-fields.json --confirm jh_ACCOUNT_UUID --json
jobhunt highlights save-host-file --file original-host-intent.json --confirm jh_ACCOUNT_UUID --json
```

`files` accepts the same filters/pagination as `list` but returns metadata only.
`download-record` verifies the complete JSON record, every source-bound byte chunk
and the final source before writing a new mode-0600 file; existing files/symlinks
are refused. Stdout contains metadata, never the record body.

The original intent contains `request_id`, required `expected_account_id` and
`action: "create"` or `"update"`. Updates also require `highlight_id` and the
reviewed `expected_fingerprint`. The fields file is a UTF-8 JSON object up to
16 MiB with the browser's native long-text/tag capacity. Omitted fields remain;
explicit null clears optional fields. Duplicate JSON keys are refused. The host
intent adds `file` (approved private `download_url`/`file_id`), `source_size` and
`source_sha256`. The server verifies host/redirect/bytes and fresh authority.
The account confirmation is checked before reading fields or making a request.

These use the same native journal service and `save_workspace_highlight_v2`
receipt as the browser and compact contracts below. Preserve the whole original
intent and fields for retry; check `operations find` after interruption. Replays
do not repeat a creation after later edits/deletion. Host retries re-read the
source; receipt lookup works independently if the source expires. Native grants,
owned company/Hunt references and first-capture task permission remain required.
Existing compact commands and schemas keep their limits and behavior.

```sh
jobhunt auth login --profile journal --scopes read:profile,read:highlights,write:highlights,write:tasks,read:companies,read:campaigns
jobhunt highlights list --page 1 --per-page 50 --profile journal --json
jobhunt highlights list --file reviewed-highlight-filters.json --profile journal --json
jobhunt highlights get HIGHLIGHT_UUID --profile journal --json
jobhunt highlights options --profile journal --json
jobhunt highlights choices --company-page 1 --hunt-page 1 --role-page 1 --per-page 100 --profile journal --json
jobhunt highlights create --file supplied-highlight.json --profile journal --json
jobhunt highlights update --file reviewed-highlight-edit.json --profile journal --json
jobhunt highlights delete --file reviewed-highlight-deletion.json --confirm HIGHLIGHT_UUID --profile journal --json
jobhunt highlights export --file reviewed-export-range.json --output private-journal.md --profile journal --json
```

Read/list require `read:highlights`. List filters support `search`, `date_from`,
`date_to`, `category`, owned `company_id`, exact `role`, an array of tags (all must
match), `sort` (`date_desc`, `date_asc`, `created_desc`), `page` and `per_page`
(1–100, default 50). Use `--file` for the complete typed query; it cannot be mixed
with list flags. The default list flags also support `--from`, `--to`, `--query`
and `--sort`. Company filters additionally require `read:companies`. Pagination
and fingerprints describe the returned source snapshots; follow `journal.pages`.
`get` reads one owned record and fingerprint without scanning a whole journal.

Options require `read:highlights`, `read:companies` and `read:campaigns`, returning
owned company/Hunt choices and distinct journal roles. Directories have an
explicit 1,000-entry bound; an oversized directory fails instead of returning a
partial list. Unknown/foreign linked records never become selectable values.

For complete directories use `highlights choices`, which requires the same three
grants and returns independent `companies`, `hunts` and `roles` pages. Follow each
page's `pages`/`total`; select `--company-page`, `--hunt-page`, `--role-page` and
`--per-page` (1–100). There is no 1,000-choice cap. Unnamed legacy Hunts retain
`name: null`, and archived/paused/completed Hunts remain selectable as before.
Empty directories return page 1 of 1 with no items; an out-of-range page fails
explicitly. Reads change no selection or record. Concurrent edits can change page
contents, so review current record IDs before saving. The roles service retains
the browser's complete distinct-role read before slicing the response. The SDK
method is `getHighlightChoices`; existing `options`/`getHighlightOptions` retain
their original bounded result for compatibility.

Create/update/delete input contains `request_id`, the verified
`expected_account_id` and `action`. Create requires `fields.title`; omitted/null
create date uses the existing browser default. Update/delete require
`highlight_id` and `expected_fingerprint` from `get` or list. Update fields are a
partial patch: omission retains an existing value; null clears optional text or
links, `tags: []` clears tags, and a supplied title/date must remain valid. Delete
omits fields and requires the exact CLI `--confirm` target. Text fields support
up to 100,000 Unicode code points, title 500, role 200, category 50 and each tag
80. The common bounded JSON/request limits still apply.

Writes require `read:highlights` and `write:highlights`. The first capture also
requires `write:tasks` to retain the same weekly reminder as the browser. Explicit
company/Hunt bindings require their read grants and owned references. A failed
side effect rolls back the highlight and receipt. All adapters retain the
`save_workspace_highlight_v2` receipt namespace: retry the exact original input,
including after interruption or through an older adapter. A retry never repeats
creation, even after later edits/deletion. Recover with `operations find
--request-id UUID --operation save_workspace_highlight_v2`.

Export input is `format: "markdown"` or `"plain"` plus optional inclusive
`date_from`/`date_to`, with `read:highlights`. It uses the browser formatter and
writes complete UTF-8 text to a new mode-0600 file, verifies size/SHA-256, refuses
existing files/symlinks and prints metadata only. The inherited optional `page`
field does not paginate an export. The CLI uses the complete-export manifest and
chunk operations; the inline export operation retains its original 1,000-record/
1 MB limits for compatibility. Complete downloads impose no new record/byte cap:
each 64,000-character chunk is bound to the full export SHA-256, independently
checked, then assembled and verified before a private file is published. A journal
change during transfer fails `revision_conflict` and leaves no output; review and
start a new download. Each chunk recomputes the same complete owned browser query
and formatter, trading repeated reads for bounded transport without persisted
private copies. Browser/server and client memory/timeout limits still apply.
The SDK exposes `getHighlightExportManifest`, `getHighlightExportChunk` and
`downloadCompleteHighlights`; existing `getHighlightExport`/`downloadHighlights`
retain their bounded inline behavior. Full legacy/core,
public/hosted and supported-OS acceptance remain outstanding.

## Activity, analytics, career facts and inbox

```sh
jobhunt auth login --profile insights --scopes read:profile,read:applications,read:activity,read:analytics,read:campaigns,read:highlights,read:documents,read:contacts,read:notifications,write:notifications
jobhunt activity list --page 1 --profile insights --json
jobhunt activity counts --date 2026-10-21 --tz-offset=-420 --profile insights --json
jobhunt analytics get --days 90 --hunt-slug HUNT_SLUG --profile insights --json
jobhunt career get --profile insights --json
jobhunt notifications list --page 1 --profile insights --json
jobhunt notifications mark-read --file reviewed-inbox-action.json --profile insights --json
```

Choose only the grants needed for your work. An explicit `--scopes` list replaces
the defaults; adding commands does not expand a saved connection. Omit
`write:notifications` for a read-only inbox connection. Existing API keys also work.

`activity list` requires `read:activity` and `read:applications`. It returns the
browser's content-minimal timeline, 50 rows per page; follow `has_more`. It combines
application history and the latest 500 durable account events. It is not a complete
audit export and excludes free-form notes/posting contents from event details.

`activity counts` requires `read:analytics` and `read:campaigns`. Supply the local
calendar date to report and an offset in minutes from UTC (default 0; range
−840 through 840). Optional `--hunt-id` takes a Hunt UUID; omission selects account
activity, including account-level work. It reports existing recorded daily facts,
without changing records or inventing activity. Unknown/foreign Hunts fail.

`analytics get` uses the same two grants and existing browser aggregate rules.
Windows are 30, 90 or 180 days (default 90); `--hunt-slug` selects an owned Hunt.
Omission includes all owned applications. An explicit missing Hunt never falls
back to the whole account. An owned Hunt literally named with slug `all` remains
one selected Hunt; omit the flag for account-wide results. A disappearing selection
is rejected after aggregation. `career get` requires `read:highlights`,
`read:documents` and `read:contacts`; its whole-account totals are not computed from
a truncated client page. `as_of` is a UTC observation time. Future contact dates
leave network facts flagged as invalid rather than producing a guessed score.
Existing inclusive date-window rules remain.

Inbox reads require `read:notifications` and `read:profile`, return 100 notifications
per page and saved display preferences, and never mark anything read, even when
`markReadOnOpen` is true. The returned preference does not filter this page.
Use the pagination metadata; unavailable pages fail explicitly.

To mark notifications read, supply `request_id`, the verified `expected_account_id`
and either `action: "read", notification_id: "UUID"` or `action: "read_all"` with
no notification ID. Both `read:notifications` and `write:notifications` are required.
Use a new request ID for a new action, and reuse the exact original input after
an interrupted reply. Replaying `read_all` never marks later arrivals; existing
read timestamps and other accounts remain. Recover with `operations find
--request-id UUID --operation mark_workspace_notifications_read_v2`.
This changes read state only; no messages are sent and preferences are unchanged.

The current commands have local prerelease evidence. Complete legacy/core activity,
analytics and notification interfaces, public distribution, hosted and supported-OS
acceptance remain part of the migration.

## Private document page previews

```sh
jobhunt documents preview --file reviewed-document-page.json --output page.jpg --json
jobhunt packages preview --file reviewed-prepared-page.json --output frozen-page.jpg --json
```

The document input contains `document_id`, `expected_revision` and optional
`page` (1–100; default 1). It uses the same website PDF renderer and requires
`read:documents`. Read the current saved revision first. Changes to content,
identity or effective rendering settings during rendering discard the result.

The prepared input contains `application_id`, `version_id`, `expected_revision`
(the prepared document's `source_revision`), `expected_sha256` (its `sha256`),
and optional `page`. Obtain those values from `packages get`. This requires both
`read:applications` and `read:documents`. The preview reads the exact private
stored PDF, checks its checksum and rechecks current grants, application/version
association and object availability after rendering. Later editable-draft changes
never alter this immutable preview.

Both commands write a bounded JPEG to a new file with mode 0600, refuse existing
files/symlinks and never overwrite a destination created during the request.
JSON output contains metadata only; it does not include image chunks or URLs.
Prepared output's `source_sha256` identifies the source PDF, not the JPEG.
They do not publish, edit, create a submission or contact an employer. The old
app-only preview tools remain; headless callers use the separately documented
`get_document_page_preview_v2` and `get_prepared_page_preview_v2` operations.
These commands remain locally verified prerelease work pending public/hosted and
supported-OS acceptance.

## Hunt Page settings, private preview and visibility

These commands manage the existing live Hunt Page. Read and preview require
read:profile and read:documents; writes also require write:profile. Select those
grants explicitly at login. Public sharing is never inferred from editing or
previewing. No new website or admin interface is introduced.

```sh
jobhunt account connected --json
jobhunt hunt-page get --json
jobhunt hunt-page get --page 2 --json
jobhunt hunt-page save --file reviewed-page.json --json
jobhunt hunt-page preview --file reviewed-preview.json --output preview.jpg --json
jobhunt hunt-page publish --file reviewed-publication.json --confirm jh_ACCOUNT_UUID --json
jobhunt hunt-page unpublish --file reviewed-privacy.json --confirm jh_ACCOUNT_UUID --json
```

The read returns the full saved page plus bounded source/profile choices. Read all
picker pages as needed. Its selected_documents list and preview_revision cover
every selected document, including those outside the current picker page.
Reading an empty account does not create a page or profile.

A save file contains request_id, expected_account_id, expected_revision and the
complete reviewed draft returned by get. Keep source_id equal to the first
source_ids entry; at most twenty selected documents must belong to one package.
Preserve the remaining fields unless intentionally changing them. Linked package
profiles supply the public name, links and photo. An already-public page requires
acknowledge_public_update: true because saving updates it immediately. Private
pages stay private. Existing personal-page palettes remain supported; these are
user publication settings, separate from application brand themes.

The private preview file contains expected_revision and expected_preview_revision
from the reviewed page, optionally document_id and page (1–100). It renders one
selected document page using the existing website PDF renderer and saves a JPEG
to a new private file. This is a document preview, not a full HTML sidebar preview.
It performs no publication. Existing session preview routes keep their session
requirement; the new API uses explicit product grants. Private page PDF/DOCX
export uses the `exports` commands above. Other export adapters remain separate
headless work.

Publication and privacy files contain request_id, expected_account_id,
expected_revision, expected_preview_revision and visibility: public or private.
Public additionally requires confirm_publication: true. Both CLI commands require
--confirm matching the complete expected account ID. Read/review again after a
conflict; do not silently replace the fingerprint and retry an old approval.
The public page uses live saved document content, so later linked edits affect it.
Making it private closes its public page and assets but cannot retract previously
downloaded copies. It remains possible to make a damaged old page private when
its selected source is missing.

For a page without a linked profile:

```sh
jobhunt hunt-page photo-save --file reviewed-photo.json --image cropped.png --confirm jh_ACCOUNT_UUID --json
jobhunt hunt-page photo-download --file reviewed-media.json --output photo.png --json
```

The photo write file contains request_id, expected_account_id, expected_revision,
expected_preview_revision and acknowledge_public_update: true when already public.
Use a PNG no larger than 367,500 bytes and 1,024 pixels per edge. Existing private
photo sanitization strips metadata. The read file contains the two expected
revision fields; it also supports profile-managed photos. For linked profiles,
change the photo through profiles photo-save instead. Downloads never overwrite
existing files or symlinks. Original local filenames are not transmitted.

Keep the exact request ID, account, fields and image bytes after a lost write
response. Retry that original intent or inspect its receipt with operations find.
A replay returns current saved state without undoing later edits or visibility
changes; the CLI never automatically retries. Rendering and storage access recheck
authority and the reviewed page before returning private bytes or committing.
These commands are locally verified prerelease work; public package distribution
and exact hosted provider acceptance remain pending.

## Contact records

```sh
jobhunt contacts create --profile contacts --name 'Example Person' --company 'Example' --notes 'Met at an event' --json
jobhunt contacts list --profile contacts --page-size 20 --page 1 --json
jobhunt contacts get CONTACT_ID --profile contacts --json
jobhunt contacts update CONTACT_ID --profile contacts --revision 1 --title 'Recruiter' --json
jobhunt contacts delete CONTACT_ID --profile contacts --confirm CONTACT_ID --json
```

Use the actual ID and `attributes.revision` from the preceding read. Updates reject
stale revisions with exit 5; review the current contact before retrying. Company
relationships must belong to your account. `--company` sets the displayed name;
`--company-id UUID` links an existing owned company. Lists return one page, at most
100 contacts, and optionally filter by `--company-id`. Empty `--email ''` or
`--phone ''` clears the displayed value. The typed client also accepts null for
nullable contact fields.

`--notes TEXT` updates plain contact notes (`notes_content`) while preserving the
separate structured note records. Company workflows, contact imports, relationship
tiers, application links, interactions, follow-ups and structured note commands
remain required work; these commands do not cover the full CRM workflow.
Creation is not retried automatically. After an uncertain result, list/read before
creating again. Delete requires the exact ID twice and removes application links.

The matching public MCP tools are `list_contacts`, `get_contact`, `create_contact`,
`update_contact` and `delete_contact`. List supports `page`, `page_size` and
`company_id`; update accepts optional `revision`. Existing HTTP/MCP consumers can
omit the new concurrency metadata, but new clients should supply it. The CLI
requires revisions and does not silently fall back if an older server omits them.
Deploy the server revision before distributing this CLI version.

## Tasks and recurring follow-ups

These commands use the existing `/api/v1/journey/` services. Reads work without
the journey release flag; mutations and versioned MCP tool discovery require
`JH_JOURNEY_ENABLED=1` on the server. This package does not enable a deployed
flag or fall back to unversioned writes. Check the exact server release before
distributing this CLI.

```sh
jobhunt auth login --profile tasks --scopes read:profile,read:tasks,write:tasks,read:applications,read:campaigns
jobhunt account connected --profile tasks --json
jobhunt tasks list --profile tasks --state open --page 1 --json
jobhunt tasks get TASK_UUID --profile tasks --date 2026-10-19 --json
jobhunt tasks create --profile tasks --file task.json --json
```

`task.json` contains the raw typed input, without a JSON:API `data` wrapper:

```json
{
  "request_id": "11111111-1111-4111-8111-111111111111",
  "expected_account_id": "jh_22222222-2222-4222-8222-222222222222",
  "title": "Follow up on the saved application",
  "description": "Review the notes before contacting the recruiter",
  "due_at": "2026-11-01"
}
```

Replace these synthetic IDs: generate a fresh UUID for each new intent and take
`expected_account_id` from `account connected`. Binding the account is optional
but recommended for agents; a connection change is rejected before a write.
Never replace that binding automatically when retrying. To link a record, add
an owned `application_id` or `search_id`. Lists use 20 items per page and expose
`data.has_more`; use `--state completed` or `all` to find completed one-off tasks.
Optional list filters are `--application-id`, `--hunt-id` and `--date`.

Listing always requires `read:tasks` and `read:applications`. Reading a standalone
task requires `read:tasks`; reading an application-linked task also requires
`read:applications`. Writes require `write:tasks`, plus the corresponding read
grants for a linked application/hunt. Selecting a hunt requires `read:campaigns`;
linking an application in a hunt also requires that grant. Omit `write:tasks` for
a read-only profile. These permissions never grant access to another account.

For a one-off completion or reopening, use the latest `data.revision` and a fresh
request UUID:

```sh
jobhunt tasks complete TASK_UUID --profile tasks --revision 3 --request-id REQUEST_UUID --json
jobhunt tasks reopen TASK_UUID --profile tasks --revision 4 --request-id REQUEST_UUID --json
jobhunt tasks update --profile tasks --file edit.json --json
```

An edit file needs `task_id`, `expected_revision`, `request_id`, optional
`expected_account_id`, and the requested `title`, `description`, `due_at` or
`is_active`. Omitted fields stay unchanged; null description/deadline clears it.
Calendar dates stay on their supplied day. Timed deadlines need a timezone.
A stale revision exits 5: read again and review the difference before editing.

For a recurring task, replace `due_at` in the create input with `recurrence`,
for example `{"type":"weekly","days":[4],"due_time":"09:30","paused":false}`.
Days run Monday=0 through Sunday=6, and times use the account timezone. Supported
types are `daily`, `weekdays`, `mwf`, `tth`, `weekly`, `custom_days` and
`times_per_week`. Weekly needs one day; custom days need at least one;
times-per-week needs `times_per_week` between 1 and 7. The server owns these rules.

`tasks complete`/`reopen` do not change recurring lifetime state. Use
`tasks completion --file completion.json`, supplying `task_id`,
`expected_revision`, `request_id`, `completion_date`, explicit `completed`
true/false, and `expected_fingerprint` from that date's `get` result
(`data.recurrence.fingerprint`). Read with `--date` first. Future completion dates
are rejected. Reopening may remove a future skip. If no date was selected for a read, the server uses account-local
today. Schedule activity and dated completion are separate.

`tasks schedule --file schedule.json` takes the same task/revision/request/fingerprint,
an `occurrence_date` matching the read, and the complete new `recurrence`.
Preserve unrequested fields; `paused` pauses/resumes the schedule. Completion
history, title, description and links remain intact. All these commands record
tasks only; they do not send messages or calendar invitations.

`tasks skip --file skip.json` records a skipped date without changing the schedule.
Supply `task_id`, `expected_revision`, `request_id`, `occurrence_date`, and
`expected_fingerprint` from a read of that exact date. Optional account binding
is supported. Future dates can be skipped. A completed or unknown record returns
`occurrence_already_recorded`; explicitly reopen it first if that is your intent.
A dated read exposes `recurrence.status`: `open`, `completed`, `skipped`, or
`unknown` for an unrecognized historical state. Never treat unknown as completed.

```sh
jobhunt tasks history TASK_UUID --profile tasks --limit 30 --json
jobhunt tasks history TASK_UUID --profile tasks --before-date 2026-10-01 --json
```

History returns recorded dates newest first, at most 100 per page. Use
`data.next_before_date` only when `data.has_more` is true. The cursor excludes its
date; it is not a snapshot. Restart pagination when the task revision changes.
Missing dates are not invented. Reopening removes the dated record; this is
current occurrence history, not an immutable audit trail.

After a lost response, inspect the owned receipt:

```sh
jobhunt operations find --profile tasks --request-id REQUEST_UUID --operation create_task_v2 --json
jobhunt operations get OPERATION_UUID --profile tasks --json
```

For an exact retry, retain the same input and request UUID. A changed payload
with the same ID conflicts. Task receipts currently expire after 24 hours; inspect
`retry_expires_at` and do not recreate an uncertain action blindly after expiry.
No mutation is retried automatically. The matching MCP tools are `list_tasks_v2`,
`get_task_v2`, `create_task_v2`, `update_task_v2`,
`set_recurring_task_completion_v2`, `set_task_schedule_v2`,
`skip_recurring_task_v2`, `get_task_history_v2`,
`get_connected_account` and `get_job_hunt_operation`. Their schemas are published
in `/api/v1/openapi.json`. Existing legacy task tools remain compatible.

Task input files must be regular UTF-8 JSON, at most 64 KiB. `--file -` reads stdin;
it cannot be combined with `--token-stdin`. Use a saved profile or protected
environment credential when piping an input document. Error output never includes
the file path or content. Stage-template cleanup/settings, bulk recurrence cleanup,
and contact/company follow-up links remain required
CLI work; this is not full task-domain parity. Existing application stage assignments
can be managed through the workspace record commands above.

### Delete a task and check calendar cleanup

`jobhunt tasks delete --file removal.json --confirm TASK_ID --json` removes the
exact owned task at the revision you reviewed. For a recurring task, this deletes
the **whole schedule and all completion history**. Use completion/reopening or
schedule pause when that is the intended action. A removal file contains:

```json
{
  "task_id": "11111111-1111-4111-8111-111111111111",
  "expected_revision": 3,
  "request_id": "22222222-2222-4222-8222-222222222222",
  "expected_account_id": "jh_33333333-3333-4333-8333-333333333333"
}
```

Replace the synthetic IDs and revision from a fresh `tasks get`. Confirmation
must match `task_id` before any HTTP request. Keep the same file/request ID for an
uncertain retry; use `operations find --request-id UUID --operation delete_task_v2`
to recover the receipt. This wraps the existing `delete_task_v2` HTTP/MCP service
and does not accept shared stage templates. Linked tasks additionally require
application read access; deletion requires task write access.

`data.deleted=true` means the product record is gone. `data.calendar_cleanup`
reports removal of its previously synced calendar event separately:

- `not_scheduled`: no eligible event/connection, including disabled or disconnected
  sync. No external cleanup was scheduled; this does not prove an event is absent.
- `pending`: the existing durable worker has cleanup to perform. Inspect the saved
  operation with `operations get ID`; retrying deletion does not duplicate work.
- `succeeded`: the worker confirmed removal (including an already deleted event).
- `failed`: cleanup could not finish or current access was withdrawn. The task
  remains deleted. Review the external calendar; a new deletion cannot restore
  the task or recreate its cleanup job.

The worker retains the original event and calendar identifiers and checks the
current account, credential and provider connection before sending. It will not
use a replaced provider grant to delete in a different account. Cleanup needs the
deployed journey worker and existing release configuration; local package checks
do not prove production worker availability. These operations never create calendar
invitations or send outreach.

## Saved job-search website bookmarks

```sh
jobhunt auth login --profile bookmarks --scopes read:profile,write:profile
jobhunt --profile bookmarks bookmarks get --json
jobhunt --profile bookmarks account connected --json
jobhunt --profile bookmarks bookmarks save --file reviewed-bookmarks.json --json
```

Use only `read:profile` for reading. `write:profile` also grants other supported
profile edits; it is not scoped to this list. Login defaults and existing grants
are unchanged. The same account-owned list appears in the website sidebar.

Read first, then save the **complete reviewed list**. Retain every bookmark you
want to keep and its ID; list order is preserved. Omitted entries are removed;
an empty `items` array clears the list. This changes bookmarks only, retaining all
other preferences. URLs are stored, never fetched or opened by these operations.

Example for a list whose current revision is zero (replace the request UUID for
each new intent; retain it unchanged for an uncertain retry):

```json
{
  "request_id": "11111111-1111-4111-8111-111111111111",
  "expected_revision": 0,
  "bookmarks": {
    "version": 1,
    "revision": 1,
    "items": [
      {"id": "example-board", "name": "Example board", "url": "https://example.com/jobs", "note": "Check weekly"}
    ]
  }
}
```

Set `expected_revision` to the last read revision and `bookmarks.revision` to
that value plus one. Include `expected_account_id` from `account connected` when
binding the change to a reviewed account. A conflicting browser, MCP or CLI save
returns `revision_conflict`; reload and review the complete list before trying a
new intent. Never increment past a conflict without reading the saved list.

Up to 50 entries are supported. IDs and names are bounded at 80 characters, URLs
at 2,048 and notes at 180. Supply all four strings. URLs must be HTTP(S), with no
embedded credentials; duplicate IDs and duplicate URLs (ignoring trailing slashes)
are rejected. Bookmark JSON has a 512 KiB file/stdin limit to cover the full list.
`--file -` cannot share stdin with `--token-stdin`.

The existing MCP tools are `get_hunt_bookmarks_v2` and `save_hunt_bookmarks_v2`;
their matching HTTP schemas are in `/api/v1/openapi.json`. Mutation and MCP discovery
use the existing `JH_JOURNEY_ENABLED` server release flag; no new flag is needed.
They do not require the optional MCP UI flag.

If a reply is lost, use `operations find --request-id UUID --operation
save_hunt_bookmarks_v2` and retry the exact original input within the receipt's
`retry_expires_at` (currently 24 hours). A replay keeps the original operation and
its revision; `data` is the current list and may reflect later edits. Recovery
never rewrites a newer list. Expired retries return `retry_expired`; review current
state before deciding on a new change.

## Output and recovery

`--json` writes one success document to stdout and errors to stderr. Errors have
`error.code`, `error.status`, and optional `request_id` / `retry_after_seconds`.
Server diagnostic text and credentials are never echoed. Human output is readable
JSON with escaped control characters. Requests time out after 15 seconds by
default; `--timeout MS` accepts 100–120000.

| Exit | Meaning |
| --- | --- |
| 0 | Success (including unauthenticated `auth status`) |
| 2 | Usage, validation or missing explicit confirmation |
| 3 | Authentication or credential failure |
| 4 | Permission denied |
| 5 | Stale revision or conflict |
| 6 | Rate limited; inspect the optional retry interval |
| 7 | Network, timeout, invalid response or service failure |
| 8 | Missing or retired resource |

Use the safe error code and request ID for support. Do not attach credential
files, browser authorization URLs, raw account output or API tokens.

Task reads and mutations can bind the reviewed application using
`expected_application_id`. Omit it for existing task-only behavior, pass the
application UUID to require that relationship, or pass `null` to require a
standalone task. A mismatch returns `task_context_changed` (HTTP 409) without
writing. The binding is part of the original request intent: retain it when
checking a receipt or retrying. `tasks get`, `tasks history`, `tasks complete`
and `tasks reopen` accept `--expected-application-id UUID|none`; file-based task
commands accept the JSON field. This check supplements ownership and revisions.

## Account task preferences

```sh
jobhunt auth login --profile preferences --scopes read:profile,write:profile
jobhunt --profile preferences task-settings get --json
jobhunt --profile preferences task-settings update --file reviewed-preferences.json --json
```

These commands use the existing account settings table through
`get_task_settings_v2` and `update_task_settings_v2`, also exposed by MCP. Reads
require `read:profile`; updates require both profile grants. Task grants alone
are insufficient. Reading an account without saved settings returns defaults
without creating a row. Stage automation is retired and cannot be enabled here.

Use the `account_id` and exact `fingerprint` from a fresh read, then send only
fields the user requested. This synthetic example must be replaced with those
values and a new request UUID:

```json
{
  "request_id": "22222222-2222-4222-8222-222222222222",
  "expected_account_id": "jh_11111111-1111-4111-8111-111111111111",
  "expected_fingerprint": "aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa",
  "patch": {
    "default_due_time": "09:30",
    "hide_completed_tasks": true
  }
}
```

Supported preferences are `default_due_time`, `default_jbr_recurrence`,
`snooze_options`, `hide_completed_tasks` and `section_order`. Due times use
`HH:MM`; explicit null restores the effective `17:00` fallback. Snooze options
are positive integer minutes (at most 50); an empty list restores the existing
`[60, 1440, 10080]` fallback. Section order contains at most four unique names
from `jbr`, `quick`, `interview`, `pipeline`; an empty list restores that order.
Recurrence uses the existing `daily`, `weekdays`, `mwf`, `tth`, `weekly`,
`custom_days` or `times_per_week` value. Other fields cannot be null.

Omitted fields and existing tasks/completion history are preserved. A preference
change does not reschedule tasks, reopen them, or create automation. Existing
browser changes invalidate the fingerprint. On a conflict, read the current
settings and review a new patch; do not automatically overwrite the newer values.

After a timeout, retain the entire original JSON. Find its receipt with
`operations find --request-id UUID --operation update_task_settings_v2` and
retry the identical file within the receipt window. Replaying an old successful
request returns its original receipt alongside current settings; it does not
reapply its old values. A changed account or revoked grant is denied. These
commands remain prerelease until public distribution and hosted checks pass.
The task settings form uses the same intent/recovery workflow when the journey
release flag is enabled; the built browser, MCP and installed CLI agree locally.

## Existing stage templates

Automatic stage-task creation is retired. These commands manage existing templates
and their retained application assignments; they never create new assignments.
Authorize `read:tasks,write:tasks,read:applications` for the full workflow.

```sh
jobhunt stage-templates list --json
jobhunt stage-templates list --include-detached --page 2 --json
jobhunt stage-templates get TEMPLATE_UUID --json
jobhunt stage-templates update --file reviewed-template.json --json
jobhunt stage-templates remove --file reviewed-cleanup.json --confirm TEMPLATE_UUID --json
```

List returns 20 templates per page. Read the exact target before editing or
removing it. Its fingerprint covers all template fields and every existing
assignment, including notes and recorded statuses. Preserve the returned account
ID, fingerprint and original request UUID when checking a receipt or retrying.
A fresh assignment edit or membership change invalidates an old review.

An update takes `template_id`, `request_id`, `expected_account_id`,
`expected_fingerprint` and a nonempty `patch`. Supported patch fields are `title`,
`description`, `sort_order`, `due_days_offset` and `auto_complete_on_forward`.
Omitted fields are unchanged; null clears description or due offset. The last
two fields are retained legacy metadata and cannot reactivate stage automation.
The title is shared with existing assignments; their personal notes, dates and
completion states remain unchanged. A retry returns the original receipt with
fresh `data.current`, which is null if the template was subsequently deleted.

Removal requires `confirmed: true` in the JSON, a matching CLI `--confirm`, and
an explicit `disposition`:

- `preserve_assignments`: detach from the stage and retain the backing template,
  assignment IDs, notes, dates and recorded states. An unassigned template is
  deleted. Use `--include-detached` to find retained backing templates later.
- `remove_assignments`: permanently delete the template and all its application
  assignments. Application records themselves remain. Review the returned pending,
  completed, skipped and unknown assignment counts before choosing this.

For ordering, list with `--stage-id UUID`, collect every page, then run
`stage-templates reorder --file reviewed-order.json`. The file contains the stage
ID, full ordered `template_ids` list, `expected_fingerprint` copied from the
listing's `stage_fingerprint`, and original mutation/account IDs. A changed set
or order fails. The atomic command accepts up to 500 IDs; larger lists can use
individual `sort_order` patches. Pagination is not a snapshot: read again if the
fingerprint changes between pages.

All five operations have matching named HTTP and MCP contracts in the developer
reference. After an uncertain removal, find the receipt with
`operations find --request-id UUID --operation remove_stage_task_template_v2`;
retry only the exact original file. A receipt proves the accepted operation,
while `data.current` shows current retained content. These commands remain
prerelease until public installation and hosted acceptance pass.

### Reviewed recurring completion cleanup

Use `jobhunt tasks cleanup-preview --date YYYY-MM-DD` to review up to 20 recorded
recurring task/date groups. Optional `--scope jbr` limits cleanup to job-board
review tasks; `--include-skipped` explicitly includes skipped dates. Otherwise
skips remain. Unknown states, other dates and nonrecurring tasks always remain.
Follow `--after-task-id` from `next_after_task_id` while `has_more` is true. Pages
are current reads, not a snapshot. A migrated task may show both unified and
legacy job-board records, which are reviewed together.

Build a JSON intent containing the returned `account_id` as `expected_account_id`,
a new UUID `request_id`, the exact `occurrence_date`, `scope`, `include_skipped`,
`confirmed: true`, and 1–20 `targets` containing each selected `task_id` and its
`fingerprint` as `expected_fingerprint`. Submit it with:

```sh
jobhunt tasks cleanup --file reviewed-cleanup.json --confirm YYYY-MM-DD --json
```

One changed target rejects the whole batch. Read and review again after a
conflict. Preserve the exact original intent after a lost reply; inspect
`operations find --request-id UUID --operation reopen_recurring_completions_v2`
or retry that original intent. `reopened_task_ids` records the accepted targets;
`current` reports fresh state and can include a later completion. Retrying never
removes that later completion. A new cleanup needs a new review and request ID.
Requires `read:tasks`, `read:applications`, and `write:tasks` for the mutation.

Reviewed application-wide actions use the original MCP operations and receipts:
`applications remove --file JSON --confirm APPLICATION_ID` deletes an exact owned
application at `expected_revision`; the existing slug-based `applications delete`
remains available. `applications set-target --file JSON` sets `target_company`
using both `expected_revision` and `expected_target_revision`. Read the current
application workspace's `target` with application/company/campaign read grants
before preparing that intent. These commands also take `request_id` and optional
`expected_account_id`; retain the exact intent after an uncertain response.
Targeting needs application/company/campaign write grants. It changes the saved
company designation in that Hunt, never creates an application or sends anything.

`hunts summary HUNT_ID` reads targeting with `read:campaigns` only. `hunts update
--file JSON` uses the original `update_job_search` operation for supplied targeting,
preferred resume or active/paused state at `expected_revision`. Omitted values
remain; null clears optional targeting fields or the preferred resume. Selecting
a resume additionally needs `read:documents`; account preferences use `hunt-settings`.
`hunts rename --file JSON` takes the exact Hunt ID/revision, name and stable request
ID with campaign read/write and application read grants. Its bounded response
shares the original `rename_hunt_v2` input and receipt, so native and CLI retries
are interchangeable for that exact intent and never repeat an earlier rename.
Full criteria/lifecycle commands remain `hunts get` and `hunts save`.

Portable browser workspace reads are available as `tasks workspace TASK_ID`,
`tasks workspace-list --page N` and `applications choices --page N`. Task context
needs task/application read grants; application choices need application read only.
Use `--expected-application-id ID|none` to bind a selected task's context and
`--date YYYY-MM-DD` for its recurring-date state. The task list retains its original
short description projection; a selected workspace returns full notes within the
existing 1 MiB view budget.

`tasks description TASK_ID --output PATH` downloads complete private UTF-8 notes
using revision/account/context-bound checksummed chunks. It also preserves empty
versus null notes in metadata. It covers retained task kinds, including templates
and CRM tasks, using task read permission and owned relationship checks.
`photos download PHOTO_ID --output PATH` reads an owned available photo artifact,
including a previous upload that is no longer linked. It uses the existing PNG
sanitization and current artifact availability checks. Both downloads create a
private file only after verification, refuse overwrites and print metadata only.
The complete note download honors bounded server `Retry-After` delays on throttled
reads; source changes still abort the download without publishing a partial file.

### Personal details only

`jobhunt profiles personal PROFILE_ID` reads the original personal-details view,
including its exact `updated_at` and public-use flag.
`jobhunt profiles update-personal --file intent.json` replaces reviewed personal
details without renaming the profile or selecting a default. Supply `profile_id`,
`expected_updated_at`, `personal_data`, `acknowledge_linked_updates: true`, and a
request ID; an expected account ID is supported. Omitted personal fields follow
the original replacement semantics. Preserve fields you want to retain.

This uses `save_contact_profile_v2` and its original receipt. It updates linked
documents and Hunt Pages immediately while preserving their bodies and publication
choices. Full profile create/update and photo-save share native business helpers
but retain distinct operation names and request envelopes. Do not translate an
uncertain native intent into a different operation; recover its original receipt.

`profiles directory --page N` preserves native directory fields, including retained
empty profile names. Read personal contents separately with `profiles personal`.
`profiles photo-upload --file intent.json --image photo.png --confirm PROFILE_ID`
uses the original `save_hunt_profile_photo_v2` input/receipt and returns only the
selected profile. This works without embedded UI and with directories too large
for native inline results. Exact native photo intents can replay through this
adapter. The older `profiles photo-save` retains its separate receipt namespace.

`profiles save-identity --file intent.json` uses the original complete identity
create/update intent and `save_hunt_profile_v2` receipt. Supply name, personal data,
explicit default choice, acknowledgment and request ID; updates also bind the
profile and its exact `updated_at`. It returns one current identity. An uncertain
native save can recover through this command even when a whole-directory result
is oversized. Existing create/update commands retain their additional default
review and distinct receipt namespace. Never move a pending intent between
different receipt namespaces.

### Calendar connections and local preferences

Request calendar permissions explicitly, for example:

```sh
jobhunt auth login --profile calendar --scopes read:profile,read:calendar,write:calendar
jobhunt calendar connections --page 1 --profile calendar --json
jobhunt calendar provider google_calendar --profile calendar --json
jobhunt calendar connection CONNECTION_ID --profile calendar --json
```

`calendar connections` follows complete pages of 25. Connection reads use only
`read:calendar` and return native effective preferences, retained stored settings,
scope/status facts and a review fingerprint. Credentials and raw provider error
text are excluded. Contacts/email-purpose connections are not calendar connections.
These reads never refresh tokens, initialize defaults or contact a provider.

`calendar settings --file intent.json` includes `request_id`, `connection_id`,
`expected_fingerprint`, optional `expected_account_id` and a `settings` object.
Native keys are `sync_interviews`, `sync_tasks`, `sync_enabled`, `calendar_id` and
`sync_settings`. Omission preserves fields; null clears nullable scalar fields.
`sync_settings.task_types` merges with retained settings as in the website.
Other supplied settings keys retain native handling; inspect `stored_sync_settings`
for actual saved state. This operation makes no provider request or calendar sync.

`calendar disconnect --file intent.json --confirm CONNECTION_ID` uses the same
review fields without `settings`. It removes only that local calendar connection
and its stored credentials. Existing events, interviews, tasks and other-purpose
connections remain. It does not revoke the provider's grant or delete remote events.
Both writers need only `write:calendar`; exact retries preserve later settings and
cannot disconnect a replacement connection. Keep original intents after interruption.

These are the native API's calendar grant names; OAuth and CLI now advertise them
without adding them to default grants. Account-setting receipt summaries use the
existing `profile` presentation kind while permission checks retain `calendar`.
Connect provider accounts through the existing browser consent flow. Local checks
do not establish hosted provider coverage.

`calendar available CONNECTION_ID [--cursor TOKEN]` uses `read:calendar` to read
writable destinations from the connected provider. Follow `next_cursor` until null,
including after an empty page. Cursors expire after 15 minutes and bind the owner,
connection and saved state; restart discovery if that state changes. Provider pages
can change during discovery and do not promise a whole-list snapshot or total.
Discovery may refresh expired access ephemerally, but saves no credentials,
preferences or events. Provider/refresh failures return an error, never a false
complete empty list. Credentials and raw provider errors are excluded.

### Saved-item Calendar handoffs

Automatic saved-item sync has an admission step before delivery. Discover all
handoffs in pages of 25; use the original ID after an interrupted save.

```bash
jobhunt calendar handoffs --page 1 --json
jobhunt calendar handoff HANDOFF_ID --json
jobhunt calendar handoff-review --file review.json --json
jobhunt calendar handoff-resume --file resume.json --confirm HANDOFF_ID --json
jobhunt calendar handoff-leave --file leave.json --confirm HANDOFF_ID --json
```

Review input contains `handoff_id` and its current `expected_fingerprint`.
Resume input adds `expected_account_id`, a stable `request_id` and the returned
`review.review_token`. It schedules the same original handoff; it does not prove
delivery. The response's `change_id` opens `calendar change ID` for actual provider
and saved-association outcomes. Keep the same request ID and proof after a lost
reply. Accepted or unknown original admissions are never replaced.

Leave input uses the account, handoff ID, fingerprint, stable request ID and
`confirm_leave_unchanged:true`. It stops further handoff admission without any
provider write. Unknown admission remains unknown, even if a related owned request
can be inspected. This does not cancel a delivery request, remove an event or
prove that no event exists. Confirmed child requests use the existing delivery
controls below. `--include-admitted true` includes linked/resolved handoff history.
Read/review needs `read:calendar`; explicit resume/leave needs `write:calendar`.
Source and provider bodies, old proofs and credentials are never returned by reads.

### Reviewed calendar changes

Review a saved source before sending it to a connected Google calendar:

```json
{"connection_id":"CONNECTION_UUID","source_kind":"task","source_id":"TASK_UUID","action":"sync"}
```

```sh
jobhunt calendar preview --file selection.json --profile calendar --json
jobhunt calendar queue --file intent.json --profile calendar --json
jobhunt calendar change CHANGE_UUID --profile calendar --json
jobhunt calendar changes --source-kind task --source-id TASK_UUID --page 1 --profile calendar --json
```

Replace the uppercase IDs with saved UUIDs. `source_kind` is `task` or `interview`.
`action` defaults to `sync`; `status` refreshes a linked event's title using the
saved Done/Skipped state, and `remove` removes the linked event. Existing events
use their captured original calendar, even after the default destination changes.
Sync requires an enabled connection and a saved source date. A retained previous
event is reported and never silently deleted. Source records remain intact.

The preview returns a signed `review_token` valid for 15 minutes. Queue JSON
contains that exact token, a new `request_id` UUID and optional
`expected_account_id`. Queueing saves the reviewed intent without provider IO;
the worker performs delivery separately. After an interrupted reply, retry the
**original request ID and token**, even if that token has since expired. A new
request needs a current preview. History returns pages of 25; follow `has_more`.

Preview and history need `read:calendar`; queue and controls need
`write:calendar`. Responses contain target IDs, fingerprints and outcome facts,
without source notes, credentials or provider bodies. Read source content through
its existing task/interview operations and permissions. Delivery rechecks current
authority, source and connection, and separates `provider_state` (`not_started`,
`refused`, `unknown`, `confirmed`) from `local_state`. A failed request may have
changed the provider. Never create a replacement request blindly after uncertainty.

`calendar cancel --file intent.json --confirm CHANGE_UUID` requires `change_id`,
`request_id`, `expected_account_id` and `confirm_cancel:true`. It cancels only
never-attempted pending work. Running or attempted work cannot be falsely cancelled.

For `needs_review`, preview the current source with `recover_of:CHANGE_UUID` and
`action:sync` or `action:remove`. This explicitly targets the earlier captured
event using its current remote version; it requires the same connected grant.
A missing/unavailable remote event is not proof of removal. Alternatively,
`calendar resolve --file intent.json --confirm CHANGE_UUID` requires `change_id`,
`request_id`, `expected_account_id`, the current state's `expected_fingerprint`
and `confirm_leave_unchanged:true`. It records that choice without changing the
source or provider. Unknown/confirmed facts remain visible. Both controls retain
original receipts on exact retry. Private delivery snapshots retire after 24 hours
of terminal state; identity and outcome history remain.

These commands cover individual reviewed changes. The complete upcoming selection
and batch queueing workflow follows below; native implicit rescheduling, real
provider consent and hosted acceptance remain migration work.

### Sync the complete upcoming selection

`calendar upcoming CONNECTION_UUID [--cursor TOKEN]` reads the same eligibility
rule as the browser's sync-all action: upcoming interviews and dated tasks selected
by the saved interview/quick/pipeline preferences. Completed items and skipped
interviews are excluded. Recurring job-board reviews remain excluded. Disabled
connections refuse selection. This read performs no provider IO or database writes.

Follow `next_cursor` until null to cover the complete selection, 20 IDs per page.
The first page freezes the UTC cutoff; later pages retain its `as_of`, counts and
selection fingerprint. Continuations expire after 15 minutes and reject changes to
eligibility, connection preferences or the connected grant. Private notes are not
part of this directory snapshot; each event receives its own exact delivery review.

For each page, use `calendar preview` for each selected source. Collect the returned
tokens in an ordered batch JSON file:

```json
{"request_id":"REQUEST_UUID","expected_account_id":"jh_ACCOUNT_UUID","review_tokens":["FIRST_REVIEW_TOKEN","SECOND_REVIEW_TOKEN"]}
```

Replace the placeholders with the actual account, new request UUID and original
review tokens. Run `calendar queue-batch --file batch.json`. It accepts 1–20 distinct
tokens using only `write:calendar`; reads use `read:calendar`. Every accepted item
returns its own request ID and change ID, backed by its individual receipt and job.
Read each change for provider/local outcomes and use the existing per-item controls.
Repeat page review/queueing through the last upcoming-source page.

Batches retain native partial-success behavior: `accepted` and `rejected` describe
queue admission, never provider delivery. Rejected items have bounded errors and
were not queued. Registration is not an all-or-nothing provider transaction.
After interruption, retry the **same request ID and ordered tokens**. Existing
child receipts prevent duplicate jobs, including after proof expiry or later edits.
An uncertain readback after a child commit fails the response; it never falsely
labels that item rejected. Retry the original batch to recover it.

Batch registration has the ordinary 24-hour receipt recovery window. After it
expires, use individual change/history reads; do not blindly submit a replacement
batch. Unqueued stale/expired items need fresh reviews and a new batch containing
only those rejected items. A changed selection requires fresh discovery; retain the
IDs already accepted. No proof tokens or source bodies appear in batch responses.
Real provider consent, hosted batch delivery and native implicit rescheduling still
require release acceptance.

### Interview preparation and round ordering

`interviews prep ID` reads complete selected interview fields and independently
paged interviewer details, linked tasks and non-system sibling rounds. Use
`--expected-application-id ID` to bind the parent and `--interviewers-page`,
`--tasks-page` and `--rounds-page` to follow each collection's `has_more` separately.
Related pages contain 25 items. Task references retain their saved order and repeats;
deleted/foreign related records are omitted. Requires `read:interviews`,
`read:contacts` and `read:tasks`. Reads create nothing.
Related references appear through those pages, without duplicate raw task/interviewer
ID arrays in the selected record. Its revision/fingerprint still review the full source.

`interviews preparation-save --file intent.json` reviews `interview_id`,
`application_id`, `expected_revision` and the complete record's
`expected_fingerprint`. Include `request_id` and optionally `expected_account_id`.
Its `change` selects one distinct native workflow:

- `{"action":"checklist","checklist":[...]}` replaces the complete checklist.
- `{"action":"merge_feedback","feedback":{...}}` preserves unmentioned keys
  and removes keys supplied as null.
- `{"action":"submit_feedback","feedback":{...}}` replaces feedback with
  rating, notes, questions, followup_needed and followup_note, using native defaults,
  a server submission timestamp and one factual feedback activity entry.

System milestones are read-only. Writers need only `write:interviews`; no contact
or task contents are returned by saves. Exact retry preserves later edits and never
repeats feedback activity. Keep original requests after an interrupted reply.

`interviews rounds APPLICATION_ID [--page N]` reads all rounds and system milestones,
25 per page, with a fingerprint of the complete order. It needs only
`read:interviews`. `interviews reorder --file intent.json` uses that
`expected_fingerprint`, `application_id`, `request_id` and explicit `order` ID list
with `write:interviews`. System IDs keep their order and do not consume positions;
unspecified rounds remain in place. Foreign/missing and duplicate IDs are rejected.
For more than 1,000 requested IDs, use `order_chunks` instead of `order`: up to ten
ordered arrays of at most 1,000 IDs each. They form one reviewed atomic ordering;
this preserves the common payload limits. Keep the original representation on retry.
An original retry never repeats ordering after later edits. These commands send
no calendar actions; use the separately reviewed calendar commands for synchronization.

### Reusable interview templates

`interview-templates list [--page N]` reads every native template field and review
fingerprint in pages of 25, using only `read:interviews`. Follow `has_more` until
the last page. Listing an empty directory never creates defaults.

`interview-templates initialize --file intent.json` explicitly creates the nine
native defaults only when the reviewed directory is empty. Include `request_id`
and the list's `fingerprint` as `expected_fingerprint`; bind the account with
`expected_account_id` when available. A nonempty directory is preserved. Exact
retries return the original created IDs without seeding again.

`interview-templates create --file intent.json` accepts `request_id`, `title` and
optional `default_step_type`. Names are trimmed and unique within the account;
native ordering is retained. `interview-templates delete --file intent.json
--confirm ID` additionally requires `template_id` and its `expected_fingerprint`.
System defaults cannot be deleted, and existing interview steps remain intact.
These three writers require only `write:interviews`. Keep original requests after
an interrupted reply; do not substitute a new request ID automatically.

### Complete interview records

`interviews records [--application-id ID] [--page N]` lists owned interviews and
system milestones in pages of 20. `interviews get ID` reads complete saved fields,
revision and fingerprint; use `--expected-application-id ID` to bind the parent.
Only `read:interviews` is required. Related contacts/tasks appear as owned IDs,
without their contents. Reads create nothing; system milestones are read-only.

`interviews create --file intent.json`, `interviews update --file intent.json`
and `interviews delete --file intent.json --confirm ID` require only
`write:interviews`. Every intent includes `request_id`, `expected_account_id`
and `application_id`; updates/deletes additionally include `interview_id`,
`expected_revision` and the complete record's `expected_fingerprint`. Create/update
use `fields`; creation requires a title. Review the selected record before editing.
Keep the original request and request ID after an interrupted response.

Fields include title/type, notes, location/format, tags, scheduled start/end,
completion/skip timestamps, order, preparation, feedback, duration, task references,
interviewer IDs and status override. Omitted fields stay unchanged; null clears
nullable fields and empty lists clear collections. As in the native API,
`interviewer_ids: null` retains links and `[]` removes them. ISO timestamps with
offsets normalize to UTC; timestamps without offsets are interpreted as UTC.
Completion history records actual null-to-value transitions only; retries do not
repeat history or webhook jobs. These fingerprints differ from `set-status`.

Record creates/edits send no calendar invitations. Deletion preserves contacts
and tasks, and reports existing synced-event cleanup separately as not scheduled,
pending, succeeded or failed. The worker checks current interview write authority
and calendar connection; cleanup failure never restores the deleted record.
Explicit synchronization uses the separately reviewed calendar commands above.

### Complete Hunt workspace and original receipts

`hunts directory --page N` returns the original directory fields and status
projection in complete pages, preserving retained whitespace names. It needs only
campaign and application reads. `hunts workspace HUNT_ID` returns every saved
native Hunt attribute, fingerprint and revision with Hunt/company/resume choices.
Page each collection separately using `--hunts-page`, `--companies-page` and
`--resumes-page`, following its `has_more`. The four original source grants apply.
Compatibility values remain data; this does not introduce gamification UI.

`hunts workspace-save --file intent.json` uses original `CampaignWrite` input and
`save_workspace_campaign_v2` receipt. It returns the selected current record,
independently of directory size. `hunts remove --file intent.json --confirm HUNT_ID`
uses the original `delete_hunt_v2` receipt and bounded acknowledgment. Supply the
reviewed source revision/application count and any migration destination/version.
Applications move; they are never deleted. Exact native intents can replay through
these adapters after a lost or oversized reply, without repeating earlier changes.

The existing `hunts save`/`delete` operations retain distinct receipt namespaces.
Do not translate an uncertain intent between different namespaces. Preserve the
original input/request, or look up its original operation receipt. Original inline
JSON budgets remain; directory pages remove aggregate choice-size limits.


Current Studio packages can contain independent resume, letter, reference and
statement records. Use `source: "package"`, an ordered `document_ids` list of
1–8 active owned members from one package, and `format: "pdf"` or `"zip"` with
`bundles inspect --file JSON`. Copy its complete `sources` and `fingerprint` into
the normal prepare intent. Optional `page_size` overrides the saved paper without
saving settings. PDF preserves the selected order (20 combined pages maximum);
ZIP contains a separately rendered PDF for each selected record. The existing
`source: "document"` and `"application"` selections still export embedded sections;
`source: "library"` remains a JSON archive. No archive is extracted automatically.

`profiles photo-upload-file --file intent.json --image photo.png --confirm PROFILE_ID`
saves a reviewed JPEG/PNG up to 5 MiB through the shared file adapter. The intent
contains the profile ID, exact `expected_updated_at`, linked-update acknowledgment,
account and original request ID. Keep both JSON and image bytes unchanged on retry.
The retained `photo-upload` and `photo-save` compact PNG commands keep their original
limits and receipt namespaces. File saves preserve crop/alpha, strip metadata and
normalize within 1024px. They update linked live identity; historical files stay intact.

For an approved host reference, use `profiles photo-upload-host-file --file input.json
--confirm PROFILE_ID`. Include the original source size/SHA-256/media type and
HostFile reference. It uses `upload_profile_photo_file` JSON/MCP semantics and the
same receipt namespace; keep the full input unchanged on retry.

`hunt-page workspace [--page N]` reads the current document picker, including
source types, current selected-document fingerprints and publication facts. It uses
`get_hunt_page_workspace` across HTTP/MCP and the typed client. The retained
`hunt-page get`/`get_hunt_page_v2` input and strict response schema stay unchanged.
Opening either read creates or publishes nothing.

Unlinked Hunt Page photos also support full JPEG/PNG files up to 5 MiB:
`hunt-page photo-upload-file --file JSON --image JPEG_OR_PNG --confirm ACCOUNT_ID`
and `hunt-page photo-upload-host-file --file JSON --confirm ACCOUNT_ID`. Supply the
reviewed page revision and full preview fingerprint, original request/account and
`acknowledge_public_update: true` when public. The host variant adds an approved
HostFile plus exact source SHA-256, size and media type. Both use the original
`upload_hunt_page_photo_file` receipt; preserve the complete original payload for
retry. Local bytes and host inputs have distinct fingerprints. The retained compact
`photo-save` command is unchanged. Linked photos use the Hunt Profiles workflow.

## Account display name

`account get-name` reads your account identity, separately from Hunt Profiles.
Retain a private JSON original with `expected_account_id`, `expected_name`,
`name` and one `request_id`. Use `account set-name --file original.json
--confirm ACCOUNT_ID`. `account check-name --file original.json` checks only
that request. `account close-name --file original.json --confirm ACCOUNT_ID`
resolves it without changing the name. Never replace an uncertain original or
automatically retry it. Native validation and current profile grants still apply.

A successful original can return a newer current name. The receipt identifies
the accepted request; replay does not replace later edits. Unrecorded closure
fences a late write. These are locally verified prerelease commands; public
registry/hosted acceptance remains required.

## Browser extension connections

`extensions list` pages your native browser connections; `extensions get TOKEN_ID`
reads complete metadata without a secret. Request `read:extensions` explicitly
at login; the default scope set does not change. Revocation needs explicit
`write:extensions`.

Use `extensions review-revoke --file review.json` with the captured account,
token ID and source fingerprint. Privately retain the returned review proof,
same fields, one request UUID and `confirm_revoke: true` as the original. Run
`extensions revoke --file original.json --confirm TOKEN_ID` only after review.
`extensions check-revoke --file original.json` checks without writing; explicit
`extensions close-revoke --file original.json --confirm TOKEN_ID` resolves that
same original. Keep it after an uncertain reply; never replace its ID or proof
for a retry. These commands do not create or deliver an extension credential.

### Create an extension connection privately

These commands require existing full owner authority; a narrow extension-management
grant cannot issue an unscoped native connection. This is separate from signing in
to the Chrome extension.

1. Put `expected_account_id` and `device_name` in a private plan JSON file.
2. `extensions prepare-recipient --file PLAN --output RECIPIENT --confirm ACCOUNT_ID`
   creates and verifies an exclusive private recipient locally without network or
   an auth-store lookup. `extensions recipient --recipient-file RECIPIENT` exposes
   public request material only, suitable for a separate authorized MCP request.
3. `extensions review-create --recipient-file RECIPIENT --output ORIGINAL` reviews
   and privately retains the exact original before any issuance.
4. `extensions issue --file ORIGINAL --recipient-file RECIPIENT --confirm ACCOUNT_ID`
   creates at most one connection. Output contains metadata only.
5. Use `extensions check-create --file ORIGINAL` and
   `extensions check-delivery --file ORIGINAL` to inspect an interrupted request.
   Retry only the unchanged original; no command automatically retries a mutation.
6. `extensions receive --file ORIGINAL --recipient-file RECIPIENT --output TOKEN_FILE --confirm CONNECTION_ID`
   decrypts locally and verifies exclusive private-file retention. It never prints
   the token or replaces existing output, and does not acknowledge delivery.
7. `extensions acknowledge --file ORIGINAL --recipient-file RECIPIENT --secret-file TOKEN_FILE --confirm CONNECTION_ID`
   verifies the saved token before clearing remote ciphertext. A lost successful
   acknowledgment can be checked/repeated without another creation.

`extensions close-create --file ORIGINAL --confirm ACCOUNT_ID` fences a late
unrecorded issuance or identifies the already-created connection; it does not
revoke it. If a recipient is lost, inspect and explicitly revoke recorded access
before starting over. Keep original and recipient files until resolved. The existing
private-file adapter rejects unsafe permissions, links and unsupported Windows
storage; no supported-OS or registry release is claimed by local installation.

Read an accepted request's opaque local-data binding with
`jobhunt account erasure-cleanup-binding --recovery-file PRIVATE_JSON`. This uses
only the private origin-bound recovery file; ordinary login/API tokens do not
authorize it. It performs no cleanup, retry or account-record read. An older
receipt may be unable to establish this binding while status/retry still work.
## Saved version files

`jobhunt documents version-file DOCUMENT_ID --version-id VERSION_ID --output PRIVATE_FILE`
downloads the selected immutable content and provenance using `read:documents`.
The output file is private, hash-verified and never overwrites an existing path.
Terminal output contains file metadata, not saved document content. Use
`documents revisions DOCUMENT_ID` to select a checkpoint first.

## Native snapshot restore

`jobhunt documents restore-snapshot --file original.json --confirm DOCUMENT_ID`
restores the exact selected native version using the shared revision/original
fences. Output contains recorded IDs/revision, never resume bodies. Reuse the
original file for retries and version checks; replay does not imply the source
still exists or matches. The existing `documents restore` canonical response is
preserved. No command sends an application or changes a Hunt Profile link.
## Native package creation and recovery

`documents create-native --file INPUT_OR_ORIGINAL_JSON` creates a retained native
document original. Input has `expected_account_id`, a new immutable `document_id`,
stable `request_id` and `fields` containing `name`, `content` and optional native
attributes. A raw JSON:API original with `meta.document_creation` is sent without
reserializing its bytes. Keep this private file before sending it.

`documents check-creation --file INPUT_OR_ORIGINAL_JSON` is read-only.
`documents close-creation --file INPUT_OR_ORIGINAL_JSON --confirm DOCUMENT_ID`
fences unused retry or reports existing/expired evidence before clearing a local
copy. These commands also accept the compact original descriptor. An uncertain
or missing receipt never authorizes a replacement request. Exact retry preserves
later edits and never recreates a deleted document.

`documents create-native-host-file --file DESCRIPTOR_JSON` uses the same original
and an approved private host file. Complete content and initial snapshot metadata
each have a 16 MiB bound; the request has a further 64 KiB envelope. Raw facts stay
unconfirmed. Creation/closure require document read/write; checking requires read.
An explicit linked identity also needs profile read. This remains a prerelease
local-install workflow until public distribution and hosted acceptance are verified.

### Exact document deletion recovery

Keep the reviewed document ID, revision, account and request UUID unchanged for
`delete_document_v2` / `documents delete`. Save the original JSON before sending.
A missing document is not proof that this request ran.

The SDK `documentDeletions.check` and CLI `documents check-delete --file ORIGINAL`
use the existing read-only operation receipt, bound to the captured account and
exact payload hash. The recovery file contains `{ "expected_account_id": "jh_…",
"original": { "document_id": "…", "expected_revision": 4, "request_id": "…",
"expected_account_id": "jh_…" } }`. Use actual saved IDs.

Explicitly closing an unused retry fences a late deletion without restoring or
deleting a document: `documentDeletions.close(original, true)` or
`documents close-delete --file ORIGINAL --confirm DOCUMENT_ID`. Both document
grants are required. Expired results remain unknown; keep the file until reviewed.

Package recovery uses the same methods and commands. Set
`"operation_name": "delete_document_package_v2"` on the recovery envelope and
include the complete reviewed `expected_document_ids` in `original`. Read every
`documents_page` of `list_document_packages_v2`, including archived members;
internal contact cards are managed by the service and are excluded from that list.
Dispatch with `deleteLibraryPackage` / `library delete-package`, retaining the
root ID, revision, account, member IDs and request UUID. Changed membership rejects
the entire deletion. Saved application evidence and Hunt Profiles remain.

Check and closure originals accept up to 128 KiB for the existing 1,000-member
package limit. Omitting `operation_name` still means individual deletion. Preserve
omitted versus null fields and member order when retaining or retrying an original;
an individual receipt can never prove a package deletion.

### Exact library change recovery

Keep the account, source document ID/revision, request UUID, action and requested
name before sending `renameDocument`, `duplicateDocument`, `setDefaultDocument`
or `addLibraryDocument`.
The recovery envelope is `{ expected_account_id, operation_name, original }`;
`operation_name` is `rename_document_v2`, `duplicate_document_v2` or
`set_default_document_v2` or `add_package_document_v2`. `original` is the existing
command JSON, including `name` for rename/duplicate/addition and `archetype` for
addition. Names are already trimmed when captured; retain omitted/null
fields exactly. A missing source or a later row value is not proof of this request.

`libraryOriginals.check(original)` / `documents check-library --file ORIGINAL`
read the exact existing receipt. Recorded resource/revision may describe history;
ordinary command replies can describe a newer row. A duplicate or member-addition receipt points to the new document while retaining
the original source/package-root ID in the recovery envelope.

`libraryOriginals.close(original, true)` / `documents close-library --file ORIGINAL
--confirm SOURCE_DOCUMENT_ID` explicitly close retries using the same owner lock.
Both document grants are required. Closing does not revert a recorded rename,
copy or default choice. Expired outcomes stay unknown. Original files are bounded
to 16 KiB; never replace an unresolved request with a new UUID automatically.

Package-member addition uses the same library-original envelope, check and closure
commands. Set `operation_name` to `add_package_document_v2`; retain the reviewed
package-root ID/revision, account, request UUID, `name` and `archetype` (`structured`,
`letter`, `reference` or `statement`). Dispatch with the existing `addLibraryDocument`
method / `library add-document` command. The recorded resource is the new member;
closing retries confirms the original package-root ID. No content, publication or
submission is requested by this operation. Legacy valid UUID spelling is preserved
for package-addition hashes; do not replace it automatically on retry.

Package profile binding uses this same envelope with
`operation_name: "link_document_package_profile_v2"`. Retain the document ID/revision,
selected `profile_id`, `expected_profile_updated_at`, `acknowledge_linked_updates: true`,
account and request UUID before `linkProfile` / `profiles link`. Check and close with
these existing library commands; closing also requires `read:profile` in addition
to document read/write grants. Preserve resource UUID spelling and nullable/omitted
fields in the hash; only request UUID spelling is normalized. The current browser
retains the same original in its existing private account/source slot before
sending, including the selected profile's display name. An interrupted update
reopens in library recovery. Checking is read-only; explicit retry reuses the exact
request, and guarded clearing first closes its retry. A recorded receipt proves
historical execution; read the current package independently before showing the
profile as applied. Missing source/profile records do not prevent retry closure.

## Complete version-history browsing

`documents revisions DOCUMENT_ID --include-metadata [--before-id ID]` reads one
30-item page through the existing `list_document_revisions` operation. Follow
`next_before_id` while `has_more`; histories are not capped at100 checkpoints.
The SDK uses `documentRevisions({ document_id, include_metadata: true,
expected_account_id, before_id })`. Account binding is optional for compatibility.

Opt-in details include the bound account/document, total count, original name,
created time and trigger. They omit saved document bodies and preserve unknown
legacy revisions. IDs and metadata must align, and cursors must progress. Pages
are live reads: later additions can require reloading the newest page. No flag
retains the original summary-only response. Current Next uses the same pages,
keeps its list on failed reads and ignores late pages after account/source changes.

## Exact full-file profile photo checks

Before dispatching a full PNG/JPEG upload, call
`prepareProfilePhotoFile(intent, bytes)` to capture the scalar multipart original,
source SHA-256/size/type and the exact `get_job_hunt_operation` read. This preserves
omitted versus null account fields and the backend's request/profile UUID
normalization. `prepareProfilePhotoOriginal(original)` prepares a retained metadata
check without sending photo bytes. `profilePhotoFileReceipt(result, original)`
requires the successful profile result and exactly one original photo artifact ID.
The typed operation read exposes those non-secret IDs in `data.related_ids` only
for the existing `upload_profile_photo_file` namespace. Other operation namespaces
retain their previous output. No provider paths, bytes or credentials are exposed.

Use the existing SDK `getOperation(prepared.read)`, MCP `get_job_hunt_operation`,
or CLI `operations find --operation upload_profile_photo_file --request-id ID
--payload-hash HASH` to check the original. Current web checks send retained file
metadata only, including the expected account and exact profile version, and then
separately compare the current profile's photo. A receipt is historical evidence;
a later photo is not silently replaced. The original bytes are still needed for
an explicit multipart retry. Metadata for a private-host upload includes its host
reference and has a different hash; do not substitute the multipart helper for it.
No automatic retry, cold browser persistence or closure for identity/photo saves
is established by these helpers.

## Exact identity original checks

Retain `{ expected_account_id, original }` before saving identity. The outer
account is required; `original` is the complete `save_profile_identity` /
`save_hunt_profile_v2` input, including request UUID, original profile/version,
name, complete personal data, default choice and acknowledgment. Preserve omitted
versus null fields. `checkProfileIdentity(envelope)` uses the new shared
`check_profile_identity_original_v1` read-only operation. It sends a private POST
body, with profile-read access, and returns the existing original receipt. It
never saves/stages personal data or creates a profile, default, audit or receipt.
Read the current profile independently; an original receipt is historical evidence.

`checkProfileIdentitySource(bytes)` and CLI `profiles check-identity --file ORIGINAL`
preserve the exact original JSON bytes over that same private POST. Use this path
for JSON created outside JavaScript: parsing and re-encoding can change `1.0`,
large integers and other lexical number forms that the existing Python canonical
hash distinguishes. Do not rehash or normalize the original in the browser.
The backend validates its original `ProfileUpsert` model and existing receipt hash;
source checks use the same bounded JSON transport and never put personal data in
URLs. The SDK captures caller input/source bytes before awaits. No confirmation
flag is needed for a read; normal identity saves retain their existing write grant
and request semantics.

HTTP original checks remain available after journey writes are disabled. MCP
keeps its existing journey tool exposure flag; the tool's read-only annotation and
private POST transport are separate facts. Ordinary GET/POST routes keep their
existing methods. Full cold identity/photo storage and explicit retry closure are
still separate acceptance requirements.

### Close an interrupted profile request

- `jobhunt profiles close-identity --file ORIGINAL.json --confirm REQUEST_ID`
- `jobhunt profiles close-photo --file ORIGINAL.json --confirm REQUEST_ID`

Confirm the original request UUID, not the profile ID. Identity closure files use
`{ expected_account_id, original, confirm_close: true }`; their JSON bytes are
preserved, including legacy number spellings. Photo files use
`{ expected_account_id, original }`, retaining the full file descriptor and host
reference when originally used. Neither command uploads a photo or saves identity
details. Closure fences a late retry or reports its existing `recorded`/`expired`
evidence; it does not undo the original save. An expired receipt cannot prove
that no save happened. Normal profile read/write grants are required.

### Recover a submission-report retry

Keep the complete original input and request ID after an interrupted
`applications record-submission`. Check `operations find --operation record_submission
--request-id UUID --payload-hash SHA256` with the original canonical hash. The typed
SDK's `prepareSubmissionOriginal` builds that lookup and `submissionReceipt` verifies
the exact reported ID; it never substitutes the newest history entry.

`applications close-submission-original --file original.json` accepts
`{expected_account_id, original}` and explicitly closes that exact retry. An unused
request becomes fenced; recorded/expired results are historical evidence, not an
undo. Read/write application grants suffice for closure without reading referenced
files. Keep your private copy until exact closure is confirmed. Existing reports
and pipeline stages are unchanged; no employer application is sent.

### Targeted publication

```sh
jobhunt publications get SOURCE_UUID --kind document --account-id jh_ACCOUNT_UUID --json
jobhunt publications publish --file private-original.json --confirm SOURCE_UUID --json
jobhunt publications check-original --file private-original.json --json
jobhunt publications unpublish --file private-unpublish-original.json --confirm SOURCE_UUID --json
jobhunt publications close-original --file private-original.json --confirm SOURCE_UUID --json
```

`--kind application` reviews an application package instead. Retain the full
account-bound `{ expected_account_id, source_type, original }` file before writing.
The nested original contains `request_id`, `source_id`, `expected_account_id`, the
displayed `expected_revision` and `expected_fingerprint`, and explicit action.
Publish includes `privacy_tier`, an allowed `target` and literal
`confirm_publication: true`; password policy additionally includes its 8–256
Unicode-character password. Unpublish includes literal `confirm_unpublish: true`.
Keep this file private; it may contain a share password. Omitted fields and null
remain distinct parts of the original.

Check and retry the exact file after interruption. Old publish acceptance never
re-publishes a later-unpublished link. Closing a retry does not unpublish or cancel
a past effect; `expired` is not proof nothing happened. Review current visibility
separately before another change. Links freeze saved content; unsaved browser edits
are excluded. Application targets are resume, cover-only or combined (cover letter
first). Hunt Page visibility is separate. The client README describes full input
fields and document/application grant requirements. Local clean-install acceptance
does not establish public registry or hosted release availability.

### Resume import originals

Keep the complete private input and original request UUID after a lost reply. `checkResumeImportOriginal` / `resume-imports check-original --file JSON` check the exact text, host-file, direct-upload or reviewed-confirmation original. The JSON envelope contains `expected_account_id` and `command: {operation_name, original}`; omission and explicit null stay distinct. Checks use a private POST and never fetch a host file or invoke a model.

For website/multipart imports, keep the full PDF/DOCX bytes. `checkResumeImportFileOriginal` / `resume-imports check-file --file PDF_OR_DOCX --request-id UUID --account-id ACCOUNT_ID` reconstruct the same bounded local parser input and raw checksum. A parser-version mismatch fails closed; keep the file and investigate instead of making a new request.

The corresponding `closeResumeImportOriginal`, `closeResumeImportFileOriginal`, `close-original` and `close-file` fence an unused retry or report recorded/expired evidence. CLI closure requires `--confirm REQUEST_ID`. Closure never cancels accepted extraction or removes an existing resume/package. Historical confirmation does not prove the current resume remains available. Current Next intake/review now retains complete private originals and recovers them on cold entry; that browser behavior is locally verified. Hosted attachment/provider behavior and public distribution remain separate release acceptance work.

For historical multipart imports that omitted account binding, pass `original_account_unbound: true` to the file-original SDK helper or `--original-unbound` to the CLI check/close command. The current captured `expected_account_id` / `--account-id` is still mandatory. This explicitly preserves the historical null binding; recovery never tries a fallback hash automatically.

Application deletion recovery preserves the exact original `delete_application_v2`
intent. Save a private wrapper containing `expected_account_id` and `original`
(the complete accepted deletion input, including the same `application_id`,
`expected_revision`, `request_id` and account omission/null semantics).
`applications check-delete --file ORIGINAL --json` checks its canonical payload
hash through the existing operation receipt. It is read-only and works after the
application is gone; a missing application does not establish deletion.
`applications close-delete --file ORIGINAL --confirm APPLICATION_ID --json`
explicitly closes unused retries or reports `recorded`/`expired` history. Closing
never deletes or restores an application. Keep the original until closure is
verified; an expired receipt cannot prove this original ran. Check needs application
read permission; closure requires application read and write permission. Retry an
uncertain deletion using the same inner original with `applications remove`.

## Draft / Ready to distribute

Packages and documents have independent, user-controlled editorial labels.
Existing, imported and copied items start Draft. Content edits and checkpoint
restores keep your choice. Ready never publishes, sends, verifies facts, prepares
PDFs or marks an application submitted.

```sh
jobhunt documents editorial DOCUMENT_UUID --json
jobhunt documents editorial-list --kind package --status ready --json
jobhunt documents editorial-history DOCUMENT_UUID --json
jobhunt documents set-editorial --file status-intent.json --json
jobhunt documents check-editorial --file original.json --json
jobhunt documents close-editorial --file original.json --confirm DOCUMENT_UUID --json
```

A write uses `{ "document_id": "DOCUMENT_UUID", "kind": "document",
"status": "ready", "expected_revision": 4, "request_id": "REQUEST_UUID",
"expected_account_id": "jh_ACCOUNT_UUID" }`. Use `kind: "package"` on a package
anchor. Retain this exact JSON before dispatch; reuse it for retry. The original
wrapper for checking/closing is `{ "expected_account_id": "jh_ACCOUNT_UUID",
"original": WRITE }`. Checking is read-only. Explicit closure prevents later
retry before the private original is discarded; it does not change the status.
Follow `next_after_id` for lists and `next_before_id` for history. Reads need
`read:documents`; writes and closure need both document scopes. The SDK uses
`getDocumentEditorialStatus`, `listDocumentEditorialStatuses`,
`setDocumentEditorialStatus`, `checkDocumentEditorialStatus`,
`closeDocumentEditorialOriginal(original, true)` and `documentEditorialHistory`.


### Separate first and last names

`account get-name-parts` reads the account's first name, last name, complete name,
and email. `account set-name-parts --file ORIGINAL_JSON --confirm ACCOUNT_ID`
changes only the private account identity; Hunt Profiles and resumes stay separate.
Retain the exact read values (`expected_name`, `expected_first_name`,
`expected_last_name`), `expected_account_id`, one `request_id`, and requested
`first_name`, `last_name`, and matching `name` in the private original file.
Multiword first and last names are preserved. After an uncertain response use
`account check-name-parts --file ORIGINAL_JSON`; retry only the unchanged original.
`account close-name-parts --file ORIGINAL_JSON --confirm ACCOUNT_ID` resolves or
fences that request before another edit. Existing single-name commands and saved
originals remain supported. Typed clients use `client.accountNameParts`.

### Durable posting imports and exact recovery

The source candidate exposes the current browser's durable import service through
`client.postingImports` and these public HTTP/MCP operations:
`list_posting_imports_v1`, `get_posting_import_v1`, `start_posting_import_v1`,
`save_posting_import_draft_v1`, `open_posting_import_v1`,
`cancel_posting_import_v1`, `stop_posting_import_v1`, `reconcile_posting_import_request_v1`,
`cancel_posting_import_request_v1`, `get_posting_import_file_v1` and
`get_posting_import_file_chunk_v1`. Reads need `read:applications`; mutations also
need `write:applications`. They preserve the native original request key and draft
revision contract; there is no fabricated generic mutation receipt.

```sh
jobhunt imports list --limit 20 --json
jobhunt imports get ATTEMPT_UUID --json
jobhunt imports start --file retained-posting-original.json --json
jobhunt imports identity --file retained-private-posting-original.json --json
jobhunt imports draft --file reviewed-draft.json --json
jobhunt imports open --file reviewed-preview-destination.json --json
jobhunt imports reconcile --file private-original-identity.json --json
jobhunt imports cancel ATTEMPT_UUID --confirm ATTEMPT_UUID --json
jobhunt imports stop ATTEMPT_UUID --confirm ATTEMPT_UUID --json
jobhunt imports cancel-request --file original-identity.json --confirm ORIGINAL_REQUEST_KEY --json
jobhunt imports file --file account-bound-attempt.json --json
jobhunt imports export --file account-bound-attempt.json --output new-private-import.json --confirm ACCOUNT_ID --json
```

For start, retain `request_key` (1–96 ASCII letters/digits/dot/underscore/hyphen),
`input_kind` (`url`, `pasted_text` or `browser_selection`) and the exact `url`/`text`.
Private posting text is 50–100,000 Unicode codepoints; browser selections require
their source URL. Existing originals reconcile before new-admission flags/quotas.
`queued` confirms acceptance, not extraction. Normal capture does not create an
application. Explicit `open_application: true` requires `job_search` and `status`;
`update_application` instead binds an existing `application_id` and
`expected_version`. No import submits anything or proves a submission.

The list returns `recovery_scope`, an opaque account partition, never a credential.
Private interrupted requests can be checked/cancelled with the same `request_key`,
`input_kind`, `input_fingerprint` and `recovery_scope` without retransmitting text.
`postingImportPrivateIdentity(original)` (or `imports identity`) computes the exact
Python-compatible canonical fingerprint locally; it never prints the posting.
An `acceptance: "unknown"` response means check again or fence that exact original;
it is not proof that a fresh request is safe. `open` requires this recovery scope
and the exact original attempt and owned Hunt/stage destination.

Draft files contain `attempt_id`, `expected_revision` and a nonempty `draft` with
native review fields. Replaying the same last write returns its saved revision;
different stale edits conflict. Raw capture evidence and operational receipts are
never draft-edit authority. Cancelled attempts clear private intake text and fence
late workers; consumed creation receipts remain intact and no application is deleted.

Use `stop` for active URL capture or enrichment attached to a saved application.
It keeps the application's stage, source and existing fields and fences late
worker results. After a lost acknowledgement, `get` the same attempt; a repeated
stop of that exact attempt is safe. Finished captures are not undone. `cancel`
retains its existing refusal for consumed creation receipts.

File input is `{ "expected_account_id": "jh_UUID", "attempt_id": "UUID" }`.
`client.postingImports.files.manifest/chunk/download` returns complete private JSON,
including captured extra fields and the saved public review draft. Every chunk is
bound to that original account/attempt/hash/size, with individual and whole-file
checksums. Changes conflict; the SDK never silently restarts from a new manifest.
Files use a fixed safe name, a 16 MiB defensive ceiling and 24,000-byte chunks,
covering the native worker's 800,000-byte capture bound plus complete drafts.
CLI export writes a new private file with mode0600 and does not overwrite; its
stdout contains metadata, not posting content. List results contain no bodies or
drafts. Full capture reads treat source text as untrusted data.

Local source, clean-install and actual HTTP/MCP/current Next acceptance are distinct
from public registry installation, production/provider and full migration acceptance.
These operations do not replace full rich application-creation reconciliation.


Use `applications create --file PRIVATE_JSON` for rich native creation; omit shorthand flags when using a file (`--file -` reads stdin). The file is the existing JSON:API envelope: `data.type` is `application`, `data.attributes` holds the rich fields, and optional `data.meta` holds the owned import attempt/confirmation/review revision. File reads are bounded, reject symlinks/non-files and never log source paths or contents on errors. The SDK validates the envelope before sending one request.

The existing native import claim replays its saved application; changing the file on replay never applies new edits to that application. The legacy command without an import has no general retry receipt. Read saved applications after an interrupted reply before retrying, or use retained originals below; the CLI never retries a write automatically. Existing native input/response bounds and optional-contact commit policy apply. This does not submit to an employer or change master documents.


### Retained native application originals

- `applications create-native --file INPUT_OR_ORIGINAL_JSON` sends one rich native
  creation with a compact acknowledgement. `--file -` reads stdin. Input is either
  `{ expected_account_id, request_id, application_id, fields, metadata? }` or the
  complete JSON:API original envelope described in the client README. Use fresh
  request/application UUIDs once; privately retain this file before dispatch.
- `applications check-creation --file ORIGINAL_OR_DESCRIPTOR_JSON` checks exact
  original ID/revision/hash evidence after a lost reply. It does not read current
  application content or infer permission to start again from `not_found`.
- `applications close-creation --file ORIGINAL_OR_DESCRIPTOR_JSON --confirm APPLICATION_UUID`
  explicitly fences unused retries before local cleanup, or reports recorded/expired
  history. It never deletes or recreates applications. Keep unresolved source files.
- `applications create-native-host-file --file DESCRIPTOR_JSON` reads the original
  descriptor plus the existing `{ download_url, file_id, mime_type?, file_name? }`
  host file. New downloads require the configured approved HTTPS host; recorded
  originals replay without fetching the host again.

The complete original is bounded at 16 MiB, including JSON metadata. Raw originals
are sent byte-for-byte, including whitespace and large JSON integers. Descriptor
files contain `expected_account_id`, `request_id`, `application_id`, `source_size`,
`source_sha256` and exact sorted `fields_supplied`. Private source never enters
queries, compact receipts or error logs. Exact replay never edits newer work,
recreates removed applications or repeats optional contact extraction. Existing
native preparatory/optional-contact commit policies remain; the primary graph,
import claim and compact receipt commit atomically. A different original conflicts.

Read/write application grants, original-account checks and revocation remain
required. Original retries expire after 24 hours and expired history cannot create
again. Neither source input nor any response triggers an automatic write retry.
The ordinary 2 MiB SDK response bound stays intact. Clean local installed-client
and Next read-gateway tests do not establish public registry, browser retention or
production/provider acceptance.

### Package display order

```sh
jobhunt library order PACKAGE_UUID --json
jobhunt library reorder --file reviewed-package-order.json --json
```

The write file contains `package_id`, the complete ordered `document_ids`, the
read's `expected_fingerprint`, and a new `request_id`. Saving needs both document
read and write permissions. After an uncertain reply, retry the exact file. A
changed fingerprint or membership requires a fresh read and review. This changes
the Docs display order; document content and exports keep their existing behavior.
