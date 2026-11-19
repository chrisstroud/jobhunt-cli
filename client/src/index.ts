import * as packageOrder from './package-order.ts';
export type {PackageOrder, PackageOrderWrite} from './package-order.ts';
export { PostingImportFilesClient, postingImportFileInput, MAX_POSTING_IMPORT_FILE_BYTES } from './posting-import-files.ts';
export type { PostingImportFileRead, PostingImportFileManifest, PostingImportFileChunkRead, PostingImportFileChunk } from './posting-import-files.ts';
import { PostingImportsClient } from './posting-imports.ts';
import { isNativeJson } from './native-json.ts';
export { PostingImportsClient, postingImportInput, postingImportPrivateIdentity } from './posting-imports.ts';
export type { ImportAccount, PostingInputKind, PostingImportList, PostingImportRead, PostingImportStart, PostingImportDraft, PostingImportOpen, PostingImportReconcile, PostingImportCancel, PostingImportAttempt, PostingImportData } from './posting-imports.ts';
import {AccountNamePartsClient} from './account-name-parts.ts';
export {AccountNamePartsClient,accountNamePartsInput,accountNamePartsOriginalHash} from './account-name-parts.ts';
export type {AccountNamePartsWrite,AccountNameParts} from './account-name-parts.ts';
import * as editorial from './editorial-contracts.ts';
export type { EditorialStatus, EditorialKind, EditorialRead, EditorialWrite, EditorialState, EditorialList, EditorialPage, EditorialOriginal, EditorialClosure, EditorialHistoryRead, EditorialHistory } from './editorial-contracts.ts';
export { editorialReadInput, editorialWriteInput, editorialOriginal, editorialReceiptRead, editorialReceipt } from './editorial-contracts.ts';
import {ProfileOriginalClient} from './profile-originals.ts';
import {ResumeImportOriginalClient,type ResumeImportOriginal,type ResumeImportFileOriginal} from './resume-import-originals.ts';
export {resumeImportOriginal,resumeImportOriginalHash,resumeImportReceipt,resumeImportClosure} from './resume-import-originals.ts';
export type {ResumeImportOriginal,ResumeImportCommand,ResumeImportClosure,ResumeImportFileOriginal} from './resume-import-originals.ts';
export {ProfileOriginalClient,captureProfilePhotoOriginal,captureProfileIdentityClosureSource,profileOriginalClosureResult} from './profile-originals.ts';
export type {ProfilePhotoOriginal,ProfileOriginalClosure} from './profile-originals.ts';
export { captureProfileLink, prepareProfileLink, profileLinkReceipt } from './profile-contracts.ts';
import { DocumentDeletionClient } from './document-deletions.ts';
import { LibraryOriginalClient } from './library-originals.ts';
export { LibraryOriginalClient, libraryOriginal, prepareLibraryOriginal, libraryOriginalRead, libraryReceipt, libraryClosure } from './library-originals.ts';
export type { LibraryOperation, LibraryOriginal, LibraryReceipt } from './library-originals.ts';
export { DocumentDeletionClient, documentDeletionOperation, MAX_DELETION_ORIGINAL_BYTES, documentDeletionOriginal, prepareDocumentDeletion, documentDeletionRead, recordedDocumentDeletionResponse, documentDeletionClosureResponse } from './document-deletions.ts';
export type { DocumentPackageDeletionOriginal, DocumentDeletionOriginal, DocumentDeletionClosure, RecordedDocumentDeletion } from './document-deletions.ts';
import { SectionSaveClient } from './section-saves.ts';
import { DocumentVersionFileClient, MAX_VERSION_FILE_BYTES } from './version-files.ts';
export { DocumentVersionFileClient, versionFileRead, versionFileBoundRead, versionFileManifestResult, verifiedVersionRecord, MAX_VERSION_FILE_BYTES } from './version-files.ts';
export type { VersionFileRead, VersionFileBoundRead, VersionFileChunkRead, VersionFileManifest, VersionFileChunk, VersionRecord } from './version-files.ts';
import { DocumentVersionOriginalClient } from './version-originals.ts';
export { DocumentVersionOriginalClient, documentVersionOriginal, prepareDocumentVersionOriginal, documentVersionOriginalRead, recordedDocumentVersionResponse, documentVersionClosureResponse } from './version-originals.ts';
export type { DocumentVersionOriginal, RecordedDocumentVersion, DocumentVersionClosure } from './version-originals.ts';
export { SectionSaveClient, sectionSaveClosureResponse, prepareSectionSave, sectionSaveOriginal, sectionSaveOriginalHash, SECTION_SAVE_OPERATION, MAX_SECTION_SAVE_BYTES, MAX_SECTION_VALUE_BYTES } from './section-saves.ts';
export type { SectionSaveInput, SectionSaveOriginal, SectionSaveClosure } from './section-saves.ts';
export { webhookTestInput, webhookReconcileInput, webhookJobOriginalHash } from './webhook-jobs.ts';
export type { WebhookTestPlan, WebhookTestOriginal, WebhookReconcilePlan, WebhookReconcileOriginal, WebhookJobRead, WebhookJobPageRead, WebhookJobReview, WebhookJobState, WebhookJobPage } from './webhook-jobs.ts';
export { webhookFileInput } from './webhook-files.ts';
export { webhookFieldInput, webhookFieldFile, webhookFieldHash, MAX_WEBHOOK_FIELDS_BYTES } from './webhook-fields.ts';
export type { WebhookFieldCreation, WebhookFieldIssue, WebhookFieldUpdate, WebhookFieldOriginal } from './webhook-fields.ts';
export { webhookCreationInput, webhookCreationHash, createWebhookRecipient, decryptWebhookSigningDelivery } from './webhook-issuance.ts';
export type { WebhookCreationInput, WebhookCreationReview, WebhookIssue, WebhookSigningDeliveryRead, WebhookSigningDeliveryAck, WebhookSigningDelivery, WebhookCreationResolution } from './webhook-issuance.ts';
export { webhookChangePlan, webhookChangeOriginal, webhookChangeHash } from './webhook-changes.ts';
export type { WebhookAttributes, WebhookChangePlan, WebhookChangeOriginal, WebhookChangeReview, WebhookChangeSaved, WebhookChangeResolution } from './webhook-changes.ts';
export type { WebhookFileRead, WebhookFileManifest, WebhookFileChunkRead, WebhookFileChunk } from './webhook-files.ts';
import { WebhookClient } from './webhooks.ts';
export type { WebhookRead, WebhookPageRead, WebhookSubscriptionRead, WebhookDeliveryRead, WebhookDeliveryPageRead, WebhookSubscription, WebhookDelivery, WebhookPage, WebhookDeliveryPage, WebhookSubscriptionItem, WebhookDeliveryItem } from './webhooks.ts';
export { ErasureRecoveryClient, erasureRecoveryFile, erasureCleanupBinding, erasureCleanupMatches, type ErasureRecoveryFile, type ErasureRecoveryStatus, type ErasureCleanupBinding } from './erasure-recovery.ts';
import { ApplicationExportClient } from './application-export.ts';
export { ApplicationExportClient, applicationExportInput } from './application-export.ts';
export type { ApplicationExportRead, ApplicationExportManifest, ApplicationExportChunkRead, ApplicationExportChunk } from './application-export.ts';
export { ExtensionIssuanceClient, extensionCreationInput, extensionCreationHash, createExtensionRecipient, decryptExtensionDelivery } from './extension-delivery.ts';
export type { ExtensionCreationInput, ExtensionIssue, ExtensionCreationReview, ExtensionDeliveryRead, ExtensionDeliveryAck, ExtensionDelivery, ExtensionCreationResolution } from './extension-delivery.ts';
import { ExtensionConnectionsClient } from './extension-connections.ts';
export { ExtensionConnectionsClient, extensionReviewInput, extensionRevokeInput, extensionOriginalHash, type ExtensionConnection, type ExtensionDirectory, type ExtensionRevoke, type ExtensionRevokeReview, type ExtensionReview, type ExtensionResolution } from './extension-connections.ts';
import { WorkspaceOriginalClient } from './workspace-originals.ts';
import { AccountNameClient } from './account-name.ts';
import { ResumeSaveClient } from './resume-saves.ts';
import { ApplicationCreationClient } from './application-creations.ts';
export { ApplicationCreationClient, prepareApplicationCreation, prepareApplicationCreationSource, applicationCreationInput,
  applicationCreationOriginal, applicationCreationOriginalHash, applicationCreationResponse, applicationCreationReceipt,
  applicationCreationEvidence, applicationCreationClosure, APPLICATION_CREATION_OPERATION, MAX_APPLICATION_CREATION_BYTES } from './application-creations.ts';
export type { ApplicationCreationInput, ApplicationCreationFields, ApplicationCreationOriginal, ApplicationCreationEvidence,
  ApplicationCreationReceipt, ApplicationCreationClosure } from './application-creations.ts';
import { DocumentCreationClient } from './document-creations.ts';
export { DocumentCreationClient, prepareDocumentCreation, prepareDocumentCreationSource, documentCreationInput, documentCreationOriginal,
  documentCreationOriginalHash, documentCreationSlug, documentCreationResponse, documentCreationReceipt,
  documentCreationEvidence, documentCreationClosure, MAX_NATIVE_DOCUMENT_BYTES, MAX_DOCUMENT_CREATION_BYTES,
  DOCUMENT_CREATION_OPERATION } from './document-creations.ts';
export type { DocumentCreationInput, DocumentCreationFields, DocumentCreationOriginal, DocumentCreationEvidence,
  DocumentCreationReceipt, DocumentCreationClosure } from './document-creations.ts';
export { ResumeSaveClient, prepareResumeSave, resumeSaveInput, resumeSaveOriginal,
  resumeSaveOriginalHash, resumeSaveReceipt, resumeSaveResponse, resumeSaveClosureResponse, RESUME_SAVE_OPERATION, MAX_RESUME_SAVE_BYTES } from './resume-saves.ts';
export type { ResumeSaveInput, ResumeSaveFields, ResumeSaveOriginal, ResumeSaveReceipt, ResumeSaveHostFile, ResumeSaveClosure } from './resume-saves.ts';
import { AccountExportClient } from './account-export.ts';
export { AccountExportClient, accountExportInput } from './account-export.ts';
export type { AccountExportRead, AccountExportManifest, AccountExportChunkRead, AccountExportChunk } from './account-export.ts';
export { AccountNameClient, accountNameInput, accountNameOriginalHash } from './account-name.ts';
export type { AccountName, AccountNameWrite, AccountNameCheck, AccountNameResolution } from './account-name.ts';
import { ApiKeyClient } from './api-keys.ts';
import { MAX_API_KEY_SCOPES_FILE_BYTES } from './key-metadata.ts';
export { ApiKeyClient } from './api-keys.ts';
export { ApiKeyMetadataClient, MAX_API_KEY_SCOPES_FILE_BYTES, verifiedApiKeyScopes, keyMetadataDigest } from './key-metadata.ts';
export type { ApiKeySummary, ApiKeySummaryDirectory, ApiKeySummaryReview, ApiKeyScopesFile, ApiKeyScopesRead, ApiKeyScopesChunkRead, ApiKeyScopesChunk } from './key-metadata.ts';
export { ApiKeyIssuanceClient, createApiKeyRecipient, decryptApiKeyDelivery, apiKeyAttributeFile, MAX_API_KEY_ATTRIBUTES_BYTES } from './key-delivery.ts';
export type { ApiKeyAttributes, ApiKeyCreationReviewInput, ApiKeyIssue, ApiKeyCreationReview, ApiKeyDeliveryRead, ApiKeyDeliveryAck, ApiKeyCreationClose, ApiKeyDelivery, ApiKeyCreationResolution, ApiKeyFileReviewInput, ApiKeyFileIssue, ApiKeyFileHostReview, ApiKeyFileHostIssue } from './key-delivery.ts';
export type { ApiKeyRead, ApiKeyList, ApiKeyRecord, ApiKeyDirectory, ApiKeyReviewInput, ApiKeyReview,
  ApiKeyRevoke, ApiKeyRevoked, ApiKeyReceiptInput, ApiKeyClose, ApiKeyResolution } from './api-keys.ts';
export { WorkspaceOriginalClient } from './workspace-originals.ts';
export type { WorkspaceOriginalPointer, WorkspaceOriginalDirectory, WorkspaceOriginalFileIntent, WorkspaceOriginalHostFile, WorkspaceOriginalDescriptor, WorkspaceOriginalManifest, WorkspaceOriginalChunkRead, WorkspaceOriginalChunk, WorkspaceOriginalCheck, WorkspaceOriginalReviewInput, WorkspaceOriginalReview, WorkspaceOriginalRetry, WorkspaceOriginalResolution, WorkspaceOriginalPage, WorkspaceOriginalKind } from './workspace-originals.ts';
import { StudioOriginalClient } from './studio-originals.ts';
export { StudioOriginalClient } from './studio-originals.ts';
export type { StudioOriginalPointer, StudioOriginalDirectory, StudioOriginalDescriptor, StudioOriginalManifest, StudioOriginalChunkRead, StudioOriginalChunk, StudioOriginalCheck, StudioOriginalReviewInput, StudioOriginalReview, StudioOriginalRetry, StudioOriginalResolution, StudioOriginalPage } from './studio-originals.ts';
import * as highlightFiles from './highlight-file-contracts.ts';
import * as recordFiles from './application-record-file-contracts.ts';
export type { ApplicationRecordFileRead, ApplicationRecordFileDirectory, ApplicationRecordFileIntent, ApplicationRecordHostFile, ApplicationRecordFileManifest, ApplicationRecordFileChunkRead, ApplicationRecordFileChunk, ApplicationRecordFilePage, ApplicationRecordFileSaved } from './application-record-file-contracts.ts';
export type {HighlightFileIntent,HighlightHostFile,HighlightFileManifest,HighlightFileChunkRead,HighlightFileChunk,HighlightFilePage,HighlightFileSaved} from './highlight-file-contracts.ts';
import * as profileFiles from './profile-file-contracts.ts';
export { captureProfileIdentityOriginal, captureProfileIdentitySource, profileIdentityReceipt } from './profile-contracts.ts';
export type { ProfileIdentityOriginal } from './profile-contracts.ts';
export type { ProfilePhotoHostFile, ProfilePhotoFileOriginal } from './profile-file-contracts.ts';
export { profilePhotoFileOriginal, prepareProfilePhotoOriginal, prepareProfilePhotoFile, profilePhotoFileReceipt } from './profile-file-contracts.ts';
import * as documentSettings from './document-settings-contracts.ts';
export type { DocumentDefaults, DocumentSettingsData, DocumentSettingsWrite } from './document-settings-contracts.ts';
import { JobHuntError, record, type JsonObject } from './protocol.ts';
export { JobHuntError, record, type JsonObject } from './protocol.ts';
import * as tasks from './task-contracts.ts';
import type { JourneyResult } from './task-contracts.ts';
import * as records from './application-record-contracts.ts';
import * as compensation from './compensation-contracts.ts';
export type { CompensationRead, CompensationChunkRead, CompensationManifest, CompensationChunk,
  CompensationReplaceIntent, CompensationPrepare, CompensationDraftRead, CompensationDraftWrite,
  CompensationAppend, CompensationDraft } from './compensation-contracts.ts';
import * as bookmarks from './bookmark-contracts.ts';
import * as huntSelection from './hunt-selection-contracts.ts';
import * as taskPreferences from './task-preferences-contracts.ts';
import * as templates from './stage-template-contracts.ts';
import * as cleanup from './recurring-cleanup-contracts.ts';
import * as jobs from './job-pipeline-contracts.ts';
import * as submissions from './submission-contracts.ts';
import * as documents from './document-contracts.ts';
import * as packages from './package-contracts.ts';
import {toolkitOriginal,toolkitClosure,type ToolkitOriginal} from './toolkit-originals.ts';
export {toolkitOriginal,prepareToolkitOriginal,toolkitReceipt,toolkitClosure,type ToolkitOriginal,type ToolkitClosure} from './toolkit-originals.ts';
import * as importFiles from './import-file-contracts.ts';
import * as profiles from './profile-contracts.ts';
import * as huntPage from './hunt-page-contracts.ts';
export type { CurrentHuntPageState, CurrentHuntPageWorkspace, HuntPagePalette, HuntPageDraft, HuntPageState, HuntPageWorkspace, HuntPageSave, HuntPageMediaRead,
  HuntPageVisibility, HuntPagePreviewRead, HuntPagePreview, HuntPagePhotoSave, HuntPagePhotoHostFile } from './hunt-page-contracts.ts';
export type { ProfileIdentity, ProfileIdentitySave, ProfileDirectory, ProfileDirectoryItem, ProfilePersonal, ProfilePersonalSave, ProfileSummary, ContactProfile, ProfilePage, ProfileSaved, ProfilePageRead, ProfileLinksRead,
  ProfileSave, ProfileDefault, ProfileDelete, ProfileLink, ProfileUnlink, ProfileLinksSave, PackageProfileBinding,
  ProfileLinks, ProfileBindingsSaved, ProfilePhotoWrite, ProfilePhoto } from './profile-contracts.ts';
export type { ResumeFileUpload, HostResumeFile, ResumeHostFileImport, ResumeUploadTransport,
  PrepareResumeFileUpload, ImportUploadedResume, PrivateResumeUpload } from './import-file-contracts.ts';
