## Hunt Page text exports

`getHuntPageExportSource` and `prepareHuntPageExport` accept `format: "md"` or
`"txt"` as well as `"pdf"` and `"docx"`. Use the current page revision and preview
fingerprint, then the returned document revision and complete render fingerprint.
Preparation preserves the reviewed bytes and date; it does not publish the page.
The existing export status, download and explicit cancellation methods apply.

`PageExportFormat` describes these four formats. Standalone `ExportFormat` remains
PDF/DOCX. Text comes from the browser's selected-content compiler, preserving
visible sections and custom headings rather than exposing internal JSON. Both
profile-read and document-read authority are required at every stage. The SDK
checks media type, bounded size, UTF-8 and checksum before returning bytes; it
never forwards product credentials to the storage grant. Expiry and asynchronous
private-object cleanup are unchanged. Local packed installation and public
registry availability are separate acceptance boundaries.

The selection directory also returns optional `hunts[].revision` metadata for
current drawer delete review. Older responses without it remain readable; an
empty-Hunt website deletion requires an actual opened revision and never infers
one from a name or a new lookup. Existing `deleteHunt` inputs and receipts remain
unchanged, with required campaign/application grants checked before and after the
shared mutation.

## Saved pipeline view

`getHuntSelection()` reads the current website Campaigns selection, original
fingerprint, account ID and eligible Hunt ID/slug pairs. `saveHuntSelection(input)`
uses the exact reviewed account, fingerprint, ordered selected identities and
request ID. Save changes only the pipeline view and active selection; it never
changes Hunt lifecycle, the default Hunt or applications. Reuse unchanged input
after an interrupted reply. A historical receipt returns fresh current state,
which may differ from the originally saved selection. The exported
`HuntSelectionSave` and `HuntSelectionData` describe both methods.

## Exact PDF preparation recovery

`preparePreparationOriginal` captures the full typed preparation input and its
canonical hash. `checkPreparationOriginal` reads its exact receipt; pending,
running and failed acceptance remain distinct from ready PDFs.
`closePreparationOriginal` explicitly closes local retry: unused requests are
fenced; recorded work keeps the same job. It never cancels workers or alters PDFs.
Keep the private original until matching closure succeeds. The envelope includes
`expected_account_id` and `original` with request, application/revision, workflow
revision, fingerprint and selected document IDs/revisions. Preserve omitted/null
legacy account fields exactly. Read and write application/document grants apply.

## Exact package profile receipts

`prepareProfileLink(input)` captures the validated account, package, displayed
revision, selected profile/version and request before awaiting. It returns
`captured` for the existing `client.linkProfile` command and `read` for the existing
`client.getOperation` check. Retain the captured input; normalize only the request
UUID as the backend does. Omitted and explicit-null account fields stay distinct.
Resource UUID spelling remains part of the payload hash.

`profileLinkReceipt(reply, captured)` requires a successful document receipt newer
than the reviewed revision. A check is read-only and does not claim that today's
package still uses that profile; read the current package separately when needed.
A missing, pending or mismatched original is never confirmation from latest state.
The CLI equivalent remains `operations find --request-id UUID --operation
link_document_package_profile_v2 --payload-hash SHA256`. No new endpoint or CLI
command is required. Existing read/write/profile scopes and publication choices
remain authoritative. These helpers do not provide browser persistence or closure
for profile originals; that acceptance remains open.

## Native document creation originals

`prepareDocumentCreation({ expected_account_id, document_id, request_id, fields })`
captures complete native `name`/`content` and optional document attributes before
awaiting. Retain the input and returned original before dispatch. `fields` may
include an explicitly selected `contact_profile_id`; it never selects a default.
Raw career content stays unconfirmed. The common package command stages Linen,
first-document primary, owned unlinked applications, optional private contact card
and an immutable initial version in the original receipt transaction.

`client.documentCreations.create(input)` sends that captured JSON original once.
For an already serialized JSON:API carrier with `meta.document_creation`, use
`prepareDocumentCreationSource(bytes)` and `createSource(bytes)` to preserve exact
UTF-8 bytes, whitespace and large JSON numbers. The source is never reserialized.
Content allows 16 MiB and the request a further 64 KiB envelope; initial snapshot
metadata has its own 16 MiB bound. Oversize work fails atomically.

