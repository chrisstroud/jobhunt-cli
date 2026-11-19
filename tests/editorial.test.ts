import assert from 'node:assert/strict';
import test from 'node:test';
import { Readable } from 'node:stream';
import { JobHuntClient } from '../client/src/index.ts';
import { editorialHistoryInput, editorialWriteInput, editorialClosure, editorialReceiptRead, type EditorialWrite } from '../client/src/editorial-contracts.ts';
import { libraryCommand } from '../cli/src/library.ts';
const account='jh_11111111-1111-4111-8111-111111111111',document='22222222-2222-4222-8222-222222222222';
const original={expected_account_id:account,original:{expected_account_id:account,request_id:'33333333-3333-4333-8333-333333333333',document_id:document,expected_revision:4,status:'ready' as const}};
const ready=(data:unknown)=>({outcome:'ready',data,next_action:{kind:'none',label:''}});
const sdk=(fetchImpl:typeof fetch)=>new JobHuntClient({credential:{origin:'https://jobhunt.app',token:'synthetic-token'},fetchImpl});
test('status input snapshots exact intent; invalid states and unknown keys fail',()=>{
 const input=structuredClone(original.original),captured=editorialWriteInput(input);input.expected_revision=99;assert.equal(captured.expected_revision,4);
 for(const fields of [{status:'live'},{kind:'company'},{expected_revision:0},{publish:true}])assert.throws(()=>editorialWriteInput({...original.original,...fields}),/invalid_input/u);
});
test('SDK and CLI use typed document and package operations',async()=>{
 let writes=0;const client=sdk(async(url,init)=>{const path=new URL(String(url)).pathname;
  if(path.endsWith('/set_document_editorial_status_v1')){writes++;assert.deepEqual(JSON.parse(String(init?.body)),original.original);return Response.json(ready({document_id:document,kind:'document',status:'ready',revision:5}));}
  assert.ok(path.endsWith('/get_document_editorial_status_v1'));return Response.json(ready({document_id:document,kind:'package',status:'draft',revision:5}));
 });
 assert.equal((await client.setDocumentEditorialStatus(original.original)).data?.status,'ready');
 const result=await libraryCommand('documents editorial',document,{kind:'package'},client,Readable.from([]));assert.ok('data' in result);assert.equal((result.data as {status:string}).status,'draft');assert.equal(writes,1);
});
test('SDK rejects wrong source, kind, status or revision; filtered lists stay bound',async()=>{
 for(const fields of [{document_id:crypto.randomUUID()},{kind:'package'},{status:'draft'},{revision:9}]){
 const client=sdk(async()=>Response.json(ready({document_id:document,kind:'document',status:'ready',revision:5,...fields})));
 await assert.rejects(client.setDocumentEditorialStatus(original.original),/invalid_response/u);
 }
 const client=sdk(async()=>Response.json(ready({items:[{document_id:document,kind:'document',status:'draft',revision:5}],next_after_id:null})));
 await assert.rejects(client.listDocumentEditorialStatuses({status:'ready'}),/invalid_response/u);
});
test('closure binds exact hash, source and request and rejects incomplete outcomes',async()=>{
 const read=await editorialReceiptRead(original),data={document_id:document,request_id:original.original.request_id,payload_hash:read.expected_payload_hash,outcome:'closed'};
 assert.equal((await editorialClosure(ready(data),original)).outcome,'closed');
 for(const reply of [ready({...data,payload_hash:'0'.repeat(64)}),ready({...data,document_id:crypto.randomUUID()}),{...ready(null),outcome:'needs_input'}])await assert.rejects(editorialClosure(reply,original),/invalid_response/u);
 const client=sdk(async()=>{throw Error('must not dispatch');});await assert.rejects(client.closeDocumentEditorialOriginal(original,false as true),/invalid_input/u);
 await assert.rejects(libraryCommand('documents close-editorial',undefined,{file:'-'},client,Readable.from([JSON.stringify(original)])),/confirmation_required/u);
});

test('history identifiers normalize to the server UUID representation',()=>{assert.equal(editorialHistoryInput({document_id:document.toUpperCase()}).document_id,document);});