import * as workspaceSearch from './workspace-search-contracts.ts';
import * as workspaceView from './workspace-view-contracts.ts';
import * as routines from './routine-contracts.ts';
import * as workspaceReads from './workspace-read-contracts.ts';
export type { WorkspaceTask, WorkspaceTaskPage, WorkspacePageRead, ApplicationChoice, ApplicationChoices, ApplicationChoicesRead, TaskDescriptionManifest, TaskDescriptionChunkRead, TaskDescriptionChunk } from './workspace-read-contracts.ts';
export type { RoutineKind, RoutineLink, RoutineTarget, RoutineAggregator, RoutineRecord, RoutinePage, RoutineRead, RoutineRecordRead, SearchRoutine, SearchRoutineRecord, RoutineFields, RoutineWrite, RoutineSaved, TodayRead, TodayTask, TodayWorkspace } from './routine-contracts.ts';
export type { WorkspaceViewRead, WorkspaceView, WorkspaceNavigation, WorkspaceTaskSummary, WorkspaceTaskSummaries, WorkspaceApplicationDetail } from './workspace-view-contracts.ts';
import * as references from './reference-contracts.ts';
export type { RecordReferenceIdentity, RecordReferenceLink, RecordReferenceMatches, RecordReferenceSelection, SavedRecordReference } from './reference-contracts.ts';
export type { WorkspaceSearchKind, WorkspaceSearchInput, WorkspaceSearchMatch, WorkspaceSearchData, WorkspaceLocationInput, WorkspaceLocation } from './workspace-search-contracts.ts';
import * as highlights from './highlight-contracts.ts';
export type { HighlightFields, HighlightRecord, HighlightRead, HighlightPage, HighlightSaved, HighlightWrite, HighlightOptions, HighlightChoicesRead, HighlightChoicePage, HighlightChoices, HighlightExportRead, HighlightExport, HighlightExportManifest, HighlightExportChunkRead, HighlightExportChunk } from './highlight-contracts.ts';
import * as insights from './insight-contracts.ts';
export type { InsightPageRead, AnalyticsRead, ActivityCountsRead, WorkActivity, WorkActivityPage, ActivityCounts, Analytics, CareerFacts, InboxNotification, Inbox, MarkNotificationsRead, InboxSaved } from './insight-contracts.ts';
import * as previews from './preview-contracts.ts';
export type { DocumentPreviewRead, PreparedPreviewRead, DocumentPreview } from './preview-contracts.ts';
import { privateJPEGBytes, downloadPDF, downloadPrivateDocument } from './private-download.ts';
import * as exports from './export-contracts.ts';
import * as bundles from './bundle-contracts.ts';
import * as interviewRecords from './interview-record-contracts.ts';
import * as calendars from './calendar-contracts.ts';
import * as calendarChanges from './calendar-change-contracts.ts';
import * as calendarHandoffs from './calendar-handoff-contracts.ts';
export type { CalendarHandoffRead, CalendarHandoffsRead, CalendarHandoffState, CalendarHandoffs, CalendarHandoffReviewInput, CalendarHandoffReview, ResumeCalendarHandoff, ResolveCalendarHandoff } from './calendar-handoff-contracts.ts';
export type { CalendarChangeSelection, CalendarChangeReview, QueueCalendarChange, CalendarChangeRead, CancelCalendarChange, ResolveCalendarChange, CalendarChangeState, CalendarChangesRead, CalendarChanges } from './calendar-change-contracts.ts';
export type { UpcomingCalendarRead, UpcomingCalendarSources, QueueCalendarChanges, CalendarBatchItem, CalendarBatchQueued } from './calendar-change-contracts.ts';
export type { CalendarConnectionRead, CalendarConnectionList, CalendarConnection, CalendarConnections, CalendarSettings, CalendarConnectionEdit, CalendarConnectionUpdate, CalendarDisconnected } from './calendar-contracts.ts';
export type { AvailableCalendarsRead, CalendarChoice, AvailableCalendars } from './calendar-contracts.ts';
import * as interviewPreparation from './interview-preparation-contracts.ts';
export type { InterviewPreparationRead, InterviewRelatedPage, InterviewPreparation, InterviewFeedback, InterviewPreparationChange, InterviewRoundsRead, InterviewRounds, InterviewReorder, InterviewOrderSaved } from './interview-preparation-contracts.ts';
import * as interviewTemplates from './interview-template-contracts.ts';
export type { InterviewTemplate, InterviewTemplateList, InterviewTemplateDirectory, InterviewTemplateInitialize, InterviewTemplatesInitialized, InterviewTemplateCreate, InterviewTemplateDelete, InterviewTemplateRemoved } from './interview-template-contracts.ts';
export type { InterviewFields, InterviewRecordRead, InterviewRecordList, InterviewRecord, InterviewSummary, InterviewDirectory, InterviewCreate, InterviewUpdate, InterviewDelete, InterviewRemoved } from './interview-record-contracts.ts';
import * as huntWorkspace from './hunt-workspace-contracts.ts';
export type { HuntWorkspaceRead, HuntWorkspaceRecord, HuntWorkspaceChoice, HuntCompanyChoice, HuntResumeChoice, HuntChoicePage, HuntWorkspace, HuntDirectoryItem, HuntDirectory } from './hunt-workspace-contracts.ts';
import * as hunts from './hunt-contracts.ts';
import * as pipeline from './pipeline-contracts.ts';
import * as screening from './screening-contracts.ts';
import {answerOriginal,answerClosure,type AnswerOriginal} from './answer-originals.ts';
import {submissionOriginal,submissionClosure,type SubmissionOriginal} from './submission-originals.ts';
import * as publications from './publications.ts';
export * from './publications.ts';
import {preparationOriginal,preparePreparationOriginal,preparationReceipt,preparationClosure,type PreparationOriginal} from './preparation-originals.ts';
export {preparationOriginal,preparePreparationOriginal,preparationReceipt,preparationClosure,type PreparationOriginal,type PreparationClosure} from './preparation-originals.ts';
export {submissionOriginal,prepareSubmissionOriginal,submissionReceipt,submissionClosure,type SubmissionOriginal,type SubmissionClosure} from './submission-originals.ts';
export {answerOriginal,prepareAnswerOriginal,answerReceipt,answerClosure,type AnswerOriginal,type AnswerClosure} from './answer-originals.ts';
import * as library from './library-contracts.ts';
import * as archive from './archive-contracts.ts';
export type { LibraryStatus, ArchiveDocument, LibraryDocumentsRead, LibraryDocumentsPage, DocumentArchiveRead, DocumentArchiveState, DocumentArchiveWrite, DocumentArchiveSaved } from './archive-contracts.ts';
export type { LibraryDocumentSummary, LibraryPackageSummary, LibraryPackagePage, LibraryPackageRead, LibraryPackageAdd, LibraryPackageDelete, DocumentUsageRead, DocumentUsagePage } from './library-contracts.ts';
import * as interviews from './interview-contracts.ts';
export type { ScreeningSource, ScreeningAnswer, ScreeningAnswerView, ScreeningAnswers, ScreeningAnswersSave } from './screening-contracts.ts';
export type { InterviewStatus, InterviewRound, InterviewPage, InterviewStatusWrite, InterviewStatusSaved } from './interview-contracts.ts';
export type { PipelineStageRecord, PipelineConfiguration, PipelineStageState, PipelineStageCreate, PipelineStageRename, PipelineStageReorder, PipelineStageRemove } from './pipeline-contracts.ts';
import * as huntSettings from './hunt-settings-contracts.ts';
export type { HuntPreferences, HuntPreferencesWrite, ConnectedHuntAccount, HuntSettings, HuntContext } from './hunt-settings-contracts.ts';
export type { HuntRecord, HuntPage, HuntDetails, HuntFields, HuntNote, HuntSave, HuntUpdate, HuntRename, HuntCreate, HuntCurrent, HuntDelete, DeletedHunt, HuntSummary, InitializedPipeline, HuntAssignment, HuntAssignmentWrite } from './hunt-contracts.ts';
import * as crm from './crm-contracts.ts';
export type { CrmKind, CrmAction, CrmFields, CrmList, CrmRead, CrmMutation, CrmPage, CrmData } from './crm-contracts.ts';
export type { BundleSelection, BundleReadSource, BundleRevision, PrepareBundleExport, BundleSource, BundleMedia, BundleState, BundleDownload } from './bundle-contracts.ts';
export type { ExportFormat, PageExportFormat, ExportMode, ExportMediaType, ExportDocumentSelection, ExportPageSelection,
  PrepareDocumentExport, PreparePageExport, ExportRead, CancelExport, ExportSource, ExportState, ExportDownload } from './export-contracts.ts';
export type { WorkflowDocument, ApplicationDocuments, ResumeChoicesRead, ResumeChoices, SelectApplicationDocuments,
  CustomizeApplicationDocuments, CreateCoverLetter, PrepareApplicationPackage, PreparedDocument, PreparedPackage,
  PackageListRead, PackageList, PreparedDownloadRead, PreparedDownload } from './package-contracts.ts';
import { resourceId, uuid } from './journey-contracts.ts';
export type { CareerDocument, CareerFact, CareerSource, CareerSection, CareerSectionInput, DocumentDisplaySettings,
  CreateCareerDocument, UpdateCareerSection, DocumentWrite, NamedDocumentWrite, RestoreDocument, DocumentRevisionRead,
  DocumentSummary, DocumentRevisions, DocumentRevisionMetadata, DocumentLibraryResult, DocumentLibraryPage, ResumeTextImport, ConfirmResumeImport,
  ResumeImport } from './document-contracts.ts';
export type { CaptureJobURL, CaptureJobDetails, CaptureTargetCompany, EditJobDetails, MoveJobStage, SavedJob,
  PipelineStage, PipelineStages } from './job-pipeline-contracts.ts';
export type { RecordSubmission, SubmissionRead, SubmissionOptionsRead, Submission, SubmissionFile, SubmissionHistory,
  SubmissionOptions, PreparedSubmissionChoice } from './submission-contracts.ts';
export type { CleanupSelection, CleanupPreviewInput, CleanupWriteInput, CleanupItem, CleanupPage, CleanupResult } from './recurring-cleanup-contracts.ts';
export type { TaskPreferences, TaskPreferencesData, TaskPreferencesWrite } from './task-preferences-contracts.ts';
export type { StageTemplate, TemplateListInput, TemplatePage, TemplatePatch, TemplateWrite,
  TemplateRemove, TemplateState, TemplateRemoval, TemplateReorder } from './stage-template-contracts.ts';
export type { HuntBookmark, HuntBookmarks, BookmarkSaveInput } from './bookmark-contracts.ts';
export type { ApplicationDeleteInput, ApplicationTargetInput, ApplicationMutationSaved, ApplicationRecordKind, ApplicationWorkspace, ApplicationWorkspaceInput, ApplicationRecordSaveInput,
  ApplicationRecordDeleteInput, ApplicationRecordSaved } from './application-record-contracts.ts';
export type { TaskSchedule, TaskOccurrence, SavedTask, TaskPage, TaskListInput, TaskReadInput, TaskCreateInput, TaskDeleteInput, DeletedTask,
  TaskUpdateInput, TaskCompletionInput, TaskSkipInput, TaskHistoryInput, TaskHistoryEntry, TaskHistory, TaskScheduleInput, OperationInput, OperationReceipt, JourneyResult } from './task-contracts.ts';
/** Job Hunt HTTP contracts. No UI, storage, browser cookies or product policy. */
export const DEFAULT_ORIGIN = 'https://jobhunt.app';
export const OAUTH_RESOURCE = 'https://jobhunt.app/mcp';
/** The protocol revision sent with a tool call; the server accepts this one and one later revision. */
export const MCP_PROTOCOL_VERSION = '2025-06-18';
/** HTTP status for a refusal the service reports inside a successful tool-call answer, by its code. */
const TOOL_REFUSAL_STATUS: Record<string, number> = { authentication_required: 401, insufficient_scope: 403, access_unavailable: 403,
  not_found: 404, conflict: 409, revision_conflict: 409, rate_limited: 429, invalid_input: 422, needs_input: 422 };
export type Credential = { origin: string; token: string };
export type Resource<T> = { type: string; id: string; attributes: T };
export type Document<T> = { data: T; meta?: JsonObject; links?: JsonObject };
export type ApplicationAttributes = {
  title: string | null; company_name: string | null; status: string | null;
  version: number; uuid?: string; job_link?: string | null; source?: string | null;
  job_search?: string | null; created_at?: string | null; updated_at?: string | null;
  job_details?: JsonObject | null; compensation?: JsonObject | null;
};
export type Application = Resource<ApplicationAttributes>;
export type CreateApplication = {
  title: string; company_name: string; job_link?: string | null; source?: string | null; job_search?: string | null;
  status?: string | null; company_id?: string | null; source_contact_id?: string | null;
  resume_template_id?: string | null; job_details?: JsonObject | null; cover_letter?: JsonObject | null;
  resume_overrides?: JsonObject | null; contacts?: JsonObject[] | null; activity?: JsonObject[] | null;
};
export type ApplicationCreationMeta = { import_attempt_id?: string; import_confirmed?: boolean; import_review_revision?: number };
export type UpdateApplication = { title?: string; company_name?: string; job_link?: string; source?: string };
export type Account = Resource<{ name: string; email: string; profile_picture?: string | null }>;
export type ConnectedAccount = { id: string; name?: string; email?: string; nickname?: string };
export type ContactAttributes = {
  name: string; revision: number; email: string | null; phone: string | null;
  linkedin_url: string | null; company: string | null; company_id: string | null;
  title: string | null; application_count?: number; notes_content?: string | null;
};
export type Contact = Resource<ContactAttributes>;
export type CreateContact = { name: string; notes?: string } & Partial<Omit<ContactAttributes, 'revision' | 'application_count' | 'notes_content'>>;
export type UpdateContact = Partial<CreateContact>;

export function normalizeOrigin(value: string, allowLoopback = false): string {
  if (typeof value !== 'string' || /[\s\\]/u.test(value)) throw new JobHuntError('invalid_origin');
  let url: URL;
  try { url = new URL(value); } catch { throw new JobHuntError('invalid_origin'); }
  if (url.username || url.password || url.search || url.hash || url.pathname !== '/' ||
      (url.protocol !== 'https:' && !(allowLoopback && url.protocol === 'http:' &&
        ['127.0.0.1', '[::1]'].includes(url.hostname)))) throw new JobHuntError('invalid_origin');
  return url.origin;
}
export function validToken(token: unknown): token is string {
  return typeof token === 'string' && token.length >= 12 && token.length <= 4096 && /^[\x21-\x7e]+$/u.test(token);
}
function boundedInteger(value: number, min: number, max: number): number {
  if (!Number.isSafeInteger(value) || value < min || value > max) throw new JobHuntError('invalid_input');
  return value;
}
function identifier(value: string): string {
  if (typeof value !== 'string' || !/^[A-Za-z0-9][A-Za-z0-9._-]{0,255}$/u.test(value)) throw new JobHuntError('invalid_input');
  return encodeURIComponent(value);
}
function safeCode(value: unknown): string | undefined {
  return typeof value === 'string' && /^[a-z][a-z0-9_]{0,79}$/u.test(value) ? value : undefined;
}
function safeId(value: unknown): string | undefined {
  return typeof value === 'string' && /^[A-Za-z0-9._:-]{1,128}$/u.test(value) ? value : undefined;
}

export type ClientOptions = {
  origin?: string; credential?: Credential; allowLoopback?: boolean;
  timeoutMs?: number; fetchImpl?: typeof fetch;
};

export class JobHuntClient {
  readonly postingImports = new PostingImportsClient(this);
  readonly applicationDeletions = {
    check: async (input: records.ApplicationDeletionOriginal) => {
      const captured = records.applicationDeletionOriginal(input);
      return records.applicationDeletionReceipt(await this.request('/api/v1/journey/get_job_hunt_operation?'
        + new URLSearchParams({ arguments: JSON.stringify(await records.applicationDeletionRead(captured)) })), captured);
    },
    close: async (input: records.ApplicationDeletionOriginal, confirmClose: true) => {
      if (confirmClose !== true) throw new JobHuntError('invalid_input');
      const captured = records.applicationDeletionOriginal(input);
      return records.applicationDeletionClosure(await this.request('/api/v1/journey/close_application_delete_original_v1',
        { method: 'POST', body: { ...captured, confirm_close: true } }), captured);
    },
  };

  readonly webhooks = new WebhookClient(this);
  readonly accountName = new AccountNameClient(this);
  readonly accountNameParts = new AccountNamePartsClient(this);
  readonly sectionSaves = new SectionSaveClient(this);
  readonly documentDeletions = new DocumentDeletionClient(this);
  readonly libraryOriginals = new LibraryOriginalClient(this);
  readonly versionOriginals = new DocumentVersionOriginalClient(this);
  readonly versionFiles = new DocumentVersionFileClient(this);
  readonly resumeSaves = new ResumeSaveClient(this);
  readonly applicationCreations = new ApplicationCreationClient(this);
  readonly documentCreations = new DocumentCreationClient(this);
  readonly extensions = new ExtensionConnectionsClient(this);
  readonly applicationExport = new ApplicationExportClient(this);
  readonly accountExport = new AccountExportClient(this);
  readonly origin: string;
  private readonly credential?: Credential;
  private readonly timeoutMs: number;
  private readonly fetchImpl: typeof fetch;
  private readonly allowLoopback: boolean;
  constructor(options: ClientOptions = {}) {
    this.origin = normalizeOrigin(options.origin ?? DEFAULT_ORIGIN, options.allowLoopback);
    if (options.credential && (options.credential.origin !== this.origin || !validToken(options.credential.token))) {
      throw new JobHuntError('credential_origin_mismatch');
    }
    this.credential = options.credential;
    this.timeoutMs = boundedInteger(options.timeoutMs ?? 15000, 100, 120000);
    this.fetchImpl = options.fetchImpl ?? fetch;
    this.allowLoopback = options.allowLoopback === true;
  }

  /** Never follows redirects, logs credentials or automatically retries a mutation. */
  async request(path: string, options: {
    method?: 'GET' | 'POST' | 'PATCH' | 'DELETE'; body?: JsonObject | URLSearchParams | FormData;
    /** Already validated JSON original bytes; never parse and reserialize this carrier. */
    jsonSource?: Uint8Array;
    authenticated?: boolean;
  } = {}): Promise<unknown> {
    // `/mcp` is the one non-API path: callTool posts a JSON-RPC tool call there with the same bearer token.
    const allowed = (value: string) => /^\/(?:api\/v1\/|oauth\/|\.well-known\/)/u.test(value) || value === '/mcp';
    if (!allowed(path) || path.includes('\\') || path.startsWith('//')) {
      throw new JobHuntError('invalid_path');
    }
    const url = new URL(path, this.origin);
    // The website host redirects a trailing slash under /api/ and this client refuses redirects, so ask for the form it serves directly.
    if (url.pathname.startsWith('/api/') && url.pathname.length > 1 && url.pathname.endsWith('/')) url.pathname = url.pathname.replace(/\/+$/u, '');
    if (url.origin !== this.origin || url.hash || url.username || url.password || !allowed(url.pathname)) throw new JobHuntError('invalid_path');
    const tool = url.pathname === '/mcp';
    if (tool && ((options.method ?? 'GET') !== 'POST' || options.authenticated === false || url.search)) throw new JobHuntError('invalid_path');
    if (options.jsonSource !== undefined && (!(options.jsonSource instanceof Uint8Array)
      || options.body !== undefined || (options.method ?? 'GET') === 'GET')) throw new JobHuntError('invalid_input');
    const jsonSource = options.jsonSource === undefined ? undefined : new Uint8Array(options.jsonSource);
    const scopesFile = url.pathname === '/api/v1/journey/api-key-permissions-file' && (options.method ?? 'GET') === 'GET' && !options.body;
    const versionFile = url.pathname === '/api/v1/journey/document-version-file' && (options.method ?? 'GET') === 'GET' && !options.body;
    const headers: Record<string, string> = { Accept: tool ? 'application/json' : 'application/vnd.api+json, application/json', 'User-Agent': 'jobhunt-client/0.1' };
    if (tool) headers['MCP-Protocol-Version'] = MCP_PROTOCOL_VERSION;
    if (options.authenticated !== false) {
      if (!this.credential) throw new JobHuntError('authentication_required', 401);
      headers.Authorization = `Bearer ${this.credential.token}`;
    }
    if (jsonSource || (options.body && !(options.body instanceof FormData))) headers['Content-Type'] = options.body instanceof URLSearchParams
      ? 'application/x-www-form-urlencoded'
      : tool || url.pathname.startsWith('/api/v1/journey/') ? 'application/json' : 'application/vnd.api+json';
    let response: Response;
    let body: unknown;
    let invalidJSON = false;
    try {
      response = await this.fetchImpl(url, { method: options.method ?? 'GET', headers,
        body: jsonSource ?? (options.body ? (options.body instanceof URLSearchParams || options.body instanceof FormData ? options.body : JSON.stringify(options.body)) : undefined),
        credentials: 'omit', redirect: 'error', signal: AbortSignal.timeout(this.timeoutMs) });
      if (response.status === 204) return null;
      const reader = response.body?.getReader();
      const chunks: Uint8Array[] = []; let length = 0;
      if (reader) {
        try {
          while (true) {
            const next = await reader.read(); if (next.done) break;
            length += next.value.byteLength;
            if (length > (versionFile && response.ok ? MAX_VERSION_FILE_BYTES : scopesFile && response.ok ? MAX_API_KEY_SCOPES_FILE_BYTES : 2 * 1024 * 1024)) { await reader.cancel(); throw new JobHuntError('response_too_large'); }
            chunks.push(next.value);
          }
        } finally { reader.releaseLock(); }
      }
      const bytes = new Uint8Array(length); let offset = 0;
      for (const chunk of chunks) { bytes.set(chunk, offset); offset += chunk.byteLength; }
      if ((scopesFile || versionFile) && response.ok) {
        const encoded = response.headers.get('content-encoding')?.trim().toLowerCase();
        if (response.status !== 200 || response.headers.get('content-type')?.split(';')[0]?.trim().toLowerCase() !== 'application/json' ||
          (!encoded || encoded === 'identity') && response.headers.has('content-length') && response.headers.get('content-length') !== String(length)) throw new JobHuntError('invalid_response');
        return bytes;
      }
      const text = new TextDecoder().decode(bytes);
      try { body = text ? JSON.parse(text) : null; } catch { body = null; invalidJSON = true; }
    } catch (error) {
      if (error instanceof JobHuntError) throw error;
      throw new JobHuntError(error instanceof Error && ['TimeoutError', 'AbortError'].includes(error.name)
        ? 'request_timeout' : 'network_error');
    }
    const requestId = safeId(record(body) && record(body.meta) ? body.meta.request_id : undefined)
      ?? safeId(response.headers.get('X-Request-ID'));
    if (!response.ok) {
      const first = record(body) && Array.isArray(body.errors) ? body.errors[0] : undefined;
      const code = safeCode(record(first) ? first.code : record(body) ? body.error ?? body.code : undefined)
        ?? ({ 401: 'unauthorized', 403: 'forbidden', 404: 'resource_not_found', 409: 'conflict', 429: 'rate_limited' } as Record<number, string>)[response.status]
        ?? 'service_unavailable';
      const retry = Number(response.headers.get('Retry-After'));
      throw new JobHuntError(code, response.status, requestId,
        response.headers.has('Retry-After') && Number.isSafeInteger(retry) && retry >= 0 ? retry : undefined);
    }
    if (invalidJSON || (body === null && response.status !== 200)) throw new JobHuntError('invalid_response', response.status, requestId);
    return body;
  }

