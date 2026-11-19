import { postingImportCommand, postingImportOptions } from './posting-imports.ts';
import {publicationCommand,publicationOptions,publicationTargets} from './publications.ts';
import { webhookCommand, webhookOptions, webhookTargets } from './webhooks.ts';
import { webhookIssuanceOptions, webhookIssuanceCommand, prepareWebhookRecipient, publicWebhookRecipient } from './webhook-issuance.ts';
import { erasureRecoveryCommand, erasureRecoveryOptions } from './erasure-recovery.ts';
import { applicationExportCommand, applicationExportOptions } from './application-export.ts';
import { extensionIssuanceOptions, extensionIssuanceCommand, prepareExtensionRecipient, publicExtensionRecipient } from './extension-issuance.ts';
import { extensionCommand, extensionOptions } from './extension-connections.ts';
import { workspaceOriginalCommand, workspaceOriginalOptions } from './workspace-originals.ts';
import { accountNameCommand, accountNameOptions } from './account-name.ts';
import { accountExportCommand, accountExportOptions } from './account-export.ts';
import { apiKeyCommand, apiKeyOptions, apiKeyTargets } from './api-keys.ts';
import { keyIssuanceCommand, keyIssuanceOptions, prepareKeyRecipient, prepareFileKeyRecipient, publicKeyRecipient } from './key-issuance.ts';
import { studioOriginalCommand, studioOriginalOptions } from './studio-originals.ts';
import { documentSettingsInput } from '../../client/src/document-settings-contracts.ts';
import { parseArgs } from 'node:util';
import type { Readable, Writable } from 'node:stream';
import { DEFAULT_ORIGIN, JobHuntClient, JobHuntError, validToken } from '../../client/src/index.ts';
import type { CreateApplication, UpdateApplication, CreateContact, UpdateContact, Credential } from '../../client/src/index.ts';
import { CredentialStore, configDirectory } from './credentials.ts';
import { login, openBrowser, refresh, revoke } from './oauth.ts';
import { runBridge, sharedToken } from './mcp-bridge.ts';
import { taskCommand } from './tasks.ts';
import { taskPreferencesInput } from '../../client/src/task-preferences-contracts.ts';
import { stageTemplateCommand } from './stage-templates.ts';
import { applicationRecordCommand } from './application-records.ts';
import { applicationCreationCommand, applicationCreationOptions } from './application-creations.ts';
import { applicationRecordFileCommand, applicationRecordFileOptions } from './application-record-files.ts';
import { compensationCommand, compensationOptions, compensationTargets } from './compensation.ts';
import { jobPipelineCommand, pipelineCommandOptions, pipelineCommandTargets } from './job-pipeline.ts';
import { packageCommand, packageCommandOptions, packageCommandTargets } from './packages.ts';
import { documentCommand, documentCommandOptions, documentCommandTargets } from './documents.ts';
import { profileCommand, profileCommandOptions, profileCommandTargets } from './profiles.ts';
import { huntPageCommand, huntPageOptions } from './hunt-page.ts';
import { exportCommand, exportOptions, exportTargets } from './exports.ts';
import { crmCommand, crmOptions, crmTargets } from './crm.ts';
import { huntCommand, huntOptions, huntTargets } from './hunts.ts';
import { pipelineCommand, pipelineOptions } from './pipeline.ts';
import { libraryCommand, libraryOptions, libraryTargets } from './library.ts';
import { interviewRecordCommand, interviewRecordOptions, interviewRecordTargets } from './interview-records.ts';
import { calendarCommand, calendarOptions, calendarTargets } from './calendar.ts';
import { interviewPreparationCommand, interviewPreparationOptions, interviewPreparationTargets } from './interview-preparation.ts';
import { interviewTemplateCommand, interviewTemplateOptions } from './interview-templates.ts';
import { screeningInterviewCommand, screeningInterviewOptions, screeningInterviewTargets } from './screening-interviews.ts';
import { highlightCommand, highlightOptions, highlightTargets } from './highlights.ts';
import { workspaceSearchCommand, workspaceSearchOptions } from './workspace-search.ts';
import { workspaceReadCommand, workspaceReadOptions, workspaceReadTargets } from './workspace-reads.ts';
import { referenceCommand, referenceOptions } from './references.ts';
import { insightCommand, insightOptions } from './insights.ts';
import { routineCommand, routineOptions } from './routines.ts';
import { huntSettingsCommand, huntSettingsOptions } from './hunt-settings.ts';
import { bookmarkSaveInput } from '../../client/src/bookmark-contracts.ts';
import { inputJSON } from './input.ts';
import { pluginCommand, pluginOneWord, pluginOptions, pluginStatus, signedOut } from './plugin.ts';
import { record } from '../../client/src/protocol.ts';

