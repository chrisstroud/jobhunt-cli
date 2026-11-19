import { createHash, createPrivateKey, createPublicKey, generateKeyPairSync, privateDecrypt, publicEncrypt, randomBytes, randomUUID, timingSafeEqual } from 'node:crypto';
import type { Readable } from 'node:stream';
import { JobHuntClient, JobHuntError, decryptWebhookSigningDelivery, record, webhookFieldFile, webhookFieldInput, MAX_WEBHOOK_FIELDS_BYTES,
  type WebhookCreationInput, type WebhookIssue, type WebhookSigningDelivery, type WebhookFieldCreation, type WebhookFieldIssue } from '../../client/src/index.ts';
import { webhookCreationInput } from '../../client/src/webhook-issuance.ts';
import { credentialBytes, credentialJSON, newCredentialFile, requireNewCredentialFile } from './credential-files.ts';
import { inputJSON } from './input.ts';
export const webhookIssuanceOptions: Record<string, string[]> = {
  'webhooks prepare-recipient': ['file', 'attributes-file', 'output', 'confirm'], 'webhooks recipient': ['recipient-file'],
  'webhooks review-create': ['recipient-file', 'attributes-file', 'output'], 'webhooks issue': ['file', 'recipient-file', 'attributes-file', 'confirm'],
  'webhooks check-create': ['file'], 'webhooks check-delivery': ['file'],
  'webhooks receive': ['file', 'recipient-file', 'output', 'confirm'],
  'webhooks acknowledge': ['file', 'recipient-file', 'secret-file', 'confirm'],
  'webhooks close-create': ['file', 'confirm'],
};
type Options = Record<string, string | boolean | undefined>;
type ReviewInput = WebhookCreationInput | WebhookFieldCreation;
type Issue = WebhookIssue | WebhookFieldIssue;
type Recipient = { version: 'webhook-signing-v1' | 'webhook-signing-v2'; origin: string; review_input: ReviewInput; recipient_fingerprint: string; private_pkcs8: string };
function exact(value: unknown, fields: string[]): value is Record<string, unknown> {
  return record(value) && Object.keys(value).length === fields.length && Object.keys(value).every(field => fields.includes(field));
}
function consent(options: Options, expected: string) { if (options.confirm !== expected) throw new JobHuntError('confirmation_required'); }
function summary(value: WebhookSigningDelivery) { const { sealed_jwe: _encrypted, ...metadata } = value; return metadata; }
function reviewed(value: Issue): ReviewInput {
  if ('source_sha256' in value) return webhookFieldInput({ expected_account_id: value.expected_account_id, request_id: value.request_id,
    source_sha256: value.source_sha256, source_size: value.source_size, recipient_public_key: value.recipient_public_key }, true);
  return { expected_account_id: value.expected_account_id, request_id: value.request_id, url: value.url, events: value.events, recipient_public_key: value.recipient_public_key };
}
function canonical(value: unknown): string {
  if (Array.isArray(value)) return '[' + value.map(canonical).join(',') + ']';
  if (record(value)) return '{' + Object.keys(value).sort().map(key => JSON.stringify(key) + ':' + canonical(value[key])).join(',') + '}';
  return JSON.stringify(value);
}
async function recipientFile(path: unknown, origin: string): Promise<Recipient> {
  const saved = await credentialJSON(path);
  try {
    if (!exact(saved, ['version', 'origin', 'review_input', 'recipient_fingerprint', 'private_pkcs8']) || !['webhook-signing-v1', 'webhook-signing-v2'].includes(String(saved.version)) || saved.origin !== origin ||
      typeof saved.private_pkcs8 !== 'string' || saved.private_pkcs8.length > 8192 || typeof saved.recipient_fingerprint !== 'string') throw new Error();
    const input = saved.version === 'webhook-signing-v1' ? webhookCreationInput(saved.review_input) as WebhookCreationInput : webhookFieldInput(saved.review_input, true);
    const key = createPrivateKey(saved.private_pkcs8), publicKey = createPublicKey(key);
    if (key.asymmetricKeyType !== 'rsa' || ![3072, 4096].includes(key.asymmetricKeyDetails?.modulusLength ?? 0) || key.asymmetricKeyDetails?.publicExponent !== 65537n) throw new Error();
    const der = publicKey.export({ type: 'spki', format: 'der' });
    if (der.toString('base64url') !== input.recipient_public_key || createHash('sha256').update(der).digest('hex') !== saved.recipient_fingerprint) throw new Error();
    const challenge = randomBytes(32), cipher = publicEncrypt({ key: publicKey, oaepHash: 'sha256' }, challenge);
    if (!timingSafeEqual(privateDecrypt({ key, oaepHash: 'sha256' }, cipher), challenge)) throw new Error();
    return saved as unknown as Recipient;
  } catch { throw new JobHuntError('invalid_credential_recipient'); }
}
async function originalFile(path: unknown): Promise<Issue> {
  const value = await credentialJSON(path);
  return record(value) && 'source_sha256' in value ? webhookFieldInput(value, true, true) : webhookCreationInput(value, true) as WebhookIssue;
}
/** Local-only preparation occurs before loading any bearer or personal auth store. */
export async function prepareWebhookRecipient(options: Options, origin: string, stdin: Readable) {
  const plan = await inputJSON(options.file as string | undefined, stdin, 524288);
  const file = options['attributes-file'] !== undefined;
  if (!exact(plan, file ? ['expected_account_id'] : ['expected_account_id', 'url', 'events']) || typeof plan.expected_account_id !== 'string') throw new JobHuntError('invalid_input');
  consent(options, plan.expected_account_id); await requireNewCredentialFile(options.output);
  const keys = generateKeyPairSync('rsa', { modulusLength: 3072, publicExponent: 65537 });
  const der = keys.publicKey.export({ type: 'spki', format: 'der' });
  const publicInput = { ...plan, request_id: randomUUID(), recipient_public_key: der.toString('base64url') };
  const review_input = file ? webhookFieldInput({ ...publicInput, ...await webhookFieldFile(await credentialBytes(options['attributes-file'], MAX_WEBHOOK_FIELDS_BYTES), true) }, true)
    : webhookCreationInput(publicInput) as WebhookCreationInput;
  const recipient: Recipient = { version: file ? 'webhook-signing-v2' : 'webhook-signing-v1', origin, review_input, recipient_fingerprint: createHash('sha256').update(der).digest('hex'),
    private_pkcs8: keys.privateKey.export({ format: 'pem', type: 'pkcs8' }).toString() };
  await newCredentialFile(options.output, Buffer.from(JSON.stringify(recipient)));
  await recipientFile(options.output, origin);
  return { prepared: true, account_id: review_input.expected_account_id, request_id: review_input.request_id, recipient_fingerprint: recipient.recipient_fingerprint };
}
/** Public material only; suitable for an explicitly authorized separate MCP request. */
export async function publicWebhookRecipient(options: Options, origin: string) {
  return (await recipientFile(options['recipient-file'], origin)).review_input;
}
export async function webhookIssuanceCommand(command: string, options: Options, client: JobHuntClient) {
  if (command === 'webhooks review-create') {
    await requireNewCredentialFile(options.output);
    const recipient = await recipientFile(options['recipient-file'], client.origin);
    if (recipient.version === 'webhook-signing-v1' && options['attributes-file'] !== undefined) throw new JobHuntError('invalid_input');
    const reply = recipient.version === 'webhook-signing-v2'
      ? await client.webhooks.fields.reviewCreation(recipient.review_input as WebhookFieldCreation, await credentialBytes(options['attributes-file'], MAX_WEBHOOK_FIELDS_BYTES))
      : await client.webhooks.issuance.review(recipient.review_input as WebhookCreationInput);
    if (!reply.data || reply.data.recipient_fingerprint !== recipient.recipient_fingerprint) throw new JobHuntError('invalid_response');
    const original: Issue = { ...recipient.review_input, review_token: reply.data.review_token, confirm_create: true };
    await newCredentialFile(options.output, Buffer.from(JSON.stringify(original)));
    const retained = await originalFile(options.output);
    if (canonical(retained) !== canonical(original)) throw new JobHuntError('credential_file_changed');
    return { reviewed: true, account_id: original.expected_account_id, request_id: original.request_id, recipient_fingerprint: recipient.recipient_fingerprint, expires_at: reply.data.expires_at };
  }
  const original = await originalFile(options.file);
  if (command === 'webhooks check-create') return 'source_sha256' in original ? client.webhooks.fields.checkCreation(original) : client.webhooks.issuance.check(original);
  if (command === 'webhooks close-create') { consent(options, original.expected_account_id); return 'source_sha256' in original ? client.webhooks.fields.closeCreation(original) : client.webhooks.issuance.close(original); }
  if (command === 'webhooks check-delivery') {
    const result = await client.webhooks.issuance.get({ expected_account_id: original.expected_account_id, request_id: original.request_id });
    if (!result.data) throw new JobHuntError('invalid_response');
    return { ...result, data: summary(result.data) };
  }
  const recipient = await recipientFile(options['recipient-file'], client.origin);
  if (canonical(reviewed(original)) !== canonical(recipient.review_input)) throw new JobHuntError('credential_recipient_mismatch');
  if (command === 'webhooks issue') {
    consent(options, original.expected_account_id);
    if (!('source_sha256' in original) && options['attributes-file'] !== undefined) throw new JobHuntError('invalid_input');
    const result = 'source_sha256' in original ? await client.webhooks.fields.issue(original, await credentialBytes(options['attributes-file'], MAX_WEBHOOK_FIELDS_BYTES))
      : await client.webhooks.issuance.issue(original);
    if (!result.data || result.data.recipient_fingerprint !== recipient.recipient_fingerprint) throw new JobHuntError('invalid_response');
    return { ...result, data: summary(result.data) };
  }
  if (!['webhooks receive', 'webhooks acknowledge'].includes(command)) throw new JobHuntError('usage_error');
  if (command === 'webhooks receive') await requireNewCredentialFile(options.output);
  const result = await client.webhooks.issuance.get({ expected_account_id: original.expected_account_id, request_id: original.request_id });
  if (!result.data || result.data.recipient_fingerprint !== recipient.recipient_fingerprint) throw new JobHuntError('invalid_response');
  consent(options, result.data.subscription_id);
  if (command === 'webhooks acknowledge' && result.data.state === 'acknowledged') return { ...summary(result.data), already_acknowledged: true, local_file_verified: false };
  if (result.data.state !== 'available') throw new JobHuntError('webhook_delivery_unavailable', 410);
  const der = createPrivateKey(recipient.private_pkcs8).export({ format: 'der', type: 'pkcs8' });
  const localKey = await crypto.subtle.importKey('pkcs8', der, { name: 'RSA-OAEP', hash: 'SHA-256' }, false, ['decrypt']);
  const secret = Buffer.from(await decryptWebhookSigningDelivery(result.data, { expected_account_id: original.expected_account_id,
    request_id: original.request_id, subscription_id: result.data.subscription_id }, localKey));
  if (command === 'webhooks receive') {
    await newCredentialFile(options.output, Buffer.concat([secret, Buffer.from('\n')]));
    const retained = await credentialBytes(options.output, 128);
    if (!retained.equals(Buffer.concat([secret, Buffer.from('\n')]))) throw new JobHuntError('credential_file_changed');
    return { ...summary(result.data), saved: true, acknowledged: false };
  }
  const retained = await credentialBytes(options['secret-file'], 128), bytes = retained.at(-1) === 10 ? retained.subarray(0, -1) : retained;
  if (bytes.length !== secret.length || !timingSafeEqual(bytes, secret)) throw new JobHuntError('credential_file_mismatch');
  const acknowledged = await client.webhooks.issuance.acknowledge({ expected_account_id: original.expected_account_id,
    request_id: original.request_id, recipient_fingerprint: recipient.recipient_fingerprint, confirm_received: true });
  if (!acknowledged.data || acknowledged.data.subscription_id !== result.data.subscription_id) throw new JobHuntError('invalid_response');
  return { ...summary(acknowledged.data), local_file_verified: true };
}