`check(original)` returns recorded IDs/revision even after later edits or source
removal. It never repeats creation or claims that today's document still exists.
`close(original, true)` fences unused retry or reports recorded/expired evidence
before local cleanup. A lost reply is not permission to clear recovery or choose
a new request. `host({ ...original, file })` carries the same exact source from an
approved private host; exact replay skips downloading. Checking needs document
read; creation/closure need read/write, plus profile read for an explicit link.

## Exact checkpoint and restore outcomes

`prepareDocumentVersionOriginal({ expected_account_id, operation_name, original })`
captures canonical fields before awaiting. Use `create_document_checkpoint_v2`
with its unchanged checkpoint input, or `restore_document_revision` with its exact
restore input. Omitted and explicit-null legacy account fields remain distinct;
checkpoint name normalization matches the server. Retain the captured original.

`client.versionOriginals.check(original)` reads the matching receipt hash and
returns the original revision, checkpoint/selected-version ID and pre-restore
recovery ID. Checkpoint status URLs contain IDs and the original hash, never the private name.
It does not claim that current source still equals that version.
It works after later edits or source removal. `close(original, true)` fences an
unused retry or reports recorded/expired evidence in the existing namespace.
Checking needs document-read; closure also needs document-write. A missing closure
reply is not confirmation. No version is removed and no restore is rolled back.

## Current section-editor originals

`prepareSectionSave(input)` captures the complete native section JSON before
awaiting, including account/document identity and displayed revision. It returns
the exact `text`, decoded `body`, compact `original` and `payloadHash`.
`sectionSaveOriginalHash(original)` hashes the sorted compact descriptor, matching
the shared Python receipt service. Private section text never belongs in a lookup
URL, audit or receipt body. `client.sectionSaves.check(original)` checks the exact
receipt namespace, document and saved revision using `get_job_hunt_operation`.
`client.sectionSaves.close(original, true)` fences an unused original or reports
recorded/expired evidence. Closure never changes a document; retain local bytes
if the reply is lost. It requires both document read/write grants, while checking
needs read access. Source removal does not prevent receipt checks or closure.

These helpers and check/close adapters grant no new public write authority. The current native confirmed-fact endpoint remains session-only; agents
retain `update_resume_section_v2` with explicit source/confidence fields. Do not
infer human authorship from a browser session or automatically re-key an uncertain
save. Modern session originals support a 16MiB native JSON value plus a 64KiB
request envelope. The complete merged document and saved snapshot metadata each
remain bounded at 16MiB; an oversized merge fails atomically rather than truncating.
Exact-byte checks and closures use the same compact descriptor at every size.
The current editor retains its base, newer draft and complete pending original
before dispatch. Native-browser storage and full migration acceptance remain open.

## Complete resume/profile saves

`client.resumeSaves.save(input)` uses the existing native full-document save.
Input contains `request_id`, `expected_account_id`, immutable `document_id`,
`slug`, and `fields` with the displayed `expected_revision` and explicit changes
to `name`, `description`, `layout`, `content`, or `is_default`.

- `prepareResumeSave(input)` snapshots canonical native JSON bytes and returns
  the body, compact original descriptor and payload hash. Retain the unchanged
  input privately before dispatch. This supports native content capacity rather
  than compact fact-edit limits. Both document-read and document-write grants
  are required; the backend owns linked identity and layout validation.
- `save` returns `{ original, operation }`; `check(original)` reads the exact
  receipt without writing or needing the source document to still exist. An old
  successful revision is distinct from the latest document state. Explicitly
  repeat only the identical original after uncertainty; no automatic write retry.
- `host({ ...original, file })` carries those same exact native JSON bytes from
  an approved HTTPS host through HTTP/MCP. Check byte count/hash and field list;
  the carrier is not the logical SDK input file. Recorded replay needs no new
  download and cannot overwrite a later edit.
- `close(original, true)` atomically fences an unused retry or reports `recorded`
  or `expired` evidence. It never rolls back a document. A lost closure response
  is uncertain; keep the local original and explicitly check/close again. Expired
  evidence does not prove that a save never happened.
- Receipt/audit metadata contains no document content. Existing live Hunt Pages
  can reflect source updates; saving does not change publication settings or send
  an application. Current browser drafts use the existing origin-private byte store before save;
  reopening restores the exact original. Cleanup requires matching source-confirmed
  save evidence or fresh server closure. Native version snapshots, creation parity,
  rendered/IndexedDB lifecycle and hosted/OS/public distribution acceptance remain open.

