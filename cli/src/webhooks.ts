import { JobHuntError, record, webhookFileInput, webhookChangePlan, webhookChangeOriginal, webhookChangeHash,
  webhookTestInput, webhookReconcileInput, webhookJobOriginalHash,
  webhookFieldInput, webhookFieldFile, webhookFieldHash, MAX_WEBHOOK_FIELDS_BYTES } from '../../client/src/index.ts';
import { inputJSON } from './input.ts';
import { credentialBytes, newCredentialFile, requireNewCredentialFile } from './credential-files.ts';
import type { Readable } from 'node:stream';
import type { JobHuntClient } from '../../client/src/index.ts';
export const webhookOptions: Record<string, string[]> = {
  'webhooks review-test': ['file', 'output'], 'webhooks send-test': ['file', 'confirm'],
  'webhooks check-test': ['file'], 'webhooks close-test': ['file', 'confirm'],
  'webhooks jobs': ['account-id', 'after'], 'webhooks job': ['account-id', 'subscription-id'],
  'webhooks review-reconciliation': ['file', 'output'], 'webhooks reconcile': ['file', 'confirm'],
  'webhooks check-reconciliation': ['file'], 'webhooks close-reconciliation': ['file', 'confirm'],
  'webhooks review-fields-update': ['file', 'attributes-file', 'output'], 'webhooks update-fields': ['file', 'attributes-file', 'confirm'],
  'webhooks check-fields-update': ['file'], 'webhooks close-fields-update': ['file', 'confirm'],
  'webhooks review-change': ['file', 'output'], 'webhooks update': ['file', 'confirm'],
  'webhooks remove': ['file', 'confirm'], 'webhooks check-change': ['file'], 'webhooks close-change': ['file', 'confirm'],
  'webhooks metadata-manifest': ['file'], 'webhooks metadata': ['file', 'output', 'confirm'],
  'webhooks list': ['account-id', 'after'], 'webhooks get': ['account-id'],
  'webhooks deliveries': ['account-id', 'after'], 'webhooks delivery': ['account-id', 'subscription-id'],
};
export const webhookTargets = new Set(['webhooks jobs', 'webhooks job', 'webhooks get', 'webhooks deliveries', 'webhooks delivery']);
export async function webhookCommand(command: string, target: string | undefined, options: Record<string, string | boolean | undefined>, client: JobHuntClient, stdin: Readable) {
  if (['webhooks review-test', 'webhooks send-test', 'webhooks check-test', 'webhooks close-test',
    'webhooks review-reconciliation', 'webhooks reconcile', 'webhooks check-reconciliation', 'webhooks close-reconciliation'].includes(command)) {
    const input = await inputJSON(options.file as string | undefined, stdin, 16384);
    const test = command.endsWith('test'), reviewing = command.startsWith('webhooks review-');
    const jobs = client.webhooks.jobs;
    if (reviewing) {
      const args = test ? webhookTestInput(input) : webhookReconcileInput(input);
      await requireNewCredentialFile(options.output);
      const reply = test ? await jobs.reviewTest(args as import('../../client/src/webhook-jobs.ts').WebhookTestPlan)
        : await jobs.reviewReconciliation(args as import('../../client/src/webhook-jobs.ts').WebhookReconcilePlan);
      if (!reply.data) throw new JobHuntError('review_unavailable');
      const original = test ? webhookTestInput({ ...args, review_token: reply.data.review_token, confirm_send: true }, true)
        : webhookReconcileInput({ ...args, review_token: reply.data.review_token, confirm_reconcile: true }, true);
      await newCredentialFile(options.output, Buffer.from(JSON.stringify(original)));
      return { saved: true, account_id: original.expected_account_id, subscription_id: original.subscription_id,
        request_id: original.request_id, expected_payload_hash: await webhookJobOriginalHash(original as import('../../client/src/webhook-jobs.ts').WebhookTestOriginal | import('../../client/src/webhook-jobs.ts').WebhookReconcileOriginal), expires_at: reply.data.expires_at };
    }
    if (test) {
      const original = webhookTestInput(input, true) as import('../../client/src/webhook-jobs.ts').WebhookTestOriginal;
      if (command === 'webhooks check-test') return jobs.checkTest(original);
      if (options.confirm !== original.subscription_id) throw new JobHuntError('confirmation_required');
      return command === 'webhooks send-test' ? jobs.sendTest(original) : jobs.closeTest(original);
    }
    const original = webhookReconcileInput(input, true) as import('../../client/src/webhook-jobs.ts').WebhookReconcileOriginal;
    if (command === 'webhooks check-reconciliation') return jobs.checkReconciliation(original);
    if (options.confirm !== original.subscription_id) throw new JobHuntError('confirmation_required');
    return command === 'webhooks reconcile' ? jobs.reconcile(original) : jobs.closeReconciliation(original);
  }
  if (command === 'webhooks jobs') return client.webhooks.jobs.list({ expected_account_id: options['account-id'] as string,
    subscription_id: target!, ...(options.after ? { after: options.after as string } : {}) });
  if (command === 'webhooks job') return client.webhooks.jobs.get({ expected_account_id: options['account-id'] as string,
    subscription_id: options['subscription-id'] as string, job_id: target! });
  if (['webhooks review-fields-update', 'webhooks update-fields', 'webhooks check-fields-update', 'webhooks close-fields-update'].includes(command)) {
    const input = await inputJSON(options.file as string | undefined, stdin, 16384);
    if (command === 'webhooks review-fields-update') {
      if (!record(input)) throw new JobHuntError('invalid_input');
      if (('source_sha256' in input) !== ('source_size' in input)) throw new JobHuntError('invalid_input');
      const bytes = await credentialBytes(options['attributes-file'], MAX_WEBHOOK_FIELDS_BYTES);
      const metadata = await webhookFieldFile(bytes, false,
        'source_sha256' in input && 'source_size' in input ? { source_sha256: input.source_sha256 as string, source_size: input.source_size as number } : undefined);
      const args = webhookFieldInput({ ...input, ...metadata }, false);
      await requireNewCredentialFile(options.output);
      const reply = await client.webhooks.fields.reviewUpdate(args, bytes);
      if (!reply.data) throw new JobHuntError('review_unavailable');
      const original = webhookFieldInput({ ...args, review_token: reply.data.review_token, confirm_change: true }, false, true);
      await newCredentialFile(options.output, Buffer.from(JSON.stringify(original)));
      return { saved: true, account_id: original.expected_account_id, subscription_id: original.subscription_id,
        request_id: original.request_id, expected_payload_hash: await webhookFieldHash(original), expires_at: reply.data.expires_at };
    }
    const args = webhookFieldInput(input, false, true);
    if (command === 'webhooks check-fields-update') return client.webhooks.fields.checkUpdate(args);
    if (options.confirm !== args.subscription_id) throw new JobHuntError('confirmation_required');
    if (command === 'webhooks close-fields-update') return client.webhooks.fields.closeUpdate(args);
    return client.webhooks.fields.update(args, await credentialBytes(options['attributes-file'], MAX_WEBHOOK_FIELDS_BYTES));
  }
  if (['webhooks review-change', 'webhooks update', 'webhooks remove', 'webhooks check-change', 'webhooks close-change'].includes(command)) {
    const input = await inputJSON(options.file as string | undefined, stdin, 512 * 1024);
    if (command === 'webhooks review-change') {
      const args = webhookChangePlan(input);
      await requireNewCredentialFile(options.output);
      const result = await client.webhooks.changes.review(args);
      if (result.outcome !== 'ready' || !result.data) throw new JobHuntError('review_unavailable');
      const original = webhookChangeOriginal({ ...args, review_token: result.data.review_token, confirm_change: true });
      await newCredentialFile(options.output, Buffer.from(JSON.stringify(original)));
      return { saved: true, account_id: original.expected_account_id, subscription_id: original.subscription_id,
        request_id: original.request_id, action: original.action, expected_payload_hash: await webhookChangeHash(original),
        delivery_count: result.data.delivery_count, queued_job_count: result.data.queued_job_count, expires_at: result.data.expires_at };
    }
    const args = webhookChangeOriginal(input);
    if (command === 'webhooks check-change') return client.webhooks.changes.check(args);
    if (options.confirm !== args.subscription_id) throw new JobHuntError('confirmation_required');
    if (command === 'webhooks close-change') return client.webhooks.changes.close(args);
    if ((command === 'webhooks update') !== (args.action === 'update')) throw new JobHuntError('invalid_input');
    return client.webhooks.changes.apply(args);
  }
  if (command === 'webhooks metadata' || command === 'webhooks metadata-manifest') {
    const args = webhookFileInput(await inputJSON(options.file as string | undefined, stdin, 4096));
    if (command === 'webhooks metadata-manifest') return client.webhooks.metadata.manifest(args);
    if (options.confirm !== args.expected_account_id) throw new JobHuntError('confirmation_required');
    await requireNewCredentialFile(options.output);
    const { bytes, ...metadata } = await client.webhooks.metadata.download(args);
    await newCredentialFile(options.output, bytes); return { ...metadata, saved: true };
  }
  const expected_account_id = options['account-id'] as string;
  if (command === 'webhooks list') return client.webhooks.list({ expected_account_id, ...(options.after ? { after: options.after as string } : {}) });
  if (command === 'webhooks get') return client.webhooks.get({ expected_account_id, subscription_id: target! });
  if (command === 'webhooks deliveries') return client.webhooks.deliveries({ expected_account_id, subscription_id: target!, ...(options.after ? { after: options.after as string } : {}) });
  return client.webhooks.delivery({ expected_account_id, subscription_id: options['subscription-id'] as string, delivery_id: target! });
}