export type IO = {
  env: NodeJS.ProcessEnv; stdin: Readable; stdout: Writable; stderr: Writable;
  fetchImpl?: typeof fetch; browser?: (url: string) => Promise<void>;
  storeFactory?: (origin: string, profile: string) => CredentialStore;
  /** The clock for commands that need today's date; tests set it. */
  now?: () => Date;
  /** How long `auth login` waits for approval; tests shorten it. */
  loginTimeoutMs?: number;
};
const help = `jobhunt — JobHunt command line client

  auth login [--no-browser]        Authorize in your browser using PKCE
    [--scopes read:profile,read:contacts,write:contacts]
                                  Replace default permissions with an explicit list
  auth status                     Check the current credential with the API
  status                          {"signed_in": true|false}, nothing else (for plugins and status bars)
  overview                        Where the search stands: the result of the get_overview tool
  activity [--days N] [--time-zone ZONE]
                                  Recorded actions per day for a contribution graph (default 365 days)
  jobs save URL                   Save a posting link to To Apply (the save_job tool)
  extensions prepare-recipient --file PLAN_JSON --output RECIPIENT_JSON --confirm ACCOUNT_ID
  extensions recipient --recipient-file RECIPIENT_JSON
  extensions review-create --recipient-file RECIPIENT_JSON --output ORIGINAL_JSON
  extensions issue --file ORIGINAL_JSON --recipient-file RECIPIENT_JSON --confirm ACCOUNT_ID
  extensions check-create --file ORIGINAL_JSON
  extensions check-delivery --file ORIGINAL_JSON
  extensions receive --file ORIGINAL_JSON --recipient-file RECIPIENT_JSON --output PRIVATE_TOKEN_FILE --confirm CONNECTION_ID
  extensions acknowledge --file ORIGINAL_JSON --recipient-file RECIPIENT_JSON --secret-file PRIVATE_TOKEN_FILE --confirm CONNECTION_ID
  extensions close-create --file ORIGINAL_JSON --confirm ACCOUNT_ID
  extensions list [--after UUID]   Read browser extension connection metadata
  extensions get UUID             Read an owned connection; no secret
  extensions review-revoke --file JSON
                                  Review one exact connection before revocation
  extensions revoke --file JSON --confirm UUID
  extensions check-revoke --file JSON
  extensions close-revoke --file JSON --confirm UUID
                                  Recover or close the unchanged original
  account get-name-parts          Read separate first/last names and account identity
  account set-name-parts --file ORIGINAL_JSON --confirm ACCOUNT_ID
  account check-name-parts --file ORIGINAL_JSON
  account close-name-parts --file ORIGINAL_JSON --confirm ACCOUNT_ID
  account get-name                Read account identity, separate from Hunt Profiles
  applications export-manifest --file JSON
                                  Inspect all-Hunt native JSON/CSV export metadata
  applications export --file JSON --output PATH --confirm ACCOUNT_ID
                                  Save applications privately; JSON also needs document access
  webhooks review-test --file PLAN_JSON --output ORIGINAL_JSON
  webhooks send-test --file ORIGINAL_JSON --confirm SUBSCRIPTION_ID
  webhooks check-test --file ORIGINAL_JSON
  webhooks close-test --file ORIGINAL_JSON --confirm SUBSCRIPTION_ID
  webhooks jobs SUBSCRIPTION_ID --account-id ACCOUNT_ID [--after UUID]
  webhooks job JOB_ID --subscription-id SUBSCRIPTION_ID --account-id ACCOUNT_ID
  webhooks review-reconciliation --file PLAN_JSON --output ORIGINAL_JSON
  webhooks reconcile --file ORIGINAL_JSON --confirm SUBSCRIPTION_ID
  webhooks check-reconciliation --file ORIGINAL_JSON
  webhooks close-reconciliation --file ORIGINAL_JSON --confirm SUBSCRIPTION_ID
  webhooks metadata-manifest --file JSON
  webhooks prepare-recipient --file JSON --output PATH --confirm ACCOUNT_ID
  webhooks recipient --recipient-file PATH
  webhooks review-create --recipient-file PATH --output ORIGINAL_JSON
  webhooks issue --file ORIGINAL_JSON --recipient-file PATH --confirm ACCOUNT_ID
  webhooks check-create|check-delivery --file ORIGINAL_JSON
  webhooks receive --file ORIGINAL_JSON --recipient-file PATH --output PATH --confirm SUBSCRIPTION_ID
  webhooks acknowledge --file ORIGINAL_JSON --recipient-file PATH --secret-file PATH --confirm SUBSCRIPTION_ID
  webhooks close-create --file ORIGINAL_JSON --confirm ACCOUNT_ID
                                  Creation also supports --attributes-file JSON at prepare/review/issue
  webhooks review-change --file PLAN_JSON --output ORIGINAL_JSON
  webhooks update|remove --file ORIGINAL_JSON --confirm SUBSCRIPTION_ID
  webhooks check-change --file ORIGINAL_JSON
  webhooks close-change --file ORIGINAL_JSON --confirm SUBSCRIPTION_ID
  webhooks review-fields-update --file PLAN_JSON --attributes-file JSON --output ORIGINAL_JSON
  webhooks update-fields --file ORIGINAL_JSON --attributes-file JSON --confirm SUBSCRIPTION_ID
  webhooks check-fields-update --file ORIGINAL_JSON
  webhooks close-fields-update --file ORIGINAL_JSON --confirm SUBSCRIPTION_ID
  webhooks metadata --file JSON --output PATH --confirm ACCOUNT_ID
                                  Save complete private native metadata beyond compact tool limits
  webhooks list --account-id ACCOUNT_ID [--after UUID]
  webhooks get UUID --account-id ACCOUNT_ID
  webhooks deliveries UUID --account-id ACCOUNT_ID [--after UUID]
  webhooks delivery UUID --subscription-id UUID --account-id ACCOUNT_ID
                                  Read native subscription and delivery metadata; no secrets or event bodies
  account erasure-status --recovery-file PRIVATE_JSON
                                  Inspect deletion after account access is revoked
  account erasure-cleanup-binding --recovery-file PRIVATE_JSON
                                  Read the accepted request's opaque local-data binding; no cleanup runs
  account retry-erasure --recovery-file PRIVATE_JSON --confirm REQUEST_ID
                                  Retry only that accepted cleanup; never starts deletion
  account export-manifest --file JSON
                                  Inspect the structured-account export; no private bodies
  account export --file JSON --output PATH --confirm ACCOUNT_ID
                                  Save verified JSON/ZIP privately without overwriting
  account set-name --file JSON --confirm ACCOUNT_ID
                                  Save an exact account/source/original name change
  account check-name --file JSON   Check the original name save without writing
  account close-name --file JSON --confirm ACCOUNT_ID
                                  Fence an unconfirmed original without renaming
  api-keys list [--after KEY_ID]   Read customer key metadata and quota facts
  api-keys get KEY_ID              Read one key without its secret
  api-keys list-summary [--after KEY_ID]
                                  Page metadata without large permission arrays
  api-keys get-summary KEY_ID       Read metadata and complete permission-file manifest
  api-keys download-permissions KEY_ID --output PRIVATE_FILE
                                  Save all permissions as verified private JSON
  api-keys review-revoke-summary --file JSON
                                  Review revocation without inline large permissions
  api-keys review-revoke --file FILE
                                  Review exact account/key/connection authority
  api-keys revoke --file FILE --confirm KEY_ID
                                  Revoke the reviewed key using its original request
  api-keys check-revoke --file FILE
                                  Check the original revocation without another write
  api-keys close-revoke --file FILE --confirm KEY_ID
                                  Fence an unconfirmed original or acknowledge its outcome
  api-keys prepare-recipient --file PLAN --output PRIVATE_FILE --confirm ACCOUNT_ID
                                  Prepare one local recipient; no network or keychain
  api-keys prepare-file-recipient --account ACCOUNT_ID --file ATTRIBUTES_JSON --output PRIVATE_FILE --confirm ACCOUNT_ID
                                  Bind full native attributes to one local recipient
  api-keys recipient --recipient-file PRIVATE_FILE
                                  Export only the public review input for MCP
  api-keys review-create --recipient-file PRIVATE_FILE --output ORIGINAL_FILE
                                  Save the exact reviewed issuance original privately
  api-keys review-file-create --recipient-file PRIVATE_FILE --attributes-file ATTRIBUTES_JSON --output ORIGINAL_FILE
                                  Review complete native attributes without a large URL
  api-keys issue --file ORIGINAL_FILE --recipient-file PRIVATE_FILE --confirm ACCOUNT_ID
                                  Issue/retry the original; never print the secret
  api-keys issue-file --file ORIGINAL_FILE --recipient-file PRIVATE_FILE --attributes-file ATTRIBUTES_JSON --confirm ACCOUNT_ID
                                  Issue the exact full-file original; same private delivery
  api-keys check-delivery --file ORIGINAL_FILE
                                  Check delivery metadata without another write
  api-keys receive --file ORIGINAL_FILE --recipient-file PRIVATE_FILE --output KEY_FILE --confirm KEY_ID
                                  Decrypt locally into a new private file; does not acknowledge
  api-keys acknowledge --file ORIGINAL_FILE --recipient-file PRIVATE_FILE --secret-file KEY_FILE --confirm KEY_ID
                                  Verify local retention, then clear encrypted delivery
  api-keys close-create --file ORIGINAL_FILE --confirm ACCOUNT_ID
                                  Fence unrecorded creation or acknowledge the recorded key
  auth logout [--local-only]       Revoke and remove the saved connection
  tasks workspace TASK_ID [--date YYYY-MM-DD] [--expected-application-id ID|none]
                                  Read full task notes and browser application context
  tasks workspace-list [--page N]  Read task rows with application labels and recurrence
  tasks description TASK_ID [--expected-application-id ID|none] --output PATH
                                  Save complete private UTF-8 notes at a verified checksum
  photos download PHOTO_ID --output PATH
                                  Save an owned available photo, including an earlier upload
  applications choices [--page N] [--identifier ID|SLUG]
                                  Read complete application choices with stages/revisions
  today get --date YYYY-MM-DD      Read your local-date agenda, activity and routine
  routine list [--links-page N] [--targets-page N] [--aggregators-page N] [--per-page N]
                                  Read complete routine directories in independent pages
  routine get --kind link|target|aggregator --id ID
  routine save --file JSON [--confirm ID]
                                  Reviewed record edit; deletion needs the exact saved ID
  workspace get [--hunt-id ID] [--application-id ID] [--document-id ID] [--section NAME]
                [--page N] [--hunts-page N] [--documents-page N] [--status TEXT] [--query TEXT] [--include-records]
  workspace search [--query TEXT] [--kind TYPE]
                                  Read up to ten ranked browser metadata matches
  workspace resolve --kind document|search --identifier ID_OR_SLUG
                                  Resolve one exact owned document or Hunt
  references find [--query TEXT]   Find up to 20 private saved-record links; refine if has_more
  references get --uri URI         Read the exact selected revision; saves nothing
  highlights list [--page N] [--per-page N] [--from DATE] [--to DATE] [--query TEXT] [--sort date_desc|date_asc|created_desc]
    [--file JSON]                 Use typed JSON for every filter, including company, role and tags
  highlights get ID               Read one record and its edit fingerprint
  highlights options              Read owned company/Hunt choices and distinct roles
  highlights choices [--company-page N] [--hunt-page N] [--role-page N] [--per-page N]
                                  Browse complete directories in independent pages
  highlights create --file JSON
  highlights update --file JSON    Omitted fields remain; explicit null clears optional fields
  highlights delete --file JSON --confirm ID
  highlights export --file JSON --output PATH
                                  Save complete private Markdown/plain text exclusively
  highlights files [--file FILTER_JSON]
                                  Discover full native records without embedding large fields
  highlights file-manifest ID
  highlights download-record ID --output PATH
                                  Verify and save the complete private JSON record exclusively
  highlights save-file --file INTENT_JSON --fields FIELDS_JSON --confirm ACCOUNT_ID
  highlights save-host-file --file HOST_INTENT_JSON --confirm ACCOUNT_ID
                                  Full native fields; same original journal receipt
  activity list [--page N]         Read owned work history; follow has_more
  activity counts --date YYYY-MM-DD [--hunt-id ID] [--tz-offset MINUTES]
                                  Read recorded daily activity; default offset is UTC
  analytics get [--days 30|90|180] [--hunt-slug SLUG]
  career get                      Read factual career totals; no score
  imports identity --file ORIGINAL_JSON  Compute private input identity locally
  imports file --file JSON         Inspect the complete source-bound JSON manifest
  imports export --file JSON --output PRIVATE_FILE --confirm ACCOUNT_ID
  imports list [--before UUID] [--limit N]  Read the owned recovery index
  imports get UUID                Read captured posting and saved draft
  imports start --file ORIGINAL_JSON
  imports draft --file JSON
  imports open --file JSON
  imports reconcile --file ORIGINAL_JSON
  imports cancel UUID --confirm UUID
  imports stop ATTEMPT_ID --confirm ATTEMPT_ID
  imports cancel-request --file ORIGINAL_JSON --confirm REQUEST_KEY
                                  Preserve exact originals; never submits or deletes an application
  notifications list [--page N]    Read the owned inbox without marking anything read
  notifications mark-read --file JSON
                                  Explicit read/read_all action; no messages sent
  whoami                          Read your account identity
  mcp                             Run a local MCP server on stdin/stdout for apps that cannot sign in themselves
  account connected               Read the account ID for bound mutation intents
  hunt-page get [--page N]         Read retained settings and source/profile choices
  publications get SOURCE_ID --kind document|application [--account-id ACCOUNT_ID]
                                  Review saved targeted publication and source fingerprint
  publications publish|unpublish --file ORIGINAL_JSON --confirm SOURCE_ID
                                  Apply an explicitly reviewed original, with literal consent
  publications check-original --file ORIGINAL_JSON
  publications close-original --file ORIGINAL_JSON --confirm SOURCE_ID
                                  Fence retry only; never undo publication or unpublication
  hunt-page workspace [--page N]   Read current workspace and publication metadata
  exports inspect --file JSON     Review document revision and complete render fingerprint
  exports inspect-page --file JSON
  exports prepare --file JSON     Queue the reviewed private PDF/DOCX; expires in 24 hours
  exports prepare-page --file JSON
  exports get ID                  Read progress, format and expiry
  exports download ID --output PATH
                                  Save a verified private file without overwriting
  exports cancel --file JSON --confirm ACCOUNT_ID
  bundles inspect --file JSON     Review independent package members, document/application sections or a JSON library ZIP
  bundles prepare --file JSON     Queue the exact reviewed selection; all members must succeed
  bundles get ID                  Read bundle progress and expiry
  bundles download ID --output PATH
  bundles cancel --file JSON --confirm ACCOUNT_ID
                                  Cancel work or retire an existing export
  hunt-page save --file JSON       Save reviewed settings; public pages update immediately
  hunt-page preview --file JSON --output PATH
                                  Save one private rendered JPEG at the reviewed fingerprint
  hunt-page publish --file JSON --confirm ACCOUNT_ID
  hunt-page unpublish --file JSON --confirm ACCOUNT_ID
                                  Explicitly change the reviewed page visibility
  hunt-page photo-save --file JSON --image PNG --confirm ACCOUNT_ID
  hunt-page photo-upload-file --file JSON --image JPEG_OR_PNG --confirm ACCOUNT_ID
  hunt-page photo-upload-host-file --file JSON --confirm ACCOUNT_ID
  hunt-page photo-download --file JSON --output PATH
  profiles check-identity --file JSON
  profiles close-identity --file JSON --confirm REQUEST_ID
  profiles close-photo --file JSON --confirm REQUEST_ID
                                  Check a complete retained original without saving
  profiles save-identity --file JSON
                                  Save reviewed identity with original native receipt
  profiles directory [--page N]    Discover all profiles, including retained empty names
  profiles photo-upload --file JSON --image PNG --confirm PROFILE_ID
  profiles photo-upload-file --file JSON --image JPEG_OR_PNG --confirm PROFILE_ID
  profiles photo-upload-host-file --file JSON --confirm PROFILE_ID
                                  Save a photo with original native receipt and bounded result
  profiles personal PROFILE_ID    Read personal details and exact updated_at
  profiles update-personal --file JSON
                                  Replace reviewed personal details; preserves name/default
  profiles list [--page N]         Discover reusable identities without creating defaults
  profiles get PROFILE_ID
  profiles links PROFILE_ID [--page N]
  profiles create --file JSON
  profiles update --file JSON      Review immediate changes to linked documents/public pages
  profiles set-default --file JSON Select the default without relinking documents
  profiles delete --file JSON --confirm PROFILE_ID
                                  Detach links and retain existing document/page copies
  profiles link --file JSON
  profiles link-many --file JSON   Atomically link up to 20 reviewed package anchors
  profiles unlink --file JSON --confirm DOCUMENT_ID
  profiles photo-save --file JSON --image PNG --confirm PROFILE_ID
  profiles photo-download PROFILE_ID --output PATH
                                  Save a private PNG preview without overwriting files
  hunts summary HUNT_ID           Read targeting with only read:campaigns
  hunts update --file JSON         Change supplied Hunt preferences/status only
  hunts rename --file JSON         Rename at an exact revision; retain the request ID
  hunts directory [--page N]      Read original Hunt directory fields in complete pages
  hunts workspace HUNT_ID [--hunts-page N] [--companies-page N] [--resumes-page N]
                                  Read complete Hunt fields and independently paged choices
  hunts workspace-save --file JSON
                                  Save criteria/lifecycle with original campaign receipt
  hunts remove --file JSON --confirm HUNT_ID
                                  Remove reviewed Hunt with original deletion receipt
  hunts selection                 Read the saved pipeline view and original selection fingerprint
  hunts selection-save --file JSON Save the reviewed pipeline selection; preserve request_id for retry
  hunts list [--page N]             List active, paused, completed and archived Hunts
  hunts get HUNT_ID                Read complete criteria, notes and exact fingerprint
  hunts assignment-review HUNT_ID  Review moving every owned application to this Hunt
  hunts assign-all --file JSON --confirm HUNT_ID
                                   Reassign all only at the reviewed fingerprint/counts
  hunts create --file JSON
  hunts save --file JSON           Save criteria or an explicit lifecycle action
  hunts set-current --file JSON --confirm HUNT_ID
  hunts delete --file JSON --confirm HUNT_ID
                                  Migrate applications to the reviewed active destination
  pipeline get [--page N]          Review stage IDs, flags, impacts and full fingerprint
  pipeline create-stage --file JSON
  pipeline rename-stage --file JSON
  pipeline reorder-stage --file JSON
  pipeline remove-stage --file JSON --confirm STAGE_ID
  pipeline initialize --file JSON  Explicitly create missing stages or reuse existing ones
  bookmarks get                   Read your saved job-search website links
  bookmarks save --file JSON       Replace the reviewed list using its previous revision
  hunt-settings get               Read saved account preferences, defaults and choices
  hunt-settings update --file JSON Patch explicitly reviewed preferences at their revision
  context get [--hunt-id ID]       Resume from saved context without selecting or writing
  document-settings get           Read saved document download and page-size defaults
  document-settings update --file JSON Patch defaults at the reviewed account fingerprint
  task-settings get               Read account task preferences without initializing defaults
  task-settings update --file JSON Patch reviewed preferences using their fingerprint
  stage-templates list [--stage-id UUID] [--include-detached] [--page N]
  stage-templates get ID           Review existing content and assignment counts
  stage-templates update --file JSON
  stage-templates reorder --file JSON
  stage-templates remove --file JSON --confirm TEMPLATE_ID
                                  Explicitly preserve or remove assigned records
  applications list [--page N] [--page-size N] [--search TEXT] [--status STAGE]
  applications get SLUG
  applications create --title TITLE --company COMPANY [--url URL] [--source TEXT] [--hunt SLUG]
  applications create --file JSON  Rich native attributes and optional import metadata; no automatic retry
  applications create-native --file JSON  Complete original with captured account, request and application UUID
  applications check-creation --file ORIGINAL_OR_INPUT_JSON
  applications close-creation --file ORIGINAL_OR_INPUT_JSON --confirm APPLICATION_UUID
  applications create-native-host-file --file JSON
  applications update SLUG --revision N [--title TITLE] [--company COMPANY] [--url URL] [--source TEXT]
  applications delete SLUG --confirm SLUG
  applications stages [--page N] [--page-size N]
  applications inspect APPLICATION_ID
  applications capture-url --file JSON
  applications capture-details --file JSON
  applications target-company --file JSON
  applications edit-details --file JSON
  applications move --file JSON    Use the saved revision and exact owned stage ID
  applications submission-options APPLICATION_ID [--prepared-before-id ID] [--external-before-id ID]
  applications submissions APPLICATION_ID [--before-id ID]
  applications close-submission-original --file JSON
                                  Close retry of an exact retained submission report
  applications record-submission --file JSON --confirm APPLICATION_ID
                                  Record what you submitted; never send to an employer
  applications answers APPLICATION_UUID
  applications close-answers-original --file JSON
  applications save-answers --file JSON
                                  Save the complete reviewed screening set; never submit
  calendar connections [--page N]  Read owned calendar connection settings; no provider IO
  calendar connection CONNECTION_ID
  calendar provider PROVIDER
  calendar available CONNECTION_ID [--cursor TOKEN]
                                  Read writable provider calendars; follow next_cursor to null
  calendar settings --file JSON   Edit exactly reviewed local calendar preferences
  calendar disconnect --file JSON --confirm CONNECTION_ID
  calendar preview --file JSON    Review a saved interview/task calendar intent
  calendar handoffs [--page N] [--include-admitted true]
  calendar handoff ID             Read saved-item admission, separate from delivery
  calendar handoff-review --file JSON
  calendar handoff-resume --file JSON --confirm HANDOFF_ID
  calendar handoff-leave --file JSON --confirm HANDOFF_ID
  calendar upcoming CONNECTION_ID [--cursor TOKEN]
                                  Read complete native sync-all selection, 20 per page
  calendar queue-batch --file JSON
                                  Queue up to 20 reviews with original per-item receipts
  calendar queue --file JSON      Queue the original review token and request ID
  calendar change CHANGE_ID       Read provider and local outcome facts
  calendar changes [--source-kind interview|task --source-id ID] [--page N]
  calendar cancel --file JSON --confirm CHANGE_ID
  calendar resolve --file JSON --confirm CHANGE_ID
                                  Explicitly leave an uncertain request unchanged
  interviews records [--application-id ID] [--page N]
                                  Discover complete interview records and edit fingerprints
  interviews get INTERVIEW_ID [--expected-application-id ID]
                                  Read all interview fields and owned relationship IDs
  interviews create --file JSON   Create an explicitly supplied owned interview
  interviews update --file JSON   Partially edit exact reviewed fields/dates/preparation
  interviews delete --file JSON --confirm INTERVIEW_ID
                                  Delete reviewed interview; inspect separate calendar cleanup
  interviews list [--page N]
  interviews set-status --file JSON
                                  Complete, skip, reopen, cancel, mark no-show or reschedule
  interviews prep INTERVIEW_ID [--expected-application-id ID]
                    [--interviewers-page N] [--tasks-page N] [--rounds-page N]
                                  Read preparation with independent related-record pages
  interviews preparation-save --file JSON
                                  Replace checklist, merge feedback or submit feedback
  interviews rounds APPLICATION_ID [--page N]
                                  Review complete application round ordering
  interviews reorder --file JSON   Apply reviewed partial ordering; preserve system rounds
  interview-templates list [--page N]
  interview-templates initialize --file JSON
  interview-templates create --file JSON
  interview-templates delete --file JSON --confirm ID
  applications workspace APPLICATION_UUID
  applications compensation APPLICATION_UUID
  applications compensation-download APPLICATION_UUID --output FILE
  applications compensation-replace APPLICATION_UUID --intent INTENT_JSON --file VALUE_JSON --confirm APPLICATION_UUID
  applications compensation-draft APPLICATION_UUID --draft-id DRAFT_UUID
  applications compensation-prepare --file JSON
  applications compensation-append --file JSON
  applications compensation-commit --file JSON --confirm APPLICATION_UUID
  applications compensation-cancel --file JSON
  library documents [--status active|archived|all] [--page N]
  library archive-review DOCUMENT_ID [--page N]
                                  Review the whole package, even when selecting a sibling
  library archive --file JSON
  library unarchive --file JSON    Set reviewed package flags; preserve publication choices
  library packages [--package-id ID] [--page N] [--documents-page N]
                                  Read master packages and separately paged members
  library add-document --file JSON
  library delete-package --file JSON --confirm PACKAGE_ID
                                  Delete exactly the reviewed members; retain application copies
  documents editorial DOCUMENT_ID [--kind document|package]
  documents editorial-list [--kind document|package] [--status draft|ready] [--after-id ID]
  documents editorial-history DOCUMENT_ID [--kind document|package] [--before-id ID]
  documents set-editorial --file JSON
  documents check-editorial --file ORIGINAL
  documents close-editorial --file ORIGINAL --confirm DOCUMENT_ID
                                  Draft / Ready labels; never publishes or sends
  documents usage DOCUMENT_ID [--page N]
  documents preview --file JSON --output PATH  Save a private rendered JPEG page
  library order PACKAGE_ID
    Read the complete saved package display order and fingerprint.
  library reorder --file FILE
    Save a complete reviewed order; reuse the exact request UUID after an uncertain reply.
  documents list [--page N] [--page-size N]
  documents get DOCUMENT_ID
  documents create --file JSON
  documents create-native --file JSON     Create the retained complete native document original
  documents check-creation --file ORIGINAL_OR_INPUT_JSON
  documents close-creation --file ORIGINAL_OR_INPUT_JSON --confirm DOCUMENT_ID
                                          Fence unused creation or report recorded evidence
  documents create-native-host-file --file JSON
  documents update-section --file JSON    Replace one complete section at its saved revision
  documents save-profile --file JSON      Save the exact full native profile original
  documents close-profile-save --file JSON --confirm DOCUMENT_ID
  documents check-section-save --file ORIGINAL_OR_INPUT_JSON
  documents close-section-save --file ORIGINAL_OR_INPUT_JSON --confirm DOCUMENT_ID
  documents check-delete --file DELETION_ORIGINAL_JSON
  documents check-library --file LIBRARY_ORIGINAL_JSON
  documents close-library --file LIBRARY_ORIGINAL_JSON --confirm DOCUMENT_ID
  documents close-delete --file DELETION_ORIGINAL_JSON --confirm DOCUMENT_ID
  documents check-version --file VERSION_ORIGINAL_JSON
  documents close-version --file VERSION_ORIGINAL_JSON --confirm DOCUMENT_ID
                                          Fence unused retry or report recorded evidence
  documents check-profile-save --file JSON
                                          Check its original descriptor without repeating a save
  documents save-profile-host-file --file JSON
                                          Use an approved host file carrying the same original
  documents revisions DOCUMENT_ID [--before-id ID] [--include-metadata]
  documents version-file DOCUMENT_ID --version-id ID --output PRIVATE_FILE
                                          Download saved content and historical provenance
  documents checkpoint --file JSON
  documents restore --file JSON --confirm DOCUMENT_ID
  documents restore-snapshot --file JSON --confirm DOCUMENT_ID
                                          Restore native content; return only the recorded revision
  documents rename --file JSON
  documents duplicate --file JSON
  documents set-default --file JSON
  documents delete --file JSON --confirm DOCUMENT_ID
  application-documents get APP_SLUG
  application-documents choices APP_SLUG [--query TEXT] [--page N]
  application-documents select --file JSON
  application-documents customize --file JSON
  application-documents letter --file JSON
  application-documents close-original --file JSON
  packages preview --file JSON --output PATH   Preview an exact frozen PDF page
  packages check-original --file JSON
  packages close-original --file JSON
                                  Check acceptance or close an exact preparation retry; never cancel its job
  packages prepare --file JSON       Freeze the exact reviewed revisions; no submission
  packages get PACKAGE_ID
  packages list APPLICATION_ID [--before-id ID]
  packages download PACKAGE_ID --version-id VERSION_ID --output PATH
                                    Verify a private PDF; never overwrite an existing file
  resume-imports text --file JSON
  resume-imports file --file PDF_OR_DOCX --request-id UUID [--account-id ACCOUNT_ID]
                                    [--transport auto|direct|multipart]; review extracted facts
  resume-imports host-file --file JSON
                                    Import an explicitly supplied, server-allowed host file
  resume-imports get IMPORT_ID
  resume-imports confirm --file JSON --confirm IMPORT_ID
  resume-imports check-original --file JSON
  resume-imports close-original --file JSON --confirm REQUEST_ID
  resume-imports check-file --file PDF_OR_DOCX --request-id UUID --account-id ACCOUNT_ID [--original-unbound]
  resume-imports close-file --file PDF_OR_DOCX --request-id UUID --account-id ACCOUNT_ID --confirm REQUEST_ID [--original-unbound]
  applications record-save --file JSON
  applications record-files --file JSON
  applications record-file --file JSON
  applications record-download --file JSON --output PATH
  captures list|check|manifest|review --file JSON
  captures download --file POINTER_JSON --output PATH
  captures stage-file --file INTENT_JSON --original ARGUMENTS_JSON --confirm ACCOUNT_ID
  captures stage-host-file --file JSON --confirm ACCOUNT_ID
  captures retry|resolve --file JSON --confirm ACCOUNT_ID
  originals list|check|manifest|review --file JSON
  originals download --file POINTER_JSON --output PATH
                                  Save the complete private original with verified SHA-256
  originals stage-file --file INTENT_JSON --fields FIELDS_JSON --confirm ACCOUNT_ID
  originals stage-host-file --file JSON --confirm ACCOUNT_ID
  originals retry|resolve --file JSON --confirm ACCOUNT_ID
                                  Explicit original retry needs its signed review and total Calendar count
  applications record-save-file --file INTENT_JSON --fields FIELDS_JSON --confirm ACCOUNT_ID
  applications record-save-host-file --file JSON --confirm ACCOUNT_ID
  applications record-delete --file JSON --confirm RECORD_ID
                                  Remove one record or unlink a person
  applications check-delete --file DELETION_ORIGINAL_JSON
  applications close-delete --file DELETION_ORIGINAL_JSON --confirm APPLICATION_ID
  applications remove --file JSON --confirm APPLICATION_ID
                                  Delete a reviewed application at its exact revision
  applications set-target --file JSON
                                  Set company targeting using application/target revisions
  crm contacts [--page N]          List owned contacts in the shared CRM workspace
  crm companies [--page N]         List owned companies
  crm contact ID [--related-page N]
  crm company ID [--related-page N]
  crm save-contact --file JSON [--confirm ID]
  crm save-company --file JSON [--confirm ID]
                                  Save reviewed fields, notes, tasks or contact relationships
  contacts list [--page N] [--page-size N] [--company-id UUID]
  contacts get ID
  contacts create --name NAME [--email EMAIL] [--phone PHONE] [--title TITLE]
    [--company COMPANY] [--company-id UUID] [--linkedin-url URL] [--notes TEXT]
  contacts update ID --revision N [same contact fields]
  contacts delete ID --confirm ID
  tasks list [--state open|completed|all] [--page N] [--date YYYY-MM-DD]
    [--application-id UUID] [--hunt-id UUID]
  tasks get ID [--date YYYY-MM-DD] [--expected-application-id UUID|none]
  tasks create --file JSON         Create a follow-up or recurring task
  tasks update --file JSON         Edit fields with a revision and request ID
  tasks complete ID --revision N --request-id UUID [--account-id ACCOUNT_ID]
    [--expected-application-id UUID|none]
  tasks reopen ID --revision N --request-id UUID [--account-id ACCOUNT_ID]
    [--expected-application-id UUID|none]
  tasks completion --file JSON     Complete or reopen one recurring date
  tasks skip --file JSON           Skip one recurring date, keeping its schedule
  tasks history ID [--limit N] [--before-date YYYY-MM-DD] [--expected-application-id UUID|none]
                                  Read recorded dates, newest first
  tasks cleanup-preview --date YYYY-MM-DD [--scope all|jbr] [--include-skipped]
    [--after-task-id UUID]         Review up to 20 dated completion groups
  tasks cleanup --file JSON --confirm YYYY-MM-DD
                                  Reopen the reviewed set; preserve later changes on retry
  tasks schedule --file JSON       Change or pause/resume a recurring schedule
  tasks delete --file JSON --confirm TASK_ID
                                  Delete the task, its schedule and completion history
  operations get ID [--payload-hash HASH]
                                  Inspect a saved mutation receipt
  operations find --request-id UUID --operation NAME [--payload-hash HASH]
                                  Recover after a lost response; keep the request ID
  --file - reads bounded JSON from stdin; it cannot share stdin with a token.

  --json                          JSON success on stdout; JSON errors on stderr
  --non-interactive                Never start browser authorization or prompt
  --profile NAME                  Independent saved connection (default: default)
  --origin HTTPS_ORIGIN           Product origin (default: https://jobhunt.app)
  --allow-loopback                 Permit explicit local HTTP IP origins for testing
  --timeout MS                    Request timeout, 100–120000 (default: 15000)
  --token-stdin                    Read an ephemeral bearer credential from stdin
  --help, --version

Automation: JOBHUNT_TOKEN; set JOBHUNT_TOKEN_ORIGIN to its exact origin when
overriding --origin. Credentials are never accepted as command-line arguments.
Lists return one bounded page. No mutation is automatically retried. Capture,
edit-details, move, submission and task commands retain request IDs for exact retry
or operations find. Legacy applications create has no retry receipt; search first.
Versioned mutations require their existing server release flag.
This prerelease covers applications, contacts, tasks and document authoring; full coverage is pending.
`;
const globalOptions = ['json', 'non-interactive', 'profile', 'origin', 'allow-loopback', 'timeout', 'token-stdin', 'help', 'version'];
const commandOptions: Record<string, string[]> = {
  ...pluginOptions,
  ...webhookOptions,
  ...webhookIssuanceOptions,
  ...erasureRecoveryOptions,
  ...apiKeyOptions,
  ...accountNameOptions,
  ...accountExportOptions,
  ...applicationExportOptions,
  ...extensionOptions,
  ...extensionIssuanceOptions,
  ...keyIssuanceOptions,
  ...routineOptions,
  ...compensationOptions,
  ...interviewRecordOptions,
  ...calendarOptions,
  ...interviewPreparationOptions,
  ...interviewTemplateOptions,
  ...workspaceReadOptions,
  ...workspaceSearchOptions,
  ...referenceOptions,
  ...highlightOptions,
  ...postingImportOptions,
  ...insightOptions,
  ...pipelineCommandOptions,
  ...documentCommandOptions,
  ...packageCommandOptions, ...publicationOptions,
  ...profileCommandOptions,
  ...huntPageOptions,
  ...exportOptions,
  ...crmOptions, ...huntOptions, ...huntSettingsOptions, ...pipelineOptions, ...screeningInterviewOptions, ...libraryOptions,
  mcp: [], 'auth login': ['no-browser', 'scopes'], 'auth logout': ['local-only'], 'auth status': [], whoami: [], 'account connected': [],
  'applications list': ['page', 'page-size', 'search', 'status'], 'applications get': [],
  'applications create': ['title', 'company', 'url', 'source', 'hunt', 'file'],
  'applications update': ['title', 'company', 'url', 'source', 'revision'], 'applications delete': ['confirm'],
  ...applicationRecordFileOptions,
  ...applicationCreationOptions,
  ...studioOriginalOptions,
  ...workspaceOriginalOptions,
  'applications workspace': [], 'applications record-save': ['file'], 'applications record-delete': ['file', 'confirm'],
  'applications check-delete': ['file'], 'applications close-delete': ['file', 'confirm'],
  'applications remove': ['file', 'confirm'], 'applications set-target': ['file'],
  'contacts list': ['page', 'page-size', 'company-id'], 'contacts get': [],
  'contacts create': ['name', 'email', 'phone', 'title', 'company', 'company-id', 'linkedin-url', 'notes'],
  'contacts update': ['revision', 'name', 'email', 'phone', 'title', 'company', 'company-id', 'linkedin-url', 'notes'],
  'contacts delete': ['confirm'],
  'tasks list': ['state', 'page', 'date', 'application-id', 'hunt-id'], 'tasks get': ['date', 'expected-application-id'],
  'tasks create': ['file'], 'tasks update': ['file'], 'tasks completion': ['file'], 'tasks schedule': ['file'],
  'tasks delete': ['file', 'confirm'],
  'tasks cleanup-preview': ['date', 'scope', 'include-skipped', 'after-task-id'], 'tasks cleanup': ['file', 'confirm'],
  'tasks skip': ['file'], 'tasks history': ['limit', 'before-date', 'expected-application-id'],
  'bookmarks get': [], 'bookmarks save': ['file'],
  'document-settings get': [], 'document-settings update': ['file'],
  'task-settings get': [], 'task-settings update': ['file'],
  'stage-templates list': ['stage-id', 'include-detached', 'page'], 'stage-templates get': [],
  'stage-templates update': ['file'], 'stage-templates reorder': ['file'], 'stage-templates remove': ['file', 'confirm'],
  'tasks complete': ['revision', 'request-id', 'account-id', 'expected-application-id'], 'tasks reopen': ['revision', 'request-id', 'account-id', 'expected-application-id'],
  'operations get': ['payload-hash'], 'operations find': ['request-id', 'operation', 'payload-hash'],
};
function exitCode(error: JobHuntError) {
  if (error.status === 401 || /^(authentication_required|authorization_|credential_|unsafe_credential_permissions|saved_credential_|invalid_credential_|invalid_saved_credential|invalid_token_response|granted_scope_mismatch)/u.test(error.code)) return 3;
  if (error.status === 403) return 4;
  if (error.status === 404 || error.status === 410) return 8;
  if (error.status === 409) return 5;
  if (error.status === 429) return 6;
  if ([400, 413, 415, 422].includes(error.status) || /^(invalid_input|invalid_origin|invalid_profile|usage_error|confirmation_required|non_interactive_login|invalid_config_directory)/u.test(error.code)) return 2;
  return 7;
}
function number(value: string | boolean | undefined, fallback?: number) {
  if (value === undefined && fallback !== undefined) return fallback;
  if (typeof value !== 'string' || !/^\d+$/u.test(value)) throw new JobHuntError('invalid_input');
  const result = Number(value); if (!Number.isSafeInteger(result)) throw new JobHuntError('invalid_input'); return result;
}
async function stdinToken(input: Readable): Promise<string> {
  let value = '';
  for await (const chunk of input) { value += chunk.toString(); if (value.length > 4098) throw new JobHuntError('invalid_input'); }
  const token = value.replace(/\r?\n$/u, '');
  if (!validToken(token)) throw new JobHuntError('invalid_input'); return token;
}
function human(value: unknown): string {
  return JSON.stringify(value, null, 2).replace(/[\u001b\u007f-\u009f]/gu, '');
}