## Durable webhook tests and delivery facts

`client.webhooks.jobs` uses the same authorized Python services and durable worker.
List/get requires `read:webhooks`; reviewed test/reconciliation and original
recovery also require `write:webhooks`. Existing login defaults are unchanged.

- `reviewTest` binds account/request/subscription and current metadata SHA-256.
  Save the returned proof in an original with literal `confirm_send: true`.
  `sendTest` queues exactly one synthetic `webhook.test`; it never reports receiver
  success merely because admission succeeded. No arbitrary payload or signing key.
- `checkTest` checks the exact original; `closeTest` fences an unused original.
  Closing accepted work preserves it and does not cancel its delivery. Keep the
  same original after a lost reply; do not generate a replacement request ID.
- `list`/`get` show owned durable jobs, including failures without an attempt row.
  `job_state` and `receiver_state` are separate facts. Private event/response bodies,
  destinations, signing keys and worker identity strings are excluded.
- `reviewReconciliation`/`reconcile` explicitly settle bookkeeping only when an
  exact matching committed HTTP2xx receipt exists and no live worker owns the job.
  Reconciliation never sends, changes a receiver receipt or guesses acceptance.
  `checkReconciliation`/`closeReconciliation` preserve exact original recovery.
- Explicit synthetic tests can target a paused endpoint, matching native test
  behavior, without changing pause/health counters. Ordinary events stay paused.
  Workers recheck original grants/session revision and destination before effects.
  Receiver retries retain one deterministic key; delivery remains at-least-once.
- Current Next test/status/reconciliation controls, rendered/hosted acceptance,
  unconfirmed-outcome recovery and actual legacy-queue cutover remain required.

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
  Current Next full-file controls, rendered recovery and test/status/worker closeout,
  public distribution and supported-OS acceptance remain required. The signing
  delivery receipt is kept in the repository at the Git tag `archive/process-docs`
  (`docs/project-simplification/2026-10-23-webhook-signing-delivery.md`).

## Account data export

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
private (POSIX mode0600) and bound to its exact product origin.

- `ErasureRecoveryClient(file).status()` / `.retry(requestId, true)` use separate
  restricted HTTP authority; ordinary account credentials and browser cookies are
  not used. CLI: `account erasure-status --recovery-file PRIVATE_JSON` and
  `account retry-erasure --recovery-file PRIVATE_JSON --confirm REQUEST_ID`.
- For MCP use a separate `/mcp/account-erasure` connection with the receipt in
  private Bearer configuration, never chat/tool arguments. Only status and retry
  tools exist on that connection; it cannot read account records or start deletion.
- Replaced/expired receipts fail. Retry never displaces a live worker or revives
  access. No automatic retry, ordinary vault lookup or private credential output.
  Native fresh identity proof remains in the browser. Windows ACL, public registry,
  actual rendered and hosted acceptance remain unverified.

## Application-only downloads

`client.applicationExport.manifest`, `.chunk` and `.download` accept
`{ expected_account_id, format: 'json' | 'csv', exported_at? }`.
These are all-Hunt native application exports, distinct from `accountExport`.
JSON includes saved resume overrides/template fallbacks and requires
`read:applications` plus `read:documents`; seven-column CSV needs
`read:applications`. Existing login defaults are unchanged. Downloads verify
bounded chunks, the complete SHA256 and a final ready manifest. Source changes
fail instead of producing a mixed file. No account records are changed.


`client.accountExport.manifest({expected_account_id, format})` inspects the same
eleven-group structured account export as Settings. `format` is `json` or `zip`;
optional `exported_at` pins the timestamp, not the database state. Explicit
`read:account-export` permission is required; ordinary login grants are unchanged.

`chunk` requires that timestamp, complete `expected_sha256`,
`expected_size_bytes`, and one-based `chunk_index`. Responses contain at most
64000 bytes before base64 encoding. `download` verifies every chunk's account,
format, counts, identity, length and hash, then the whole file and final source.
It returns bytes for local private retention; no automatic retry or publication
occurs. Never log those bytes. Source changes fail rather than mix records.

The retained export excludes uploaded/generated file contents and some newer
document models; it is not a full backup. No server-side snapshot or job is saved.
Actual hosted/OS/public distribution and full migration acceptance remain open.

## Recipient-encrypted key issuance