  /**
   * Calls one tool at /mcp, as an assistant would, with this client's credential. Returns the tool's structured
   * result exactly as the service sent it. A refusal (`ok: false`) throws with its code, a status that maps to the
   * CLI's exit codes, and the service's own one-sentence message. Never retries.
   */
  async callTool(name: string, args: JsonObject = {}): Promise<JsonObject> {
    if (!/^[a-z][a-z0-9_]{0,63}$/u.test(name)) throw new JobHuntError('invalid_input');
    const body = await this.request('/mcp', { method: 'POST',
      body: { jsonrpc: '2.0', id: 1, method: 'tools/call', params: { name, arguments: args } } });
    if (!record(body) || body.jsonrpc !== '2.0' || body.id !== 1 || !record(body.result) || !record(body.result.structuredContent)) {
      throw new JobHuntError('invalid_response');
    }
    const value = body.result.structuredContent;
    if (body.result.isError === true || value.ok === false) {
      const code = safeCode(value.code) ?? 'request_failed';
      const detail = typeof value.message === 'string' ? value.message.replace(/[\u0000-\u001f\u007f-\u009f]/gu, ' ').trim().slice(0, 300) : undefined;
      throw new JobHuntError(code, TOOL_REFUSAL_STATUS[code] ?? 502, undefined, undefined, detail || undefined);
    }
    return value;
  }
  /**
   * Confirms the credential is accepted and returns the account's id. Reads nothing else: a missing or odd name
   * or email must never make a working connection look broken.
   */
  async verifiedAccountId(): Promise<string> {
    const value = await this.request('/api/v1/account/');
    if (!record(value) || !record(value.data) || typeof value.data.id !== 'string' || !/^[A-Za-z0-9._-]{1,128}$/u.test(value.data.id)) {
      throw new JobHuntError('invalid_response');
    }
    return value.data.id;
  }
  async identity(): Promise<Document<Account>> {
    const value = await this.request('/api/v1/account/');
    if (!record(value) || !record(value.data) || value.data.type !== 'user_profile' || typeof value.data.id !== 'string' ||
        !record(value.data.attributes) || typeof value.data.attributes.name !== 'string' || typeof value.data.attributes.email !== 'string') {
      throw new JobHuntError('invalid_response');
    }
    return value as unknown as Document<Account>;
  }
  async getBookmarks() {
    return bookmarks.bookmarkResult(await this.request('/api/v1/journey/get_hunt_bookmarks_v2'));
  }
  async saveBookmarks(input: bookmarks.BookmarkSaveInput) {
    return bookmarks.bookmarkResult(await this.request('/api/v1/journey/save_hunt_bookmarks_v2', {
      method: 'POST', body: { ...bookmarks.bookmarkSaveInput(input) },
    }));
  }

  async listHunts(input: { page?: number } = {}) {
    const query = new URLSearchParams({ arguments: JSON.stringify(hunts.huntPageInput(input)) });
    const result = hunts.huntPageResult(await this.request(`/api/v1/journey/list_hunt_records_v2?${query}`));
    if (result.data && result.data.page !== (input.page ?? 1)) throw new JobHuntError('invalid_response');
    return result;
  }
  async getInterviewRecord(input: interviewRecords.InterviewRecordRead) {
    const args = interviewRecords.readInput(input);
    const query = new URLSearchParams({ arguments: JSON.stringify(args) });
    return interviewRecords.recordResult(await this.request(`/api/v1/journey/get_interview_record?${query}`), args.interview_id, args.expected_application_id);
  }
  async listCalendarConnections(input: calendars.CalendarConnectionList = {}) {
    const args = calendars.listInput(input);
    const query = new URLSearchParams({ arguments: JSON.stringify(args) });
    return calendars.connectionsResult(await this.request(`/api/v1/journey/list_calendar_connections?${query}`), args);
  }
  async getUpcomingCalendarSources(input: calendarChanges.UpcomingCalendarRead) {
    const args = calendarChanges.upcomingInput(input);
    const query = new URLSearchParams({ arguments: JSON.stringify(args) });
    return calendarChanges.upcomingResult(await this.request(`/api/v1/journey/get_upcoming_calendar_sources?${query}`), args);
  }
  async getCalendarHandoff(input: calendarHandoffs.CalendarHandoffRead) {
    const args = calendarHandoffs.readInput(input), query = new URLSearchParams({ arguments: JSON.stringify(args) });
    return calendarHandoffs.stateResult(await this.request(`/api/v1/journey/get_calendar_handoff?${query}`), args.handoff_id);
  }
  async listCalendarHandoffs(input: calendarHandoffs.CalendarHandoffsRead = {}) {
    const args = calendarHandoffs.listInput(input), query = new URLSearchParams({ arguments: JSON.stringify(args) });
    return calendarHandoffs.listResult(await this.request(`/api/v1/journey/list_calendar_handoffs?${query}`), args);
  }
  async reviewCalendarHandoff(input: calendarHandoffs.CalendarHandoffReviewInput) {
    const args = calendarHandoffs.reviewInput(input), query = new URLSearchParams({ arguments: JSON.stringify(args) });
    return calendarHandoffs.reviewResult(await this.request(`/api/v1/journey/review_calendar_handoff?${query}`), args);
  }
  async resumeCalendarHandoff(input: calendarHandoffs.ResumeCalendarHandoff) {
    const args = calendarHandoffs.mutationInput(input);
    return calendarHandoffs.stateResult(await this.request('/api/v1/journey/resume_calendar_handoff', { method: 'POST', body: args }), args.handoff_id);
  }
  async resolveCalendarHandoff(input: calendarHandoffs.ResolveCalendarHandoff) {
    const args = calendarHandoffs.mutationInput(input, true);
    return calendarHandoffs.stateResult(await this.request('/api/v1/journey/resolve_calendar_handoff', { method: 'POST', body: args }), args.handoff_id);
  }
  async queueCalendarChanges(input: calendarChanges.QueueCalendarChanges) {
    const args = calendarChanges.batchInput(input);
    return calendarChanges.batchResult(await this.request('/api/v1/journey/queue_calendar_changes', { method: 'POST', body: args }), args);
  }
  async previewCalendarChange(input: calendarChanges.CalendarChangeSelection) {
    const args = calendarChanges.selectionInput(input);
    const query = new URLSearchParams({ arguments: JSON.stringify(args) });
    return calendarChanges.reviewResult(await this.request(`/api/v1/journey/preview_calendar_change?${query}`), args);
  }
  async queueCalendarChange(input: calendarChanges.QueueCalendarChange) {
    const args = calendarChanges.queueInput(input);
    return calendarChanges.stateResult(await this.request('/api/v1/journey/queue_calendar_change', { method: 'POST', body: args }));
  }
  async getCalendarChange(input: calendarChanges.CalendarChangeRead) {
    const args = calendarChanges.readInput(input);
    const query = new URLSearchParams({ arguments: JSON.stringify(args) });
    return calendarChanges.stateResult(await this.request(`/api/v1/journey/get_calendar_change?${query}`), args.change_id);
  }
  async listCalendarChanges(input: calendarChanges.CalendarChangesRead = {}) {
    const args = calendarChanges.listInput(input);
    const query = new URLSearchParams({ arguments: JSON.stringify(args) });
    return calendarChanges.listResult(await this.request(`/api/v1/journey/list_calendar_changes?${query}`), args);
  }
  async cancelCalendarChange(input: calendarChanges.CancelCalendarChange) {
    const args = calendarChanges.controlInput(input);
    return calendarChanges.stateResult(await this.request('/api/v1/journey/cancel_calendar_change', { method: 'POST', body: args }), args.change_id);
  }
  async resolveCalendarChange(input: calendarChanges.ResolveCalendarChange) {
    const args = calendarChanges.controlInput(input, true);
    return calendarChanges.stateResult(await this.request('/api/v1/journey/resolve_calendar_change', { method: 'POST', body: args }), args.change_id);
  }
  async listAvailableCalendars(input: calendars.AvailableCalendarsRead) {
    const args = calendars.availableInput(input);
    const query = new URLSearchParams({ arguments: JSON.stringify(args) });
    return calendars.availableResult(await this.request(`/api/v1/journey/list_available_calendars?${query}`), args);
  }
  async getCalendarConnection(input: calendars.CalendarConnectionRead) {
    const args = calendars.readInput(input);
    const query = new URLSearchParams({ arguments: JSON.stringify(args) });
    return calendars.connectionResult(await this.request(`/api/v1/journey/get_calendar_connection?${query}`), args);
  }
  async updateCalendarConnection(input: calendars.CalendarConnectionUpdate) {
    const args = calendars.updateInput(input);
    return calendars.connectionResult(await this.request('/api/v1/journey/update_calendar_connection', { method: 'POST', body: args }), { connection_id: args.connection_id });
  }
  async disconnectCalendarConnection(input: calendars.CalendarConnectionEdit) {
    const args = calendars.editInput(input);
    return calendars.disconnectedResult(await this.request('/api/v1/journey/disconnect_calendar_connection', { method: 'POST', body: args }), args);
  }
  async getInterviewPreparation(input: interviewPreparation.InterviewPreparationRead) {
    const args = interviewPreparation.preparationInput(input);
    const query = new URLSearchParams({ arguments: JSON.stringify(args) });
    return interviewPreparation.preparationResult(await this.request(`/api/v1/journey/get_interview_preparation?${query}`), args);
  }
  async changeInterviewPreparation(input: interviewPreparation.InterviewPreparationChange) {
    const args = interviewPreparation.changeInput(input);
    return interviewRecords.recordResult(await this.request('/api/v1/journey/change_interview_preparation', { method: 'POST', body: args }), args.interview_id, args.application_id);
  }
  async getInterviewRounds(input: interviewPreparation.InterviewRoundsRead) {
    const args = interviewPreparation.roundsInput(input);
    const query = new URLSearchParams({ arguments: JSON.stringify(args) });
    return interviewPreparation.roundsResult(await this.request(`/api/v1/journey/get_interview_rounds?${query}`), args);
  }
  async reorderInterviewRounds(input: interviewPreparation.InterviewReorder) {
    const args = interviewPreparation.reorderInput(input);
    return interviewPreparation.orderResult(await this.request('/api/v1/journey/reorder_interview_rounds', { method: 'POST', body: args }), args);
  }
  async listInterviewTemplates(input: interviewTemplates.InterviewTemplateList = {}) {
    const args = interviewTemplates.listInput(input);
    const query = new URLSearchParams({ arguments: JSON.stringify(args) });
    return interviewTemplates.directoryResult(await this.request(`/api/v1/journey/list_interview_templates?${query}`), args);
  }
  async initializeInterviewTemplates(input: interviewTemplates.InterviewTemplateInitialize) {
    const args = interviewTemplates.initializeInput(input);
    return interviewTemplates.initializedResult(await this.request('/api/v1/journey/initialize_interview_templates', { method: 'POST', body: args }));
  }
  async createInterviewTemplate(input: interviewTemplates.InterviewTemplateCreate) {
    const args = interviewTemplates.createInput(input);
    const result = interviewTemplates.templateResult(await this.request('/api/v1/journey/create_interview_template', { method: 'POST', body: args }));
    if (result.data && result.operation?.resource?.id !== result.data.id) throw new JobHuntError('invalid_response');
    return result;
  }
  async deleteInterviewTemplate(input: interviewTemplates.InterviewTemplateDelete) {
    const args = interviewTemplates.deleteInput(input);
    return interviewTemplates.removedResult(await this.request('/api/v1/journey/delete_interview_template', { method: 'POST', body: args }), args);
  }
  async listInterviewRecords(input: interviewRecords.InterviewRecordList = {}) {
    const args = interviewRecords.listInput(input);
    const query = new URLSearchParams({ arguments: JSON.stringify(args) });
    return interviewRecords.directoryResult(await this.request(`/api/v1/journey/list_interview_records?${query}`), args);
  }
  async createInterviewRecord(input: interviewRecords.InterviewCreate) {
    const args = interviewRecords.createInput(input);
    const result = interviewRecords.recordResult(await this.request('/api/v1/journey/create_interview_record', { method: 'POST', body: args }), undefined, args.application_id);
    if (result.data && result.operation?.resource?.id !== result.data.id) throw new JobHuntError('invalid_response');
    return result;
  }
  async updateInterviewRecord(input: interviewRecords.InterviewUpdate) {
    const args = interviewRecords.updateInput(input);
    return interviewRecords.recordResult(await this.request('/api/v1/journey/update_interview_record', { method: 'POST', body: args }), args.interview_id, args.application_id);
  }
  async deleteInterviewRecord(input: interviewRecords.InterviewDelete) {
    const args = interviewRecords.deleteInput(input);
    return interviewRecords.removedResult(await this.request('/api/v1/journey/delete_interview_record', { method: 'POST', body: args }), args);
  }
  async getHuntWorkspace(input: huntWorkspace.HuntWorkspaceRead) {
    const args = huntWorkspace.workspaceReadInput(input);
    const query = new URLSearchParams({ arguments: JSON.stringify(args) });
    return huntWorkspace.workspaceResult(await this.request(`/api/v1/journey/get_hunt_workspace?${query}`), args);
  }
  async listHuntDirectory(input: { page?: number } = {}) {
    const args = hunts.huntPageInput(input);
    const query = new URLSearchParams({ arguments: JSON.stringify(args) });
    return huntWorkspace.directoryResult(await this.request(`/api/v1/journey/list_hunt_directory?${query}`), args.page ?? 1);
  }
  async saveHuntWorkspace(input: hunts.HuntSave) {
    const args = hunts.huntSaveInput(input);
    return huntWorkspace.workspaceRecordResult(await this.request('/api/v1/journey/save_hunt_workspace', { method: 'POST', body: args }), args);
  }
  async removeHunt(input: hunts.HuntDelete) {
    const args = huntWorkspace.originalDeleteInput(input);
    const result = hunts.huntDeletedResult(await this.request('/api/v1/journey/remove_hunt', { method: 'POST', body: args }));
    if (result.data && (result.data.search_id.toLowerCase() !== args.search_id.toLowerCase() ||
      result.data.application_count !== args.expected_application_count ||
      (result.data.migrated_to_id?.toLowerCase() ?? null) !== (args.migrate_to_id?.toLowerCase() ?? null))) throw new JobHuntError('invalid_response');
    return result;
  }
  async getHunt(input: { search_id: string }) {
    const query = new URLSearchParams({ arguments: JSON.stringify(hunts.huntReadInput(input)) });
    const result = hunts.huntDetailsResult(await this.request(`/api/v1/journey/get_hunt_details_v2?${query}`));
    if (result.data && result.data.hunt.id !== input.search_id.toLowerCase()) throw new JobHuntError('invalid_response');
    return result;
  }
  async getHuntSummary(input: { search_id: string }) {
    const args = hunts.huntReadInput(input);
    const query = new URLSearchParams({ arguments: JSON.stringify(args) });
    const result = hunts.huntSummaryResult(await this.request(`/api/v1/journey/get_job_search?${query}`));
    if (result.data && result.data.id !== args.search_id.toLowerCase()) throw new JobHuntError('invalid_response');
    return result;
  }
  async updateHunt(input: hunts.HuntUpdate) {
    const args = hunts.huntUpdateInput(input);
    const result = hunts.huntSummaryResult(await this.request('/api/v1/journey/update_job_search', { method: 'POST', body: { ...args } }));
    if (result.data && (result.data.id !== args.search_id.toLowerCase() || result.operation?.kind !== 'update_job_search' ||
        result.operation.resource?.id !== args.search_id.toLowerCase() || result.operation.resource?.revision !== args.expected_revision + 1))
      throw new JobHuntError('invalid_response');
    return result;
  }
  async renameHunt(input: hunts.HuntRename) {
    const args = hunts.huntRenameInput(input);
    const result = hunts.huntRenamedResult(await this.request('/api/v1/journey/rename_hunt_record_v2', { method: 'POST', body: { ...args } }));
    if (result.data && (result.data.id !== args.search_id.toLowerCase() || result.operation?.kind !== 'rename_hunt_v2' ||
        result.operation.resource?.id !== args.search_id.toLowerCase() || result.operation.resource?.revision !== args.expected_revision + 1 ||
        result.website_url !== 'https://jobhunt.app/app')) throw new JobHuntError('invalid_response');
    return result;
  }
  async getHuntSelection() {
    return huntSelection.huntSelectionResult(await this.request('/api/v1/journey/get_hunt_selection_v2'));
  }
  async saveHuntSelection(input: huntSelection.HuntSelectionSave) {
    const args = huntSelection.huntSelectionInput(input);
    const result = huntSelection.huntSelectionResult(await this.request('/api/v1/journey/save_hunt_selection_v2', {
      method: 'POST', body: { ...args },
    }));
    if (result.data && (result.data.account_id !== args.expected_account_id || result.operation?.kind !== 'save_hunt_selection_v2' ||
      result.operation.resource?.id !== args.expected_account_id.slice(3))) throw new JobHuntError('invalid_response');
    return result;
  }
  async createHunt(input: hunts.HuntCreate) {
    return hunts.huntSummaryResult(await this.request('/api/v1/journey/create_job_search_v2', {
      method: 'POST', body: { ...hunts.huntCreateInput(input) },
    }));
  }
  async saveHunt(input: hunts.HuntSave) {
    const result = hunts.huntDetailsResult(await this.request('/api/v1/journey/save_hunt_details_v2', {
      method: 'POST', body: { ...hunts.huntSaveInput(input) },
    }));
    if (result.data && result.data.hunt.id !== input.search_id.toLowerCase()) throw new JobHuntError('invalid_response');
    return result;
  }
  async setCurrentHunt(input: hunts.HuntCurrent) {
    const result = hunts.huntSummaryResult(await this.request('/api/v1/journey/set_current_job_search_v2', {
      method: 'POST', body: { ...hunts.huntCurrentInput(input) },
    }));
    if (result.data && result.data.id !== input.search_id.toLowerCase()) throw new JobHuntError('invalid_response');
    return result;
  }
  async deleteHunt(input: hunts.HuntDelete) {
    const result = hunts.huntDeletedResult(await this.request('/api/v1/journey/delete_hunt_record_v2', {
      method: 'POST', body: { ...hunts.huntDeleteInput(input) },
    }));
    if (result.data && (result.data.search_id !== input.search_id.toLowerCase() ||
      result.data.migrated_to_id !== (input.migrate_to_id?.toLowerCase() ?? null) ||
      result.data.application_count !== input.expected_application_count)) throw new JobHuntError('invalid_response');
    return result;
  }
  async listLibraryDocuments(input: archive.LibraryDocumentsRead = {}) {
    const query = new URLSearchParams({ arguments: JSON.stringify(archive.libraryDocumentsInput(input)) });
    const result = archive.libraryDocumentsResult(await this.request(`/api/v1/journey/list_library_documents_v2?${query}`));
    if (result.data && (result.data.page !== (input.page ?? 1) || result.data.status !== (input.status ?? 'active'))) throw new JobHuntError('invalid_response');
    return result;
  }
  async documentArchiveState(input: archive.DocumentArchiveRead) {
    const query = new URLSearchParams({ arguments: JSON.stringify(archive.archiveReadInput(input)) });
    const result = archive.archiveStateResult(await this.request(`/api/v1/journey/get_document_archive_state_v2?${query}`));
    if (result.data && (result.data.document_id.toLowerCase() !== input.document_id.toLowerCase() || result.data.page !== (input.page ?? 1))) throw new JobHuntError('invalid_response');
    return result;
  }
  async archiveDocumentPackage(input: archive.DocumentArchiveWrite) {
    const result = archive.archiveSavedResult(await this.request('/api/v1/journey/archive_document_package_v2', {
      method: 'POST', body: { ...archive.archiveWriteInput(input) },
    }));
    if (result.data && result.data.anchor_id.toLowerCase() !== input.expected_anchor_id.toLowerCase()) throw new JobHuntError('invalid_response');
    return result;
  }
  async unarchiveDocumentPackage(input: archive.DocumentArchiveWrite) {
    const result = archive.archiveSavedResult(await this.request('/api/v1/journey/unarchive_document_package_v2', {
      method: 'POST', body: { ...archive.archiveWriteInput(input) },
    }));
    if (result.data && result.data.anchor_id.toLowerCase() !== input.expected_anchor_id.toLowerCase()) throw new JobHuntError('invalid_response');
    return result;
  }
  async documentEditorialHistory(input: editorial.EditorialHistoryRead) {
    const args=editorial.editorialHistoryInput(input),result=editorial.editorialHistoryResult(await this.request('/api/v1/journey/list_document_editorial_history_v1?'+new URLSearchParams({arguments:JSON.stringify(args)})));
    if(result.data&&(result.data.document_id!==args.document_id||result.data.kind!==(args.kind??'document')||result.data.items.some(i=>i.id===args.before_id)))throw new JobHuntError('invalid_response');return result;
  }
  async getDocumentEditorialStatus(input: editorial.EditorialRead) {
    const args=editorial.editorialReadInput(input),result=editorial.editorialResult(await this.request('/api/v1/journey/get_document_editorial_status_v1?'+new URLSearchParams({arguments:JSON.stringify(args)})));
    if(result.data&&(result.data.document_id!==args.document_id||result.data.kind!==(args.kind??'document')))throw new JobHuntError('invalid_response');return result;
  }
  async listDocumentEditorialStatuses(input: editorial.EditorialList = {}) {
    const args=editorial.editorialListInput(input),result=editorial.editorialPageResult(await this.request('/api/v1/journey/list_document_editorial_statuses_v1?'+new URLSearchParams({arguments:JSON.stringify(args)})));
    if(result.data?.items.some(item=>item.kind!==(args.kind??'document')||(args.status&&item.status!==args.status)))throw new JobHuntError('invalid_response');return result;
  }
  async setDocumentEditorialStatus(input: editorial.EditorialWrite) {
    const args=editorial.editorialWriteInput(input),result=editorial.editorialResult(await this.request('/api/v1/journey/set_document_editorial_status_v1',{method:'POST',body:{...args}}));
    if(result.data&&(result.data.document_id!==args.document_id||result.data.kind!==(args.kind??'document')||result.data.status!==args.status||result.data.revision!==args.expected_revision+1))throw new JobHuntError('invalid_response');return result;
  }
  async checkDocumentEditorialStatus(input: editorial.EditorialOriginal) {
    const args=editorial.editorialOriginal(input);return editorial.editorialReceipt(await this.request('/api/v1/journey/get_job_hunt_operation?'+new URLSearchParams({arguments:JSON.stringify(await editorial.editorialReceiptRead(args))})),args);
  }
  async closeDocumentEditorialOriginal(input: editorial.EditorialOriginal,confirmClose:true) {
    if(confirmClose!==true)throw new JobHuntError('invalid_input');const args=editorial.editorialOriginal(input);return editorial.editorialClosure(await this.request('/api/v1/journey/close_document_editorial_original_v1',{method:'POST',body:{...args,confirm_close:true}}),args);
  }
  async listLibraryPackages(input: library.LibraryPackageRead = {}) {
    const query = new URLSearchParams({ arguments: JSON.stringify(library.libraryPackageReadInput(input)) });
    const result = library.libraryPackagePageResult(await this.request(`/api/v1/journey/list_document_packages_v2?${query}`));
    if (result.data && (result.data.page !== (input.page ?? 1) || result.data.documents_page !== (input.documents_page ?? 1) ||
      (input.package_id && result.data.selected?.id.toLowerCase() !== input.package_id.toLowerCase()))) throw new JobHuntError('invalid_response');
    return result;
  }
  async documentUsage(input: library.DocumentUsageRead) {
    const query = new URLSearchParams({ arguments: JSON.stringify(library.documentUsageInput(input)) });
    const result = library.documentUsageResult(await this.request(`/api/v1/journey/list_document_usage_v2?${query}`));
    if (result.data && (result.data.document_id.toLowerCase() !== input.document_id.toLowerCase() ||
      (result.data.next_page !== null && result.data.next_page !== (input.page ?? 1) + 1))) throw new JobHuntError('invalid_response');
    return result;
  }
  async addLibraryDocument(input: library.LibraryPackageAdd) {
    const result = documents.documentLibraryResult(await this.request('/api/v1/journey/add_package_document_v2', {
      method: 'POST', body: { ...library.libraryPackageWriteInput(input, 'add') },
    }));
    if (result.data && (result.data.deleted === true || result.data.document?.id !== result.data.document_id ||
      result.data.document_id.toLowerCase() === input.document_id.toLowerCase())) throw new JobHuntError('invalid_response');
    return result;
  }
  async deleteLibraryPackage(input: library.LibraryPackageDelete) {
    const result = documents.documentLibraryResult(await this.request('/api/v1/journey/delete_document_package_v2', {
      method: 'POST', body: { ...library.libraryPackageWriteInput(input, 'delete') },
    }));
    if (result.data && (result.data.document_id.toLowerCase() !== input.document_id.toLowerCase() || result.data.deleted !== true)) throw new JobHuntError('invalid_response');
    return result;
  }
  async getScreeningAnswers(input: { application_id: string }) {
    const query = new URLSearchParams({ arguments: JSON.stringify(screening.screeningReadInput(input)) });
    const result = screening.screeningResult(await this.request(`/api/v1/journey/get_application_answers?${query}`));
    if (result.data && result.data.application_id.toLowerCase() !== input.application_id.toLowerCase()) throw new JobHuntError('invalid_response');
    return result;
  }
  async saveScreeningAnswers(input: screening.ScreeningAnswersSave) {
    const result = screening.screeningResult(await this.request('/api/v1/journey/save_application_answers', {
      method: 'POST', body: { ...screening.screeningSaveInput(input) },
    }));
    if (result.data && result.data.application_id.toLowerCase() !== input.application_id.toLowerCase()) throw new JobHuntError('invalid_response');
    return result;
  }
  async listInterviews(input: { page?: number } = {}) {
    const query = new URLSearchParams({ arguments: JSON.stringify(interviews.interviewPageInput(input)) });
    const result = interviews.interviewPageResult(await this.request(`/api/v1/journey/list_workspace_interviews_v2?${query}`));
    if (result.data && result.data.page !== (input.page ?? 1)) throw new JobHuntError('invalid_response');
    return result;
  }
  async setInterviewStatus(input: interviews.InterviewStatusWrite) {
    const result = interviews.interviewStatusResult(await this.request('/api/v1/journey/update_interview_status_v2', {
      method: 'POST', body: { ...interviews.interviewStatusInput(input) },
    }));
    if (result.data && result.data.id.toLowerCase() !== input.interview_id.toLowerCase()) throw new JobHuntError('invalid_response');
    return result;
  }
  async getPipelineConfiguration(input: { page?: number } = {}) {
    const query = new URLSearchParams({ arguments: JSON.stringify(pipeline.pipelineReadInput(input)) });
    const result = pipeline.pipelineConfigurationResult(await this.request(`/api/v1/journey/get_pipeline_configuration_v2?${query}`));
    if (result.data && result.data.page !== (input.page ?? 1)) throw new JobHuntError('invalid_response');
    return result;
  }
  async createPipelineStage(input: pipeline.PipelineStageCreate) {
    return pipeline.pipelineStageResult(await this.request('/api/v1/journey/create_pipeline_stage_v2', {
      method: 'POST', body: { ...pipeline.pipelineWriteInput(input, 'create') },
    }));
  }
  async renamePipelineStage(input: pipeline.PipelineStageRename) {
    const result = pipeline.pipelineStageResult(await this.request('/api/v1/journey/rename_pipeline_stage_v2', {
      method: 'POST', body: { ...pipeline.pipelineWriteInput(input, 'rename') },
    }));
    if (result.data && result.data.stage_id !== input.stage_id.toLowerCase()) throw new JobHuntError('invalid_response');
    return result;
  }
  async reorderPipelineStage(input: pipeline.PipelineStageReorder) {
    const result = pipeline.pipelineStageResult(await this.request('/api/v1/journey/reorder_pipeline_stage_v2', {
      method: 'POST', body: { ...pipeline.pipelineWriteInput(input, 'reorder') },
    }));
    if (result.data && result.data.stage_id !== input.stage_id.toLowerCase()) throw new JobHuntError('invalid_response');
    return result;
  }
  async removePipelineStage(input: pipeline.PipelineStageRemove) {
    const result = pipeline.pipelineStageResult(await this.request('/api/v1/journey/remove_pipeline_stage_v2', {
      method: 'POST', body: { ...pipeline.pipelineWriteInput(input, 'remove') },
    }));
    if (result.data && result.data.stage_id !== input.stage_id.toLowerCase()) throw new JobHuntError('invalid_response');
    return result;
  }
  async getHuntAssignment(input: { search_id: string }) {
    const query = new URLSearchParams({ arguments: JSON.stringify(hunts.huntReadInput(input)) });
    const result = hunts.huntAssignmentResult(await this.request(`/api/v1/journey/get_hunt_assignment_review_v2?${query}`));
    if (result.data && result.data.target.id !== input.search_id.toLowerCase()) throw new JobHuntError('invalid_response');
    return result;
  }
  async assignAllHuntApplications(input: hunts.HuntAssignmentWrite) {
    const result = hunts.huntAssignmentResult(await this.request('/api/v1/journey/assign_all_hunt_applications_v2', {
      method: 'POST', body: { ...hunts.huntAssignmentInput(input) },
    }));
    if (result.data && (result.data.target.id !== input.search_id.toLowerCase() ||
      (input.expected_account_id && result.data.account_id !== input.expected_account_id))) throw new JobHuntError('invalid_response');
    return result;
  }
  async getHuntSettings() {
    return huntSettings.huntSettingsResult(await this.request('/api/v1/journey/get_job_hunt_preferences'));
  }
  async updateHuntPreferences(input: huntSettings.HuntPreferencesWrite) {
    return huntSettings.huntPreferencesResult(await this.request('/api/v1/journey/update_job_hunt_preferences', {
      method: 'POST', body: { ...huntSettings.huntPreferencesInput(input) },
    }));
  }
  async getHuntContext(input: { search_id?: string | null } = {}) {
    const query = new URLSearchParams({ arguments: JSON.stringify(huntSettings.huntContextInput(input)) });
    const result = huntSettings.huntContextResult(await this.request(`/api/v1/journey/get_job_hunt_context?${query}`));
    if (input.search_id && result.data?.search?.id !== input.search_id.toLowerCase()) throw new JobHuntError('invalid_response');
    return result;
  }
  async initializePipeline(input: import('./journey-contracts.ts').MutationIntent) {
    return hunts.pipelineInitializedResult(await this.request('/api/v1/journey/initialize_job_pipeline_v2', {
      method: 'POST', body: { ...hunts.pipelineInitializeInput(input) },
    }));
  }