export async function runCLI(args: string[], io: IO, version: string): Promise<number> {
  let json = args.includes('--json');
  try {
    const options: Record<string, { type: 'string' | 'boolean' }> = {};
    for (const key of [...globalOptions, ...Object.values(commandOptions).flat()]) {
      options[key] = { type: ['json', 'non-interactive', 'allow-loopback', 'token-stdin', 'help', 'version', 'no-browser', 'local-only', 'include-detached', 'include-skipped', 'include-records', 'include-metadata', 'original-unbound'].includes(key) ? 'boolean' : 'string' };
    }
    let parsed;
    try { parsed = parseArgs({ args, options, allowPositionals: true, strict: true, tokens: true }); }
    catch { throw new JobHuntError('usage_error'); }
    const { values, positionals, tokens } = parsed; json = values.json === true;
    const names = tokens.filter(t => t.kind === 'option').map(t => t.name);
    if (new Set(names).size !== names.length) throw new JobHuntError('usage_error');
    if (values.help || args.length === 0) { io.stdout.write(help); return 0; }
    if (values.version) { io.stdout.write(json ? JSON.stringify({ version }) + '\n' : version + '\n'); return 0; }
    const oneWord = positionals[0] === 'whoami' || positionals[0] === 'mcp' || (positionals.length === 1 && pluginOneWord.has(positionals[0]));
    const command = oneWord ? positionals[0] : positionals.slice(0, 2).join(' ');
    if (!(command in commandOptions) || names.some(name => !globalOptions.includes(name) && !commandOptions[command].includes(name))) throw new JobHuntError('usage_error');
    const needsTarget = ['jobs save', 'applications get', 'applications update', 'applications delete', 'contacts get', 'contacts update', 'contacts delete',
      'imports get', 'imports cancel', 'imports stop', 'tasks get', 'tasks history', 'tasks complete', 'tasks reopen', 'operations get', 'applications workspace', 'stage-templates get'].includes(command) || compensationTargets.has(command) || pipelineCommandTargets.has(command) || documentCommandTargets.has(command) || packageCommandTargets.has(command) || profileCommandTargets.has(command) || exportTargets.has(command) || crmTargets.has(command) || huntTargets.has(command) || screeningInterviewTargets.has(command) || publicationTargets.has(command) || libraryTargets.has(command) || highlightTargets.has(command) || workspaceReadTargets.has(command) || interviewRecordTargets.has(command) || interviewPreparationTargets.has(command) || calendarTargets.has(command) || apiKeyTargets.has(command) || command === 'extensions get' || webhookTargets.has(command);
    if (positionals.length !== (oneWord ? 1 : needsTarget ? 3 : 2)) throw new JobHuntError('usage_error');
    if (command === 'auth login' && values['non-interactive']) throw new JobHuntError('non_interactive_login');
    if (values.file === '-' && values['token-stdin']) throw new JobHuntError('usage_error');
    const profile = typeof values.profile === 'string' ? values.profile : 'default';
    const baseOptions = { origin: typeof values.origin === 'string' ? values.origin : DEFAULT_ORIGIN,
      allowLoopback: values['allow-loopback'] === true, timeoutMs: number(values.timeout, 15000), fetchImpl: io.fetchImpl };
    const publicClient = new JobHuntClient(baseOptions);
    const origin = publicClient.origin;
    const output = (value: unknown) => io.stdout.write((json ? JSON.stringify(value) : human(value)) + '\n');
    if (Object.hasOwn(erasureRecoveryOptions, command)) {
      if (values['token-stdin']) throw new JobHuntError('usage_error');
      output(await erasureRecoveryCommand(command, values, { ...baseOptions, origin })); return 0;
    }
    if (command === 'extensions prepare-recipient' || command === 'extensions recipient') {
      if (values['token-stdin']) throw new JobHuntError('usage_error');
      output(command === 'extensions recipient' ? await publicExtensionRecipient(values, origin) : await prepareExtensionRecipient(values, origin, io.stdin)); return 0;
    }
    if (command === 'webhooks prepare-recipient' || command === 'webhooks recipient') {
      if (values['token-stdin']) throw new JobHuntError('usage_error');
      output(command === 'webhooks recipient' ? await publicWebhookRecipient(values, origin) : await prepareWebhookRecipient(values, origin, io.stdin)); return 0;
    }
    if (command === 'api-keys prepare-recipient' || command === 'api-keys prepare-file-recipient' || command === 'api-keys recipient') {
      if (values['token-stdin']) throw new JobHuntError('usage_error');
      output(command === 'api-keys recipient' ? await publicKeyRecipient(values, origin) : command === 'api-keys prepare-file-recipient'
        ? await prepareFileKeyRecipient(values, origin) : await prepareKeyRecipient(values, origin, io.stdin)); return 0;
    }
    if (values['token-stdin'] && io.env.JOBHUNT_TOKEN) throw new JobHuntError('usage_error');
    if (command.startsWith('auth ') && command !== 'auth status' && (values['token-stdin'] || io.env.JOBHUNT_TOKEN)) throw new JobHuntError('usage_error');
    let external: Credential | undefined;
    if (values['token-stdin']) external = { origin, token: await stdinToken(io.stdin) };
    else if (io.env.JOBHUNT_TOKEN) {
      // Environment credentials default to production, never to an arbitrary override.
      external = { origin: io.env.JOBHUNT_TOKEN_ORIGIN ?? DEFAULT_ORIGIN, token: io.env.JOBHUNT_TOKEN };
      if (external.origin !== origin || !validToken(external.token)) throw new JobHuntError('credential_origin_mismatch');
    }
    const store = io.storeFactory?.(origin, profile) ?? new CredentialStore(origin, profile, { directory: configDirectory(io.env) });
    if (command === 'auth login') {
      const session = await login(publicClient, profile, { scopes: values.scopes as string | undefined, timeoutMs: io.loginTimeoutMs, onAuthorization: async url => {
        io.stderr.write(`Authorize JobHunt in your browser:\n${url}\n`);
        if (!values['no-browser']) await (io.browser ?? openBrowser)(url).catch(() => io.stderr.write('Open the URL above to continue.\n'));
      } });
      try {
        // Each step that can fail says which one it was, so a plugin can show why and a person can report it.
        const accountId = await new JobHuntClient({ ...baseOptions, credential: { origin, token: session.accessToken } }).verifiedAccountId()
          .catch(error => {
            const status = error instanceof JobHuntError ? error.status : 0;
            throw new JobHuntError('account_check_failed', status, error instanceof JobHuntError ? error.requestId : undefined, undefined,
              `JobHunt issued the connection, but checking it against your account failed${status ? ` (HTTP ${status})` : ''}${error instanceof JobHuntError ? `: ${error.code}` : ''}.`);
          });
        const backend = await store.locked(async () => {
          const previous = await store.load(); if (previous) await revoke(publicClient, previous);
          return store.save(session);
        });
        if (backend === 'file') io.stderr.write('OS credential store unavailable; using a restricted local credential file.\n');
        output({ authenticated: true, origin, profile, account_id: accountId, scopes: session.scopes, storage: backend }); return 0;
      } catch (error) { await revoke(publicClient, session).catch(() => {}); throw error; }
    }
    if (command === 'auth logout') {
      await store.locked(async () => {
        const session = await store.load();
        if (session && !values['local-only']) await revoke(publicClient, session);
        await store.remove();
      });
      output({ authenticated: false, origin, profile, remote_revocation: values['local-only'] ? 'not_requested' : 'completed_or_no_saved_connection' }); return 0;
    }
    async function execute(credential?: Credential) {
      if (!credential) {
        if (command === 'auth status') { output({ authenticated: false, origin, profile }); return; }
        if (command === 'status') { output({ signed_in: false }); return; }
        throw new JobHuntError('authentication_required', 401);
      }
      const client = new JobHuntClient({ ...baseOptions, credential });
      if (Object.hasOwn(pluginOptions, command)) { output(await pluginCommand(command, positionals[2], values, client, io.now)); return; }
      if (Object.hasOwn(extensionIssuanceOptions, command)) output(await extensionIssuanceCommand(command, values, client));
      else if (Object.hasOwn(webhookIssuanceOptions, command)) output(await webhookIssuanceCommand(command, values, client));
      else if (Object.hasOwn(webhookOptions, command)) output(await webhookCommand(command, positionals[2], values, client, io.stdin));
      else if (Object.hasOwn(extensionOptions, command)) output(await extensionCommand(command, positionals[2], values, client, io.stdin));
      else if (Object.hasOwn(accountNameOptions, command)) output(await accountNameCommand(command, values, client, io.stdin));
      else if (Object.hasOwn(applicationExportOptions, command)) output(await applicationExportCommand(command, values, client, io.stdin));
      else if (Object.hasOwn(accountExportOptions, command)) output(await accountExportCommand(command, values, client, io.stdin));
      else if (Object.hasOwn(keyIssuanceOptions, command)) output(await keyIssuanceCommand(command, values, client, io.stdin));
      else if (Object.hasOwn(apiKeyOptions, command)) output(await apiKeyCommand(command, positionals[2], values, client, io.stdin));
      else if (Object.hasOwn(calendarOptions, command)) output(await calendarCommand(command, positionals[2], values, client, io.stdin));
      else if (Object.hasOwn(interviewPreparationOptions, command)) output(await interviewPreparationCommand(command, positionals[2], values, client, io.stdin));
      else if (Object.hasOwn(interviewTemplateOptions, command)) output(await interviewTemplateCommand(command, values, client, io.stdin));
      else if (Object.hasOwn(interviewRecordOptions, command)) output(await interviewRecordCommand(command, positionals[2], values, client, io.stdin));
      else if (Object.hasOwn(workspaceReadOptions, command)) output(await workspaceReadCommand(command, positionals[2], values, client));
      else if (command.startsWith('tasks ') || command.startsWith('operations ')) output(await taskCommand(command, positionals[2], values, client, io.stdin));
      else if (Object.hasOwn(pipelineCommandOptions, command)) output(await jobPipelineCommand(command, positionals[2], values, client, io.stdin));
      else if (Object.hasOwn(publicationOptions, command)) output(await publicationCommand(command,positionals[2],values,client,io.stdin));
      else if (Object.hasOwn(packageCommandOptions, command)) output(await packageCommand(command, positionals[2], values, client, io.stdin));
      else if (Object.hasOwn(compensationOptions, command)) output(await compensationCommand(command, positionals[2], values, client, io.stdin));
      else if (Object.hasOwn(profileCommandOptions, command)) output(await profileCommand(command, positionals[2], values, client, io.stdin));
      else if (Object.hasOwn(huntPageOptions, command)) output(await huntPageCommand(command, values, client, io.stdin));
      else if (Object.hasOwn(exportOptions, command)) output(await exportCommand(command, positionals[2], values, client, io.stdin));
      else if (Object.hasOwn(workspaceSearchOptions, command)) output(await workspaceSearchCommand(command, values, client));
      else if (Object.hasOwn(referenceOptions, command)) output(await referenceCommand(command, values, client));
      else if (Object.hasOwn(highlightOptions, command)) output(await highlightCommand(command, positionals[2], values, client, io.stdin));
      else if (Object.hasOwn(routineOptions, command)) output(await routineCommand(command, values, client, io.stdin));
      else if (Object.hasOwn(postingImportOptions, command)) output(await postingImportCommand(command, positionals[2], values, client, io.stdin));
      else if (Object.hasOwn(insightOptions, command)) output(await insightCommand(command, values, client, io.stdin));
      else if (Object.hasOwn(huntSettingsOptions, command)) output(await huntSettingsCommand(command, values, client, io.stdin));
      else if (Object.hasOwn(screeningInterviewOptions, command)) output(await screeningInterviewCommand(command, positionals[2], values, client, io.stdin));
      else if (Object.hasOwn(libraryOptions, command)) output(await libraryCommand(command, positionals[2], values, client, io.stdin));
      else if (Object.hasOwn(pipelineOptions, command)) output(await pipelineCommand(command, values, client, io.stdin));
      else if (Object.hasOwn(huntOptions, command)) output(await huntCommand(command, positionals[2], values, client, io.stdin));
      else if (Object.hasOwn(crmOptions, command)) output(await crmCommand(command, positionals[2], values, client, io.stdin));
      else if (Object.hasOwn(documentCommandOptions, command)) output(await documentCommand(command, positionals[2], values, client, io.stdin));
      else if (Object.hasOwn(workspaceOriginalOptions, command)) output(await workspaceOriginalCommand(command, values, client, io.stdin));
      else if (Object.hasOwn(studioOriginalOptions, command)) output(await studioOriginalCommand(command, values, client, io.stdin));
      else if (Object.hasOwn(applicationCreationOptions, command)) output(await applicationCreationCommand(command, values, client, io.stdin));
      else if (Object.hasOwn(applicationRecordFileOptions, command)) output(await applicationRecordFileCommand(command, values, client, io.stdin));
      else if (['applications workspace', 'applications record-save', 'applications record-delete', 'applications remove', 'applications set-target', 'applications check-delete', 'applications close-delete'].includes(command))
        output(await applicationRecordCommand(command, positionals[2], values, client, io.stdin));
      else if (command === 'account connected') output(await client.connectedAccount());
      else if (command === 'bookmarks get') output(await client.getBookmarks());
      else if (command === 'document-settings get') output(await client.getDocumentSettings());
      else if (command === 'document-settings update') output(await client.updateDocumentSettings(documentSettingsInput(await inputJSON(values.file as string | undefined, io.stdin, 64 * 1024))));
      else if (command === 'task-settings get') output(await client.getTaskSettings());
      else if (command.startsWith('stage-templates ')) output(await stageTemplateCommand(command, positionals[2], values, client, io.stdin));
      else if (command === 'task-settings update') output(await client.updateTaskSettings(taskPreferencesInput(await inputJSON(values.file as string | undefined, io.stdin, 64 * 1024))));
      else if (command === 'bookmarks save') output(await client.saveBookmarks(bookmarkSaveInput(await inputJSON(values.file as string | undefined, io.stdin, 512 * 1024))));
      else if (command === 'whoami' || command === 'auth status') {
        const identity = await client.identity();
        output(command === 'whoami' ? identity : { authenticated: true, origin, profile, account_id: identity.data.id, source: external ? 'ephemeral' : 'saved' });
      } else if (command === 'applications list') output(await client.listApplications({
        page: number(values.page, 1), pageSize: number(values['page-size'], 20),
        search: values.search as string | undefined, status: values.status as string | undefined,
      }));
      else if (command === 'applications get') output(await client.getApplication(positionals[2]));
      else if (command === 'applications create' || command === 'applications update') {
        if (command === 'applications create' && values.file !== undefined) {
          if (['title','company','url','source','hunt'].some(key => values[key] !== undefined)) throw new JobHuntError('invalid_input');
          const value = await inputJSON(values.file as string, io.stdin, 16 * 1024 * 1024 + 65536);
          if (!record(value) || Object.keys(value).some(key => !['data'].includes(key)) || !record(value.data) ||
              value.data.type !== 'application' || Object.keys(value.data).some(key => !['type','attributes','meta'].includes(key))) throw new JobHuntError('invalid_input');
          output(await client.createApplication(value.data.attributes as CreateApplication, value.data.meta as import('../../client/src/index.ts').ApplicationCreationMeta | undefined));
          return 0;
        }
        const attributes: Record<string, string> = {};
        for (const [flag, field] of Object.entries({ title: 'title', company: 'company_name', url: 'job_link', source: 'source', hunt: 'job_search' })) {
          if (typeof values[flag] === 'string') attributes[field] = values[flag];
        }
        output(command === 'applications create' ? await client.createApplication(attributes as unknown as CreateApplication)
          : await client.updateApplication(positionals[2], attributes as UpdateApplication, number(values.revision)));
      } else if (command === 'applications delete') {
        if (values.confirm !== positionals[2]) throw new JobHuntError('confirmation_required');
        await client.deleteApplication(positionals[2]); output({ deleted: true, id: positionals[2] });
      } else if (command === 'contacts list') output(await client.listContacts({
        page: number(values.page, 1), pageSize: number(values['page-size'], 20), companyId: values['company-id'] as string | undefined,
      }));
      else if (command === 'contacts get') output(await client.getContact(positionals[2]));
      else if (command === 'contacts create' || command === 'contacts update') {
        const attributes: Record<string, string> = {};
        for (const [flag, field] of Object.entries({ name: 'name', email: 'email', phone: 'phone', title: 'title', company: 'company', 'company-id': 'company_id', 'linkedin-url': 'linkedin_url', notes: 'notes' })) {
          if (typeof values[flag] === 'string') attributes[field] = values[flag];
        }
        output(command === 'contacts create' ? await client.createContact(attributes as CreateContact)
          : await client.updateContact(positionals[2], attributes as UpdateContact, number(values.revision)));
      } else if (command === 'contacts delete') {
        if (values.confirm !== positionals[2]) throw new JobHuntError('confirmation_required');
        await client.deleteContact(positionals[2]); output({ deleted: true, id: positionals[2] });
      }
    }
    if (command === 'mcp') {
      if (external) throw new JobHuntError('usage_error');
      // The saved sign-in is read under the store lock only when needed (not held across the connection), so other
      // commands can refresh it too; concurrent messages share one read.
      const token = sharedToken(() => store.locked(async () => {
        let session = await store.load();
        if (!session) throw new JobHuntError('authentication_required');
        if (session.expiresAt <= Date.now() + 30000) {
          session = await refresh(publicClient, session);
          try { await store.save(session); }
          catch (error) { await revoke(publicClient, session).catch(() => {}); throw error; }
        }
        return { token: session.accessToken, expiresAt: session.expiresAt };
      }));
      await runBridge({ origin, input: io.stdin, output: io.stdout, log: io.stderr, token, fetchImpl: io.fetchImpl, timeoutMs: number(values.timeout, 60000) });
      return 0;
    }
    if (external) await execute(external);
    else await store.locked(async () => {
      let session = await store.load();
      if (session && session.expiresAt <= Date.now() + 30000) {
        try { session = await refresh(publicClient, session); }
        catch (error) { if (command === 'status' && signedOut(error)) { output({ signed_in: false }); return; } throw error; }
        try { await store.save(session); }
        catch (error) { await revoke(publicClient, session).catch(() => {}); throw error; }
      }
      await execute(session ? { origin, token: session.accessToken } : undefined);
    });
    return 0;
  } catch (error) {
    const safe = error instanceof JobHuntError ? error : new JobHuntError('internal_error');
    const result = { code: safe.code, status: safe.status, request_id: safe.requestId, retry_after_seconds: safe.retryAfterSeconds,
      ...(safe.detail ? { message: safe.detail } : {}) };
    io.stderr.write(json ? JSON.stringify({ error: result }) + '\n' : `JobHunt: ${safe.code}${safe.requestId ? ` (request ${safe.requestId})` : ''}.\n`);
    return exitCode(safe);
  }
}