`client.apiKeys.issuance` supplies `review`, `issue`, `get`, `acknowledge` and
`close`. Retain one complete original (account/request/attributes/recipient public
key/proof/consent); no method automatically retries a write. Native delegated
scope and quota rules remain. The legacy tier is metadata, never payment authority.

`createApiKeyRecipient()` generates an RSA-3072 recipient whose private CryptoKey
is nonextractable. Retain it locally before any issuance request. Public creation
uses only its base64url SPKI key. `decryptApiKeyDelivery` verifies JWE algorithms,
recipient/account/request/key binding and authenticated ciphertext locally. Its
plaintext return belongs only in a trusted local UI/vault/file; never put it in a
model-visible tool response, log, URL or ordinary JSON output.

After successful local retention, explicitly acknowledge the recipient fingerprint.
Acknowledgment, expiry or revocation clears server ciphertext. Original replay
returns the same encrypted delivery or acknowledged/expired/unavailable state;
it never creates another key. Lost recipient keys cannot recover plaintext: inspect
and explicitly revoke the recorded key before starting over. Closure fences an
unrecorded original or acknowledges an existing key without revoking it.

The domain CLI now prepares/retains recipients, saves reviewed originals and
receives/verifies/acknowledges private files. Current Next creation controls also
retain nonextractable browser recipients and exact originals through reload;
complete protected-store/OS acceptance remains required migration work. Local service/client acceptance is not hosted/release
acceptance. Existing native issuance remains secret-once and non-idempotent.

## Complete native attribute files

`apiKeyAttributeFile(bytes)` binds a UTF-8 JSON attributes object by exact byte
count/SHA-256, up to 16 MiB. Native field validation remains on the server. Use
`issuance.reviewFile(intent, bytes)` and `issueFile(original, bytes)` for multipart
HTTP. `reviewHostFile`/`issueHostFile` use approved private host references instead;
never upload a raw key or private recipient. `closeFile` accepts the exact file
original without its contents or host URL. Keep the source and original privately.

File and compact creation share one receipt/delivery namespace. Existing
`get`, `acknowledge` and local decryption work with either; no write auto-retries.
A source mismatch fails before sending. Exact accepted replay never downloads
the host file. Complete permission reads use the bounded metadata interface below.
Current browser attribute-file creation, protected stores/OS and actual hosted/client
envelopes remain required work.

## Complete key metadata and permissions

`client.apiKeys.metadata.list({ after })` and `get({ key_id })` return bounded
management summaries, native quota facts, exact `scope_count` and a complete
permission-file manifest. Follow `next_after`; large keys remain manageable.
The manifest binds account/key/fingerprint, UTF-8 size and SHA-256.

`downloadScopes({ key_id })` verifies the complete private JSON attachment.
`downloadReviewedScopes(summary)` preserves a captured source; a changed key
fails rather than downloading different permissions. Explicit `'chunks'` mode
verifies each 24,000-byte chunk and the final envelope/hash/size. All strings,
duplicates and order are preserved. Usage counters stay in the summary so a key
can read its own permissions without invalidating the file. Ordinary JSON
response limits remain unchanged; only this private file uses the native envelope.

`metadata.reviewRevocation(input)` returns the same actor-bound proof and a
bounded summary. Existing `apiKeys.revoke`, `checkRevocation` and
`closeRevocation` accept that unchanged original. The current Account controls
use this interface, with lazy small permission previews and verified complete
private downloads. No large scopes are silently omitted or represented as empty.

## Customer API keys

`client.apiKeys.list({ after })` pages customer key metadata, with native quota
usage and expiry/revocation facts. `get({ key_id })` includes the management
fingerprint. These methods require `read:developer`; they return no credential
secret or hash. Operator keys remain in their separately guarded registry.

`reviewRevocation({ key_id, expected_account_id, expected_fingerprint })` is
read-only and requires `write:developer`. Preserve its proof with one original
request ID and `confirm_revoke: true` for `revoke`. `checkRevocation` looks up that
original by account/request without another write. Proofs expire after 15 minutes
and bind the current key and real connection. Original accepted retries preserve
later key state. Self-revocation needs another authorized connection for recovery.
No mutation automatically retries. Unexpected secret-bearing response fields fail
validation. Current Next account controls use these shared services. Current browser attribute-file creation and full release/body-size acceptance
remain migration work.

