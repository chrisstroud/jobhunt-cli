import { createHash, createPrivateKey, createPublicKey, generateKeyPairSync, privateDecrypt, publicEncrypt, randomBytes, randomUUID, timingSafeEqual } from 'node:crypto';
import type { Readable } from 'node:stream';
import { JobHuntClient, JobHuntError, decryptExtensionDelivery, record, type ExtensionCreationInput, type ExtensionIssue, type ExtensionDelivery } from '../../client/src/index.ts';
import { extensionCreationInput } from '../../client/src/extension-delivery.ts';
import { credentialBytes, credentialJSON, newCredentialFile, requireNewCredentialFile } from './credential-files.ts';
import { inputJSON } from './input.ts';
export const extensionIssuanceOptions: Record<string, string[]> = {
  'extensions prepare-recipient': ['file', 'output', 'confirm'], 'extensions recipient': ['recipient-file'],
  'extensions review-create': ['recipient-file', 'output'], 'extensions issue': ['file', 'recipient-file', 'confirm'],
  'extensions check-create': ['file'], 'extensions check-delivery': ['file'],
  'extensions receive': ['file', 'recipient-file', 'output', 'confirm'],
  'extensions acknowledge': ['file', 'recipient-file', 'secret-file', 'confirm'],
  'extensions close-create': ['file', 'confirm'],
};
type Options = Record<string, string | boolean | undefined>;
type Recipient = { version: 'extension-v1'; origin: string; review_input: ExtensionCreationInput; recipient_fingerprint: string; private_pkcs8: string };
function exact(value: unknown, fields: string[]): value is Record<string, unknown> {
  return record(value) && Object.keys(value).length === fields.length && Object.keys(value).every(field => fields.includes(field));
}
function consent(options: Options, expected: string) { if (options.confirm !== expected) throw new JobHuntError('confirmation_required'); }
function summary(value: ExtensionDelivery) { const { sealed_jwe: _encrypted, ...metadata } = value; return metadata; }
function reviewed(value: ExtensionIssue): ExtensionCreationInput {
  return { expected_account_id: value.expected_account_id, request_id: value.request_id, device_name: value.device_name, recipient_public_key: value.recipient_public_key };
}
function canonical(value: unknown): string {
  if (Array.isArray(value)) return '[' + value.map(canonical).join(',') + ']';
  if (record(value)) return '{' + Object.keys(value).sort().map(key => JSON.stringify(key) + ':' + canonical(value[key])).join(',') + '}';
  return JSON.stringify(value);
}
async function recipientFile(path: unknown, origin: string): Promise<Recipient> {
  const saved = await credentialJSON(path);
  try {
    if (!exact(saved, ['version', 'origin', 'review_input', 'recipient_fingerprint', 'private_pkcs8']) || saved.version !== 'extension-v1' || saved.origin !== origin ||
      typeof saved.private_pkcs8 !== 'string' || saved.private_pkcs8.length > 8192 || typeof saved.recipient_fingerprint !== 'string') throw new Error();
    const input = extensionCreationInput(saved.review_input) as ExtensionCreationInput;
    const key = createPrivateKey(saved.private_pkcs8), publicKey = createPublicKey(key);
    if (key.asymmetricKeyType !== 'rsa' || ![3072, 4096].includes(key.asymmetricKeyDetails?.modulusLength ?? 0) || key.asymmetricKeyDetails?.publicExponent !== 65537n) throw new Error();
    const der = publicKey.export({ type: 'spki', format: 'der' });
    if (der.toString('base64url') !== input.recipient_public_key || createHash('sha256').update(der).digest('hex') !== saved.recipient_fingerprint) throw new Error();
    const challenge = randomBytes(32), cipher = publicEncrypt({ key: publicKey, oaepHash: 'sha256' }, challenge);
    if (!timingSafeEqual(privateDecrypt({ key, oaepHash: 'sha256' }, cipher), challenge)) throw new Error();
    return saved as unknown as Recipient;
  } catch { throw new JobHuntError('invalid_credential_recipient'); }
}
async function originalFile(path: unknown): Promise<ExtensionIssue> {
  return extensionCreationInput(await credentialJSON(path), true) as ExtensionIssue;
}
/** Local-only preparation occurs before loading any bearer or personal auth store. */
export async function prepareExtensionRecipient(options: Options, origin: string, stdin: Readable) {
  const plan = await inputJSON(options.file as string | undefined, stdin, 524288);
  if (!exact(plan, ['expected_account_id', 'device_name']) || typeof plan.expected_account_id !== 'string') throw new JobHuntError('invalid_input');
  consent(options, plan.expected_account_id); await requireNewCredentialFile(options.output);
  const keys = generateKeyPairSync('rsa', { modulusLength: 3072, publicExponent: 65537 });
  const der = keys.publicKey.export({ type: 'spki', format: 'der' });
  const review_input = extensionCreationInput({ ...plan, request_id: randomUUID(), recipient_public_key: der.toString('base64url') }) as ExtensionCreationInput;
  const recipient: Recipient = { version: 'extension-v1', origin, review_input, recipient_fingerprint: createHash('sha256').update(der).digest('hex'),
    private_pkcs8: keys.privateKey.export({ format: 'pem', type: 'pkcs8' }).toString() };
  await newCredentialFile(options.output, Buffer.from(JSON.stringify(recipient)));
  await recipientFile(options.output, origin);
  return { prepared: true, account_id: review_input.expected_account_id, request_id: review_input.request_id, recipient_fingerprint: recipient.recipient_fingerprint };
}
/** Public material only; suitable for an explicitly authorized separate MCP request. */
export async function publicExtensionRecipient(options: Options, origin: string) {
  return (await recipientFile(options['recipient-file'], origin)).review_input;
}
export async function extensionIssuanceCommand(command: string, options: Options, client: JobHuntClient) {
  if (command === 'extensions review-create') {
    await requireNewCredentialFile(options.output);
    const recipient = await recipientFile(options['recipient-file'], client.origin);
    const reply = await client.extensions.issuance.review(recipient.review_input);
    if (!reply.data || reply.data.recipient_fingerprint !== recipient.recipient_fingerprint) throw new JobHuntError('invalid_response');
    const original: ExtensionIssue = { ...recipient.review_input, review_token: reply.data.review_token, confirm_create: true };
    await newCredentialFile(options.output, Buffer.from(JSON.stringify(original)));
    const retained = await originalFile(options.output);
    if (canonical(retained) !== canonical(original)) throw new JobHuntError('credential_file_changed');
    return { reviewed: true, account_id: original.expected_account_id, request_id: original.request_id, recipient_fingerprint: recipient.recipient_fingerprint, expires_at: reply.data.expires_at };
  }
  const original = await originalFile(options.file);
  if (command === 'extensions check-create') return client.extensions.issuance.check(original);
  if (command === 'extensions close-create') { consent(options, original.expected_account_id); return client.extensions.issuance.close(original); }
  if (command === 'extensions check-delivery') {
    const result = await client.extensions.issuance.get({ expected_account_id: original.expected_account_id, request_id: original.request_id });
    if (!result.data) throw new JobHuntError('invalid_response');
    return { ...result, data: summary(result.data) };
  }
  const recipient = await recipientFile(options['recipient-file'], client.origin);
  if (canonical(reviewed(original)) !== canonical(recipient.review_input)) throw new JobHuntError('credential_recipient_mismatch');
  if (command === 'extensions issue') {
    consent(options, original.expected_account_id);
    const result = await client.extensions.issuance.issue(original);
    if (!result.data || result.data.recipient_fingerprint !== recipient.recipient_fingerprint) throw new JobHuntError('invalid_response');
    return { ...result, data: summary(result.data) };
  }
  if (!['extensions receive', 'extensions acknowledge'].includes(command)) throw new JobHuntError('usage_error');
  if (command === 'extensions receive') await requireNewCredentialFile(options.output);
  const result = await client.extensions.issuance.get({ expected_account_id: original.expected_account_id, request_id: original.request_id });
  if (!result.data || result.data.recipient_fingerprint !== recipient.recipient_fingerprint) throw new JobHuntError('invalid_response');
  consent(options, result.data.connection_id);
  if (command === 'extensions acknowledge' && result.data.state === 'acknowledged') return { ...summary(result.data), already_acknowledged: true, local_file_verified: false };
  if (result.data.state !== 'available') throw new JobHuntError('extension_delivery_unavailable', 410);
  const der = createPrivateKey(recipient.private_pkcs8).export({ format: 'der', type: 'pkcs8' });
  const localKey = await crypto.subtle.importKey('pkcs8', der, { name: 'RSA-OAEP', hash: 'SHA-256' }, false, ['decrypt']);
  const secret = Buffer.from(await decryptExtensionDelivery(result.data, { expected_account_id: original.expected_account_id,
    request_id: original.request_id, connection_id: result.data.connection_id }, localKey));
  if (command === 'extensions receive') {
    await newCredentialFile(options.output, Buffer.concat([secret, Buffer.from('\n')]));
    const retained = await credentialBytes(options.output, 128);
    if (!retained.equals(Buffer.concat([secret, Buffer.from('\n')]))) throw new JobHuntError('credential_file_changed');
    return { ...summary(result.data), saved: true, acknowledged: false };
  }
  const retained = await credentialBytes(options['secret-file'], 128), bytes = retained.at(-1) === 10 ? retained.subarray(0, -1) : retained;
  if (bytes.length !== secret.length || !timingSafeEqual(bytes, secret)) throw new JobHuntError('credential_file_mismatch');
  const acknowledged = await client.extensions.issuance.acknowledge({ expected_account_id: original.expected_account_id,
    request_id: original.request_id, recipient_fingerprint: recipient.recipient_fingerprint, confirm_received: true });
  if (!acknowledged.data || acknowledged.data.connection_id !== result.data.connection_id) throw new JobHuntError('invalid_response');
  return { ...summary(acknowledged.data), local_file_verified: true };
}