  async listProfiles(input: profiles.ProfilePageRead = {}) {
    const query = new URLSearchParams({ arguments: JSON.stringify(profiles.profilePageInput(input)) });
    return profiles.profilePageResult(await this.request(`/api/v1/journey/list_contact_profiles?${query}`));
  }
  async getHuntPageWorkspace(input: {page?:number} = {}) {
    const query=new URLSearchParams({arguments:JSON.stringify(huntPage.huntPageReadInput(input))});
    return huntPage.currentHuntPageResult(await this.request(`/api/v1/journey/get_hunt_page_workspace?${query}`));
  }
  async getHuntPage(input: { page?: number } = {}) {
    const query = new URLSearchParams({ arguments: JSON.stringify(huntPage.huntPageReadInput(input)) });
    return huntPage.huntPageResult(await this.request(`/api/v1/journey/get_hunt_page_v2?${query}`));
  }
  async getDocumentExportSource(input: exports.ExportDocumentSelection) {
    const query = new URLSearchParams({ arguments: JSON.stringify(exports.exportDocumentInput(input)) });
    const result = exports.exportSourceResult(await this.request(`/api/v1/journey/get_document_export_source?${query}`));
    if (result.data && (result.data.document_id !== input.document_id.toLowerCase() || result.data.source !== 'document')) throw new JobHuntError('invalid_response');
    return result;
  }
  async listCrm(input: crm.CrmList) {
    const value = crm.crmListInput(input);
    const query = new URLSearchParams({ arguments: JSON.stringify(value) });
    const result = crm.crmPageResult(await this.request(`/api/v1/journey/list_workspace_crm_v2?${query}`), value.kind);
    if (result.data && result.data.page !== (value.page ?? 1)) throw new JobHuntError('invalid_response');
    return result;
  }
  async getCrm(input: crm.CrmRead) {
    const value = crm.crmReadInput(input);
    const query = new URLSearchParams({ arguments: JSON.stringify(value) });
    const result = crm.crmDataResult(await this.request(`/api/v1/journey/get_workspace_crm_v2?${query}`), value.kind);
    if (result.data && (result.data.entity_id !== value.entity_id.toLowerCase() || result.data.deleted ||
      result.data.related_page !== (value.related_page ?? 1))) throw new JobHuntError('invalid_response');
    return result;
  }
  async saveCrmContact(input: crm.CrmMutation) { return this.saveCrm(input, 'contact'); }
  async saveCrmCompany(input: crm.CrmMutation) { return this.saveCrm(input, 'company'); }
  private async saveCrm(input: crm.CrmMutation, kind: crm.CrmKind) {
    const value = crm.crmMutationInput(input, kind);
    const result = crm.crmDataResult(await this.request(`/api/v1/journey/save_workspace_${kind}_v2`,
      { method: 'POST', body: { ...value } }), kind);
    if (result.data && ((value.entity_id && result.data.entity_id !== value.entity_id.toLowerCase()) ||
      result.data.deleted !== (value.action === 'delete'))) throw new JobHuntError('invalid_response');
    return result;
  }
  async getDocumentBundleSource(input: bundles.BundleReadSource) {
    const value = bundles.bundleSourceInput(input);
    const query = new URLSearchParams({ arguments: JSON.stringify(value) });
    const result = bundles.bundleSourceResult(await this.request(`/api/v1/journey/get_document_bundle_source?${query}`));
    if (result.data && bundles.selectionKey(result.data.selection) !== bundles.selectionKey(value.selection)) throw new JobHuntError('invalid_response');
    return result;
  }
  async prepareDocumentBundle(input: bundles.PrepareBundleExport) {
    const value = bundles.prepareBundleInput(input);
    const result = bundles.bundleStateResult(await this.request('/api/v1/journey/prepare_document_bundle', { method: 'POST', body: { ...value } }));
    if (result.data && (result.data.fingerprint !== value.expected_fingerprint ||
      bundles.selectionKey(result.data.selection) !== bundles.selectionKey(value.selection) ||
      result.data.sources.length !== value.expected_sources.length || result.data.sources.some((item, index) =>
        item.id !== value.expected_sources[index].id.toLowerCase() || item.revision !== value.expected_sources[index].revision))) throw new JobHuntError('invalid_response');
    return result;
  }
  async getDocumentBundle(input: exports.ExportRead) {
    const query = new URLSearchParams({ arguments: JSON.stringify(exports.exportReadInput(input)) });
    const result = bundles.bundleStateResult(await this.request(`/api/v1/journey/get_document_bundle?${query}`));
    if (result.data && result.data.id !== input.export_id.toLowerCase()) throw new JobHuntError('invalid_response');
    return result;
  }
  async cancelDocumentBundle(input: exports.CancelExport) {
    const result = bundles.bundleStateResult(await this.request('/api/v1/journey/cancel_document_bundle', { method: 'POST', body: { ...exports.cancelExportInput(input) } }));
    if (result.data && (result.data.id !== input.export_id.toLowerCase() || result.data.status !== 'cancelled')) throw new JobHuntError('invalid_response');
    return result;
  }
  async getDocumentBundleDownload(input: exports.ExportRead) {
    const query = new URLSearchParams({ arguments: JSON.stringify(exports.exportReadInput(input)) });
    const result = bundles.bundleDownloadResult(await this.request(`/api/v1/journey/get_document_bundle_download?${query}`));
    if (result.data && result.data.export_id !== input.export_id.toLowerCase()) throw new JobHuntError('invalid_response');
    return result;
  }
  async downloadDocumentBundle(input: exports.ExportRead) {
    const result = await this.getDocumentBundleDownload(input);
    if (result.outcome !== 'ready' || !result.data) throw new JobHuntError('download_unavailable');
    return { bytes: await downloadPrivateDocument(result.data, this.fetchImpl, this.timeoutMs, this.allowLoopback),
      export_id: result.data.export_id, media_type: result.data.media_type, sha256: result.data.sha256, size_bytes: result.data.size_bytes };
  }
  async getHuntPageExportSource(input: exports.ExportPageSelection) {
    const query = new URLSearchParams({ arguments: JSON.stringify(exports.exportPageInput(input)) });
    const result = exports.exportSourceResult(await this.request(`/api/v1/journey/get_hunt_page_export_source?${query}`));
    if (result.data && (result.data.source !== 'hunt_page' || (input.document_id && result.data.document_id !== input.document_id.toLowerCase()) ||
        result.data.page_revision !== input.expected_revision || result.data.preview_revision !== input.expected_preview_revision)) throw new JobHuntError('invalid_response');
    return result;
  }
  async prepareDocumentExport(input: exports.PrepareDocumentExport) {
    const result = exports.exportStateResult(await this.request('/api/v1/journey/prepare_document_export', { method: 'POST', body: { ...exports.prepareDocumentExportInput(input) } }));
    if (result.data && (result.data.fingerprint !== input.expected_fingerprint || result.data.document_id !== input.document_id.toLowerCase())) throw new JobHuntError('invalid_response');
    return result;
  }
  async prepareHuntPageExport(input: exports.PreparePageExport) {
    const result = exports.exportStateResult(await this.request('/api/v1/journey/prepare_hunt_page_export', { method: 'POST', body: { ...exports.preparePageExportInput(input) } }));
    if (result.data && (result.data.fingerprint !== input.expected_fingerprint || result.data.source !== 'hunt_page')) throw new JobHuntError('invalid_response');
    return result;
  }
  async getDocumentExport(input: exports.ExportRead) {
    const query = new URLSearchParams({ arguments: JSON.stringify(exports.exportReadInput(input)) });
    const result = exports.exportStateResult(await this.request(`/api/v1/journey/get_document_export?${query}`));
    if (result.data && result.data.id !== input.export_id.toLowerCase()) throw new JobHuntError('invalid_response');
    return result;
  }
  async cancelDocumentExport(input: exports.CancelExport) {
    const result = exports.exportStateResult(await this.request('/api/v1/journey/cancel_document_export', { method: 'POST', body: { ...exports.cancelExportInput(input) } }));
    if (result.data && (result.data.id !== input.export_id.toLowerCase() || result.data.status !== 'cancelled')) throw new JobHuntError('invalid_response');
    return result;
  }
  async getDocumentExportDownload(input: exports.ExportRead) {
    const query = new URLSearchParams({ arguments: JSON.stringify(exports.exportReadInput(input)) });
    const result = exports.exportDownloadResult(await this.request(`/api/v1/journey/get_document_export_download?${query}`));
    if (result.data && result.data.export_id !== input.export_id.toLowerCase()) throw new JobHuntError('invalid_response');
    return result;
  }
  async downloadDocumentExport(input: exports.ExportRead) {
    const result = await this.getDocumentExportDownload(input);
    if (result.outcome !== 'ready' || !result.data) throw new JobHuntError('download_unavailable');
    return { bytes: await downloadPrivateDocument(result.data, this.fetchImpl, this.timeoutMs, this.allowLoopback),
      export_id: result.data.export_id, media_type: result.data.media_type, sha256: result.data.sha256, size_bytes: result.data.size_bytes };
  }
  async saveHuntPage(input: huntPage.HuntPageSave) {
    return huntPage.huntPageResult(await this.request('/api/v1/journey/save_hunt_page_v2', { method: 'POST', body: huntPage.huntPageSaveInput(input) }));
  }
  async setHuntPageVisibility(input: huntPage.HuntPageVisibility) {
    return huntPage.huntPageResult(await this.request('/api/v1/journey/set_hunt_page_visibility_v2', { method: 'POST', body: huntPage.huntPageVisibilityInput(input) }));
  }
  async listHighlights(input: highlights.HighlightRead = {}) {
    const query = new URLSearchParams({ arguments: JSON.stringify(highlights.highlightReadInput(input)) });
    const result = highlights.highlightPageResult(await this.request(`/api/v1/journey/list_highlight_records_v2?${query}`));
    if (result.data && (result.data.journal.page !== (input.page ?? 1) || result.data.journal.per_page !== (input.per_page ?? 50))) throw new JobHuntError('invalid_response');
    return result;
  }
  async getHighlight(id: string) {
    if (!highlights.validHighlightId(id)) throw new JobHuntError('invalid_input');
    const query = new URLSearchParams({ arguments: JSON.stringify({ highlight_id: id }) });
    const result = highlights.highlightSavedResult(await this.request(`/api/v1/journey/get_highlight_record_v2?${query}`));
    if (result.data && (result.data.deleted || !result.data.highlight || result.data.highlight.id.toLowerCase() !== id.toLowerCase())) throw new JobHuntError('invalid_response');
    return result;
  }
  async findRecordReferences(input: { query?: string } = {}) {
    const query = new URLSearchParams({ arguments: JSON.stringify(references.recordReferenceFindInput(input)) });
    return references.recordReferenceMatches(await this.request(`/api/v1/journey/find_job_hunt_records?${query}`));
  }
  async getRecordReference(input: { uri: string }) {
    const args = references.recordReferenceReadInput(input);
    const identity = references.recordReferenceIdentity(args.uri)!;
    const query = new URLSearchParams({ arguments: JSON.stringify(args) });
    const result = references.savedRecordReferenceResult(await this.request(`/api/v1/journey/get_job_hunt_reference?${query}`));
    if (result.data) {
      const data = result.data;
      const selected = data.kind === 'application' ? data.application : data.document;
      const path = data.kind === 'application' ? `applications/id/${selected.id}` : `documents/${encodeURIComponent(data.document.slug)}`;
      if (data.kind !== identity.kind || selected.id !== identity.id || selected.revision !== identity.revision ||
          result.revision !== identity.revision || result.website_url !== `https://jobhunt.app/app/${path}`) throw new JobHuntError('invalid_response');
    }
    return result;
  }
  async getTaskWorkspace(input: tasks.TaskReadInput) {
    const args = tasks.taskReadInput(input);
    const query = new URLSearchParams({ arguments: JSON.stringify(args) });
    return workspaceReads.taskWorkspaceResult(await this.request(`/api/v1/journey/get_task_workspace?${query}`), args);
  }
  async listTaskWorkspace(input: workspaceReads.WorkspacePageRead = {}) {
    const args = workspaceReads.workspacePageInput(input);
    const query = new URLSearchParams({ arguments: JSON.stringify(args) });
    return workspaceReads.taskWorkspacePageResult(await this.request(`/api/v1/journey/list_task_workspace?${query}`), args);
  }
  async listApplicationChoices(input: workspaceReads.ApplicationChoicesRead = {}) {
    const args = workspaceReads.choicesInput(input);
    const query = new URLSearchParams({ arguments: JSON.stringify(args) });
    return workspaceReads.choicesResult(await this.request(`/api/v1/journey/list_application_choices?${query}`), args);
  }
  async getOwnedPhoto(id: string) {
    const args = workspaceReads.photoInput(id);
    const query = new URLSearchParams({ arguments: JSON.stringify(args) });
    const result = profiles.profilePhotoResult(await this.request(`/api/v1/journey/get_owned_photo?${query}`));
    if (result.data && result.data.photo_id.toLowerCase() !== id.toLowerCase()) throw new JobHuntError('invalid_response');
    return result;
  }
  async downloadOwnedPhoto(id: string) {
    const result = await this.getOwnedPhoto(id);
    if (result.outcome !== 'ready' || !result.data) throw new JobHuntError('download_unavailable');
    const bytes = profiles.photoBytes(result.data);
    return { bytes, photo_id: result.data.photo_id, media_type: 'image/png' as const, size_bytes: bytes.length };
  }
  async getTaskDescriptionManifest(input: tasks.TaskTarget) {
    const args = workspaceReads.descriptionInput(input);
    const query = new URLSearchParams({ arguments: JSON.stringify(args) });
    return workspaceReads.descriptionManifestResult(await this.request(`/api/v1/journey/get_task_description_manifest?${query}`), args);
  }
  async getTaskDescriptionChunk(input: workspaceReads.TaskDescriptionChunkRead) {
    const args = workspaceReads.descriptionChunkInput(input);
    const query = new URLSearchParams({ arguments: JSON.stringify(args) });
    const result = workspaceReads.descriptionChunkResult(await this.request(`/api/v1/journey/get_task_description_chunk?${query}`), args);
    if (result.data) {
      const bytes = new TextEncoder().encode(result.data.text);
      const digest = Array.from(new Uint8Array(await crypto.subtle.digest('SHA-256', bytes)), b => b.toString(16).padStart(2, '0')).join('');
      if (digest !== result.data.chunk_sha256) throw new JobHuntError('download_checksum_mismatch');
    }
    return result;
  }
  async downloadTaskDescription(input: tasks.TaskTarget) {
    const result = await this.completeFileRead(() => this.getTaskDescriptionManifest(input));
    if (result.outcome !== 'ready' || !result.data) throw new JobHuntError('download_unavailable');
    const metadata = result.data;
    let bytes: Uint8Array<ArrayBuffer>;
    try { bytes = new Uint8Array(metadata.size_bytes); } catch { throw new JobHuntError('download_unavailable'); }
    let offset = 0;
    for (let index = 1; index <= metadata.chunk_count; index++) {
      const response = await this.completeFileRead(() => this.getTaskDescriptionChunk({ task_id: metadata.task_id, expected_application_id: metadata.application_id,
        expected_revision: metadata.revision, expected_sha256: metadata.sha256, chunk_index: index }));
      if (response.outcome !== 'ready' || !response.data) throw new JobHuntError('download_unavailable');
      const { text, chunk_index: _index, chunk_sha256: _hash, ...view } = response.data;
      if (Object.keys(metadata).some(key => metadata[key as keyof typeof metadata] !== view[key as keyof typeof view])) throw new JobHuntError('invalid_response');
      const part = new TextEncoder().encode(text);
      if (offset + part.length > bytes.length) throw new JobHuntError('invalid_response');
      bytes.set(part, offset); offset += part.length;
    }
    const digest = Array.from(new Uint8Array(await crypto.subtle.digest('SHA-256', bytes)), b => b.toString(16).padStart(2, '0')).join('');
    if (offset !== bytes.length || digest !== metadata.sha256) throw new JobHuntError('download_checksum_mismatch');
    return { ...metadata, bytes, media_type: metadata.mime };
  }
  private async completeFileRead<T>(read: () => Promise<T>): Promise<T> {
    for (let attempt = 0; ; attempt++) {
      try { return await read(); }
      catch (error) {
        if (!(error instanceof JobHuntError) || error.status !== 429 || attempt >= 2 ||
            !Number.isInteger(error.retryAfterSeconds) || error.retryAfterSeconds! < 1 || error.retryAfterSeconds! > 60) throw error;
        await new Promise(resolve => setTimeout(resolve, error.retryAfterSeconds! * 1000));
      }
    }
  }
  async getTodayAgenda(input: routines.TodayRead) {
    const query = new URLSearchParams({ arguments: JSON.stringify(routines.todayInput(input)) });
    return routines.todayResult(await this.request(`/api/v1/journey/get_today_agenda?${query}`));
  }
  async getSearchRoutine(input: routines.RoutineRead = {}) {
    const args = routines.routineReadInput(input);
    const query = new URLSearchParams({ arguments: JSON.stringify(args) });
    return routines.routineResult(await this.request(`/api/v1/journey/get_search_routine?${query}`), args);
  }
  async getSearchRoutineRecord(input: routines.RoutineRecordRead) {
    const args = routines.routineRecordInput(input);
    const query = new URLSearchParams({ arguments: JSON.stringify(args) });
    return routines.routineRecordResult(await this.request(`/api/v1/journey/get_search_routine_record?${query}`), args);
  }
  async changeSearchRoutine(input: routines.RoutineWrite) {
    const args = routines.routineWriteInput(input);
    return routines.routineSavedResult(await this.request('/api/v1/journey/change_search_routine', {
      method: 'POST', body: { ...args },
    }), args);
  }
  async getWorkspaceView(input: workspaceView.WorkspaceViewRead = {}) {
    const args = workspaceView.workspaceViewInput(input);
    const query = new URLSearchParams({ arguments: JSON.stringify(args) });
    return workspaceView.workspaceViewResult(await this.request(`/api/v1/journey/get_job_hunt_view?${query}`), args);
  }
  async searchWorkspace(input: workspaceSearch.WorkspaceSearchInput = {}) {
    const query = new URLSearchParams({ arguments: JSON.stringify(workspaceSearch.workspaceSearchInput(input)) });
    const result = workspaceSearch.workspaceSearchResult(await this.request(`/api/v1/journey/search_workspace_v2?${query}`));
    if (input.kind && result.data?.items.some(item => item.type !== input.kind)) throw new JobHuntError('invalid_response');
    return result;
  }
  async resolveWorkspaceLocation(input: workspaceSearch.WorkspaceLocationInput) {
    const query = new URLSearchParams({ arguments: JSON.stringify(workspaceSearch.workspaceLocationInput(input)) });
    const result = workspaceSearch.workspaceLocationResult(await this.request(`/api/v1/journey/resolve_workspace_location_v2?${query}`));
    if (result.data && result.data.kind !== input.kind) throw new JobHuntError('invalid_response');
    return result;
  }
  async getHighlightOptions() {
    return highlights.highlightOptionsResult(await this.request('/api/v1/journey/get_highlight_catalog_v2'));
  }
  async getHighlightChoices(input: highlights.HighlightChoicesRead = {}) {
    const query = new URLSearchParams({ arguments: JSON.stringify(highlights.highlightChoicesInput(input)) });
    const result = highlights.highlightChoicesResult(await this.request(`/api/v1/journey/get_highlight_choices_v2?${query}`));
    if (result.data) {
      for (const [key, page] of [['companies', input.company_page], ['hunts', input.hunt_page], ['roles', input.role_page]] as const) {
        if (result.data[key].page !== (page ?? 1) || result.data[key].per_page !== (input.per_page ?? 50)) throw new JobHuntError('invalid_response');
      }
    }
    return result;
  }
  async saveHighlight(input: highlights.HighlightWrite) {
    const result = highlights.highlightSavedResult(await this.request('/api/v1/journey/save_highlight_record_v2', { method: 'POST', body: highlights.highlightWriteInput(input) }));
    if (result.data && (result.data.deleted !== (input.action === 'delete') || (result.data.highlight &&
        ((input.highlight_id && result.data.highlight.id.toLowerCase() !== input.highlight_id.toLowerCase()) ||
         (result.operation?.resource && result.operation.resource.id.toLowerCase() !== result.data.highlight.id.toLowerCase()))))) throw new JobHuntError('invalid_response');
    return result;
  }
  async getHighlightExport(input: highlights.HighlightExportRead) {
    const query = new URLSearchParams({ arguments: JSON.stringify(highlights.highlightExportInput(input)) });
    const result = highlights.highlightExportResult(await this.request(`/api/v1/journey/get_highlight_export_v2?${query}`));
    const extension = input.format === 'markdown' ? 'md' : 'txt';
    const label = input.date_from || input.date_to ? `${input.date_from || 'start'}-${input.date_to || 'now'}` : 'all';
    if (result.data && (result.data.mime !== (input.format === 'markdown' ? 'text/markdown' : 'text/plain') || result.data.filename !== `highlights-${label}.${extension}`)) throw new JobHuntError('invalid_response');
    return result;
  }
  async downloadHighlights(input: highlights.HighlightExportRead) {
    const result = await this.getHighlightExport(input);
    if (result.outcome !== 'ready' || !result.data) throw new JobHuntError('download_unavailable');
    const { text_chunks, ...metadata } = result.data;
    const bytes = new TextEncoder().encode(text_chunks.join(''));
    const digest = Array.from(new Uint8Array(await crypto.subtle.digest('SHA-256', bytes)), b => b.toString(16).padStart(2, '0')).join('');
    if (bytes.length !== metadata.size_bytes || digest !== metadata.sha256) throw new JobHuntError('download_checksum_mismatch');
    return { ...metadata, bytes, media_type: metadata.mime };
  }
  async getHighlightExportManifest(input: highlights.HighlightExportRead) {
    const query = new URLSearchParams({ arguments: JSON.stringify(highlights.highlightExportInput(input)) });
    const result = highlights.highlightExportManifestResult(await this.request(`/api/v1/journey/get_highlight_export_manifest_v2?${query}`));
    if (result.data && (result.data.format !== input.format || !highlights.highlightExportMatches(result.data, input))) throw new JobHuntError('invalid_response');
    return result;
  }
  async listHighlightRecordFiles(input:highlights.HighlightRead={}) {
    const args=highlights.highlightReadInput(input),query=new URLSearchParams({arguments:JSON.stringify(args)});
    const result=highlightFiles.highlightFilePageResult(await this.request('/api/v1/journey/list_highlight_record_files?'+query));
    if(result.data&&(result.data.page!==(args.page??1)||result.data.per_page!==(args.per_page??50)))throw new JobHuntError('invalid_response');
    return result;
  }
  async getHighlightRecordFile(id:string) {
    if(!highlights.validHighlightId(id))throw new JobHuntError('invalid_input');id=id.toLowerCase();
    const query=new URLSearchParams({arguments:JSON.stringify({highlight_id:id})});
    const result=highlightFiles.highlightFileManifestResult(await this.request('/api/v1/journey/get_highlight_record_file?'+query));
    if(result.data&&result.data.highlight_id!==id)throw new JobHuntError('invalid_response');return result;
  }
  async getHighlightRecordFileChunk(input:highlightFiles.HighlightFileChunkRead) {
    const args=highlightFiles.highlightFileChunkInput(input),query=new URLSearchParams({arguments:JSON.stringify(args)});
    const result=highlightFiles.highlightFileChunkResult(await this.request('/api/v1/journey/get_highlight_record_file_chunk?'+query));
    if(result.data){const row=result.data;if(row.highlight_id!==args.highlight_id||row.fingerprint!==args.expected_fingerprint||row.sha256!==args.expected_sha256||row.chunk_index!==args.chunk_index)throw new JobHuntError('invalid_response');
      if(await highlightFiles.digest(highlightFiles.chunkBytes(row))!==row.chunk_sha256)throw new JobHuntError('download_checksum_mismatch');}
    return result;
  }
  async downloadHighlightRecordFile(id:string) {
    const first=await this.completeFileRead(()=>this.getHighlightRecordFile(id));
    if(first.outcome!=='ready'||!first.data)throw new JobHuntError('download_unavailable');const metadata=first.data;
    let bytes:Uint8Array;try{bytes=new Uint8Array(metadata.size_bytes);}catch{throw new JobHuntError('download_unavailable');}
    let offset=0;
    for(let index=1;index<=metadata.chunk_count;index++){
      const response=await this.completeFileRead(()=>this.getHighlightRecordFileChunk({highlight_id:id,expected_fingerprint:metadata.fingerprint,expected_sha256:metadata.sha256,chunk_index:index}));
      if(response.outcome!=='ready'||!response.data)throw new JobHuntError('download_unavailable');
      const {chunk_index:_index,content_base64:_content,chunk_sha256:_hash,...view}=response.data;
      if(Object.keys(metadata).some(k=>metadata[k as keyof typeof metadata]!==view[k as keyof typeof view]))throw new JobHuntError('invalid_response');
      const part=highlightFiles.chunkBytes(response.data);if(offset+part.length>bytes.length)throw new JobHuntError('invalid_response');bytes.set(part,offset);offset+=part.length;
    }
    if(offset!==bytes.length||await highlightFiles.digest(bytes)!==metadata.sha256)throw new JobHuntError('download_checksum_mismatch');
    highlightFiles.verifiedRecord(bytes,metadata);
    const after=await this.completeFileRead(()=>this.getHighlightRecordFile(id));
    if(!after.data||Object.keys(metadata).some(k=>metadata[k as keyof typeof metadata]!==after.data![k as keyof typeof metadata]))throw new JobHuntError('download_source_changed');
    return {...metadata,bytes,media_type:metadata.mime};
  }
  async saveHighlightFieldsFile(input:highlightFiles.HighlightFileIntent,bytes:Uint8Array) {
    const args=highlightFiles.highlightFileIntent(input);
    if(!(bytes instanceof Uint8Array)||!bytes.length||bytes.length>highlightFiles.MAX_HIGHLIGHT_FIELDS_BYTES)throw new JobHuntError('invalid_input');
    const form=new FormData();form.set('intent',JSON.stringify(args));form.set('fields',new Blob([new Uint8Array(bytes)],{type:'application/json'}),'highlight-fields.json');
    const result=highlightFiles.highlightFileSavedResult(await this.request('/api/v1/journey/highlight-fields-upload',{method:'POST',body:form}));
    if(result.data&&(result.operation?.resource?.id!==result.data.highlight_id||(args.highlight_id&&args.highlight_id.toLowerCase()!==result.data.highlight_id.toLowerCase())||(result.data.current&&result.data.current.account_id!==args.expected_account_id)))throw new JobHuntError('invalid_response');return result;
  }
  async saveHighlightFieldsHostFile(input:highlightFiles.HighlightHostFile) {
    const args=highlightFiles.highlightHostFileInput(input);
    const result=highlightFiles.highlightFileSavedResult(await this.request('/api/v1/journey/save_highlight_fields_file',{method:'POST',body:args}));
    if(result.data&&(result.operation?.resource?.id!==result.data.highlight_id||(args.highlight_id&&args.highlight_id.toLowerCase()!==result.data.highlight_id.toLowerCase())||(result.data.current&&result.data.current.account_id!==args.expected_account_id)))throw new JobHuntError('invalid_response');return result;
  }
  async getHighlightExportChunk(input: highlights.HighlightExportChunkRead) {
    const query = new URLSearchParams({ arguments: JSON.stringify(highlights.highlightExportChunkInput(input)) });
    const result = highlights.highlightExportChunkResult(await this.request(`/api/v1/journey/get_highlight_export_chunk_v2?${query}`));
    if (result.data) {
      if (result.data.format !== input.format || !highlights.highlightExportMatches(result.data, input) ||
          result.data.sha256 !== input.expected_sha256 || result.data.chunk_index !== input.chunk_index) throw new JobHuntError('invalid_response');
      const bytes = new TextEncoder().encode(result.data.text);
      const digest = Array.from(new Uint8Array(await crypto.subtle.digest('SHA-256', bytes)), b => b.toString(16).padStart(2, '0')).join('');
      if (digest !== result.data.chunk_sha256) throw new JobHuntError('download_checksum_mismatch');
    }
    return result;
  }
  async downloadCompleteHighlights(input: highlights.HighlightExportRead) {
    const result = await this.getHighlightExportManifest(input);
    if (result.outcome !== 'ready' || !result.data) throw new JobHuntError('download_unavailable');
    const { format, filename, mime, size_bytes, size_chars, chunk_chars, chunk_count, sha256 } = result.data;
    const metadata = { format, filename, mime, size_bytes, size_chars, chunk_chars, chunk_count, sha256 };
    let bytes: Uint8Array<ArrayBuffer>;
    try { bytes = new Uint8Array(metadata.size_bytes); } catch { throw new JobHuntError('download_unavailable'); }
    let offset = 0;
    for (let index = 1; index <= metadata.chunk_count; index++) {
      const response = await this.getHighlightExportChunk({ ...input, expected_sha256: metadata.sha256, chunk_index: index });
      if (response.outcome !== 'ready' || !response.data) throw new JobHuntError('download_unavailable');
      const { text, chunk_index: _index, chunk_sha256: _hash, ...view } = response.data;
      if (Object.keys(metadata).some(key => metadata[key as keyof typeof metadata] !== view[key as keyof typeof view])) throw new JobHuntError('invalid_response');
      const part = new TextEncoder().encode(text);
      if (offset + part.length > bytes.length) throw new JobHuntError('invalid_response');
      bytes.set(part, offset); offset += part.length;
    }
    const digest = Array.from(new Uint8Array(await crypto.subtle.digest('SHA-256', bytes)), b => b.toString(16).padStart(2, '0')).join('');
    if (offset !== bytes.length || digest !== metadata.sha256) throw new JobHuntError('download_checksum_mismatch');
    return { ...metadata, bytes, media_type: metadata.mime };
  }
  async listWorkActivity(input: insights.InsightPageRead = {}) {
    const query = new URLSearchParams({ arguments: JSON.stringify(insights.insightPageInput(input)) });
    const result = insights.workActivityResult(await this.request(`/api/v1/journey/list_workspace_activity_v2?${query}`));
    if (result.data && result.data.page !== (input.page ?? 1)) throw new JobHuntError('invalid_response');
    return result;
  }
  async getActivityCounts(input: insights.ActivityCountsRead) {
    const query = new URLSearchParams({ arguments: JSON.stringify(insights.activityCountsInput(input)) });
    const result = insights.activityCountsResult(await this.request(`/api/v1/journey/get_hunt_activity_v2?${query}`));
    if (result.data && (result.data.today_date !== input.today || result.data.scope.kind !== (input.search_id ? 'hunt' : 'account'))) throw new JobHuntError('invalid_response');
    return result;
  }
  async getAnalytics(input: insights.AnalyticsRead = {}) {
    const query = new URLSearchParams({ arguments: JSON.stringify(insights.analyticsInput(input)) });
    const result = insights.analyticsResult(await this.request(`/api/v1/journey/get_workspace_analytics_v2?${query}`));
    if (result.data && (result.data.days !== (input.days ?? 90) || result.data.search !== (input.search ?? null))) throw new JobHuntError('invalid_response');
    return result;
  }
  async getCareerFacts() {
    return insights.careerFactsResult(await this.request('/api/v1/journey/get_workspace_career_health_v2'));
  }
  async listNotifications(input: insights.InsightPageRead = {}) {
    const query = new URLSearchParams({ arguments: JSON.stringify(insights.insightPageInput(input)) });
    const result = insights.inboxResult(await this.request(`/api/v1/journey/get_workspace_notifications_v2?${query}`));
    if (result.data && result.data.notifications.meta.pagination.current_page !== (input.page ?? 1)) throw new JobHuntError('invalid_response');
    return result;
  }
  async markNotificationsRead(input: insights.MarkNotificationsRead) {
    const result = insights.inboxSavedResult(await this.request('/api/v1/journey/mark_workspace_notifications_read_v2', { method: 'POST', body: insights.inboxWriteInput(input) }));
    if (result.data && (result.data.action !== input.action || (input.action === 'read' && result.data.notification &&
        result.data.notification.id.toLowerCase() !== input.notification_id!.toLowerCase()))) throw new JobHuntError('invalid_response');
    return result;
  }
  async previewDocumentPage(input: previews.DocumentPreviewRead) {
    const query = new URLSearchParams({ arguments: JSON.stringify(previews.documentPreviewInput(input)) });
    const result = previews.documentPreviewResult(await this.request(`/api/v1/journey/get_document_page_preview_v2?${query}`));
    if (result.data && (result.data.document_id.toLowerCase() !== input.document_id.toLowerCase() ||
        result.data.revision !== input.expected_revision || result.data.page !== (input.page ?? 1))) throw new JobHuntError('invalid_response');
    return result;
  }
  async previewPreparedDocumentPage(input: previews.PreparedPreviewRead) {
    const query = new URLSearchParams({ arguments: JSON.stringify(previews.preparedPreviewInput(input)) });
    const result = previews.documentPreviewResult(await this.request(`/api/v1/journey/get_prepared_page_preview_v2?${query}`));
    if (result.data && (result.data.document_id.toLowerCase() !== input.version_id.toLowerCase() ||
        result.data.revision !== input.expected_revision || result.data.page !== (input.page ?? 1))) throw new JobHuntError('invalid_response');
    return result;
  }
  private previewBytes(result: JourneyResult<previews.DocumentPreview>) {
    if (result.outcome !== 'ready' || !result.data) throw new JobHuntError('invalid_response');
    const { image_chunks: _, ...metadata } = result.data;
    const bytes = privateJPEGBytes(result.data.image_chunks);
    return { ...metadata, bytes, media_type: 'image/jpeg' as const, size_bytes: bytes.length };
  }
  async downloadDocumentPreview(input: previews.DocumentPreviewRead) {
    return this.previewBytes(await this.previewDocumentPage(input));
  }
  async downloadPreparedDocumentPreview(input: previews.PreparedPreviewRead) {
    return { ...this.previewBytes(await this.previewPreparedDocumentPage(input)), application_id: input.application_id, source_sha256: input.expected_sha256 };
  }
  async previewHuntPage(input: huntPage.HuntPagePreviewRead) {
    const query = new URLSearchParams({ arguments: JSON.stringify(huntPage.huntPagePreviewInput(input)) });
    const result = huntPage.huntPagePreviewResult(await this.request(`/api/v1/journey/preview_hunt_page_document?${query}`));
    if (result.data && (result.data.page_revision !== input.expected_revision || result.data.preview_revision !== input.expected_preview_revision ||
      (input.document_id && result.data.document_id !== input.document_id) || result.data.page !== (input.page ?? 1))) throw new JobHuntError('invalid_response');
    return result;
  }
  async downloadHuntPagePreview(input: huntPage.HuntPagePreviewRead) {
    const result = await this.previewHuntPage(input);
    if (result.outcome !== 'ready' || !result.data) throw new JobHuntError('invalid_response');
    const { image_chunks: _, ...metadata } = result.data;
    const bytes = huntPage.huntPagePreviewBytes(result.data);
    return { ...metadata, bytes, media_type: 'image/jpeg' as const, size_bytes: bytes.length };
  }
  async getHuntPagePhoto(input: huntPage.HuntPageMediaRead) {
    const query = new URLSearchParams({ arguments: JSON.stringify(huntPage.huntPageMediaInput(input)) });
    return profiles.profilePhotoResult(await this.request(`/api/v1/journey/get_hunt_page_photo?${query}`));
  }
  async downloadHuntPagePhoto(input: huntPage.HuntPageMediaRead) {
    const result = await this.getHuntPagePhoto(input);
    if (result.outcome !== 'ready' || !result.data) throw new JobHuntError('invalid_response');
    const bytes = profiles.photoBytes(result.data);
    return { bytes, photo_id: result.data.photo_id, media_type: 'image/png' as const, size_bytes: bytes.length };
  }
  async saveHuntPagePhoto(input: huntPage.HuntPagePhotoSave, bytes: Uint8Array) {
    return huntPage.huntPageResult(await this.request('/api/v1/journey/save_hunt_page_photo', { method: 'POST',
      body: { ...huntPage.huntPagePhotoInput(input), image_chunks: profiles.photoChunks(bytes) } }));
  }
  async uploadHuntPagePhotoFile(input:huntPage.HuntPagePhotoSave,bytes:Uint8Array) {
    const intent=huntPage.huntPagePhotoInput(input),source=new Uint8Array(bytes);
    const media=profileFiles.profileFileKind(source),form=new FormData();
    form.set('intent',JSON.stringify(intent));
    form.set('photo',new Blob([source],{type:media}),media==='image/png'?'photo.png':'photo.jpg');
    return huntPage.huntPageResult(await this.request('/api/v1/journey/hunt-page-photo-upload',{method:'POST',body:form}));
  }
  async uploadHuntPagePhotoHostFile(input:huntPage.HuntPagePhotoHostFile) {
    const args=huntPage.huntPagePhotoHostFileInput(input);
    return huntPage.huntPageResult(await this.request('/api/v1/journey/upload_hunt_page_photo_file',{method:'POST',body:args}));
  }
  readonly profileOriginals = new ProfileOriginalClient(this);
  async checkProfileIdentitySource(bytes: Uint8Array) {
    const {source,captured} = profiles.captureProfileIdentitySource(bytes);
    const result = await this.request('/api/v1/journey/check_profile_identity_original_v1', {method:'POST',jsonSource:source});
    profiles.profileIdentityReceipt(result, captured);
    return tasks.operationResult(result);
  }
  async checkProfileIdentity(input: profiles.ProfileIdentityOriginal) {
    const original = profiles.captureProfileIdentityOriginal(input);
    const result = await this.request('/api/v1/journey/check_profile_identity_original_v1', {method:'POST',body:original});
    profiles.profileIdentityReceipt(result, original);
    return tasks.operationResult(result);
  }
  async saveProfileIdentity(input: profiles.ProfileIdentitySave) {
    const args = structuredClone(profiles.profileIdentitySaveInput(input));
    const result = profiles.profileIdentityResult(await this.request('/api/v1/journey/save_profile_identity', { method: 'POST', body: args }), args);
    if (result.data && result.operation?.resource?.id !== result.data.id) throw new JobHuntError('invalid_response');
    return result;
  }
  async listProfileDirectory(input: profiles.ProfilePageRead = {}) {
    const args = profiles.profilePageInput(input);
    const query = new URLSearchParams({ arguments: JSON.stringify(args) });
    return profiles.profileDirectoryResult(await this.request(`/api/v1/journey/list_profile_directory?${query}`), args.page ?? 1);
  }
  async uploadProfilePhoto(input: profiles.ProfilePhotoWrite, bytes: Uint8Array) {
    const args = profiles.profilePhotoInput(input);
    return profiles.profilePersonalResult(await this.request('/api/v1/journey/upload_profile_photo', { method: 'POST',
      body: { ...args, image_chunks: profiles.photoChunks(bytes) } }), args.profile_id);
  }
  async uploadProfilePhotoFile(input: profiles.ProfilePhotoWrite, bytes: Uint8Array) {
    const intent = structuredClone(profiles.profilePhotoInput(input)), source = new Uint8Array(bytes);
    const media = profileFiles.profileFileKind(source), form = new FormData();
    form.set('intent', JSON.stringify(intent));
    form.set('photo', new Blob([source], {type:media}), media === 'image/png' ? 'photo.png' : 'photo.jpg');
    return profiles.profilePersonalResult(await this.request('/api/v1/journey/profile-photo-upload', {method:'POST',body:form}), intent.profile_id);
  }
  async uploadProfilePhotoHostFile(input: profileFiles.ProfilePhotoHostFile) {
    const args = structuredClone(profileFiles.profileHostFileInput(input));
    return profiles.profilePersonalResult(await this.request('/api/v1/journey/upload_profile_photo_file', {method:'POST',body:args}), args.profile_id);
  }
  async getProfilePersonal(id: string) {
    const args = profiles.profileReadInput(id);
    const query = new URLSearchParams({ arguments: JSON.stringify(args) });
    return profiles.profilePersonalResult(await this.request(`/api/v1/journey/get_contact_profile_v2?${query}`), id);
  }
  async saveProfilePersonal(input: profiles.ProfilePersonalSave) {
    const args = profiles.profilePersonalSaveInput(input);
    return profiles.profilePersonalResult(await this.request('/api/v1/journey/save_contact_profile_v2', { method: 'POST', body: args }), args.profile_id);
  }
  async getProfile(id: string) {
    const query = new URLSearchParams({ arguments: JSON.stringify(profiles.profileReadInput(id)) });
    return profiles.profileResult(await this.request(`/api/v1/journey/get_contact_profile_details?${query}`));
  }
  async listProfilePackages(input: profiles.ProfileLinksRead) {
    const query = new URLSearchParams({ arguments: JSON.stringify(profiles.profileLinksInput(input)) });
    return profiles.profileLinksResult(await this.request(`/api/v1/journey/list_contact_profile_packages?${query}`));
  }
  async saveProfile(input: profiles.ProfileSave) {
    return profiles.profileSavedResult(await this.request('/api/v1/journey/save_contact_profile', { method: 'POST', body: profiles.profileSaveInput(input) }));
  }
  async setDefaultProfile(input: profiles.ProfileDefault) {
    return profiles.profileSavedResult(await this.request('/api/v1/journey/set_default_contact_profile', { method: 'POST', body: profiles.profileDefaultInput(input) }));
  }
  async deleteProfile(input: profiles.ProfileDelete) {
    return profiles.profileSavedResult(await this.request('/api/v1/journey/delete_contact_profile', { method: 'POST', body: profiles.profileDeleteInput(input) }));
  }
  async linkProfile(input: profiles.ProfileLink) {
    return documents.documentLibraryResult(await this.request('/api/v1/journey/link_document_package_profile_v2', { method: 'POST', body: profiles.captureProfileLink(input) }));
  }
  async linkProfilePackages(input: profiles.ProfileLinksSave) {
    return profiles.profileBindingsResult(await this.request('/api/v1/journey/link_document_packages_profile', { method: 'POST', body: profiles.profileLinksSaveInput(input) }));
  }
  async unlinkProfile(input: profiles.ProfileUnlink) {
    return profiles.profileBindingsResult(await this.request('/api/v1/journey/unlink_document_package_profile', { method: 'POST', body: profiles.profileUnlinkInput(input) }));
  }
  async getProfilePhoto(id: string) {
    const query = new URLSearchParams({ arguments: JSON.stringify(profiles.profileReadInput(id)) });
    return profiles.profilePhotoResult(await this.request(`/api/v1/journey/get_profile_photo?${query}`));
  }
  async saveProfilePhoto(input: profiles.ProfilePhotoWrite, bytes: Uint8Array) {
    const body = { ...profiles.profilePhotoInput(input), image_chunks: profiles.photoChunks(bytes) };
    return profiles.profileSavedResult(await this.request('/api/v1/journey/save_profile_photo', { method: 'POST', body }));
  }
  async downloadProfilePhoto(id: string) {
    const result = await this.getProfilePhoto(id);
    if (result.outcome !== 'ready' || !result.data) throw new JobHuntError('invalid_response');
    const bytes = profiles.photoBytes(result.data);
    return { bytes, profile_id: id, photo_id: result.data.photo_id, media_type: 'image/png' as const, size_bytes: bytes.length };
  }
  async listApplications(options: { page?: number; pageSize?: number; search?: string; status?: string } = {}): Promise<Document<Application[]>> {
    const query = new URLSearchParams({ 'page[number]': String(boundedInteger(options.page ?? 1, 1, 1000000)),
      'page[size]': String(boundedInteger(options.pageSize ?? 20, 1, 100)) });
    for (const [key, value] of [['search', options.search], ['status', options.status]] as const) {
      if (value !== undefined) { if (value.length > 500) throw new JobHuntError('invalid_input'); query.set(`filter[${key}]`, value); }
    }
    const result = await this.request(`/api/v1/applications/?${query}`);
    if (!record(result) || !Array.isArray(result.data)) throw new JobHuntError('invalid_response');
    result.data.forEach(assertApplication);
    return result as unknown as Document<Application[]>;
  }
  async getApplication(slug: string): Promise<Document<Application>> {
    return applicationDocument(await this.request(`/api/v1/applications/${identifier(slug)}`));
  }
  async createApplication(attributes: CreateApplication, metadata?: ApplicationCreationMeta): Promise<Document<Application>> {
    validateCreation(attributes, metadata);
    return applicationDocument(await this.request('/api/v1/applications/', { method: 'POST',
      body: { data: { type: 'application', attributes, ...(metadata === undefined ? {} : { meta: metadata }) } } }));
  }
  async updateApplication(slug: string, attributes: UpdateApplication, version: number): Promise<Document<Application>> {
    validateAttributes(attributes, false); boundedInteger(version, 1, 2147483647);
    return applicationDocument(await this.request(`/api/v1/applications/${identifier(slug)}`, { method: 'PATCH',
      body: { data: { type: 'application', id: slug, attributes, meta: { version } } } }));
  }
  async deleteApplication(slug: string): Promise<void> {
    await this.request(`/api/v1/applications/${identifier(slug)}`, { method: 'DELETE' });
  }
  get workspaceOriginals() { return new WorkspaceOriginalClient(this); }
  get apiKeys() { return new ApiKeyClient(this); }
  get studioOriginals() { return new StudioOriginalClient(this); }
  async listApplicationRecordFiles(input: recordFiles.ApplicationRecordFileDirectory) {
    const args = recordFiles.recordFileDirectory(input), query = new URLSearchParams({ arguments: JSON.stringify(args) });
    const result = recordFiles.recordFilePageResult(await this.request('/api/v1/journey/list_application_record_files?' + query));
    if (result.data && (result.data.application_id !== args.application_id || result.data.kind !== args.kind || result.data.page !== (args.page ?? 1) || result.data.per_page !== (args.per_page ?? 50))) throw new JobHuntError('invalid_response');
    return result;
  }
  async getApplicationRecordFile(input: recordFiles.ApplicationRecordFileRead) {
    const args = recordFiles.recordFileRead(input), query = new URLSearchParams({ arguments: JSON.stringify(args) });
    const result = recordFiles.recordFileManifestResult(await this.request('/api/v1/journey/get_application_record_file?' + query));
    if (result.data && (result.data.application_id !== args.application_id || result.data.kind !== args.kind || result.data.record_id !== args.record_id)) throw new JobHuntError('invalid_response');
    return result;
  }
  async getApplicationRecordFileChunk(input: recordFiles.ApplicationRecordFileChunkRead) {
    const args = recordFiles.recordFileChunkInput(input), query = new URLSearchParams({ arguments: JSON.stringify(args) });
    const result = recordFiles.recordFileChunkResult(await this.request('/api/v1/journey/get_application_record_file_chunk?' + query));
    if (result.data) {
      const row = result.data;
      if (row.application_id !== args.application_id || row.kind !== args.kind || row.record_id !== args.record_id || row.fingerprint !== args.expected_fingerprint || row.sha256 !== args.expected_sha256 || row.chunk_index !== args.chunk_index) throw new JobHuntError('invalid_response');
      if (await recordFiles.digest(recordFiles.chunkBytes(row)) !== row.chunk_sha256) throw new JobHuntError('download_checksum_mismatch');
    }
    return result;
  }
  async downloadApplicationRecordFile(input: recordFiles.ApplicationRecordFileRead) {
    const first = await this.completeFileRead(() => this.getApplicationRecordFile(input));
    if (first.outcome !== 'ready' || !first.data) throw new JobHuntError('download_unavailable');
    const metadata = first.data;
    let bytes: Uint8Array; try { bytes = new Uint8Array(metadata.size_bytes); } catch { throw new JobHuntError('download_unavailable'); }
    let offset = 0;
    for (let index = 1; index <= metadata.chunk_count; index++) {
      const response = await this.completeFileRead(() => this.getApplicationRecordFileChunk({ ...input, expected_fingerprint: metadata.fingerprint, expected_sha256: metadata.sha256, chunk_index: index }));
      if (response.outcome !== 'ready' || !response.data) throw new JobHuntError('download_unavailable');
      const { chunk_index: _index, content_base64: _content, chunk_sha256: _hash, ...view } = response.data;
      if (Object.keys(metadata).some(key => metadata[key as keyof typeof metadata] !== view[key as keyof typeof view])) throw new JobHuntError('invalid_response');
      const part = recordFiles.chunkBytes(response.data);
      if (offset + part.length > bytes.length) throw new JobHuntError('invalid_response');
      bytes.set(part, offset); offset += part.length;
    }
    if (offset !== bytes.length || await recordFiles.digest(bytes) !== metadata.sha256) throw new JobHuntError('download_checksum_mismatch');
    recordFiles.verifiedRecord(bytes, metadata);
    const after = await this.completeFileRead(() => this.getApplicationRecordFile(input));
    if (!after.data || Object.keys(metadata).some(key => metadata[key as keyof typeof metadata] !== after.data![key as keyof typeof metadata])) throw new JobHuntError('download_source_changed');
    return { ...metadata, bytes, media_type: metadata.mime };
  }
  async saveApplicationRecordFieldsFile(input: recordFiles.ApplicationRecordFileIntent, bytes: Uint8Array) {
    const args = recordFiles.recordFileIntent(input);
    if (!(bytes instanceof Uint8Array) || !bytes.length || bytes.length > recordFiles.MAX_APPLICATION_RECORD_FIELDS_BYTES) throw new JobHuntError('invalid_input');
    const form = new FormData(); form.set('intent', JSON.stringify(args));
    form.set('fields', new Blob([new Uint8Array(bytes)], { type: 'application/json' }), 'application-record-fields.json');
    const result = recordFiles.recordFileSavedResult(await this.request('/api/v1/journey/application-record-fields-upload', { method: 'POST', body: form }));
    if (result.data && (result.data.application_id !== args.application_id || args.record_id && result.data.record_id !== args.record_id || result.data.current && (result.data.current.account_id !== args.expected_account_id || result.data.current.kind !== args.kind))) throw new JobHuntError('invalid_response');
    return result;
  }
  async saveApplicationRecordFieldsHostFile(input: recordFiles.ApplicationRecordHostFile) {
    const args = recordFiles.recordHostFile(input);
    const result = recordFiles.recordFileSavedResult(await this.request('/api/v1/journey/save_application_record_fields_file', { method: 'POST', body: args }));
    if (result.data && (result.data.application_id !== args.application_id || args.record_id && result.data.record_id !== args.record_id || result.data.current && (result.data.current.account_id !== args.expected_account_id || result.data.current.kind !== args.kind))) throw new JobHuntError('invalid_response');
    return result;
  }
  async applicationWorkspace(input: records.ApplicationWorkspaceInput) {
    const query = new URLSearchParams({ arguments: JSON.stringify(records.applicationWorkspaceInput(input)) });
    return records.applicationWorkspaceResult(await this.request(`/api/v1/journey/get_application_workspace_v2?${query}`));
  }
  async getApplicationCompensation(input: compensation.CompensationRead) {
    const args = compensation.compensationRead(input);
    const query = new URLSearchParams({ arguments: JSON.stringify(args) });
    return compensation.compensationManifestResult(await this.request(`/api/v1/journey/get_application_compensation?${query}`), args);
  }
  async getApplicationCompensationChunk(input: compensation.CompensationChunkRead) {
    const args = compensation.compensationChunkRead(input);
    const query = new URLSearchParams({ arguments: JSON.stringify(args) });
    return compensation.compensationChunkResult(await this.request(`/api/v1/journey/get_application_compensation_chunk?${query}`), args);
  }
  async getCompensationReplacement(input: compensation.CompensationDraftRead) {
    const args = compensation.compensationDraftRead(input);
    const query = new URLSearchParams({ arguments: JSON.stringify(args) });
    return compensation.compensationDraftResult(await this.request(`/api/v1/journey/get_compensation_replacement?${query}`), args);
  }
  async prepareCompensationReplacement(input: compensation.CompensationPrepare) {
    const args = compensation.compensationPrepare(input);
    return compensation.compensationDraftResult(await this.request('/api/v1/journey/prepare_compensation_replacement', { method: 'POST', body: { ...args } }), args);
  }
  async appendCompensationReplacement(input: compensation.CompensationAppend) {
    const args = compensation.compensationAppend(input);
    return compensation.compensationDraftResult(await this.request('/api/v1/journey/append_compensation_replacement', { method: 'POST', body: { ...args } }), args);
  }
  async commitCompensationReplacement(input: compensation.CompensationDraftWrite) {
    const args = compensation.compensationDraftWrite(input);
    const result = compensation.compensationManifestResult(await this.request('/api/v1/journey/commit_compensation_replacement', { method: 'POST', body: { ...args } }), args);
    if (result.data && (!result.operation || result.operation.kind !== 'commit_compensation_replacement' ||
        result.operation.resource?.id !== args.application_id.toLowerCase() ||
        !Number.isSafeInteger(result.operation.resource?.revision) || Number(result.operation.resource?.revision) < 1 ||
        Number(result.operation.resource?.revision) > result.data.revision || result.revision !== result.data.revision ||
        (args.expected_account_id && result.data.account_id !== args.expected_account_id))) throw new JobHuntError('invalid_response');
    return result;
  }
  async cancelCompensationReplacement(input: compensation.CompensationDraftWrite) {
    const args = compensation.compensationDraftWrite(input);
    return compensation.compensationDraftResult(await this.request('/api/v1/journey/cancel_compensation_replacement', { method: 'POST', body: { ...args } }), args);
  }
  async downloadApplicationCompensation(input: compensation.CompensationRead) {
    const result = await this.completeFileRead(() => this.getApplicationCompensation(input));
    if (result.outcome !== 'ready' || !result.data) throw new JobHuntError('download_unavailable');
    const metadata = result.data;
    let bytes: Uint8Array<ArrayBuffer>;
    try { bytes = new Uint8Array(metadata.size_bytes); } catch { throw new JobHuntError('download_unavailable'); }
    let offset = 0;
    for (let index = 1; index <= metadata.chunk_count; index++) {
      const response = await this.completeFileRead(() => this.getApplicationCompensationChunk({ application_id: metadata.application_id,
        expected_revision: metadata.revision, expected_sha256: metadata.sha256, chunk_index: index }));
      if (response.outcome !== 'ready' || !response.data) throw new JobHuntError('download_unavailable');
      const { base64, chunk_index: _index, chunk_sha256, ...view } = response.data;
      if (Object.keys(metadata).some(key => metadata[key as keyof typeof metadata] !== view[key as keyof typeof view])) throw new JobHuntError('invalid_response');
      const part = compensation.compensationBytes(base64, true);
      if (await compensation.compensationDigest(part) !== chunk_sha256 || offset + part.length > bytes.length) throw new JobHuntError('download_checksum_mismatch');
      bytes.set(part, offset); offset += part.length;
    }
    if (offset !== bytes.length || await compensation.compensationDigest(bytes) !== metadata.sha256) throw new JobHuntError('download_checksum_mismatch');
    return { ...metadata, bytes, media_type: metadata.mime };
  }
  async replaceApplicationCompensation(input: compensation.CompensationReplaceIntent, bytes: Uint8Array) {
    const args = compensation.compensationReplaceIntent(input);
    if (!(bytes instanceof Uint8Array) || bytes.length < 1 || bytes.length > compensation.compensationMaxBytes) throw new JobHuntError('invalid_input');
    const source_sha256 = await compensation.compensationDigest(bytes);
    const prepared = await this.prepareCompensationReplacement({ ...args, size_bytes: bytes.length, source_sha256 });
    if (prepared.outcome !== 'ready' || !prepared.data) throw new JobHuntError('source_unavailable');
    const draft = prepared.data;
    if (draft.status === 'expired') throw new JobHuntError('retry_expired', 410);
    if (draft.status === 'cancelled') throw new JobHuntError('revision_conflict', 409);
    const target = { application_id: args.application_id, draft_id: draft.draft_id, expected_account_id: args.expected_account_id };
    if (draft.status === 'open') {
      for (let index = draft.next_chunk_index; index <= Math.ceil(bytes.length / 24000); index++) {
        const part = bytes.subarray((index - 1) * 24000, index * 24000);
        const base64 = btoa(Array.from(part, byte => String.fromCharCode(byte)).join(''));
        const saved = await this.appendCompensationReplacement({ ...target, request_id: await compensation.compensationRequestId(args.request_id, 'chunk:' + index), chunk_index: index, base64 });
        if (saved.outcome !== 'ready' || !saved.data || saved.data.source_sha256 !== source_sha256 || saved.data.size_bytes !== bytes.length ||
            saved.data.account_id !== draft.account_id || saved.data.expected_revision !== draft.expected_revision ||
            saved.data.expected_sha256 !== draft.expected_sha256) throw new JobHuntError('invalid_response');
      }
    }
    const saved = await this.commitCompensationReplacement({ ...target, request_id: await compensation.compensationRequestId(args.request_id, 'commit') });
    if (saved.data && saved.data.account_id !== draft.account_id) throw new JobHuntError('invalid_response');
    return saved;
  }
  async listPipelineStages(input: { page?: number; pageSize?: number } = {}) {
    const query = new URLSearchParams({ 'page[number]': String(boundedInteger(input.page ?? 1, 1, 10000)),
      'page[size]': String(boundedInteger(input.pageSize ?? 20, 1, 100)) });
    return jobs.pipelineStagesResult(await this.request(`/api/v1/pipeline-stages/?${query}`));
  }
  async listDocuments(input: { page?: number; pageSize?: number } = {}) {
    const query = new URLSearchParams({ 'page[number]': String(boundedInteger(input.page ?? 1, 1, 10000)),
      'page[size]': String(boundedInteger(input.pageSize ?? 20, 1, 100)) });
    return documents.documentLibraryPage(await this.request(`/api/v1/resume-templates/?${query}`));
  }
  async getDocument(documentId: string) {
    if (!resourceId(documentId)) throw new JobHuntError('invalid_input');
    const query = new URLSearchParams({ arguments: JSON.stringify({ document_id: documentId }) });
    return documents.careerDocumentResult(await this.request(`/api/v1/journey/get_document?${query}`));
  }
  async createDocument(input: documents.CreateCareerDocument) {
    return documents.careerDocumentResult(await this.request('/api/v1/journey/create_resume_template_v2', {
      method: 'POST', body: { ...documents.createCareerDocumentInput(input) },
    }));
  }
  async updateDocumentSection(input: documents.UpdateCareerSection) {
    return documents.careerDocumentResult(await this.request('/api/v1/journey/update_resume_section_v2', {
      method: 'POST', body: { ...documents.updateCareerSectionInput(input) },
    }));
  }
  async documentRevisions(input: documents.DocumentRevisionRead) {
    const captured = { ...documents.documentRevisionReadInput(input) };
    const query = new URLSearchParams({ arguments: JSON.stringify(captured) });
    return documents.documentRevisionsResult(await this.request(`/api/v1/journey/list_document_revisions?${query}`), captured);
  }
  async checkpointDocument(input: documents.NamedDocumentWrite) {
    return documents.documentCheckpointResult(await this.request('/api/v1/journey/create_document_checkpoint_v2', {
      method: 'POST', body: { ...documents.documentWriteInput(input, 'named') },
    }));
  }
  async restoreDocument(input: documents.RestoreDocument) {
    return documents.careerDocumentResult(await this.request('/api/v1/journey/restore_document_revision', {
      method: 'POST', body: { ...documents.documentWriteInput(input, 'restore') },
    }));
  }
  async restoreDocumentSnapshot(input: documents.RestoreDocument) {
    const args = documents.documentWriteInput(input, 'restore');
    const result = documents.documentCheckpointResult(await this.request('/api/v1/journey/restore_document_snapshot_v1', {
      method: 'POST', body: { ...args },
    }));
    if (result.outcome === 'ready' && (result.data?.id !== args.document_id || result.data.revision !== args.expected_revision + 1
      || result.operation?.kind !== 'restore_document_revision' || result.operation.status !== 'succeeded'
      || result.operation.resource?.id !== args.document_id || result.operation.resource.revision !== result.data.revision)) {
      throw new JobHuntError('invalid_response');
    }
    return result;
  }
  async renameDocument(input: documents.NamedDocumentWrite) {
    return documents.documentLibraryResult(await this.request('/api/v1/journey/rename_document_v2', {
      method: 'POST', body: { ...documents.documentWriteInput(input, 'named') },
    }));
  }
  async duplicateDocument(input: documents.NamedDocumentWrite) {
    return documents.documentLibraryResult(await this.request('/api/v1/journey/duplicate_document_v2', {
      method: 'POST', body: { ...documents.documentWriteInput(input, 'named') },
    }));
  }
  async getDocumentPackageOrder(input: {package_id: string}) {
    const args=packageOrder.packageOrderRead(input);
    return packageOrder.packageOrderResult(await this.request('/api/v1/journey/get_document_package_order_v1?'+new URLSearchParams({arguments:JSON.stringify(args)})),args.package_id);
  }
  async reorderDocumentPackage(input: packageOrder.PackageOrderWrite) {
    const args=packageOrder.packageOrderWrite(input);
    return packageOrder.packageOrderResult(await this.request('/api/v1/journey/reorder_document_package_v1', {method:'POST',body:{...args}}),args.package_id);
  }
  async setDefaultDocument(input: documents.DocumentWrite) {
    return documents.documentLibraryResult(await this.request('/api/v1/journey/set_default_document_v2', {
      method: 'POST', body: { ...documents.documentWriteInput(input, 'plain') },
    }));
  }
  async deleteDocument(input: documents.DocumentWrite) {
    return documents.documentLibraryResult(await this.request('/api/v1/journey/delete_document_v2', {
      method: 'POST', body: { ...documents.documentWriteInput(input, 'plain') },
    }));
  }
  async importResumeText(input: documents.ResumeTextImport) {
    return documents.resumeImportResult(await this.request('/api/v1/journey/import_resume_text', {
      method: 'POST', body: { ...documents.resumeTextImportInput(input) },
    }));
  }
  async prepareResumeFileUpload(input: importFiles.PrepareResumeFileUpload) {
    return importFiles.privateResumeUploadResult(await this.request('/api/v1/journey/prepare_resume_file_upload', {
      method: 'POST', body: { ...importFiles.prepareResumeUploadInput(input) },
    }));
  }
  async importUploadedResume(input: importFiles.ImportUploadedResume) {
    return documents.resumeImportResult(await this.request('/api/v1/journey/import_uploaded_resume', {
      method: 'POST', body: { ...importFiles.importUploadedResumeInput(input) },
    }));
  }
  async uploadResumeFile(input: importFiles.ResumeFileUpload, bytes: Uint8Array,
    transport: importFiles.ResumeUploadTransport = 'auto') {
    const fields = { ...importFiles.resumeFileUploadInput(input) };
    const kind = importFiles.resumeFileKind(bytes);
    if (!['auto', 'direct', 'multipart'].includes(transport)) throw new JobHuntError('invalid_input');
    const mediaType = kind === 'pdf' ? 'application/pdf' : 'application/vnd.openxmlformats-officedocument.wordprocessingml.document';
    if (transport === 'direct' || (transport === 'auto' && bytes.byteLength > 4 * 1024 * 1024)) {
      // Freeze the user's source before hashing or any asynchronous network work.
      const source = new Uint8Array(bytes);
      const digest = Array.from(new Uint8Array(await crypto.subtle.digest('SHA-256', source)), b => b.toString(16).padStart(2, '0')).join('');
      const prepared = await this.prepareResumeFileUpload({ ...fields, size_bytes: source.byteLength, sha256: digest, media_type: mediaType });
      const upload = prepared.data;
      if (!upload || upload.size_bytes !== source.byteLength || upload.sha256 !== digest || upload.media_type !== mediaType)
        throw new JobHuntError('invalid_upload');
      if (upload.status === 'awaiting_upload')
        await importFiles.putResumeBytes(upload, source, this.fetchImpl, this.timeoutMs, this.allowLoopback);
      // Both named mutations use the original request ID; an accepted upload is
      // never PUT again. Receipt replay resolves a lost final response.
      return this.importUploadedResume({ ...fields, upload_id: upload.id });
    }
    const form = new FormData();
    form.set('request_id', fields.request_id);
    if (fields.expected_account_id != null) form.set('expected_account_id', fields.expected_account_id);
    // Neither a personal path nor the original filename is needed by the service.
    form.set('file', new Blob([new Uint8Array(bytes)], { type: mediaType }), 'resume.' + kind);
    return documents.resumeImportResult(await this.request('/api/v1/journey/resume-upload', { method: 'POST', body: form }));
  }
  async importResumeHostFile(input: importFiles.ResumeHostFileImport) {
    return documents.resumeImportResult(await this.request('/api/v1/journey/import_resume_file', {
      method: 'POST', body: { ...importFiles.resumeHostFileInput(input) },
    }));
  }
  async getResumeImport(importId: string) {
    if (!resourceId(importId)) throw new JobHuntError('invalid_input');
    const query = new URLSearchParams({ arguments: JSON.stringify({ import_id: importId }) });
    return documents.resumeImportResult(await this.request(`/api/v1/journey/get_resume_import?${query}`));
  }
  async confirmResumeImport(input: documents.ConfirmResumeImport) {
    return documents.careerDocumentResult(await this.request('/api/v1/journey/confirm_resume_import', {
      method: 'POST', body: { ...documents.confirmResumeImportInput(input) },
    }));
  }
  async checkResumeImportOriginal(input:ResumeImportOriginal){
    return new ResumeImportOriginalClient(this.request.bind(this)).check(input);
  }
  async closeResumeImportOriginal(input:ResumeImportOriginal){
    return new ResumeImportOriginalClient(this.request.bind(this)).close(input);
  }
  async checkResumeImportFileOriginal(input:ResumeImportFileOriginal,bytes:Uint8Array){
    return new ResumeImportOriginalClient(this.request.bind(this)).file(input,bytes);
  }
  async closeResumeImportFileOriginal(input:ResumeImportFileOriginal,bytes:Uint8Array){
    return new ResumeImportOriginalClient(this.request.bind(this)).file(input,bytes,true);
  }
  async closeScreeningAnswersOriginal(input: AnswerOriginal) {
    const captured=answerOriginal(input);
    return answerClosure(await this.request('/api/v1/journey/close_screening_answers_original_v1',{method:'POST',body:{...captured,confirm_close:true}}),captured);
  }
  async closeApplicationDocumentsOriginal(input: ToolkitOriginal) {
    const captured=toolkitOriginal(input);
    return toolkitClosure(await this.request('/api/v1/journey/close_application_documents_original_v1', {
      method:'POST',body:{...captured,confirm_close:true},
    }),captured);
  }
  async getApplicationDocuments(appSlug: string) {
    if (!resourceId(appSlug)) throw new JobHuntError('invalid_input');
    const query = new URLSearchParams({ arguments: JSON.stringify({ app_slug: appSlug }) });
    return packages.applicationDocumentsResult(await this.request(`/api/v1/journey/get_application_documents_v2?${query}`));
  }
  async listApplicationResumeChoices(input: packages.ResumeChoicesRead) {
    const query = new URLSearchParams({ arguments: JSON.stringify(packages.resumeChoicesInput(input)) });
    return packages.resumeChoicesResult(await this.request(`/api/v1/journey/list_application_resume_choices_v2?${query}`));
  }
  async selectApplicationDocuments(input: packages.SelectApplicationDocuments) {
    return packages.applicationDocumentsResult(await this.request('/api/v1/journey/select_application_documents_v2', {
      method: 'POST', body: { ...packages.selectApplicationDocumentsInput(input) },
    }));
  }
  async customizeApplicationDocuments(input: packages.CustomizeApplicationDocuments) {
    return packages.applicationDocumentsResult(await this.request('/api/v1/journey/customize_application_documents_v2', {
      method: 'POST', body: { ...packages.customizeApplicationDocumentsInput(input) },
    }));
  }
  async createCoverLetter(input: packages.CreateCoverLetter) {
    return documents.careerDocumentResult(await this.request('/api/v1/journey/create_cover_letter_document_v2', {
      method: 'POST', body: { ...packages.createCoverLetterInput(input) },
    }));
  }
  async getPublication(kind: publications.PublicationKind, sourceId: string, expectedAccountId?: string) {
    publications.publicationKind(kind);
    if (!uuid(sourceId) || expectedAccountId !== undefined && (!expectedAccountId.startsWith('jh_') || !uuid(expectedAccountId.slice(3)))) throw new JobHuntError('invalid_input');
    const captured = {source_id:sourceId.toLowerCase(),...(expectedAccountId===undefined?{}:{expected_account_id:expectedAccountId})};
    const query = new URLSearchParams({arguments:JSON.stringify(captured)});
    return publications.publicationStateResult(await this.request('/api/v1/journey/get_'+kind+'_publication?'+query),kind,captured.source_id);
  }
  async changePublication(input: publications.PublicationOriginal) {
    const captured=publications.publicationOriginal(input);
    return publications.publicationAccepted(await this.request('/api/v1/journey/'+publications.publicationOperation(captured.source_type,captured.original.action),{
      method:'POST',body:{...captured.original},
    }),captured);
  }
  async checkPublicationOriginal(input: publications.PublicationOriginal) {
    const prepared=await publications.preparePublicationOriginal(input);
    const query=new URLSearchParams({arguments:JSON.stringify(prepared.read)});
    return publications.publicationReceipt(await this.request('/api/v1/journey/get_job_hunt_operation?'+query),prepared.captured);
  }
  async closePublicationOriginal(input: publications.PublicationOriginal) {
    const captured=publications.publicationOriginal(input);
    return publications.publicationClosure(await this.request('/api/v1/journey/close_'+captured.source_type+'_publication_original_v1',{
      method:'POST',body:{...captured,confirm_close:true},
    }),captured);
  }
  async checkPreparationOriginal(input: PreparationOriginal) {
    const prepared=await preparePreparationOriginal(input);
    const query=new URLSearchParams({arguments:JSON.stringify(prepared.read)});
    return preparationReceipt(await this.request('/api/v1/journey/get_job_hunt_operation?'+query),prepared.captured);
  }
  async closePreparationOriginal(input: PreparationOriginal) {
    const captured=preparationOriginal(input);
    return preparationClosure(await this.request('/api/v1/journey/close_preparation_original_v1',{method:'POST',body:{...captured,confirm_close:true}}),captured);
  }
  async prepareApplicationPackage(input: packages.PrepareApplicationPackage) {
    return packages.preparedPackageResult(await this.request('/api/v1/journey/prepare_application_package', {
      method: 'POST', body: { ...packages.prepareApplicationPackageInput(input) },
    }));
  }
  async getPreparedPackage(packageId: string) {
    if (!resourceId(packageId)) throw new JobHuntError('invalid_input');
    const query = new URLSearchParams({ arguments: JSON.stringify({ package_id: packageId }) });
    return packages.preparedPackageResult(await this.request(`/api/v1/journey/get_prepared_package?${query}`));
  }
  async listApplicationPackages(input: packages.PackageListRead) {
    const query = new URLSearchParams({ arguments: JSON.stringify(packages.packageListInput(input)) });
    return packages.packageListResult(await this.request(`/api/v1/journey/list_application_packages?${query}`));
  }
  async getPreparedDocumentDownload(input: packages.PreparedDownloadRead) {
    const query = new URLSearchParams({ arguments: JSON.stringify(packages.preparedDownloadInput(input)) });
    const result = packages.preparedDownloadResult(await this.request(`/api/v1/journey/get_prepared_document_download?${query}`));
    if (result.data && (result.data.package_id !== input.package_id || result.data.version_id !== input.version_id)) throw new JobHuntError('invalid_response');
    return result;
  }
  async downloadPreparedDocument(input: packages.PreparedDownloadRead) {
    const result = await this.getPreparedDocumentDownload(input);
    if (result.outcome !== 'ready' || !result.data) throw new JobHuntError('download_unavailable');
    return { bytes: await downloadPDF(result.data, this.fetchImpl, this.timeoutMs, this.allowLoopback),
      package_id: result.data.package_id, version_id: result.data.version_id, sha256: result.data.sha256, size_bytes: result.data.size_bytes };
  }
  async getSavedJob(applicationId: string) {
    const query = new URLSearchParams({ arguments: JSON.stringify(jobs.jobReadInput({ application_id: applicationId })) });
    return jobs.savedJobResult(await this.request(`/api/v1/journey/get_application_v2?${query}`));
  }
  async saveJobURL(input: jobs.CaptureJobURL) {
    return jobs.savedJobResult(await this.request('/api/v1/journey/save_job_url_v2', { method: 'POST', body: { ...jobs.captureJobURLInput(input) } }));
  }
  async saveJobDetails(input: jobs.CaptureJobDetails) {
    return jobs.savedJobResult(await this.request('/api/v1/journey/save_job_details', { method: 'POST', body: { ...jobs.captureJobDetailsInput(input) } }));
  }
  async saveTargetCompany(input: jobs.CaptureTargetCompany) {
    return jobs.savedJobResult(await this.request('/api/v1/journey/save_target_company_v2', { method: 'POST', body: { ...jobs.captureTargetCompanyInput(input) } }));
  }
  async editJobDetails(input: jobs.EditJobDetails) {
    return jobs.savedJobResult(await this.request('/api/v1/journey/edit_job_details', { method: 'POST', body: { ...jobs.editJobDetailsInput(input) } }));
  }
  async moveJobStage(input: jobs.MoveJobStage) {
    return jobs.savedJobResult(await this.request('/api/v1/journey/move_job_stage', { method: 'POST', body: { ...jobs.moveJobStageInput(input) } }));
  }
  async submissionOptions(input: submissions.SubmissionOptionsRead) {
    const query = new URLSearchParams({ arguments: JSON.stringify(submissions.submissionOptionsInput(input)) });
    return submissions.submissionOptionsResult(await this.request(`/api/v1/journey/get_submission_options?${query}`));
  }
  async listSubmissions(input: submissions.SubmissionRead) {
    const query = new URLSearchParams({ arguments: JSON.stringify(submissions.submissionReadInput(input)) });
    return submissions.submissionHistoryResult(await this.request(`/api/v1/journey/get_application_submissions?${query}`));
  }
  async closeSubmissionOriginal(input: SubmissionOriginal) {
    const captured=submissionOriginal(input);
    return submissionClosure(await this.request('/api/v1/journey/close_submission_original_v1', {method:'POST',body:{...captured,confirm_close:true}}),captured);
  }
  async recordSubmission(input: submissions.RecordSubmission) {
    return submissions.submissionResult(await this.request('/api/v1/journey/record_submission', { method: 'POST', body: { ...submissions.recordSubmissionInput(input) } }));
  }
  async saveApplicationRecord(input: records.ApplicationRecordSaveInput) {
    return records.applicationRecordResult(await this.request('/api/v1/journey/save_application_record_v2', {
      method: 'POST', body: { ...records.applicationRecordSaveInput(input) },
    }));
  }
  async removeApplication(input: records.ApplicationDeleteInput) {
    const args = records.applicationDeleteInput(input);
    return records.applicationMutationResult(await this.request('/api/v1/journey/delete_application_v2', { method: 'POST', body: { ...args } }), args, true);
  }
  async setApplicationTarget(input: records.ApplicationTargetInput) {
    const args = records.applicationTargetInput(input);
    return records.applicationMutationResult(await this.request('/api/v1/journey/set_application_target_v2', { method: 'POST', body: { ...args } }), args, false);
  }
  async deleteApplicationRecord(input: records.ApplicationRecordDeleteInput) {
    return records.applicationRecordResult(await this.request('/api/v1/journey/delete_application_record_v2', {
      method: 'POST', body: { ...records.applicationRecordDeleteInput(input) },
    }));
  }
  async listContacts(options: { page?: number; pageSize?: number; companyId?: string } = {}): Promise<Document<Contact[]>> {
    const query = new URLSearchParams({ 'page[number]': String(boundedInteger(options.page ?? 1, 1, 1000000)),
      'page[size]': String(boundedInteger(options.pageSize ?? 20, 1, 100)) });
    if (options.companyId !== undefined) { identifier(options.companyId); query.set('filter[company_id]', options.companyId); }
    const result = await this.request(`/api/v1/contacts/?${query}`);
    if (!record(result) || !Array.isArray(result.data) || result.data.length > (options.pageSize ?? 20)) throw new JobHuntError('invalid_response');
    result.data.forEach(assertContact);
    return result as unknown as Document<Contact[]>;
  }
  async getContact(id: string): Promise<Document<Contact>> {
    return contactDocument(await this.request(`/api/v1/contacts/${identifier(id)}`));
  }
  async createContact(attributes: CreateContact): Promise<Document<Contact>> {
    validateContact(attributes, true);
    return contactDocument(await this.request('/api/v1/contacts/', { method: 'POST',
      body: { data: { type: 'contact', attributes } } }));
  }
  async updateContact(id: string, attributes: UpdateContact, revision: number): Promise<Document<Contact>> {
    validateContact(attributes, false); boundedInteger(revision, 1, 2147483647);
    return contactDocument(await this.request(`/api/v1/contacts/${identifier(id)}`, { method: 'PATCH',
      body: { data: { type: 'contact', id, attributes, meta: { revision } } } }));
  }
  async deleteContact(id: string): Promise<void> {
    await this.request(`/api/v1/contacts/${identifier(id)}`, { method: 'DELETE' });
  }
  async listTasks(input: tasks.TaskListInput = {}) {
    const query = new URLSearchParams({ arguments: JSON.stringify(tasks.taskListInput(input)) });
    return tasks.taskListResult(await this.request(`/api/v1/journey/list_tasks_v2?${query}`));
  }
  async getDocumentSettings() {
    return documentSettings.documentSettingsResult(await this.request('/api/v1/journey/get_document_settings'));
  }
  async updateDocumentSettings(input: documentSettings.DocumentSettingsWrite) {
    return documentSettings.documentSettingsResult(await this.request('/api/v1/journey/update_document_settings', {
      method: 'POST', body: { ...documentSettings.documentSettingsInput(input) },
    }));
  }
  async getTaskSettings() {
    return taskPreferences.taskPreferencesResult(await this.request('/api/v1/journey/get_task_settings_v2'));
  }
  async previewRecurringCleanup(input: cleanup.CleanupPreviewInput) {
    const query = new URLSearchParams({ arguments: JSON.stringify(cleanup.cleanupPreviewInput(input)) });
    return cleanup.cleanupPageResult(await this.request(`/api/v1/journey/preview_recurring_completion_cleanup_v2?${query}`));
  }
  async reopenRecurringCompletions(input: cleanup.CleanupWriteInput) {
    return cleanup.cleanupSavedResult(await this.request('/api/v1/journey/reopen_recurring_completions_v2', {
      method: 'POST', body: { ...cleanup.cleanupWriteInput(input) },
    }));
  }
  async listStageTemplates(input: templates.TemplateListInput = {}) {
    const query = new URLSearchParams({ arguments: JSON.stringify(templates.templateListInput(input)) });
    return templates.templatePageResult(await this.request(`/api/v1/journey/list_stage_task_templates_v2?${query}`));
  }
  async getStageTemplate(templateId: string) {
    const query = new URLSearchParams({ arguments: JSON.stringify(templates.templateReadInput({ template_id: templateId })) });
    return templates.templateResult(await this.request(`/api/v1/journey/get_stage_task_template_v2?${query}`));
  }
  async updateStageTemplate(input: templates.TemplateWrite) {
    return templates.templateStateResult(await this.request('/api/v1/journey/update_stage_task_template_v2', {
      method: 'POST', body: { ...templates.templateWriteInput(input) },
    }));
  }
  async removeStageTemplate(input: templates.TemplateRemove) {
    return templates.templateRemovalResult(await this.request('/api/v1/journey/remove_stage_task_template_v2', {
      method: 'POST', body: { ...templates.templateRemoveInput(input) },
    }));
  }
  async reorderStageTemplates(input: templates.TemplateReorder) {
    return templates.templatePageResult(await this.request('/api/v1/journey/reorder_stage_task_templates_v2', {
      method: 'POST', body: { ...templates.templateReorderInput(input) },
    }));
  }
  async updateTaskSettings(input: taskPreferences.TaskPreferencesWrite) {
    return taskPreferences.taskPreferencesResult(await this.request('/api/v1/journey/update_task_settings_v2', {
      method: 'POST', body: { ...taskPreferences.taskPreferencesInput(input) },
    }));
  }
  async connectedAccount(): Promise<ConnectedAccount> {
    const value = await this.request('/api/v1/journey/get_connected_account');
    if (!record(value) || typeof value.id !== 'string' || !/^jh_[a-f0-9]{8}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{12}$/iu.test(value.id) ||
        ['name', 'email', 'nickname'].some(field => value[field] !== undefined && (typeof value[field] !== 'string' || String(value[field]).length > 320)))
      throw new JobHuntError('invalid_response');
    return value as ConnectedAccount;
  }
  async getTask(input: tasks.TaskReadInput) {
    const query = new URLSearchParams({ arguments: JSON.stringify(tasks.taskReadInput(input)) });
    return tasks.taskResult(await this.request(`/api/v1/journey/get_task_v2?${query}`));
  }
  async createTask(input: tasks.TaskCreateInput) {
    return tasks.taskResult(await this.request('/api/v1/journey/create_task_v2', { method: 'POST', body: { ...tasks.taskCreateInput(input) } }));
  }
  async updateTask(input: tasks.TaskUpdateInput) {
    return tasks.taskResult(await this.request('/api/v1/journey/update_task_v2', { method: 'POST', body: { ...tasks.taskUpdateInput(input) } }));
  }
  async deleteTask(input: tasks.TaskDeleteInput) {
    return tasks.taskDeleteResult(await this.request('/api/v1/journey/delete_task_v2', {
      method: 'POST', body: { ...tasks.taskDeleteInput(input) },
    }));
  }
  async setTaskCompletion(input: tasks.TaskCompletionInput) {
    return tasks.taskResult(await this.request('/api/v1/journey/set_recurring_task_completion_v2', { method: 'POST', body: { ...tasks.taskCompletionInput(input) } }));
  }
  async skipTaskOccurrence(input: tasks.TaskSkipInput) {
    return tasks.taskResult(await this.request('/api/v1/journey/skip_recurring_task_v2', { method: 'POST', body: { ...tasks.taskSkipInput(input) } }));
  }
  async taskHistory(input: tasks.TaskHistoryInput) {
    const query = new URLSearchParams({ arguments: JSON.stringify(tasks.taskHistoryInput(input)) });
    return tasks.taskHistoryResult(await this.request(`/api/v1/journey/get_task_history_v2?${query}`));
  }
  async setTaskSchedule(input: tasks.TaskScheduleInput) {
    return tasks.taskResult(await this.request('/api/v1/journey/set_task_schedule_v2', { method: 'POST', body: { ...tasks.taskScheduleInput(input) } }));
  }
  async getOperation(input: tasks.OperationInput) {
    const query = new URLSearchParams({ arguments: JSON.stringify(tasks.operationInput(input)) });
    return tasks.operationResult(await this.request(`/api/v1/journey/get_job_hunt_operation?${query}`));
  }
}
const contactLimits: Record<string, number> = { name: 255, email: 255, phone: 50, linkedin_url: 500, company: 255, company_id: 36, title: 255, notes: 10000 };
function validateContact(value: CreateContact | UpdateContact, creating: boolean) {
  if (!record(value) || !Object.keys(value).length || Object.entries(value).some(([key, field]) =>
    !Object.hasOwn(contactLimits, key) || (field !== null && (typeof field !== 'string' || field.length > contactLimits[key] || /\u0000/u.test(field)))))
    throw new JobHuntError('invalid_input');
  if ((creating || 'name' in value) && (typeof value.name !== 'string' || !value.name.trim())) throw new JobHuntError('invalid_input');
  if ('notes' in value && typeof value.notes !== 'string') throw new JobHuntError('invalid_input');
  if (value.company_id !== undefined && value.company_id !== null && !/^[a-f0-9]{8}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{12}$/iu.test(value.company_id))
    throw new JobHuntError('invalid_input');
}
function assertContact(value: unknown): asserts value is Contact {
  if (!record(value) || value.type !== 'contact' || typeof value.id !== 'string' || !value.id || !record(value.attributes) ||
      typeof value.attributes.name !== 'string' || !Number.isSafeInteger(value.attributes.revision) || Number(value.attributes.revision) < 1 ||
      ['email', 'phone', 'linkedin_url', 'company', 'company_id', 'title'].some(key =>
        value.attributes && record(value.attributes) && value.attributes[key] !== null && typeof value.attributes[key] !== 'string'))
    throw new JobHuntError('invalid_response');
}
function contactDocument(value: unknown): Document<Contact> {
  if (!record(value)) throw new JobHuntError('invalid_response');
  assertContact(value.data); return value as unknown as Document<Contact>;
}
function validateCreation(value: CreateApplication, metadata?: ApplicationCreationMeta) {
  const keys = ['title','company_name','job_link','source','job_search','status','company_id','source_contact_id',
    'resume_template_id','job_details','cover_letter','resume_overrides','contacts','activity'];
  try {
    if (!record(value) || Object.keys(value).some(key => !keys.includes(key)) || !isNativeJson(value) ||
        new TextEncoder().encode(JSON.stringify(value)).length > 16 * 1024 * 1024) throw new Error();
    for (const key of ['title','company_name']) if (typeof value[key as keyof CreateApplication] !== 'string' || !String(value[key as keyof CreateApplication]).trim()) throw new Error();
    for (const key of ['title','company_name','job_link','source','job_search','status','company_id','source_contact_id','resume_template_id']) {
      const field = value[key as keyof CreateApplication];
      if (field !== undefined && field !== null && typeof field !== 'string') throw new Error();
    }
    for (const key of ['job_details','cover_letter','resume_overrides']) {
      const field = value[key as keyof CreateApplication]; if (field !== undefined && field !== null && !record(field)) throw new Error();
    }
    for (const key of ['contacts','activity']) {
      const field = value[key as keyof CreateApplication]; if (field !== undefined && field !== null && (!Array.isArray(field) || !field.every(record))) throw new Error();
    }
    if (metadata !== undefined && (!record(metadata) || !isNativeJson(metadata) || Object.keys(metadata).some(key => !['import_attempt_id','import_confirmed','import_review_revision'].includes(key)) ||
      metadata.import_attempt_id !== undefined && !/^[a-f0-9]{8}-(?:[a-f0-9]{4}-){3}[a-f0-9]{12}$/iu.test(metadata.import_attempt_id) ||
      metadata.import_confirmed !== undefined && typeof metadata.import_confirmed !== 'boolean' ||
      metadata.import_review_revision !== undefined && (!Number.isInteger(metadata.import_review_revision) || metadata.import_review_revision < 0 || metadata.import_review_revision > 2147483646))) throw new Error();
  } catch { throw new JobHuntError('invalid_input'); }
}
function validateAttributes(value: CreateApplication | UpdateApplication, creating: boolean) {
  const allowed = creating ? ['title', 'company_name', 'job_link', 'source', 'job_search'] : ['title', 'company_name', 'job_link', 'source'];
  if (!record(value) || !Object.keys(value).length || Object.entries(value).some(([key, field]) =>
    !allowed.includes(key) || typeof field !== 'string' || field.length > 2048 || /[\u0000]/u.test(field))) throw new JobHuntError('invalid_input');
  for (const field of ['title', 'company_name'] as const) {
    if ((creating || field in value) && !value[field]?.trim()) throw new JobHuntError('invalid_input');
  }
}
function assertApplication(value: unknown): asserts value is Application {
  if (!record(value) || value.type !== 'application' || typeof value.id !== 'string' || !record(value.attributes) ||
      !Number.isSafeInteger(value.attributes.version) || Number(value.attributes.version) < 1 ||
      ['title', 'company_name', 'status'].some(key => value.attributes && record(value.attributes) &&
        value.attributes[key] !== null && typeof value.attributes[key] !== 'string')) throw new JobHuntError('invalid_response');
}
function applicationDocument(value: unknown): Document<Application> {
  if (!record(value)) throw new JobHuntError('invalid_response');
  assertApplication(value.data); return value as unknown as Document<Application>;
}

export { applicationDeletionOriginal, applicationDeletionRead, applicationDeletionReceipt, applicationDeletionClosure } from './application-record-contracts.ts';
export type { ApplicationDeletionOriginal, ApplicationDeletionClosure } from './application-record-contracts.ts';

export type { HuntSelection, HuntSelectionData, HuntSelectionSave } from './hunt-selection-contracts.ts';