`closeRevocation({ original, confirm_close: true })` closes that exact original
under the owner transaction. `closed` permanently fences a request which had not
been recorded. `recorded` acknowledges its original receipt; `recorded_expired`
keeps its replay fence after receipt retention. Closing never changes a key.

## Interrupted Quick Add originals

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


Full photo files use `uploadProfilePhotoFile(intent, bytes)` for owned JPEG/PNG up
to 5 MiB. The multipart adapter keeps the original account/profile/version/request;
its receipt kind is `upload_profile_photo_file`. `uploadProfilePhotoHostFile(input)`
uses the same service with an approved private host reference and explicit source
size/SHA-256/media type. The server's existing host allowlist must be configured;
redirects and bytes are checked there. Keep original input unchanged after a lost
response. A confirmed replay does not upload/download again. Existing compact PNG
methods and their limits remain supported.
Complete native Highlights use `listHighlightRecordFiles`, `getHighlightRecordFile`
and `downloadHighlightRecordFile`. The latter verifies account/record identity,
source fingerprint, every 24,000-byte chunk, byte counts, SHA-256 and a final source
read before returning the complete private JSON bytes. These methods retain long
native text and tags that exceed the original compact models.

`saveHighlightFieldsFile(intent, bytes)` accepts a UTF-8 JSON fields object up to
16 MiB through multipart HTTP. `saveHighlightFieldsHostFile(input)` accepts its
verified size/SHA-256 and approved private host reference for ordinary HTTP/MCP
parity. Both share the browser's original `save_workspace_highlight_v2` receipt,
including omission/null semantics, source/account checks and first-capture task
permission. Keep the original intent and fields unchanged for retry; reads of
the original receipt need no source download. Host retries re-read the source;
an unavailable host can still be checked through the original operation receipt.
Neither method automatically retries writes or publishes the record.

Complete application records use `listApplicationRecordFiles`,
`getApplicationRecordFile` and `downloadApplicationRecordFile` with an explicit
application, kind and record. Downloads verify account/parent/record identity,
source fingerprint, every chunk and full SHA-256, then recheck the saved source.
`saveApplicationRecordFieldsFile(intent, bytes)` and
`saveApplicationRecordFieldsHostFile(input)` preserve full UTF-8 JSON fields up
to 16 MiB, using `save_application_record_file_v1` original receipts. Account,
parent revision, exact record fingerprint and original request remain fixed for
retry. Host input uses the existing approved-host allowlist. Reads of an original
receipt need no file download. These public writes do not implicitly queue Calendar
changes; use the explicit Calendar workflow. Existing compact v2 methods remain.

## Account display name

`client.accountName.get()`, `.save(original)`, `.check(original)` and
`.close(original)` share native owned account-name services. Keep the complete
`AccountNameWrite` (`expected_account_id`, `expected_name`, raw `name`, UUID
`request_id`) after an uncertain response. Check derives the canonical hash
locally, keeping names out of the URL; no method automatically retries a write.
Native whitespace/Unicode validation remains authoritative. Receipt recovery
returns current account data, which can include a newer edit. Closure fences an
unrecorded original; never silently swap its account or requested name.

## Browser extension connections

`client.extensions.list({after})` pages complete native connection metadata;
`.get(tokenId)` reads one connection. These never return a credential. Extension
connections are separate from API keys and use explicit `read:extensions` and
`write:extensions` grants; login defaults do not expand.

`.review({token_id, expected_account_id, expected_fingerprint})` binds revocation
to the current actor/source. Retain that review plus one request UUID and
`confirm_revoke: true` as an `ExtensionRevoke` original before `.revoke(original)`.
`.check(original)` sends only its hash, account and request ID; `.close(original)`
fences an unrecorded late write or resolves its existing receipt. No method
automatically retries writes. Metadata/revocation support does not establish
secure extension setup, delivery or hosted acceptance.

### Encrypted extension issuance

`client.extensions.issuance` provides `review`, `issue`, `get`, `check`,
`acknowledge` and `close`. Native extension credentials are broad, unscoped access:
creation and delivery require an owned session or an existing wildcard credential.
The narrower `write:extensions` management grant cannot mint them.

Generate a local nonextractable recipient with `createExtensionRecipient()`.
Retain its private key and exact account/request/label/public-key original before
issuance. Review binds that original and current actor for15 minutes. Issue with
`confirm_create:true`; the response contains only recipient-encrypted JWE.
`decryptExtensionDelivery` verifies the distinct extension envelope type plus
account/request/connection/recipient bindings. Keep the plaintext local; never
return it to model-visible output. Verify private retention before acknowledgment.

