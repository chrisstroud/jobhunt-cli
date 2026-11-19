import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import test from 'node:test';
import { JobHuntClient, postingImportPrivateIdentity } from '../client/src/index.ts';
const id='11111111-1111-4111-8111-111111111111', account='jh_'+id;
const input={expected_account_id:account,attempt_id:id};
const content=Buffer.from(JSON.stringify({format:'jobhunt.posting-import/v1',account_id:account,attempt:{capture_result:{data:{description:'Synthetic café 😀 original.\n'.repeat(5000)+'FULL TAIL'}}}}));
const hash=(v:Uint8Array)=>createHash('sha256').update(v).digest('hex');
const manifest={account_id:account,attempt_id:id,format:'jobhunt.posting-import/v1',filename:'posting-import.json',mime:'application/json',
  sha256:hash(content),size_bytes:content.length,chunk_bytes:24000,chunk_count:Math.ceil(content.length/24000)};
const ready=(data:unknown)=>({outcome:'ready',data,next_action:{kind:'none',label:''}});
const api=(fetchImpl:typeof fetch)=>new JobHuntClient({credential:{origin:'https://jobhunt.app',token:'synthetic_import_credential'},fetchImpl}).postingImports.files;
function chunk(index:number){const part=content.subarray((index-1)*24000,index*24000);return{...manifest,chunk_index:index,content_base64:part.toString('base64'),chunk_sha256:hash(part)};}

test('complete import download verifies original metadata, every chunk and whole-file bytes',async()=>{
  let calls=0;
  const value=await api(async(url)=>{const parsed=new URL(String(url));const args=JSON.parse(parsed.searchParams.get('arguments')!);calls++;
    if(parsed.pathname.endsWith('get_posting_import_file_v1')){assert.deepEqual(args,input);return Response.json(ready(manifest));}
    assert.equal(args.expected_sha256,manifest.sha256);assert.equal(args.expected_size_bytes,manifest.size_bytes);assert.equal(args.attempt_id,id);
    return Response.json(ready(chunk(args.chunk_index)));
  }).download(input);
  assert.deepEqual(Buffer.from(value.bytes),content);assert.equal(calls,1+manifest.chunk_count);
});

test('source conflicts, wrong account and malformed or corrupt chunks never produce a partial file',async()=>{
  for(const data of [{...manifest,account_id:'jh_22222222-2222-4222-8222-222222222222'}, {...manifest,size_bytes:20*1024*1024}, {...manifest,filename:'../private.json'}])
    await assert.rejects(api(async()=>Response.json(ready(data))).manifest(input),/invalid_response/);
  await assert.rejects(api(async()=>Response.json(ready({...chunk(1),chunk_sha256:'a'.repeat(64)}))).chunk({...input,expected_sha256:manifest.sha256,expected_size_bytes:manifest.size_bytes,chunk_index:1}),/download_checksum_mismatch/);
  let calls=0;
  await assert.rejects(api(async()=>{calls++;if(calls===1)return Response.json(ready(manifest));return Response.json({error:{code:'revision_conflict',message:'Source changed'}},{status:409});}).download(input));
  assert.equal(calls,2);
});

test('private input identity is computed locally and matches the canonical Python wire contract',async()=>{
  const text='\ufeffSynthetic café 😀 \u007f posting body.\n'.repeat(3);
  const result=await postingImportPrivateIdentity({request_key:'identity',input_kind:'browser_selection',url:'\u0085https://example.test/role\u001c',text});
  const canonical=JSON.stringify(['browser_selection','https://example.test/role',text]).replace(/[\u007f-\uffff]/g,c=>'\\u'+c.charCodeAt(0).toString(16).padStart(4,'0'));
  assert.equal(result.input_kind,'browser_selection');assert.equal(result.input_fingerprint,hash(Buffer.from(canonical)));
  assert.equal(Object.hasOwn(result,'text'),false);
});
