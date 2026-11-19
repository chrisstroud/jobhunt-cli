import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { execFileSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { mkdtemp, mkdir, readFile, writeFile, stat } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';

const root = fileURLToPath(new URL('../', import.meta.url));
const npm = process.env.npm_execpath;
assert.ok(npm, 'Run this check with npm run pack:smoke.');
const temporary = await mkdtemp(path.join(tmpdir(), 'jobhunt-cli-package-'));
const install = path.join(temporary, 'consumer'); await mkdir(install);
const userConfig = path.join(temporary, 'user.npmrc'); const globalConfig = path.join(temporary, 'global.npmrc');
await writeFile(userConfig, ''); await writeFile(globalConfig, '');
const env = { ...process.env };
for (const key of Object.keys(env)) if (/^(?:npm_config_|NODE_AUTH_TOKEN$|NPM_TOKEN$|JOBHUNT_TOKEN(?:_ORIGIN)?$)/iu.test(key)) delete env[key];
Object.assign(env, { NPM_CONFIG_USERCONFIG: userConfig, NPM_CONFIG_GLOBALCONFIG: globalConfig,
  NPM_CONFIG_CACHE: path.join(temporary, 'cache'), NPM_CONFIG_REGISTRY: 'https://registry.npmjs.org/' });
const runNpm = (args, cwd) => execFileSync(process.execPath, [npm, ...args], { cwd, env, encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'] });
const pack = () => JSON.parse(runNpm(['pack', '--json', '--ignore-scripts', '--pack-destination', temporary], path.join(root, 'cli')))[0];
const cliManifest = JSON.parse(await readFile(path.join(root, 'cli/package.json'), 'utf8'));
const first = pack();
// The published name lives only in cli/package.json; changing it there is the whole rename.
assert.equal(first.name, cliManifest.name);
assert.equal(first.version, cliManifest.version);
assert.deepEqual(first.files.map(file => file.path).sort(), ['LICENSE', 'README.md', 'dist/jobhunt.js', 'package.json']);
assert.ok(first.size < 256 * 1024);
const artifact = path.join(temporary, first.filename);
const clientPackage = JSON.parse(runNpm(['pack', '--json', '--ignore-scripts', '--pack-destination', temporary], path.join(root, 'client')))[0];
assert.equal(clientPackage.name, '@chrisstroud/job-hunt-client');
assert.deepEqual(clientPackage.files.map(file => file.path).sort(), ['README.md', 'dist/account-export.d.ts', 'dist/account-name-parts.d.ts', 'dist/account-name.d.ts', 'dist/answer-originals.d.ts', 'dist/api-keys.d.ts', 'dist/application-creations.d.ts', 'dist/application-export.d.ts', 'dist/application-record-contracts.d.ts', 'dist/application-record-file-contracts.d.ts', 'dist/archive-contracts.d.ts', 'dist/bookmark-contracts.d.ts', 'dist/bundle-contracts.d.ts', 'dist/calendar-change-contracts.d.ts', 'dist/calendar-contracts.d.ts', 'dist/calendar-handoff-contracts.d.ts', 'dist/compensation-contracts.d.ts', 'dist/crm-contracts.d.ts', 'dist/document-contracts.d.ts', 'dist/document-creations.d.ts', 'dist/document-deletions.d.ts', 'dist/document-settings-contracts.d.ts', 'dist/editorial-contracts.d.ts', 'dist/erasure-recovery.d.ts', 'dist/export-contracts.d.ts', 'dist/extension-connections.d.ts', 'dist/extension-delivery.d.ts', 'dist/highlight-contracts.d.ts', 'dist/highlight-file-contracts.d.ts', 'dist/hunt-contracts.d.ts', 'dist/hunt-page-contracts.d.ts', 'dist/hunt-selection-contracts.d.ts', 'dist/hunt-settings-contracts.d.ts', 'dist/hunt-workspace-contracts.d.ts', 'dist/import-file-contracts.d.ts', 'dist/index.d.ts', 'dist/index.js', 'dist/insight-contracts.d.ts', 'dist/interview-contracts.d.ts', 'dist/interview-preparation-contracts.d.ts', 'dist/interview-record-contracts.d.ts', 'dist/interview-template-contracts.d.ts', 'dist/job-pipeline-contracts.d.ts', 'dist/journey-contracts.d.ts', 'dist/key-delivery.d.ts', 'dist/key-metadata.d.ts', 'dist/library-contracts.d.ts', 'dist/library-originals.d.ts', 'dist/native-json.d.ts', 'dist/package-contracts.d.ts', 'dist/package-order.d.ts', 'dist/pipeline-contracts.d.ts', 'dist/posting-import-files.d.ts', 'dist/posting-imports.d.ts', 'dist/preparation-originals.d.ts', 'dist/preview-contracts.d.ts', 'dist/private-download.d.ts', 'dist/profile-contracts.d.ts', 'dist/profile-file-contracts.d.ts', 'dist/profile-originals.d.ts', 'dist/protocol.d.ts', 'dist/publications.d.ts', 'dist/recurring-cleanup-contracts.d.ts', 'dist/reference-contracts.d.ts', 'dist/resume-import-originals.d.ts', 'dist/resume-saves.d.ts', 'dist/routine-contracts.d.ts', 'dist/screening-contracts.d.ts', 'dist/section-saves.d.ts', 'dist/stage-template-contracts.d.ts', 'dist/studio-originals.d.ts', 'dist/submission-contracts.d.ts', 'dist/submission-originals.d.ts', 'dist/task-contracts.d.ts', 'dist/task-preferences-contracts.d.ts', 'dist/toolkit-originals.d.ts', 'dist/version-files.d.ts', 'dist/version-originals.d.ts', 'dist/webhook-changes.d.ts', 'dist/webhook-fields.d.ts', 'dist/webhook-files.d.ts', 'dist/webhook-issuance.d.ts', 'dist/webhook-jobs.d.ts', 'dist/webhooks.d.ts', 'dist/workspace-originals.d.ts', 'dist/workspace-read-contracts.d.ts', 'dist/workspace-search-contracts.d.ts', 'dist/workspace-view-contracts.d.ts', 'package.json']);
const clientArtifact = path.join(temporary, clientPackage.filename);
const digest = async () => 'sha512-' + createHash('sha512').update(await readFile(artifact)).digest('base64');
const integrity = await digest(); assert.equal(first.integrity, integrity);
execFileSync(process.execPath, ['scripts/build.mjs'], { cwd: root, env, stdio: ['ignore', 'pipe', 'pipe'] });
assert.equal(pack().integrity, integrity, 'Rebuilding unchanged source changed the public artifact.');
const clientAgain = JSON.parse(runNpm(['pack', '--json', '--ignore-scripts', '--pack-destination', temporary], path.join(root, 'client')))[0];
assert.equal(clientAgain.integrity, clientPackage.integrity, 'Rebuilding unchanged source changed the typed client artifact.');
for (const [directory, packed] of [['cli', first], ['client', clientPackage]]) {
  for (const file of packed.files) {
    const bytes = await readFile(path.join(root, directory, file.path));
    assert.ok(!bytes.includes(Buffer.from('\r\n')), 'Published text files must use platform-independent LF line endings.');
  }
}
await writeFile(path.join(install, 'package.json'), JSON.stringify({ name: 'anonymous-cli-consumer', private: true, type: 'module' }));
runNpm(['install', '--ignore-scripts', '--no-audit', '--no-fund', artifact, clientArtifact], install);
// Check the shipped declarations without workspace source paths or special
// import-extension flags, and the bundled client with ordinary Node ESM.
await writeFile(path.join(install, 'typed-consumer.ts'), `
import { JobHuntClient, JobHuntError, type TaskCreateInput, type TaskSkipInput, type TaskHistory, type TaskDeleteInput, type DeletedTask, type SavedTask, type JourneyResult, type ApplicationWorkspace, type ApplicationRecordSaveInput, type HuntBookmarks, type BookmarkSaveInput, type HuntPreferencesWrite, type HuntSettings, type HuntContext, type HuntAssignment, type HuntAssignmentWrite, type PipelineConfiguration, type PipelineStageCreate } from '@chrisstroud/job-hunt-client';
const client = new JobHuntClient();
import { type HuntSelectionSave, type HuntSelectionData } from '@chrisstroud/job-hunt-client';
declare const selectionInput: HuntSelectionSave;
const selectionRead: Promise<JourneyResult<HuntSelectionData>> = client.getHuntSelection();
const selectionSaved: Promise<JourneyResult<HuntSelectionData>> = client.saveHuntSelection(selectionInput);
void [selectionRead, selectionSaved];
import { resumeImportOriginal, type ResumeImportOriginal, type ResumeImportClosure } from '@chrisstroud/job-hunt-client';
const importOriginal = null as unknown as ResumeImportOriginal;
const checkOriginal = client.checkResumeImportOriginal(importOriginal);
const closeOriginal: Promise<ResumeImportClosure> = client.closeResumeImportOriginal(importOriginal);
void [resumeImportOriginal, checkOriginal, closeOriginal];
import { prepareResumeSave, type ResumeSaveInput, type ResumeSaveOriginal, type ResumeSaveReceipt, type ResumeSaveHostFile } from '@chrisstroud/job-hunt-client';
import { prepareApplicationCreation, prepareApplicationCreationSource, type ApplicationCreationInput, type ApplicationCreationOriginal, type ApplicationCreationEvidence, type ApplicationCreationClosure } from '@chrisstroud/job-hunt-client';
declare const applicationCreationInput: ApplicationCreationInput; declare const applicationCreationOriginal: ApplicationCreationOriginal;
const applicationCreationEvidence: Promise<ApplicationCreationEvidence> = client.applicationCreations.check(applicationCreationOriginal);
const applicationCreationClosure: Promise<ApplicationCreationClosure> = client.applicationCreations.close(applicationCreationOriginal, true);
void client.applicationCreations.create(applicationCreationInput); void client.applicationCreations.createSource(new Uint8Array());
void prepareApplicationCreation(applicationCreationInput); void prepareApplicationCreationSource(new Uint8Array());
void [applicationCreationEvidence, applicationCreationClosure];
import { prepareDocumentCreation, prepareDocumentCreationSource, type DocumentCreationInput, type DocumentCreationOriginal, type DocumentCreationEvidence, type DocumentCreationClosure } from '@chrisstroud/job-hunt-client';
declare const creationInput: DocumentCreationInput; declare const creationOriginal: DocumentCreationOriginal;
const creationEvidence: Promise<DocumentCreationEvidence> = client.documentCreations.check(creationOriginal);
const creationClosure: Promise<DocumentCreationClosure> = client.documentCreations.close(creationOriginal, true);
void client.documentCreations.create(creationInput); void client.documentCreations.createSource(new Uint8Array());
void prepareDocumentCreation(creationInput); void prepareDocumentCreationSource(new Uint8Array());
void creationEvidence; void creationClosure;

import { prepareSectionSave, sectionSaveOriginalHash, type SectionSaveInput, type SectionSaveOriginal } from '@chrisstroud/job-hunt-client';
declare const sectionInput: SectionSaveInput; declare const sectionOriginal: SectionSaveOriginal;
void prepareSectionSave(sectionInput); void sectionSaveOriginalHash(sectionOriginal);
import { prepareProfilePhotoFile, prepareProfilePhotoOriginal, profilePhotoFileReceipt, type ProfilePhotoFileOriginal } from '@chrisstroud/job-hunt-client';
declare const photoOriginal: ProfilePhotoFileOriginal;
void prepareProfilePhotoOriginal(photoOriginal); void prepareProfilePhotoFile(photoOriginal, new Uint8Array());
void profilePhotoFileReceipt;
import { captureProfileIdentityOriginal, captureProfileIdentitySource, type ProfileIdentityOriginal } from '@chrisstroud/job-hunt-client';
declare const identityOriginal: ProfileIdentityOriginal;
void captureProfileIdentityOriginal(identityOriginal); void captureProfileIdentitySource;
import {captureProfilePhotoOriginal,captureProfileIdentityClosureSource,profileOriginalClosureResult,type ProfilePhotoOriginal,type ProfileOriginalClosure} from '@chrisstroud/job-hunt-client';
declare const profilePhotoOriginal:ProfilePhotoOriginal;
const closedPhoto:Promise<ProfileOriginalClosure>=client.profileOriginals.closePhoto(profilePhotoOriginal,true);
void closedPhoto; void captureProfilePhotoOriginal; void captureProfileIdentityClosureSource; void profileOriginalClosureResult;
void client.profileOriginals.closeIdentity(identityOriginal,true); void client.profileOriginals.closeIdentitySource(new Uint8Array());
void client.checkProfileIdentity(identityOriginal); void client.checkProfileIdentitySource(new Uint8Array());
declare const resumeInput: ResumeSaveInput;
declare const resumeOriginal: ResumeSaveOriginal;
declare const resumeHost: ResumeSaveHostFile;
const resumeReceipt: Promise<{ original: ResumeSaveOriginal; operation: ResumeSaveReceipt }> = client.resumeSaves.save(resumeInput);
void prepareResumeSave(resumeInput); void resumeReceipt;
const sectionClosure: Promise<import('@chrisstroud/job-hunt-client').SectionSaveClosure> = client.sectionSaves.close(sectionOriginal, true);
void sectionClosure; void client.sectionSaves.check(sectionOriginal);
declare const versionOriginal: import('@chrisstroud/job-hunt-client').DocumentVersionOriginal;
const versionOutcome: Promise<import('@chrisstroud/job-hunt-client').RecordedDocumentVersion> = client.versionOriginals.check(versionOriginal);
const versionClosure: Promise<import('@chrisstroud/job-hunt-client').DocumentVersionClosure> = client.versionOriginals.close(versionOriginal, true);
void versionOutcome; void versionClosure;

void client.resumeSaves.close(resumeOriginal, true); void client.resumeSaves.check(resumeOriginal); void client.resumeSaves.host(resumeHost);

import { type ApiKeyRecord, type ApiKeyReviewInput, type ApiKeyRevoke, type ApiKeyDirectory } from '@chrisstroud/job-hunt-client';

import { applicationDeletionOriginal, applicationDeletionRead, applicationDeletionReceipt, applicationDeletionClosure, type ApplicationDeletionOriginal, type ApplicationDeletionClosure } from '@chrisstroud/job-hunt-client';
declare const applicationDeletion: ApplicationDeletionOriginal;
void applicationDeletionOriginal(applicationDeletion); void applicationDeletionRead(applicationDeletion); void applicationDeletionReceipt; void applicationDeletionClosure;
void client.applicationDeletions.check(applicationDeletion);
const applicationDeletionClosed: Promise<ApplicationDeletionClosure> = client.applicationDeletions.close(applicationDeletion, true); void applicationDeletionClosed;

const keyID = '11111111-1111-4111-8111-111111111111';
void client.restoreDocumentSnapshot({ document_id: keyID, version_id: keyID, request_id: keyID, expected_revision: 1 });
const keyReview: ApiKeyReviewInput = { key_id: keyID, expected_account_id: 'jh_' + keyID, expected_fingerprint: 'a'.repeat(64) };
const keyRevoke: ApiKeyRevoke = { ...keyReview, request_id: keyID, review_token: 'synthetic-review', confirm_revoke: true };
const applicationExportRead: import('@chrisstroud/job-hunt-client').ApplicationExportRead = { expected_account_id: keyReview.expected_account_id, format: 'csv' };
void client.applicationExport.manifest(applicationExportRead); void client.applicationExport.download(applicationExportRead);
import { ErasureRecoveryClient, type ErasureRecoveryFile } from '@chrisstroud/job-hunt-client';
const erasureFile: ErasureRecoveryFile = { kind: 'jobhunt-erasure-recovery', version: 1, origin: 'https://jobhunt.app', receipt: 'synthetic-private-recovery-credential' };
const erasureClient = new ErasureRecoveryClient(erasureFile); void erasureClient.status; void erasureClient.retry; void erasureClient.cleanupBinding;
const readErasureBinding: () => Promise<import('@chrisstroud/job-hunt-client').ErasureCleanupBinding> = () => erasureClient.cleanupBinding(); void readErasureBinding;
void client.webhooks.list; void client.webhooks.get; void client.webhooks.deliveries; void client.webhooks.delivery; void client.webhooks.metadata.download; void client.webhooks.changes.review; void client.webhooks.changes.apply; void client.webhooks.changes.check; void client.webhooks.changes.close; void client.webhooks.issuance.review; void client.webhooks.issuance.issue; void client.webhooks.issuance.get; void client.webhooks.issuance.check; void client.webhooks.issuance.acknowledge; void client.webhooks.issuance.close;
import { webhookFieldInput, webhookFieldFile, webhookFieldHash, type WebhookFieldCreation, type WebhookFieldIssue, type WebhookFieldUpdate, type WebhookFieldOriginal } from '@chrisstroud/job-hunt-client';
const webhookFileInput: WebhookFieldCreation = { expected_account_id: keyReview.expected_account_id, request_id: keyID,
  source_sha256: 'a'.repeat(64), source_size: 2, recipient_public_key: 'synthetic-public-recipient' };
const webhookFileIssue: WebhookFieldIssue = { ...webhookFileInput, review_token: 'synthetic', confirm_create: true };
const webhookFileUpdate: WebhookFieldUpdate = { expected_account_id: keyReview.expected_account_id, request_id: keyID,
  source_sha256: 'a'.repeat(64), source_size: 2, subscription_id: keyID, expected_metadata_sha256: 'b'.repeat(64), action: 'update' };
const webhookFileOriginal: WebhookFieldOriginal = { ...webhookFileUpdate, review_token: 'synthetic', confirm_change: true };
void webhookFieldInput; void webhookFieldFile; void webhookFieldHash;
void client.webhooks.fields.reviewCreation(webhookFileInput, new Uint8Array()); void client.webhooks.fields.issue(webhookFileIssue, new Uint8Array());
void client.webhooks.fields.reviewUpdate(webhookFileUpdate, new Uint8Array()); void client.webhooks.fields.update(webhookFileOriginal, new Uint8Array());
void client.webhooks.fields.checkCreation(webhookFileIssue); void client.webhooks.fields.closeCreation(webhookFileIssue);
void client.webhooks.fields.checkUpdate(webhookFileOriginal); void client.webhooks.fields.closeUpdate(webhookFileOriginal);
import { webhookTestInput, webhookReconcileInput, webhookJobOriginalHash, type WebhookTestPlan, type WebhookTestOriginal, type WebhookReconcilePlan, type WebhookReconcileOriginal } from '@chrisstroud/job-hunt-client';
declare const webhookTestPlan: WebhookTestPlan; declare const webhookTestOriginal: WebhookTestOriginal;
declare const webhookReconcilePlan: WebhookReconcilePlan; declare const webhookReconcileOriginal: WebhookReconcileOriginal;
void webhookTestInput; void webhookReconcileInput; void webhookJobOriginalHash;
void client.webhooks.jobs.reviewTest(webhookTestPlan); void client.webhooks.jobs.sendTest(webhookTestOriginal);
void client.webhooks.jobs.checkTest(webhookTestOriginal); void client.webhooks.jobs.closeTest(webhookTestOriginal);
void client.webhooks.jobs.reviewReconciliation(webhookReconcilePlan); void client.webhooks.jobs.reconcile(webhookReconcileOriginal);
void client.webhooks.jobs.checkReconciliation(webhookReconcileOriginal); void client.webhooks.jobs.closeReconciliation(webhookReconcileOriginal);

import { PostingImportsClient, postingImportPrivateIdentity, type PostingImportStart, type PostingImportFileRead } from '@chrisstroud/job-hunt-client';
const richApplication: import('@chrisstroud/job-hunt-client').CreateApplication = {
  title: 'Synthetic role', company_name: 'Synthetic employer', resume_template_id: keyID,
  company_id: keyID, source_contact_id: keyID, job_details: { description: 'Synthetic posting' },
  resume_overrides: { summary: 'Synthetic user-authored summary' }, cover_letter: { opening: 'Synthetic opening' },
  contacts: [{ name: 'Synthetic recruiter' }], activity: [{ type: 'note', note: 'Synthetic history' }],
};
const richApplicationMeta: import('@chrisstroud/job-hunt-client').ApplicationCreationMeta = {
  import_attempt_id: keyID, import_confirmed: true, import_review_revision: 0,
};
void client.createApplication(richApplication, richApplicationMeta);
const postingOriginal: PostingImportStart = { request_key: 'synthetic-original', url: 'https://example.test/role' };
const postingFile: PostingImportFileRead = { expected_account_id: 'jh_' + keyID, attempt_id: keyID };
void PostingImportsClient; void postingImportPrivateIdentity; void client.postingImports.start(postingOriginal);
void client.postingImports.list; void client.postingImports.get; void client.postingImports.saveDraft; void client.postingImports.open;
void client.postingImports.reconcile; void client.postingImports.cancelRequest; void client.postingImports.cancel;
void client.postingImports.stop({ attempt_id: keyID });
void client.postingImports.files.manifest(postingFile); void client.postingImports.files.chunk; void client.postingImports.files.download;
const keyRecord: Promise<JourneyResult<ApiKeyRecord>> = client.apiKeys.get({ key_id: keyID });
const keyDirectory: Promise<JourneyResult<ApiKeyDirectory>> = client.apiKeys.list();
void keyRecord; void keyDirectory; void client.apiKeys.reviewRevocation(keyReview); void client.apiKeys.revoke(keyRevoke);
void client.apiKeys.checkRevocation({ request_id: keyID, expected_account_id: keyReview.expected_account_id });
void client.apiKeys.closeRevocation({ original: keyRevoke, confirm_close: true });
import { createApiKeyRecipient, decryptApiKeyDelivery, type ApiKeyIssue } from '@chrisstroud/job-hunt-client';
const issue: ApiKeyIssue = { expected_account_id: keyReview.expected_account_id, request_id: keyID, attributes: { name: 'Synthetic key', scopes: [] }, recipient_public_key: 'synthetic-public-key', review_token: 'synthetic', confirm_create: true };
void createApiKeyRecipient; void decryptApiKeyDelivery; void client.apiKeys.issuance.issue(issue);
import { createExtensionRecipient, decryptExtensionDelivery, type ExtensionIssue } from '@chrisstroud/job-hunt-client';
const extensionIssue: ExtensionIssue = { expected_account_id: keyReview.expected_account_id, request_id: keyID, device_name: 'Synthetic browser', recipient_public_key: 'synthetic-public-key', review_token: 'synthetic', confirm_create: true };
void createExtensionRecipient; void decryptExtensionDelivery; void client.extensions.issuance.review(extensionIssue); void client.extensions.issuance.issue(extensionIssue);
void client.extensions.issuance.check(extensionIssue); void client.extensions.issuance.close(extensionIssue);

import { type ApiKeyFileIssue, apiKeyAttributeFile } from '@chrisstroud/job-hunt-client';
const fileIssue: ApiKeyFileIssue = { expected_account_id: issue.expected_account_id, request_id: issue.request_id, recipient_public_key: issue.recipient_public_key,
  source_sha256: 'a'.repeat(64), source_size: 2, review_token: 'synthetic', confirm_create: true };
void client.apiKeys.issuance.issueFile(fileIssue, new Uint8Array()); void apiKeyAttributeFile;
import { type ApiKeySummary, type ApiKeyScopesFile } from '@chrisstroud/job-hunt-client';
void client.apiKeys.metadata.list(); void client.apiKeys.metadata.get({ key_id: keyID }); void client.apiKeys.metadata.downloadScopes({ key_id: keyID });
const summaryType: ApiKeySummary | null = null; const scopesFile: ApiKeyScopesFile | null = null; void summaryType; void scopesFile;
import { type ApplicationRecordFileIntent, type ApplicationRecordFileManifest, type ApplicationRecordFilePage, type ApplicationRecordHostFile } from '@chrisstroud/job-hunt-client';
const recordID = '11111111-1111-4111-8111-111111111111';
const recordTarget = { application_id: recordID, kind: 'note' as const, record_id: recordID };
const recordIntent: ApplicationRecordFileIntent = { application_id: recordID, kind: 'note', expected_revision: 1, request_id: recordID, expected_account_id: 'jh_' + recordID };
const recordHost: ApplicationRecordHostFile = { ...recordIntent, source_size: 2, source_sha256: 'a'.repeat(64), file: { file_id: 'synthetic', download_url: 'https://files.example.test/synthetic' } };
const recordManifest: Promise<JourneyResult<ApplicationRecordFileManifest>> = client.getApplicationRecordFile(recordTarget);
const recordFiles: Promise<JourneyResult<ApplicationRecordFilePage>> = client.listApplicationRecordFiles({ application_id: recordID, kind: 'note' });
void recordManifest; void recordFiles; void client.downloadApplicationRecordFile(recordTarget);
void client.saveApplicationRecordFieldsFile(recordIntent, new Uint8Array([123,125])); void client.saveApplicationRecordFieldsHostFile(recordHost);
import { type HighlightFileIntent, type HighlightHostFile, type HighlightFileManifest, type HighlightFilePage } from '@chrisstroud/job-hunt-client';
const highlightID = '11111111-1111-4111-8111-111111111111';
const highlightIntent: HighlightFileIntent = { request_id: highlightID, expected_account_id: 'jh_' + highlightID, action: 'create' };
const highlightHost: HighlightHostFile = { ...highlightIntent, source_size: 2, source_sha256: 'a'.repeat(64), file: { file_id: 'synthetic', download_url: 'https://files.example.test/synthetic' } };
const highlightFiles: Promise<JourneyResult<HighlightFilePage>> = client.listHighlightRecordFiles();
const highlightManifest: Promise<JourneyResult<HighlightFileManifest>> = client.getHighlightRecordFile(highlightID);
void highlightFiles; void highlightManifest; void client.downloadHighlightRecordFile(highlightID);
void client.saveHighlightFieldsFile(highlightIntent, new Uint8Array([123,125])); void client.saveHighlightFieldsHostFile(highlightHost);
import { type ExtensionConnection, type ExtensionRevoke, type ExtensionDirectory } from '@chrisstroud/job-hunt-client';
const extensionOriginal: ExtensionRevoke = { token_id: keyID, expected_account_id: 'jh_' + keyID, expected_fingerprint: 'a'.repeat(64), request_id: keyID, review_token: 'synthetic', confirm_revoke: true };
const extensions: Promise<JourneyResult<ExtensionDirectory>> = client.extensions.list();
const extension: Promise<JourneyResult<ExtensionConnection>> = client.extensions.get({ token_id: keyID });
void extensions; void extension; void client.extensions.review({ token_id: keyID, expected_account_id: extensionOriginal.expected_account_id, expected_fingerprint: extensionOriginal.expected_fingerprint }); void client.extensions.revoke(extensionOriginal);
void client.extensions.check(extensionOriginal); void client.extensions.close(extensionOriginal);
import { type AccountName, type AccountNameWrite, type AccountNameResolution } from '@chrisstroud/job-hunt-client';
const nameOriginal: AccountNameWrite = { expected_account_id: 'jh_11111111-1111-4111-8111-111111111111', request_id: '22222222-2222-4222-8222-222222222222', expected_name: 'Synthetic', name: 'Synthetic updated' };
import { type AccountExportManifest, type AccountExportRead } from '@chrisstroud/job-hunt-client';
const accountExportRead: AccountExportRead = { expected_account_id: 'jh_' + keyID, format: 'zip' };
const accountExportManifest: Promise<JourneyResult<AccountExportManifest>> = client.accountExport.manifest(accountExportRead);
void accountExportManifest; void client.accountExport.download(accountExportRead);
const nameRead: Promise<JourneyResult<AccountName>> = client.accountName.get();
const nameClose: Promise<JourneyResult<AccountNameResolution>> = client.accountName.close(nameOriginal);
void nameRead; void nameClose; void client.accountName.save(nameOriginal); void client.accountName.check(nameOriginal);
import { type CalendarHandoffState, type CalendarHandoffs, type CalendarHandoffReview, type ResumeCalendarHandoff, type ResolveCalendarHandoff } from '@chrisstroud/job-hunt-client';
const handoffID = '11111111-1111-4111-8111-111111111111';
const handoffRead: Promise<JourneyResult<CalendarHandoffState>> = client.getCalendarHandoff({ handoff_id: handoffID });
const handoffList: Promise<JourneyResult<CalendarHandoffs>> = client.listCalendarHandoffs({ include_admitted: true });
const handoffReview: Promise<JourneyResult<CalendarHandoffReview>> = client.reviewCalendarHandoff({ handoff_id: handoffID, expected_fingerprint: 'a'.repeat(64) });
const handoffResume: ResumeCalendarHandoff = { handoff_id: handoffID, request_id: handoffID, expected_account_id: 'jh_' + handoffID, expected_fingerprint: 'a'.repeat(64), review_token: 'synthetic-review' };
const handoffLeave: ResolveCalendarHandoff = { handoff_id: handoffID, request_id: handoffID, expected_account_id: 'jh_' + handoffID, expected_fingerprint: 'a'.repeat(64), confirm_leave_unchanged: true };
void handoffRead; void handoffList; void handoffReview; void client.resumeCalendarHandoff(handoffResume); void client.resolveCalendarHandoff(handoffLeave);
import { type CompensationManifest, type CompensationPrepare, type CompensationDraft, type CompensationDraftWrite } from '@chrisstroud/job-hunt-client';
const compensationRead: Promise<JourneyResult<CompensationManifest>> = client.getApplicationCompensation({ application_id: '11111111-1111-4111-8111-111111111111' });
const compensationPrepare: CompensationPrepare = { request_id: '11111111-1111-4111-8111-111111111111', application_id: '11111111-1111-4111-8111-111111111111', expected_revision: 1, expected_sha256: 'a'.repeat(64), source_sha256: 'b'.repeat(64), size_bytes: 2 };
const compensationDraft: Promise<JourneyResult<CompensationDraft>> = client.prepareCompensationReplacement(compensationPrepare);
const compensationCommit: CompensationDraftWrite = { request_id: compensationPrepare.request_id, application_id: compensationPrepare.application_id, draft_id: compensationPrepare.request_id };
void compensationRead; void compensationDraft; void client.commitCompensationReplacement(compensationCommit);
import { type WorkspaceView, type WorkspaceViewRead } from '@chrisstroud/job-hunt-client';
const workspaceInput: WorkspaceViewRead = { page: 1, include_application_records: true };
const fullWorkspace: Promise<JourneyResult<WorkspaceView>> = client.getWorkspaceView(workspaceInput);
void fullWorkspace;

const create: TaskCreateInput = { title: 'Synthetic', request_id: '11111111-1111-4111-8111-111111111111' };
const result: Promise<JourneyResult<SavedTask>> = client.createTask(create);
import { type ToolkitOriginal, type ToolkitClosure } from '@chrisstroud/job-hunt-client';
const toolkitOriginal: ToolkitOriginal = { expected_account_id: 'jh_' + create.request_id, operation_name: 'select_application_documents_v2', original: { app_slug: 'synthetic', request_id: create.request_id, revision: 'a'.repeat(64), expected_revision: 1, package_id: create.request_id } };
const toolkitClosed: Promise<ToolkitClosure> = client.closeApplicationDocumentsOriginal(toolkitOriginal);
import { type AnswerOriginal, type AnswerClosure } from '@chrisstroud/job-hunt-client';
import { type SubmissionOriginal, type SubmissionClosure } from '@chrisstroud/job-hunt-client';
const reportOriginal: SubmissionOriginal = {expected_account_id:'jh_' + create.request_id, original:{application_id:create.request_id, expected_revision:1, request_id:create.request_id, date:'2026-10-01',user_confirmed:true,document_knowledge:'unknown'}};
const reportClosure: Promise<SubmissionClosure> = client.closeSubmissionOriginal(reportOriginal);
import {type PublicationOriginal,type PublicationClosure,preparePublicationOriginal} from '@chrisstroud/job-hunt-client';
declare const publication:PublicationOriginal;
void client.getPublication('document',create.request_id);void client.changePublication(publication);
void client.checkPublicationOriginal(publication);const publicationClosed:Promise<PublicationClosure>=client.closePublicationOriginal(publication);
void publicationClosed;void preparePublicationOriginal;
import {type PreparationOriginal,type PreparationClosure} from '@chrisstroud/job-hunt-client';
const preparationOriginal:PreparationOriginal={expected_account_id:'jh_'+create.request_id,original:{application_id:create.request_id,expected_revision:1,request_id:create.request_id,workflow_revision:'a'.repeat(64),fingerprint:'b'.repeat(64),documents:[{document_id:create.request_id,revision:1}]}};
const preparationClosed:Promise<PreparationClosure>=client.closePreparationOriginal(preparationOriginal);
void preparationClosed;
void client.checkPreparationOriginal(preparationOriginal);
void reportClosure;
const answersOriginal: AnswerOriginal = {expected_account_id: 'jh_' + create.request_id, original: {application_id:create.request_id, expected_revision:1, request_id:create.request_id, answers:[]}};
const answersClosed: Promise<AnswerClosure> = client.closeScreeningAnswersOriginal(answersOriginal);
void answersClosed;
void toolkitClosed;
const error: Error = new JobHuntError('synthetic');
const workspace: Promise<JourneyResult<ApplicationWorkspace>> = client.applicationWorkspace({ application_id: create.request_id });
const record: ApplicationRecordSaveInput = { application_id: create.request_id, expected_revision: 1, request_id: create.request_id, title: 'Synthetic', kind: 'note' };
void result; void error; void workspace; void record;
const settings: Promise<HuntSettings> = client.getHuntSettings();
const preferenceInput: HuntPreferencesWrite = { request_id: create.request_id, expected_revision: 1, set: { quiet: false, follow_up_days: 0 }, clear_fields: [] };
const savedPreferences = client.updateHuntPreferences(preferenceInput);
const context: Promise<JourneyResult<HuntContext>> = client.getHuntContext();
void settings; void savedPreferences; void context;
const assignment: Promise<JourneyResult<HuntAssignment>> = client.getHuntAssignment({ search_id: create.request_id });
const assignmentInput: HuntAssignmentWrite = { request_id: create.request_id, search_id: create.request_id, scope: 'all', expected_fingerprint: 'a'.repeat(64), expected_application_count: 0, expected_moving_count: 0 };
const assigned: Promise<JourneyResult<HuntAssignment>> = client.assignAllHuntApplications(assignmentInput);
void assignment; void assigned;
const pipeline: Promise<JourneyResult<PipelineConfiguration>> = client.getPipelineConfiguration();
const createStage: PipelineStageCreate = { request_id: create.request_id, expected_fingerprint: 'a'.repeat(64), name: 'Synthetic stage', position: 0 };
void pipeline; void client.createPipelineStage(createStage);
import { type ScreeningAnswers, type ScreeningAnswersSave, type InterviewPage, type InterviewStatusWrite } from '@chrisstroud/job-hunt-client';
const screening: Promise<JourneyResult<ScreeningAnswers>> = client.getScreeningAnswers({ application_id: create.request_id });
const screeningWrite: ScreeningAnswersSave = { request_id: create.request_id, application_id: create.request_id, expected_revision: 1, answers: [] };
const interviewPage: Promise<JourneyResult<InterviewPage>> = client.listInterviews();
const interviewWrite: InterviewStatusWrite = { request_id: create.request_id, interview_id: create.request_id, expected_revision: 1, expected_fingerprint: 'a'.repeat(64), status: 'No_Show' };
void screening; void client.saveScreeningAnswers(screeningWrite); void interviewPage; void client.setInterviewStatus(interviewWrite);
import { type LibraryPackagePage, type LibraryPackageAdd, type LibraryPackageDelete, type DocumentUsagePage } from '@chrisstroud/job-hunt-client';
const masterPackages: Promise<JourneyResult<LibraryPackagePage>> = client.listLibraryPackages();
const masterAdd: LibraryPackageAdd = { request_id: create.request_id, document_id: create.request_id, expected_revision: 1, name: 'Synthetic letter', archetype: 'letter' };
const masterDelete: LibraryPackageDelete = { request_id: create.request_id, document_id: create.request_id, expected_revision: 1, expected_document_ids: [create.request_id] };
const usage: Promise<JourneyResult<DocumentUsagePage>> = client.documentUsage({ document_id: create.request_id });
void masterPackages; void client.addLibraryDocument(masterAdd); void client.deleteLibraryPackage(masterDelete); void usage;
import { type LibraryDocumentsPage, type DocumentArchiveState, type DocumentArchiveWrite, type DocumentArchiveSaved } from '@chrisstroud/job-hunt-client';
const archiveReview: Promise<JourneyResult<DocumentArchiveState>> = client.documentArchiveState({ document_id: create.request_id });
const archiveList: Promise<JourneyResult<LibraryDocumentsPage>> = client.listLibraryDocuments({ status: 'archived' });
const archiveInput: DocumentArchiveWrite = { request_id: create.request_id, document_id: create.request_id, expected_anchor_id: create.request_id, expected_fingerprint: 'a'.repeat(64) };
const archived: Promise<JourneyResult<DocumentArchiveSaved>> = client.archiveDocumentPackage(archiveInput);
void archiveReview; void archiveList; void archived; void client.unarchiveDocumentPackage(archiveInput);
const deletion: TaskDeleteInput = { task_id: create.request_id, request_id: create.request_id, expected_revision: 1 };
const removed: Promise<JourneyResult<DeletedTask>> = client.deleteTask(deletion);
void removed;
const bookmarkInput: BookmarkSaveInput = { request_id: create.request_id, expected_revision: 0, bookmarks: { version: 1, revision: 1, items: [] } };
const bookmarkRead: Promise<JourneyResult<HuntBookmarks>> = client.getBookmarks();
const bookmarkWrite: Promise<JourneyResult<HuntBookmarks>> = client.saveBookmarks(bookmarkInput);
void bookmarkRead; void bookmarkWrite;
const skip: TaskSkipInput = { ...deletion, occurrence_date: '2026-10-19', expected_fingerprint: 'a'.repeat(64) };
const skipped: Promise<JourneyResult<SavedTask>> = client.skipTaskOccurrence(skip);
const history: Promise<JourneyResult<TaskHistory>> = client.taskHistory({ task_id: create.request_id, limit: 30 });
void skipped; void history;
import { type TaskPreferencesData, type TaskPreferencesWrite } from '@chrisstroud/job-hunt-client';
const preferences: TaskPreferencesWrite = { request_id: create.request_id, expected_fingerprint: 'a'.repeat(64), patch: { default_due_time: null, hide_completed_tasks: true } };
const preferenceRead: Promise<JourneyResult<TaskPreferencesData>> = client.getTaskSettings();
const preferenceWrite: Promise<JourneyResult<TaskPreferencesData>> = client.updateTaskSettings(preferences);
void preferenceRead; void preferenceWrite;
import { type StageTemplate, type TemplateRemove, type TemplateRemoval, type TemplatePage } from '@chrisstroud/job-hunt-client';
const templateRead: Promise<JourneyResult<StageTemplate>> = client.getStageTemplate(create.request_id);
const templateList: Promise<JourneyResult<TemplatePage>> = client.listStageTemplates({ include_detached: true });
const templateRemoval: TemplateRemove = { request_id: create.request_id, template_id: create.request_id, expected_fingerprint: 'a'.repeat(64), disposition: 'preserve_assignments', confirmed: true };
const templateRemove: Promise<JourneyResult<TemplateRemoval>> = client.removeStageTemplate(templateRemoval);
void templateRead; void templateList; void templateRemove;
const cleanupRead = client.previewRecurringCleanup({ occurrence_date: '2026-10-18' });
const cleanupWrite = client.reopenRecurringCompletions({ request_id: create.request_id, occurrence_date: '2026-10-18',
  targets: [{ task_id: create.request_id, expected_fingerprint: 'a'.repeat(64) }], confirmed: true });
void cleanupRead; void cleanupWrite;
import { type CaptureJobDetails, type CaptureJobURL, type CaptureTargetCompany, type SavedJob, type RecordSubmission,
  type Submission, type SubmissionHistory, type SubmissionOptions, type PipelineStages } from '@chrisstroud/job-hunt-client';
const captureInput: CaptureJobDetails = { request_id: create.request_id, title: 'Synthetic role', company: 'Synthetic company' };
const urlInput: CaptureJobURL = { request_id: create.request_id, url: 'https://jobs.example.invalid/example' };
const targetInput: CaptureTargetCompany = { request_id: create.request_id, name: 'Synthetic company' };
const captures: Promise<JourneyResult<SavedJob>>[] = [client.saveJobDetails(captureInput), client.saveJobURL(urlInput), client.saveTargetCompany(targetInput),
  client.getSavedJob(create.request_id), client.editJobDetails({ request_id: create.request_id, application_id: create.request_id, expected_revision: 1, posting_text: null }),
  client.moveJobStage({ request_id: create.request_id, application_id: create.request_id, expected_revision: 1, stage_id: create.request_id })];
const reportInput: RecordSubmission = { request_id: create.request_id, application_id: create.request_id, expected_revision: 1,
  date: '2026-10-19', user_confirmed: true, document_knowledge: 'unknown' };
const submission: Promise<JourneyResult<Submission>> = client.recordSubmission(reportInput);
const submissions: Promise<JourneyResult<SubmissionHistory>> = client.listSubmissions({ application_id: create.request_id });
const submissionOptions: Promise<JourneyResult<SubmissionOptions>> = client.submissionOptions({ application_id: create.request_id });
const stages: Promise<PipelineStages> = client.listPipelineStages({ page: 1, pageSize: 100 });
void captures; void submission; void submissions; void submissionOptions; void stages;
import { type CareerDocument, type CreateCareerDocument, type DocumentLibraryPage, type DocumentLibraryResult,
  type DocumentSummary, type DocumentRevisions, type ResumeImport, type ConfirmResumeImport } from '@chrisstroud/job-hunt-client';
const createDocument: CreateCareerDocument = { request_id: create.request_id, name: 'Synthetic master', content: { sections: [] } };
const document: Promise<JourneyResult<CareerDocument>> = client.createDocument(createDocument);
const library: Promise<DocumentLibraryPage> = client.listDocuments();
const documentRead: Promise<JourneyResult<CareerDocument>> = client.getDocument(create.request_id);
const documentEdit: Promise<JourneyResult<CareerDocument>> = client.updateDocumentSection({ request_id: create.request_id,
  template_slug: 'synthetic', section: 'summary', expected_revision: 1, data: { name: 'summary', text: 'Draft', entries: [] } });
const documentIntent = { request_id: create.request_id, document_id: create.request_id, expected_revision: 1 };
const restored: Promise<JourneyResult<CareerDocument>> = client.restoreDocument({ ...documentIntent, version_id: create.request_id });
const checkpoint: Promise<JourneyResult<DocumentSummary>> = client.checkpointDocument({ ...documentIntent, name: 'Checkpoint' });
const revisions: Promise<JourneyResult<DocumentRevisions>> = client.documentRevisions({ document_id: create.request_id });
const libraryChanges: Promise<JourneyResult<DocumentLibraryResult>>[] = [client.renameDocument({ ...documentIntent, name: 'Renamed' }),
  client.duplicateDocument({ ...documentIntent, name: 'Copy' }), client.setDefaultDocument(documentIntent), client.deleteDocument(documentIntent)];
const imported: Promise<JourneyResult<ResumeImport>> = client.importResumeText({ request_id: create.request_id, text: 'Synthetic source' });
const importRead: Promise<JourneyResult<ResumeImport>> = client.getResumeImport(create.request_id);
const confirmation: ConfirmResumeImport = { request_id: create.request_id, import_id: create.request_id, expected_revision: 1,
  accepted_facts: [{ field: '/summary', value: 'Synthetic', state: 'confirmed', sources: [{ kind: 'user_statement' }] }] };
const confirmed: Promise<JourneyResult<CareerDocument>> = client.confirmResumeImport(confirmation);
const workflow = client.getApplicationDocuments('synthetic-role');
const choices = client.listApplicationResumeChoices({ app_slug: 'synthetic-role' });
const preparation = client.prepareApplicationPackage({ request_id: create.request_id, application_id: create.request_id,
  expected_revision: 1, workflow_revision: 'a'.repeat(64), fingerprint: 'b'.repeat(64), documents: [{ document_id: create.request_id, revision: 1 }] });
const download: Promise<{ bytes: Uint8Array; size_bytes: number; sha256: string; package_id: string; version_id: string }> =
  client.downloadPreparedDocument({ package_id: create.request_id, version_id: create.request_id });
const fileImport: Promise<JourneyResult<ResumeImport>> = client.uploadResumeFile({ request_id: create.request_id }, new Uint8Array());
const hostFileImport: Promise<JourneyResult<ResumeImport>> = client.importResumeHostFile({ request_id: create.request_id,
  file: { download_url: 'https://files.example.test/synthetic', file_id: 'synthetic' } });
const directUpload = client.prepareResumeFileUpload({ request_id: create.request_id, size_bytes: 20,
  sha256: 'a'.repeat(64), media_type: 'application/pdf' });
const uploadedImport: Promise<JourneyResult<ResumeImport>> = client.importUploadedResume({ request_id: create.request_id, upload_id: create.request_id });
void directUpload; void uploadedImport;
import { type ProfileSave, type ContactProfile, type ProfileSaved, type ProfilePage, type ProfileLinks } from '@chrisstroud/job-hunt-client';
const profileIntent: ProfileSave = { request_id: create.request_id, name: 'Synthetic identity', personal_data: { first_name: 'Synthetic' },
  expected_default_profile_id: null, is_default: false, acknowledge_linked_updates: true };
const profilesRead: Promise<JourneyResult<ProfilePage>> = client.listProfiles({ page: 1 });
const profileRead: Promise<JourneyResult<ContactProfile>> = client.getProfile(create.request_id);
const profileSaved: Promise<JourneyResult<ProfileSaved>> = client.saveProfile(profileIntent);
const profileLinks: Promise<JourneyResult<ProfileLinks>> = client.listProfilePackages({ profile_id: create.request_id });
const profileDefault = client.setDefaultProfile({ request_id: create.request_id, profile_id: create.request_id, expected_updated_at: null, expected_default_profile_id: null });
const profileDelete = client.deleteProfile({ request_id: create.request_id, profile_id: create.request_id, expected_updated_at: null,
  expected_default_profile_id: null, expected_usage_revision: 'a'.repeat(64), confirm_delete: true, acknowledge_retained_copies: true });
const profileLink = client.linkProfile({ ...documentIntent, profile_id: create.request_id, expected_profile_updated_at: null, acknowledge_linked_updates: true });
const profileBulk = client.linkProfilePackages({ request_id: create.request_id, profile_id: create.request_id, expected_profile_updated_at: null,
  documents: [{ document_id: create.request_id, expected_revision: 1 }], acknowledge_linked_updates: true });
const profileUnlink = client.unlinkProfile({ ...documentIntent, expected_profile_id: create.request_id, expected_profile_updated_at: null, acknowledge_retained_copies: true });
const profilePhoto = client.getProfilePhoto(create.request_id);
const profilePhotoSave = client.saveProfilePhoto({ request_id: create.request_id, profile_id: create.request_id,
  expected_updated_at: null, acknowledge_linked_updates: true }, new Uint8Array());
const profilePhotoDownload = client.downloadProfilePhoto(create.request_id);
void profilesRead; void profileRead; void profileSaved; void profileLinks; void profileDefault; void profileDelete;
import { type HuntPageWorkspace, type HuntPagePreview } from '@chrisstroud/job-hunt-client';
const huntRead: Promise<JourneyResult<HuntPageWorkspace>> = client.getHuntPage({ page: 2 });
const huntSave = client.saveHuntPage({ request_id: create.request_id, expected_revision: 0,
  draft: { source_id: null, photo_id: null, handle: 'synthetic-person', links: [], sidebar_palette: 'steel' } });
const huntMedia = { expected_revision: 1, expected_preview_revision: 'a'.repeat(64) };
const huntVisibility = client.setHuntPageVisibility({ request_id: create.request_id, ...huntMedia, visibility: 'private' });
const huntPreview: Promise<JourneyResult<HuntPagePreview>> = client.previewHuntPage({ ...huntMedia, page: 1 });
const journal = client.listHighlights({ search: 'supplied', tags: ['review'], sort: 'date_asc' });
const journalRecord = client.getHighlight(create.request_id);
const workspaceMatches = client.searchWorkspace({ query: 'supplied', kind: 'Document' });
const workspaceLocation = client.resolveWorkspaceLocation({ kind: 'document', identifier: 'supplied-slug' });
void workspaceMatches; void workspaceLocation;
import { type RecordReferenceMatches, type SavedRecordReference } from '@chrisstroud/job-hunt-client';
const referenceMatches: Promise<RecordReferenceMatches> = client.findRecordReferences({ query: 'Synthetic' });
const savedReference: Promise<JourneyResult<SavedRecordReference>> = client.getRecordReference({ uri: 'jobhunt://documents/' + create.request_id + '?revision=1' });
void referenceMatches; void savedReference;
const journalOptions = client.getHighlightOptions();
const journalChoices = client.getHighlightChoices({ company_page: 1, role_page: 2 });
void journalChoices;
const journalSave = client.saveHighlight({ request_id: create.request_id, action: 'create', fields: { title: 'Supplied fact' } });
const journalExport = client.downloadHighlights({ format: 'plain' });
const completeJournalExport = client.downloadCompleteHighlights({ format: 'plain' });
const journalManifest = client.getHighlightExportManifest({ format: 'plain' });
const journalChunk = client.getHighlightExportChunk({ format: 'plain', expected_sha256: 'a'.repeat(64), chunk_index: 1 });
void completeJournalExport; void journalManifest; void journalChunk;
void journal; void journalRecord; void journalOptions; void journalSave; void journalExport;
const workActivity = client.listWorkActivity({ page: 1 });
const activityCounts = client.getActivityCounts({ today: '2026-10-21', tz_offset: -420 });
const analytics = client.getAnalytics({ days: 30 });
const careerFacts = client.getCareerFacts();
const inbox = client.listNotifications({ page: 1 });
const inboxSaved = client.markNotificationsRead({ request_id: create.request_id, action: 'read_all' });
void workActivity; void activityCounts; void analytics; void careerFacts; void inbox; void inboxSaved;
const documentImage = client.downloadDocumentPreview({ document_id: create.request_id, expected_revision: 1 });
const preparedImage = client.downloadPreparedDocumentPreview({ application_id: create.request_id, version_id: create.request_id, expected_revision: 1, expected_sha256: 'a'.repeat(64) });
void documentImage; void preparedImage;
const huntImage = client.downloadHuntPagePreview(huntMedia);
const huntPhoto = client.getHuntPagePhoto(huntMedia);
const huntPhotoBytes = client.downloadHuntPagePhoto(huntMedia);
const huntPhotoSave = client.saveHuntPagePhoto({ request_id: create.request_id, ...huntMedia }, new Uint8Array());
import { type ExportState, type ExportSource } from '@chrisstroud/job-hunt-client';
const exportInput = { document_id: create.request_id };
const exportSource: Promise<JourneyResult<ExportSource>> = client.getDocumentExportSource(exportInput);
const exportPage = client.getHuntPageExportSource(huntMedia);
const exportIntent = { request_id: create.request_id, expected_revision: 1, expected_fingerprint: 'a'.repeat(64), ...exportInput };
const exportPrepared: Promise<JourneyResult<ExportState>> = client.prepareDocumentExport(exportIntent);
const exportPagePrepared = client.prepareHuntPageExport({ ...exportIntent, ...huntMedia, expected_document_revision: 1 });
const exportRead = client.getDocumentExport({ export_id: create.request_id });
const exportBytes = client.downloadDocumentExport({ export_id: create.request_id });
const exportCancelled = client.cancelDocumentExport({ request_id: create.request_id, export_id: create.request_id, expected_account_id: 'jh_' + create.request_id, confirm_cancel: true });
void exportSource; void exportPage; void exportPrepared; void exportPagePrepared; void exportRead; void exportBytes; void exportCancelled;
import { type BundleSelection, type BundleSource, type BundleState } from '@chrisstroud/job-hunt-client';
const bundleSelection: BundleSelection = { source: 'document', document_id: create.request_id, documents: ['resume', 'references'], format: 'zip' };
const bundleSource: Promise<JourneyResult<BundleSource>> = client.getDocumentBundleSource({ selection: bundleSelection });
const bundlePrepared: Promise<JourneyResult<BundleState>> = client.prepareDocumentBundle({ selection: bundleSelection,
  request_id: create.request_id, expected_sources: [{ id: create.request_id, revision: 1 }], expected_fingerprint: 'a'.repeat(64) });
const bundleRead = client.getDocumentBundle({ export_id: create.request_id });
const bundleBytes = client.downloadDocumentBundle({ export_id: create.request_id });
const bundleCancelled = client.cancelDocumentBundle({ request_id: create.request_id, export_id: create.request_id, expected_account_id: 'jh_' + create.request_id, confirm_cancel: true });
void bundleSource; void bundlePrepared; void bundleRead; void bundleBytes; void bundleCancelled;
const independentPackage: BundleSelection = { source: 'package', document_ids: [create.request_id], format: 'zip', page_size: 'a4' };
const independentSource: Promise<JourneyResult<BundleSource>> = client.getDocumentBundleSource({ selection: independentPackage });
void independentSource;
import { type CrmMutation, type CrmData, type CrmPage } from '@chrisstroud/job-hunt-client';
const crmIntent: CrmMutation = { kind: 'company', action: 'create', request_id: create.request_id, fields: { name: 'Synthetic company' } };
const crmSaved: Promise<JourneyResult<CrmData>> = client.saveCrmCompany(crmIntent);
const crmRead: Promise<JourneyResult<CrmData>> = client.getCrm({ kind: 'company', entity_id: create.request_id });
const crmPage: Promise<JourneyResult<CrmPage>> = client.listCrm({ kind: 'company', page: 1 });
void crmSaved; void crmRead; void crmPage;
const huntRecords = client.listHunts({ page: 2 });
const huntRecord = client.getHunt({ search_id: create.request_id });
const createdHunt = client.createHunt({ request_id: create.request_id, name: 'Synthetic hunt' });
const currentHunt = client.setCurrentHunt({ request_id: create.request_id, search_id: create.request_id, expected_revision: 1, expected_current_ids: [] });
const removedHunt = client.deleteHunt({ request_id: create.request_id, search_id: create.request_id, expected_revision: 1, expected_application_count: 0 });
const initializedStages = client.initializePipeline({ request_id: create.request_id });
void huntRecords; void huntRecord; void createdHunt; void currentHunt; void removedHunt; void initializedStages;
const huntSummary = client.getHuntSummary({ search_id: create.request_id });
const huntPartial = client.updateHunt({ search_id: create.request_id, request_id: create.request_id, expected_revision: 1, preferences: { locations: [] } });
const huntRenamed = client.renameHunt({ search_id: create.request_id, request_id: create.request_id, expected_revision: 1, name: 'Synthetic rename' });
void huntSummary; void huntPartial; void huntRenamed;


import { type TodayWorkspace, type SearchRoutine, type SearchRoutineRecord, type RoutineWrite, type RoutineSaved } from '@chrisstroud/job-hunt-client';
const todayAgenda: Promise<JourneyResult<TodayWorkspace>> = client.getTodayAgenda({ today: '2026-10-21' });
const searchRoutine: Promise<JourneyResult<SearchRoutine>> = client.getSearchRoutine({ links_page: 2 });
const routineRecord: Promise<JourneyResult<SearchRoutineRecord>> = client.getSearchRoutineRecord({ kind: 'aggregator', entity_id: 'Custom' });
const routineIntent: RoutineWrite = { request_id: create.request_id, expected_fingerprint: 'a'.repeat(64), kind: 'link', action: 'create', fields: { label: 'Synthetic board', url: 'https://example.test/jobs' } };
const routineSaved: Promise<JourneyResult<RoutineSaved>> = client.changeSearchRoutine(routineIntent);
void todayAgenda; void searchRoutine; void routineRecord; void routineSaved;
import { type WorkspaceTaskPage, type TaskDescriptionManifest, type TaskDescriptionChunk, type ApplicationChoices } from '@chrisstroud/job-hunt-client';
import { type ProfilePersonal, type ProfilePersonalSave } from '@chrisstroud/job-hunt-client';
import { type HuntWorkspace, type HuntWorkspaceRecord, type HuntDirectory } from '@chrisstroud/job-hunt-client';
import { type InterviewRecord, type InterviewDirectory, type InterviewCreate, type InterviewUpdate, type InterviewRemoved } from '@chrisstroud/job-hunt-client';
const calendarConnectionsRead = client.listCalendarConnections({ page: 1 });
const calendarConnectionRead = client.getCalendarConnection({ provider: 'google_calendar' });
const calendarConnectionUpdated = client.updateCalendarConnection({ request_id: create.request_id, connection_id: create.request_id, expected_fingerprint: 'a'.repeat(64), settings: { sync_enabled: false, sync_settings: { task_types: { interview: false } } } });
const calendarDisconnected = client.disconnectCalendarConnection({ request_id: create.request_id, connection_id: create.request_id, expected_fingerprint: 'a'.repeat(64) });
void calendarConnectionsRead; void calendarConnectionRead; void calendarConnectionUpdated; void calendarDisconnected;
const interviewPreparationRead = client.getInterviewPreparation({ interview_id: create.request_id, tasks_page: 2 });
const interviewPreparationSaved = client.changeInterviewPreparation({ request_id: create.request_id, interview_id: create.request_id, application_id: create.request_id, expected_revision: 1, expected_fingerprint: 'a'.repeat(64), change: { action: 'submit_feedback', feedback: { rating: 4, notes: 'Synthetic supplied feedback' } } });
const interviewRoundsRead = client.getInterviewRounds({ application_id: create.request_id });
const interviewReordered = client.reorderInterviewRounds({ request_id: create.request_id, application_id: create.request_id, expected_fingerprint: 'a'.repeat(64), order: [create.request_id] });
void interviewPreparationRead; void interviewPreparationSaved; void interviewRoundsRead; void interviewReordered;
const calendarReview = client.previewCalendarChange({ connection_id: create.request_id, source_kind: 'task', source_id: create.request_id, action: 'sync' });
const upcomingCalendar = client.getUpcomingCalendarSources({ connection_id: create.request_id });
const calendarBatch = client.queueCalendarChanges({ request_id: create.request_id, review_tokens: ['synthetic-reviewed-calendar'] });
void upcomingCalendar; void calendarBatch;
const calendarQueued = client.queueCalendarChange({ request_id: create.request_id, review_token: 'synthetic-signed-review' });
const calendarProgress = client.getCalendarChange({ change_id: create.request_id });
const calendarHistory = client.listCalendarChanges({ source_kind: 'task', source_id: create.request_id, page: 1 });
const calendarCancelled = client.cancelCalendarChange({ request_id: create.request_id, expected_account_id: 'jh_' + create.request_id, change_id: create.request_id, confirm_cancel: true });
const calendarResolved = client.resolveCalendarChange({ request_id: create.request_id, expected_account_id: 'jh_' + create.request_id, change_id: create.request_id, expected_fingerprint: 'a'.repeat(64), confirm_leave_unchanged: true });
void calendarReview; void calendarQueued; void calendarProgress; void calendarHistory; void calendarCancelled; void calendarResolved;
const calendarDestinations = client.listAvailableCalendars({ connection_id: create.request_id, cursor: null });
void calendarDestinations;
const interviewTemplateList = client.listInterviewTemplates({ page: 1 });
const interviewTemplateInitialize = client.initializeInterviewTemplates({ request_id: create.request_id, expected_fingerprint: 'a'.repeat(64) });
const interviewTemplateCreate = client.createInterviewTemplate({ request_id: create.request_id, title: 'Synthetic template', default_step_type: null });
const interviewTemplateDelete = client.deleteInterviewTemplate({ request_id: create.request_id, template_id: create.request_id, expected_fingerprint: 'a'.repeat(64) });
void interviewTemplateList; void interviewTemplateInitialize; void interviewTemplateCreate; void interviewTemplateDelete;
const interviewRecords: Promise<JourneyResult<InterviewDirectory>> = client.listInterviewRecords({ application_id: create.request_id });
const interviewRecord: Promise<JourneyResult<InterviewRecord>> = client.getInterviewRecord({ interview_id: create.request_id });
const interviewCreate: InterviewCreate = { request_id: create.request_id, application_id: create.request_id, fields: { title: 'Synthetic interview', scheduled_end_at: null, tags: ['Synthetic'], interviewer_ids: [] } };
const interviewCreated = client.createInterviewRecord(interviewCreate);
const interviewUpdate: InterviewUpdate = { request_id: create.request_id, application_id: create.request_id, interview_id: create.request_id, expected_revision: 1, expected_fingerprint: 'a'.repeat(64), fields: { completed_at: null, feedback: { note: 'Synthetic review' } } };
const interviewUpdated = client.updateInterviewRecord(interviewUpdate);
const interviewRemoved: Promise<JourneyResult<InterviewRemoved>> = client.deleteInterviewRecord({ request_id: create.request_id, application_id: create.request_id, interview_id: create.request_id, expected_revision: 1, expected_fingerprint: 'a'.repeat(64) });
void interviewRecords; void interviewRecord; void interviewCreated; void interviewUpdated; void interviewRemoved;
const fullHuntWorkspace: Promise<JourneyResult<HuntWorkspace>> = client.getHuntWorkspace({ search_id: create.request_id, companies_page: 2 });
const huntDirectory: Promise<JourneyResult<HuntDirectory>> = client.listHuntDirectory({ page: 2 });
const fullHuntSaved: Promise<JourneyResult<HuntWorkspaceRecord>> = client.saveHuntWorkspace({ request_id: create.request_id, search_id: create.request_id, expected_fingerprint: 'a'.repeat(64), action: 'pause' });
const removedNativeHunt = client.removeHunt({ request_id: create.request_id, search_id: create.request_id, expected_revision: 1, expected_application_count: 0 });
void fullHuntWorkspace; void huntDirectory; void fullHuntSaved; void removedNativeHunt;
const portableIdentity = client.saveProfileIdentity({ request_id: create.request_id, name: 'Synthetic identity', personal_data: {}, is_default: false, acknowledge_linked_updates: true });
void portableIdentity;
import { type CurrentHuntPageWorkspace } from '@chrisstroud/job-hunt-client';
const currentPageWorkspace: Promise<JourneyResult<CurrentHuntPageWorkspace>> = client.getHuntPageWorkspace({ page: 2 });
void currentPageWorkspace;
import {type HuntPagePhotoHostFile} from '@chrisstroud/job-hunt-client';
const pagePhotoIntent = {request_id:create.request_id, expected_account_id:'jh_'+create.request_id, expected_revision:1, expected_preview_revision:'a'.repeat(64)};
const pagePhotoHost: HuntPagePhotoHostFile = {...pagePhotoIntent, source_sha256:'b'.repeat(64),source_size:8,media_type:'image/png',file:{download_url:'https://approved.example.test/photo',file_id:'synthetic'}};
void client.uploadHuntPagePhotoFile(pagePhotoIntent,new Uint8Array()); void client.uploadHuntPagePhotoHostFile(pagePhotoHost);

const portableDirectory = client.listProfileDirectory({ page: 2 });
const portablePhoto: Promise<JourneyResult<ProfilePersonal>> = client.uploadProfilePhoto({ request_id: create.request_id, profile_id: create.request_id, expected_updated_at: null, acknowledge_linked_updates: true }, new Uint8Array());
import { type ProfilePhotoHostFile } from '@chrisstroud/job-hunt-client';
const filePhotoIntent = { request_id: create.request_id, profile_id: create.request_id, expected_updated_at: null, acknowledge_linked_updates: true as const };
const filePhoto: Promise<JourneyResult<ProfilePersonal>> = client.uploadProfilePhotoFile(filePhotoIntent, new Uint8Array());
const hostPhotoIntent: ProfilePhotoHostFile = { ...filePhotoIntent, source_size: 100, source_sha256: 'a'.repeat(64), media_type: 'image/png', file: { file_id: 'synthetic', download_url: 'https://approved.example.test/photo' } };
const hostPhoto: Promise<JourneyResult<ProfilePersonal>> = client.uploadProfilePhotoHostFile(hostPhotoIntent);
void filePhoto; void hostPhoto; void portableDirectory; void portablePhoto;
const personalDetails: Promise<JourneyResult<ProfilePersonal>> = client.getProfilePersonal(create.request_id);
const personalIntent: ProfilePersonalSave = { request_id: create.request_id, profile_id: create.request_id, expected_updated_at: null, personal_data: {}, acknowledge_linked_updates: true };
const personalSaved: Promise<JourneyResult<ProfilePersonal>> = client.saveProfilePersonal(personalIntent);
void personalDetails; void personalSaved;
const taskWorkspace: Promise<JourneyResult<WorkspaceTaskPage>> = client.getTaskWorkspace({ task_id: create.request_id });
const taskWorkspacePage = client.listTaskWorkspace({ page: 2 });
const applicationChoices: Promise<JourneyResult<ApplicationChoices>> = client.listApplicationChoices({ slug: create.request_id });
const ownedPhoto = client.getOwnedPhoto(create.request_id);
const ownedPhotoBytes = client.downloadOwnedPhoto(create.request_id);
const taskNoteManifest: Promise<JourneyResult<TaskDescriptionManifest>> = client.getTaskDescriptionManifest({ task_id: create.request_id });
const taskNoteChunk: Promise<JourneyResult<TaskDescriptionChunk>> = client.getTaskDescriptionChunk({ task_id: create.request_id, expected_revision: 1, expected_sha256: 'a'.repeat(64), chunk_index: 1 });
const taskNoteBytes = client.downloadTaskDescription({ task_id: create.request_id });
void taskWorkspace; void taskWorkspacePage; void applicationChoices; void ownedPhoto; void ownedPhotoBytes; void taskNoteManifest; void taskNoteChunk; void taskNoteBytes;

const removedApplication = client.removeApplication({ application_id: create.request_id, expected_revision: 1, request_id: create.request_id });
const targetedApplication = client.setApplicationTarget({ application_id: create.request_id, expected_revision: 1, request_id: create.request_id,
  expected_target_revision: 'a'.repeat(64), target_company: false });
void removedApplication; void targetedApplication;
const originalPointer = { expected_account_id: 'jh_' + create.request_id, application_id: create.request_id, request_id: create.request_id, expected_payload_hash: 'a'.repeat(64) };
const originalCheck = client.studioOriginals.check(originalPointer);
const originalFile = client.studioOriginals.download(originalPointer);
const originalReview = client.studioOriginals.review(originalPointer);
const originalRetry = client.studioOriginals.retry({ ...originalPointer, review_token: 'synthetic', confirm_calendar_handoff_count: 0 });
const originalResolved = client.studioOriginals.resolve({ ...originalPointer, disposition: 'discarded' });
void originalCheck; void originalFile; void originalReview; void originalRetry; void originalResolved;
const capturePointer = {expected_account_id:'jh_' + create.request_id,kind:'task' as const,request_id:create.request_id,expected_payload_hash:'a'.repeat(64)};
const captureDirectory = client.workspaceOriginals.list({expected_account_id:capturePointer.expected_account_id,kind:'task'});
const captureCheck = client.workspaceOriginals.check(capturePointer);
const captureDownload = client.workspaceOriginals.download(capturePointer);
const captureReview = client.workspaceOriginals.review(capturePointer);
const captureRetry = client.workspaceOriginals.retry({...capturePointer,review_token:'synthetic',confirm_calendar_handoff_count:0});
const captureResolve = client.workspaceOriginals.resolve({...capturePointer,disposition:'discarded'});
void captureDirectory;void captureCheck;void captureDownload;void captureReview;void captureRetry;void captureResolve;



void huntRead; void huntSave; void huntVisibility; void huntPreview; void huntImage; void huntPhoto; void huntPhotoBytes; void huntPhotoSave;
void profileLink; void profileBulk; void profileUnlink; void profilePhoto; void profilePhotoSave; void profilePhotoDownload;
void fileImport; void hostFileImport;
void workflow; void choices; void preparation; void download;
void document; void library; void documentRead; void documentEdit; void restored; void checkpoint; void revisions; void libraryChanges; void imported; void importRead; void confirmed;
`);
execFileSync(process.execPath, [path.join(root, 'node_modules/typescript/bin/tsc'), 'typed-consumer.ts',
  '--noEmit', '--strict', '--target', 'ES2023', '--module', 'NodeNext', '--moduleResolution', 'NodeNext'],
  { cwd: install, env, stdio: ['ignore', 'pipe', 'pipe'] });
execFileSync(process.execPath, ['--input-type=module', '-e', "import { JobHuntClient, JobHuntError } from '@chrisstroud/job-hunt-client'; if (new JobHuntClient().origin !== 'https://jobhunt.app' || !(new JobHuntError('synthetic') instanceof Error)) process.exit(1)"],
  { cwd: install, env, stdio: ['ignore', 'pipe', 'pipe'] });
const installedCLI = path.join(install, 'node_modules', ...cliManifest.name.split('/'), 'dist/jobhunt.js');
const installedSDK = path.join(install, 'node_modules/@chrisstroud/job-hunt-client/dist/index.js');
assert.ok((await stat(installedSDK)).isFile());
const binary = path.join(install, 'node_modules/.bin', process.platform === 'win32' ? 'jobhunt.cmd' : 'jobhunt');
assert.ok((await stat(binary)).isFile());
const version = execFileSync(process.execPath, [installedCLI, '--version', '--json'], { cwd: install, env, encoding: 'utf8' });
assert.equal(JSON.parse(version).version, first.version);
// The shipped file carries no source map, no build-machine path and no test or fixture data.
const shipped = await readFile(path.join(root, 'cli/dist/jobhunt.js'), 'utf8');
assert.ok(!/sourceMappingURL/u.test(shipped), 'The CLI must not ship a source map.');
for (const forbidden of [root, path.dirname(root), '/home/', '/' + 'Users/', 'C:\\Users\\']) assert.ok(!shipped.includes(forbidden), `The CLI embeds a build-machine path: ${forbidden}`);
assert.ok(!/jsk_(?:live|test)_[A-Za-z0-9]{8,}/u.test(shipped), 'The CLI must not embed a credential.');
// Plugins ask a fresh install whether anyone is signed in: a plain answer, no network, no prompt.
const freshHome = path.join(temporary, 'fresh-home'); await mkdir(freshHome);
const signedOut = execFileSync(process.execPath, [installedCLI, 'status', '--json'], { cwd: install, encoding: 'utf8',
  env: { ...env, HOME: freshHome, USERPROFILE: freshHome, XDG_CONFIG_HOME: path.join(freshHome, '.config'), LOCALAPPDATA: path.join(freshHome, 'AppData') } });
assert.deepEqual(JSON.parse(signedOut), { signed_in: false });
assert.equal(signedOut, '{"signed_in":false}\n');
const help = execFileSync(process.execPath, [installedCLI, '--help'], { cwd: install, env, encoding: 'utf8' });
assert.ok(help.includes('account erasure-cleanup-binding'));
assert.ok(help.includes('auth login') && help.includes('applications update') && help.includes('contacts update') && help.includes('--scopes') && help.includes('tasks completion') && help.includes('operations find') && help.includes('stage-templates remove'));
assert.ok(help.includes('exports inspect') && help.includes('exports prepare-page') && help.includes('exports download') && help.includes('exports cancel'));
assert.ok(help.includes('applications workspace') && help.includes('applications record-delete'));
assert.ok(help.includes('originals download') && help.includes('originals stage-file') && help.includes('originals retry|resolve'));

assert.ok(help.includes('applications remove') && help.includes('applications set-target'));
assert.ok(help.includes('hunts summary') && help.includes('hunts update') && help.includes('hunts rename'));
assert.ok(help.includes('interviews records') && help.includes('interviews get') && help.includes('interviews create') && help.includes('interviews delete'));
assert.ok(help.includes('hunts workspace') && help.includes('hunts directory') && help.includes('hunts remove'));
assert.ok(help.includes('profiles check-identity') && help.includes('profiles close-identity') && help.includes('profiles close-photo'));
assert.ok(help.includes('profiles directory') && help.includes('profiles photo-upload') && help.includes('profiles photo-upload-file') && help.includes('profiles photo-upload-host-file'));
assert.ok(help.includes('profiles personal') && help.includes('profiles update-personal'));
assert.ok(help.includes('tasks workspace') && help.includes('tasks description') && help.includes('photos download') && help.includes('applications choices'));
assert.ok(help.includes('tasks delete') && help.includes('tasks skip') && help.includes('tasks history'));
assert.ok(help.includes('bookmarks get') && help.includes('bookmarks save'));
assert.ok(help.includes('tasks cleanup-preview') && help.includes('tasks cleanup'));
assert.ok(help.includes('task-settings get') && help.includes('task-settings update'));
assert.ok(help.includes('applications capture-url') && help.includes('applications stages') && help.includes('applications move') &&
  help.includes('applications record-submission') && help.includes('applications submission-options'));
assert.ok(help.includes('resume-imports file') && help.includes('resume-imports host-file'));
assert.ok(help.includes('today get') && help.includes('routine list') && help.includes('routine save'));
assert.ok(help.includes('workspace search') && help.includes('workspace resolve'));
assert.ok(help.includes('references find') && help.includes('references get'));
assert.ok(help.includes('highlights list') && help.includes('highlights choices') && help.includes('highlights delete') && help.includes('highlights export'));
assert.ok(help.includes('activity list') && help.includes('analytics get') && help.includes('notifications mark-read') && help.includes('career get'));
assert.ok(help.includes('documents close-profile-save'));
assert.ok(help.includes('applications create-native') && help.includes('applications check-creation')
  && help.includes('applications close-creation') && help.includes('applications create-native-host-file'));
assert.ok(help.includes('documents create-native') && help.includes('documents check-creation')
  && help.includes('documents close-creation') && help.includes('documents create-native-host-file'));
assert.ok(help.includes('documents save-profile') && help.includes('documents check-profile-save') && help.includes('documents save-profile-host-file'));
assert.ok(help.includes('documents preview') && help.includes('packages preview'));
assert.ok(help.includes('packages download') && help.includes('application-documents customize'));
assert.ok(help.includes('documents create') && help.includes('documents restore') && help.includes('documents delete') &&
  help.includes('documents checkpoint') && help.includes('resume-imports confirm'));
assert.ok(help.includes('captures stage-file') && help.includes('captures download') && help.includes('captures retry'));
assert.ok(help.includes('api-keys prepare-recipient') && help.includes('api-keys recipient') && help.includes('api-keys review-create') && help.includes('api-keys issue') &&
  help.includes('api-keys check-delivery') && help.includes('api-keys receive') && help.includes('api-keys acknowledge') && help.includes('api-keys close-create'));
assert.ok(help.includes('api-keys prepare-file-recipient') && help.includes('api-keys review-file-create') && help.includes('api-keys issue-file'));
assert.ok(help.includes('api-keys list-summary') && help.includes('api-keys get-summary') && help.includes('api-keys download-permissions') && help.includes('api-keys review-revoke-summary'));
assert.ok(help.includes('extensions prepare-recipient') && help.includes('extensions review-create') && help.includes('extensions check-create') && help.includes('extensions receive') && help.includes('extensions acknowledge'));
assert.ok(help.includes('webhooks review-test') && help.includes('webhooks jobs') && help.includes('webhooks reconcile'));
assert.ok(help.includes('webhooks review-fields-update') && help.includes('webhooks update-fields') && help.includes('webhooks check-fields-update') && help.includes('webhooks close-fields-update'));
assert.ok(help.includes('imports list') && help.includes('imports identity') && help.includes('imports draft') && help.includes('imports cancel-request') && help.includes('imports stop') && help.includes('imports export'));
// Keep the inspected artifact and clean consumer for the real HTTP parity check.
console.log(JSON.stringify({ name: first.name, version: first.version, bytes: first.size,
  integrity, files: first.files.map(file => file.path), artifact, installedCLI, installedSDK,
  node: process.version, platform: process.platform, anonymousPublicDependencyInstall: true,
  publicRegistryCLIInstall: false, reproducibleBuildAndPack: true,
  client: { name: clientPackage.name, artifact: clientArtifact, integrity: clientPackage.integrity,
    bytes: clientPackage.size, cleanTypeScriptConsumer: true, cleanNodeESMConsumer: true } }, null, 2));