Exact replay recovers the same connection, never a replacement. Check the original
before retrying; explicitly close an uncertain unrecorded request before starting
over. Acknowledgment, revocation and24-hour retention remove delivery ciphertext.
Native credential expiry and revocation remain independent. Public distribution,
protected-store/supported-OS and hosted acceptance remain pending.
## Complete webhook fields

`client.webhooks.fields` supplies full-file creation/update review, explicit apply,
exact-original checks and closure. `webhookFieldFile(bytes, creating)` computes the
SHA-256 and byte count for a private UTF-8 JSON object up to 16 MiB. Creation fields:
`url/events`; patch fields: `url/events/is_active`. Native Python services own field
rules and permission decisions; compact interfaces remain available unchanged.

Use `reviewCreation`/`issue` or `reviewUpdate`/`update` with the same descriptor and
unchanged bytes. Keep the returned reviewed original before applying it. Use
`checkCreation`/`closeCreation` or `checkUpdate`/`closeUpdate` after interruption;
do not choose a new request ID for an uncertain result. `reviewHostCreation`,
`issueHost`, `reviewHostUpdate`, and `updateHost` use the same services with an
explicitly approved HTTPS private-file host. Host URLs never identify receipts.

Signing delivery, local decryption and acknowledgment use the existing
`webhooks.issuance` lifecycle. Neither the file nor an agent-visible response
contains the plaintext signing key or a private recipient. Reads and mutations
are not automatically retried.

## Accepted-deletion local-data binding

Use the separate private recovery file with `ErasureRecoveryClient.cleanupBinding()`
to read an opaque binding for that accepted deletion. `erasureCleanupMatches`
compares a known local account key without returning an account ID. The result
also identifies the existing private import journal partition. This read never
deletes local data, retries server work, acknowledges delivery or grants account
access. Old random receipts may return `cleanup_binding_unavailable`; preserve
uncertainty and do not guess from the current login. Existing status/retry
responses remain unchanged. Browser store retirement is a separate required step.
## Immutable saved versions

`client.versionFiles.manifest({ document_id, version_id })` reads the saved record’s
hash and size. `versionFiles.download(...)` downloads and verifies the complete
private JSON in one HTTP read; `versionFiles.downloadChunks(...)` uses the same
manifest and bounded chunk contract exposed to MCP. Files preserve saved content,
historical metadata and legacy nulls. They never overlay the current profile or
document, infer an actor, restore a revision or recreate a deleted source.

## Native snapshot restore

`restoreDocumentSnapshot(original)` restores complete native content and returns
only the recorded document ID/revision. It uses the same validated original and
`restore_document_revision` receipt/check/closure namespace as the canonical
restore. Replay reports recorded history even after source changes/removal; read
the source separately. Current linked Hunt Profiles are not changed. The existing
`restoreDocument` canonical response remains available.

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

### Closing exact profile retries

`client.profileOriginals.closeIdentity(original, true)` and
`closePhoto({ expected_account_id, original }, true)` explicitly fence a delayed
identity save or full-file photo upload through the existing owner/receipt lock.
They return `closed`, `recorded`, or `expired`; they never undo a save, change a
profile/photo, fetch a file, or change publication. `expired` is not proof that
a save never happened. Keep the complete original and captured account. Photo
originals retain the exact size/hash/type and original host file carrier when used.

For identity JSON written by another language, use
`client.profileOriginals.closeIdentitySource(bytes)`. The JSON source must contain
`{ expected_account_id, original, confirm_close: true }`; it is sent unchanged so
legacy floats and large integers keep their established canonical hash. Both
read/write profile grants and normal write availability are required. Current
Next identity/photo controls retain exact originals in the existing account-scoped
private byte store before dispatch, reopen interrupted requests and require shared
closure before guarded cleanup. Native-browser storage/rendered acceptance and the
distinct embedded native consumers remain separate migration requirements.

Submission-report originals use `submissionOriginal`, `prepareSubmissionOriginal`,
`submissionReceipt` and `closeSubmissionOriginal`. Retain the complete reviewed
`RecordSubmission`, including date, explicit confirmation, document choices,
correction and stage intent. Use the same key and body on retry. A payload-bound
operation check exposes only that report's ID; generic receipt reads do not.
Closure fences an unused retry or confirms historical evidence without undoing a
report or changing its pipeline stage. This records a user report, never employer
delivery or verification.

