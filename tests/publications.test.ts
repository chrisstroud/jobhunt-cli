import test from 'node:test';
import assert from 'node:assert/strict';
import {Readable} from 'node:stream';
import {JobHuntClient} from '../client/src/index.ts';
import {publicationOriginal,preparePublicationOriginal,publicationAccepted,type PublicationOriginal} from '../client/src/publications.ts';
import {publicationCommand} from '../cli/src/publications.ts';
const source='22222222-2222-4222-8222-222222222222',request='33333333-3333-4333-8333-333333333333',account='jh_11111111-1111-4111-8111-111111111111';
const original:PublicationOriginal={expected_account_id:account,source_type:'document',original:{action:'publish',request_id:request,
 expected_account_id:account,source_id:source,expected_revision:1,expected_fingerprint:'a'.repeat(64),target:'resume',privacy_tier:'unlisted',confirm_publication:true}};
const receipt={id:'44444444-4444-4444-8444-444444444444',kind:'publish_document_v1',status:'succeeded',resource:{id:source,kind:'document',label:'Publication',revision:2},retry_after_seconds:0,retry_expires_at:'2099-01-01T00:00:00Z'};
const accepted={outcome:'ready',data:{source_id:source,source_type:'document',action:'publish',accepted_revision:2},operation:receipt,next_action:{kind:'none',label:'Saved'}};
const ready=(data:unknown)=>({outcome:'ready',data,next_action:{kind:'none',label:''}});
const client=(fetchImpl:typeof fetch)=>new JobHuntClient({credential:{origin:'https://jobhunt.app',token:'synthetic-publication-test'},fetchImpl});
test('publication preserves exact Unicode/password input and captures before transport',async()=>{
 const input=structuredClone(original);input.original={...input.original,privacy_tier:'password',password:'🔒'.repeat(256)} as typeof original.original;
 const captured=publicationOriginal(input);let calls=0;
 const api=client(async(url,init)=>{calls++;assert.ok(String(url).endsWith('/publish_document_v1'));assert.deepEqual(JSON.parse(String(init?.body)),captured.original);return Response.json(accepted);});
 const pending=api.changePublication(input);input.original.expected_revision=9;await pending;assert.equal(calls,1);
 for(const value of [{...captured.original,confirm_publication:1},{...captured.original,password:'🔒'.repeat(257)},
  {...captured.original,privacy_tier:'unlisted'}, {...captured.original,expected_account_id:'jh_'+source}]){
  await assert.rejects(api.changePublication({...captured,original:value} as PublicationOriginal));
 }
 assert.equal(calls,1);
});
test('operation lookup sends the exact original hash and rejects mismatched acceptance',async()=>{
 const prepared=await preparePublicationOriginal(original);let calls=0;
 const api=client(async url=>{calls++;const args=JSON.parse(new URL(String(url)).searchParams.get('arguments')!);assert.deepEqual(args,prepared.read);return Response.json(ready(receipt));});
 assert.equal((await api.checkPublicationOriginal(original)).id,receipt.id);assert.equal(calls,1);
 for(const row of [{...receipt,kind:'publish_application_v1'},{...receipt,resource:{...receipt.resource,id:request}},
  {...receipt,status:'pending'},{...receipt,retry_after_seconds:1},{...receipt,error:{code:'processing_failed'}}])await assert.rejects(client(async()=>Response.json(ready(row))).checkPublicationOriginal(original));
 await assert.rejects(client(async()=>Response.json({...ready(receipt),operation:{...receipt,id:request}})).checkPublicationOriginal(original));
 for(const value of [{...accepted,data:{...accepted.data,accepted_revision:3}},
  {...accepted,operation:{...receipt,resource:{...receipt.resource,kind:'package'}}}])assert.throws(()=>publicationAccepted(value,original));
});
test('closure verifies request, hash, source and exact historical acceptance',async()=>{
 const {payloadHash}=await preparePublicationOriginal(original);
 const data={source_id:source,source_type:'document',request_id:request,payload_hash:payloadHash,outcome:'recorded',recorded_resource_id:source};
 const api=client(async(url,init)=>{assert.ok(String(url).endsWith('/close_document_publication_original_v1'));
  assert.deepEqual(JSON.parse(String(init?.body)),{...original,confirm_close:true});return Response.json(ready(data));});
 assert.equal((await api.closePublicationOriginal(original)).outcome,'recorded');
 for(const invalid of [{...data,source_id:request},{...data,source_type:'application'},{...data,payload_hash:'b'.repeat(64)},
  {...data,recorded_resource_id:request},{...data,recorded_resource_id:null}])await assert.rejects(client(async()=>Response.json(ready(invalid))).closePublicationOriginal(original));
});
test('CLI requires the source confirmation and matching action without sending a request',async()=>{
 let calls=0;const api=client(async()=>{calls++;return Response.json(accepted);});
 const run=(command:string,confirm?:string)=>publicationCommand(command,undefined,{file:'-',confirm},api,Readable.from([JSON.stringify(original)]));
 await assert.rejects(run('publications publish'));await assert.rejects(run('publications unpublish',source));assert.equal(calls,0);
 await run('publications publish',source);assert.equal(calls,1);
});
