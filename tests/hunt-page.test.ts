import { assertPrivateFile } from './private-file-fixture.ts';
import assert from 'node:assert/strict';
import { mkdtemp, readFile, rm, stat, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { Readable, Writable } from 'node:stream';
import test from 'node:test';
import { JobHuntClient } from '../client/src/index.ts';
import { runCLI } from '../cli/src/cli.ts';

const id = '11111111-1111-4111-8111-111111111111';
const token = 'synthetic_hunt_page_credential';
const draft = { source_id: id, source_ids: [id], photo_id: null, handle: 'synthetic-person', links: [] };
const state = { revision: 2, draft, visibility: 'private', published: false, preview_revision: 'a'.repeat(64),
  public_path: '/synthetic-person', source_status: 'personal_page_unpublished', profile_status: null };
const workspace = { page: state, sources: [], profiles: [], selected_documents: [{ id, revision: 1 }], sources_page: 1,
  sources_have_more: false, profiles_have_more: false };
const ready = (data: unknown) => ({ outcome: 'ready', data, next_action: { kind: 'none', label: '' } });
const api = (fetchImpl: typeof fetch) => new JobHuntClient({ credential: { origin: 'https://jobhunt.app', token }, fetchImpl });
const visibility = { request_id: id, expected_account_id: 'jh_' + id, expected_revision: 2, expected_preview_revision: state.preview_revision,
  visibility: 'public' as const, confirm_publication: true };
const preview = { expected_revision: 2, expected_preview_revision: state.preview_revision, document_id: id, page: 1 };
const jpeg = Buffer.from([255, 216, 255, 217]);
const image = { document_id: id, page_revision: 2, preview_revision: state.preview_revision, page: 1, pages: 1,
  image_chunks: ['data:image/jpeg;base64,' + jpeg.toString('base64')] };

test('Hunt Page publication preserves exact consent, fingerprint and account without retries', async () => {
  let calls = 0;
  const client = api(async (url, init) => {
    calls++; assert.ok(String(url).endsWith('/set_hunt_page_visibility_v2'));
    assert.deepEqual(JSON.parse(String(init?.body)), visibility);
    assert.equal(init?.credentials, 'omit'); assert.equal(init?.redirect, 'error');
    return Response.json(ready(workspace));
  });
  await client.setHuntPageVisibility(visibility);
  for (const value of [{ ...visibility, confirm_publication: false }, { ...visibility, expected_preview_revision: 'bad' },
    { ...visibility, expected_revision: -1 }, { ...visibility, unexpected: true }])
    await assert.rejects(client.setHuntPageVisibility(value as never), /invalid_input/);
  assert.equal(calls, 1);
  await assert.rejects(api(async () => { calls++; throw new Error('private diagnostic'); }).setHuntPageVisibility(visibility), /network_error|request_failed/);
  assert.equal(calls, 2);
});

test('Hunt Page settings and readback remain bounded and preserve every existing personal palette', async () => {
  let calls = 0;
  const client = api(async () => { calls++; return Response.json(ready(workspace)); });
  for (const palette of ['forest', 'steel', 'ochre', 'linen', 'slate', 'ocean', 'indigo', 'plum', 'clay', 'rose', 'graphite'])
    await client.saveHuntPage({ request_id: id, expected_revision: 2, draft: { ...draft, sidebar_palette: palette } } as never);
  assert.equal(calls, 11);
  await assert.rejects(client.saveHuntPage({ request_id: id, expected_revision: 2, draft: { ...draft, source_ids: Array(21).fill(id) } }), /invalid_input/);
  await assert.rejects(api(async () => Response.json(ready({ ...workspace, profiles: Array(26).fill({ id, name: 'Synthetic', updated_at: null }) }))).getHuntPage(), /invalid_response/);
});

test('private rendered previews bind returned image to the reviewed page, source and fingerprint', async () => {
  const result = await api(async () => Response.json(ready(image))).downloadHuntPagePreview(preview);
  assert.deepEqual(result.bytes, new Uint8Array(jpeg));
  assert.equal(result.media_type, 'image/jpeg'); assert.ok(!('image_chunks' in result));
  for (const changed of [{ ...image, preview_revision: 'b'.repeat(64) }, { ...image, page_revision: 3 },
    { ...image, document_id: '22222222-2222-4222-8222-222222222222' }, { ...image, image_chunks: ['data:image/svg+xml;base64,PHN2Zz4='] }])
    await assert.rejects(api(async () => Response.json(ready(changed))).downloadHuntPagePreview(preview), /invalid_response/);
});

async function cli(args: string[], fetchImpl: typeof fetch) {
  let stdout = ''; let stderr = '';
  const code = await runCLI([...args, '--json', '--non-interactive'], { env: { JOBHUNT_TOKEN: token }, stdin: Readable.from([]), fetchImpl,
    stdout: new Writable({ write(chunk, _, done) { stdout += chunk.toString(); done(); } }),
    stderr: new Writable({ write(chunk, _, done) { stderr += chunk.toString(); done(); } }),
  }, 'test');
  return { code, stdout, stderr };
}

test('publication CLI requires exact account confirmation and refuses mismatched command intent', async () => {
  const dir = await mkdtemp(join(tmpdir(), 'hunt-page-consent-')); let calls = 0;
  try {
    const path = join(dir, 'intent.json'); await writeFile(path, JSON.stringify(visibility));
    const fetchImpl = async () => { calls++; return Response.json(ready(workspace)); };
    for (const args of [[], ['--confirm', 'jh_wrong']]) {
      const result = await cli(['hunt-page', 'publish', '--file', path, ...args], fetchImpl);
      assert.equal(result.code, 2); assert.equal(JSON.parse(result.stderr).error.code, 'confirmation_required');
    }
    assert.equal((await cli(['hunt-page', 'unpublish', '--file', path, '--confirm', visibility.expected_account_id], fetchImpl)).code, 2);
    assert.equal(calls, 0);
    assert.equal((await cli(['hunt-page', 'publish', '--file', path, '--confirm', visibility.expected_account_id], fetchImpl)).code, 0);
  } finally { await rm(dir, { force: true, recursive: true }); }
});

test('private preview CLI saves only verified bytes and preserves an existing destination', async () => {
  const dir = await mkdtemp(join(tmpdir(), 'hunt-page-preview-')); let calls = 0;
  try {
    const path = join(dir, 'intent.json'); const output = join(dir, 'preview.jpg');
    await writeFile(path, JSON.stringify(preview));
    const fetchImpl = async () => { calls++; return Response.json(ready(image)); };
    const args = ['hunt-page', 'preview', '--file', path, '--output', output];
    const result = await cli(args, fetchImpl);
    assert.equal(result.code, 0); assert.equal(JSON.parse(result.stdout).saved, true);
    assert.deepEqual(await readFile(output), jpeg); await assertPrivateFile(output);
    assert.equal((await cli(args, fetchImpl)).code, 7); assert.equal(calls, 1);
  } finally { await rm(dir, { force: true, recursive: true }); }
});

test('current picker metadata is additive, bounded and retained by the typed client',async()=>{
  const source={id,title:'Synthetic letter',package_id:id,package_title:'Synthetic package',eligible:true,reason:null,archetype:'letter',published_at:null,snapshot_id:state.preview_revision,generation:'2026-10-22T12:00:00'};
  const current={...workspace,page:{...state,user_id:id,published_at:null,published_snapshot_id:state.preview_revision,published_document_snapshots:{[id]:state.preview_revision},has_unpublished_changes:false},sources:[source]};
  const read=await api(async()=>Response.json(ready(current))).getHuntPageWorkspace();assert.deepEqual(read.data,current);
  for(const change of [{user_id:'bad'},{published_snapshot_id:'bad'},{published_document_snapshots:{[id]:'bad'}},{has_unpublished_changes:'no'}])await assert.rejects(api(async()=>Response.json(ready({...current,page:{...current.page,...change}}))).getHuntPageWorkspace(),/invalid_response/);
  for(const change of [{snapshot_id:'bad'},{generation:7},{archetype:[]},{published_at:7}])await assert.rejects(api(async()=>Response.json(ready({...current,sources:[{...source,...change}]}))).getHuntPageWorkspace(),/invalid_response/);
});

test('full unlinked photo uses multipart unchanged bytes and reviewed page intent',async()=>{
  const input={request_id:id,expected_account_id:'jh_'+id,expected_revision:2,expected_preview_revision:state.preview_revision};
  const bytes=Buffer.concat([Buffer.from([137,80,78,71,13,10,26,10]),Buffer.alloc(500000,7)]);let calls=0;
  const client=api(async(url,init)=>{calls++;assert.ok(String(url).endsWith('/hunt-page-photo-upload'));assert.ok(init?.body instanceof FormData);assert.deepEqual(JSON.parse(String(init.body.get('intent'))),input);const image=init.body.get('photo') as Blob;assert.equal(image.type,'image/png');assert.deepEqual(Buffer.from(await image.arrayBuffer()),bytes);return Response.json(ready(workspace));});
  assert.deepEqual((await client.uploadHuntPagePhotoFile(input,bytes)).data,workspace);
  for(const invalid of [Buffer.alloc(0),Buffer.from('not an image'),Buffer.alloc(5*1024*1024+1)])await assert.rejects(client.uploadHuntPagePhotoFile(input,invalid),/invalid_input/);
  assert.equal(calls,1);
});

test('full page host reference is bounded and never accepts arbitrary input keys',async()=>{
  const input={request_id:id,expected_account_id:'jh_'+id,expected_revision:2,expected_preview_revision:state.preview_revision,source_size:800000,source_sha256:'b'.repeat(64),media_type:'image/png' as const,file:{file_id:'synthetic',download_url:'https://approved.example.test/photo'}};
  let calls=0;const client=api(async(url,init)=>{calls++;assert.ok(String(url).endsWith('/upload_hunt_page_photo_file'));assert.deepEqual(JSON.parse(String(init?.body)),input);return Response.json(ready(workspace));});
  await client.uploadHuntPagePhotoHostFile(input);
  for(const change of [{source_size:5*1024*1024+1},{source_sha256:'bad'},{media_type:'image/svg+xml'},{expected_preview_revision:'bad'},{extra:true}])await assert.rejects(client.uploadHuntPagePhotoHostFile({...input,...change} as never),/invalid_input/);
  assert.equal(calls,1);
});

test('full page file CLI requires exact account confirmation before IO',async()=>{
  const dir=await mkdtemp(join(tmpdir(),'hunt-page-file-'));let calls=0;
  try{const file=join(dir,'intent.json'),image=join(dir,'photo.png');await writeFile(file,JSON.stringify({request_id:id,expected_account_id:'jh_'+id,expected_revision:2,expected_preview_revision:state.preview_revision}));await writeFile(image,Buffer.from([137,80,78,71,13,10,26,10]));const fetchImpl=async()=>{calls++;return Response.json(ready(workspace));};const args=['hunt-page','photo-upload-file','--file',file,'--image',image];assert.notEqual((await cli(args,fetchImpl)).code,0);assert.equal(calls,0);assert.equal((await cli([...args,'--confirm','jh_'+id],fetchImpl)).code,0);assert.equal(calls,1);}finally{await rm(dir,{recursive:true,force:true});}
});