### Targeted document and application publication

`getPublication(kind, sourceId, accountId)` reviews saved content, source revision,
render-input fingerprint, allowed targets and current publication policy. Kinds are
`document` and `application`; these links are separate from live Hunt Pages.

`changePublication(original)` accepts an account-bound full original. Publish
requires `action: "publish"`, the displayed `expected_revision` and
`expected_fingerprint`, `privacy_tier` (`unlisted`, `public`, or `password`),
`target` and literal `confirm_publication: true`. Application targets are `resume`,
`cover_only` and `combined` (cover letter first); document targets come from its
review. Password publication requires 8–256 Unicode code points. Unpublish uses
`action: "unpublish"` and literal `confirm_unpublish: true`. Both require the exact
`source_id`, `request_id` and `expected_account_id`. Optional handle/address fields
reserve permanent aliases. Updates preserve the existing active link; unpublish
revokes recipient access without freeing those aliases.

Retain the complete original privately before dispatch, including its password.
`checkPublicationOriginal(original)` verifies the exact canonical hash through
`get_job_hunt_operation`. Retry the same original, never a new request ID after an
uncertain response. Acceptance is historical and does not prove current visibility.
`closePublicationOriginal(original)` explicitly fences an unused retry or reports
recorded/expired evidence, including after source deletion. It does not undo an
effect; expired evidence is not proof that nothing happened. Use a fresh displayed
review for another publication change. Receipts/audit contain no document body or
share password. Document operations require document read/write grants; application
publication additionally requires application read/write grants.

### Resume import originals

Keep the complete private input and original request UUID after a lost reply. `checkResumeImportOriginal` / `resume-imports check-original --file JSON` check the exact text, host-file, direct-upload or reviewed-confirmation original. The JSON envelope contains `expected_account_id` and `command: {operation_name, original}`; omission and explicit null stay distinct. Checks use a private POST and never fetch a host file or invoke a model.

For website/multipart imports, keep the full PDF/DOCX bytes. `checkResumeImportFileOriginal` / `resume-imports check-file --file PDF_OR_DOCX --request-id UUID --account-id ACCOUNT_ID` reconstruct the same bounded local parser input and raw checksum. A parser-version mismatch fails closed; keep the file and investigate instead of making a new request.

The corresponding `closeResumeImportOriginal`, `closeResumeImportFileOriginal`, `close-original` and `close-file` fence an unused retry or report recorded/expired evidence. CLI closure requires `--confirm REQUEST_ID`. Closure never cancels accepted extraction or removes an existing resume/package. Historical confirmation does not prove the current resume remains available. Current-browser cold retention and hosted distribution remain separate acceptance work.

For historical multipart imports that omitted account binding, pass `original_account_unbound: true` to the file-original SDK helper or `--original-unbound` to the CLI check/close command. The current captured `expected_account_id` / `--account-id` is still mandatory. This explicitly preserves the historical null binding; recovery never tries a fallback hash automatically.

Application deletion uses `removeApplication` with the reviewed immutable
application ID/revision and original request UUID. For an uncertain reply, retain
`{ expected_account_id, original }` privately. `applicationDeletions.check(original)`
uses the canonical hash with `get_job_hunt_operation` and validates the recorded
application ID and resulting revision. It performs no deletion or closure.
`applicationDeletions.close(original, true)` explicitly fences unused retries,
or reports `recorded`/`expired` history, using that same complete original.
Closing never deletes or restores a record. Account omission and explicit null
inside the inner original remain different hashes. Do not substitute a new UUID
or infer success from an absent source. The current website's trash confirmation
uses the same deletion/receipt/closure services and its existing account-fenced
private browser storage; interrupted originals are discoverable in Hunt Pipeline.

Durable posting imports are available as `client.postingImports`:
`list`, `get`, `start`, `saveDraft`, `open`, `reconcile`, `cancelRequest`, `cancel`, `stop`
and `files.manifest/chunk/download`. See the CLI README's durable-import section
for grants, exact original keys, draft revisions, opaque recovery partitions and
source-bound complete files. `postingImportPrivateIdentity` computes private
recovery identity locally; source text never appears in its result. Unknown
acceptance never authorizes a new request. These interfaces never submit an
application or delete one; production and public distribution remain separate gates.

`stop({ attempt_id })` stops active URL capture or enrichment for an already saved
application. It preserves that application, its stage and existing fields, and
prevents late worker results from being applied. After a lost reply, read the
same attempt; repeating the same stop is safe. Finished captures are not undone.
The existing `cancel` contract still refuses consumed creation receipts.


Rich retained application creation uses `client.createApplication(attributes, metadata?)` over the existing JSON:API route. It accepts owned company/source-contact/package references, a saved Hunt/stage, complete posting fields, application-specific resume overrides/letter, supplied contacts and imported activity. Native services validate relationships, copy exact saved package versions and prevent imported actors or reserved operational state from becoming authority. Source masters stay unchanged. Optional contact extraction keeps its existing independent save policy.

`metadata` supports `import_attempt_id`, `import_confirmed` and `import_review_revision`; the existing owned import claim prevents creating a second application and returns the originally saved application on replay. Changing the fields on a consumed claim does not edit that application. The legacy `createApplication` method without an import does not acquire a general retry receipt and never retries automatically. For retained exact originals and compact acknowledgements, use `applicationCreations` below. Native input is bounded at 16 MiB; the ordinary 2 MiB response bound remains unchanged.


### Exact native application creation originals

`client.applicationCreations` supports `create`, `createSource`, `check`, `close`
and `host` over the same authorized native assembly service. This never submits
to an employer or changes source master documents. Capture the current opaque
account ID, a fresh request UUID and a fresh immutable application UUID. Keep
those identities with the complete original before the first dispatch.

```ts
const prepared = await prepareApplicationCreation({
  expected_account_id: accountId, request_id: requestId, application_id: applicationId,
  fields: { title: 'Role I selected', company_name: 'Employer I selected' },
});
// First retain prepared.bytes in private durable storage owned by the caller.
const saved = await client.applicationCreations.createSource(prepared.bytes);
// After a lost reply: check the retained descriptor, then explicitly replay
// these exact bytes if appropriate. Never generate a replacement identity.
const found = await client.applicationCreations.check(prepared.original);
```

`prepareApplicationCreation` freezes rich fields and optional import metadata;
`prepareApplicationCreationSource` preserves an already retained JSON envelope's
exact UTF-8 bytes, whitespace and large JSON integers. The entire envelope must
fit within 16 MiB. For raw input, use `data.type: "application"`, the existing rich
`data.attributes`, optional `data.meta` import metadata, and
`meta.application_creation: { expected_account_id, request_id, application_id }`.
Automatic imports may omit identity fields filled from their owned stored capture;
explicitly confirmed imports keep their existing validation. Unknown fields fail.

The native `?return=creation-receipt` response is compact and validated against
account/original hash, application ID, request ID, source bytes and revision 1.
No private source is placed in a query or receipt. Exact replay acknowledges the
original primary commit; it never repeats extraction, overwrites later edits or
recreates deleted applications. Package snapshots remain exact. Native preparatory
helper commits and optional extracted-contact commits retain their independent
policies; only the primary graph/import claim and compact receipt are atomic.

`check(original)` returns recorded ID/revision/hash facts, not current content.
`not_found` is not permission to choose a new request. Retain unresolved originals.
`close(original, true)` fences unused retries or reports recorded/expired evidence;
it never deletes an application. Original retry retention is 24 hours; expired
history never authorizes recreation. Nothing automatically retries writes.

`host({ ...original, file })` uses `create_native_application_file_v1` with the
existing HostResumeFile shape. New downloads require the configured exact HTTPS
host allowlist; bytes must match the original's full size/hash/field descriptor.
A recorded replay skips download entirely. Actual original credentials and grants
are checked across downloads, primary effects and final output. Unsupported native
extension bearer access is not added; its existing posting-import route remains.

Source checks, clean local package installation and real loopback HTTP/MCP/current
Next read-gateway acceptance are separate from public registry, browser retention,
provider and production acceptance. See the application-creation-originals receipt.

### Package display order

`getDocumentPackageOrder({package_id})` reads the full member list and fingerprint.
`reorderDocumentPackage({package_id, document_ids, expected_fingerprint, request_id})`
saves that complete reviewed list. Read requires `read:documents`; saving also
requires `write:documents`. Reuse the exact original after a lost reply. A stale
fingerprint or changed membership returns a conflict. This changes display order
only; document content, package identity and export behavior stay unchanged.
