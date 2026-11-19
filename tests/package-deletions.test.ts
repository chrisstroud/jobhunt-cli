import assert from 'node:assert/strict';
import test from 'node:test';
import { Readable } from 'node:stream';
import { JobHuntClient, documentDeletionOriginal, prepareDocumentDeletion, documentDeletionRead, type DocumentPackageDeletionOriginal } from '../client/src/index.ts';
import { documentCommand } from '../cli/src/documents.ts';
const account='jh_11111111-1111-4111-8111-111111111111',root='22222222-2222-4222-8222-222222222222',child='33333333-3333-4333-8333-333333333333';
const original:DocumentPackageDeletionOriginal={expected_account_id:account,operation_name:'delete_document_package_v2',original:{expected_account_id:account,document_id:root,expected_revision:4,request_id:'44444444-4444-4444-8444-444444444444',expected_document_ids:[root,child]}};
const ready=(data:unknown)=>({outcome:'ready',data,next_action:{kind:'none',label:''}});
const sdk=(fetchImpl:typeof fetch)=>new JobHuntClient({credential:{origin:'https://jobhunt.app',token:'synthetic-package-token'},fetchImpl});
const receipt=(kind='delete_document_package_v2')=>ready({id:crypto.randomUUID(),kind,status:'succeeded',resource:{id:root,kind:'document',label:'Saved document',revision:null},retry_after_seconds:0,retry_expires_at:'2030-01-01T00:00:00Z'});
test('package originals snapshot exact membership order and retain legacy omission/null hashes',async()=>{
 const value=structuredClone(original),pending=prepareDocumentDeletion(value);value.original.expected_document_ids.push(crypto.randomUUID());
 assert.equal((await pending).captured.original.expected_revision,4);
 assert.deepEqual((await pending).captured.original,original.original);
 const changed={...original,original:{...original.original,expected_document_ids:[child,root]}};
 assert.notEqual((await prepareDocumentDeletion(original)).payloadHash,(await prepareDocumentDeletion(changed)).payloadHash);
 const omitted=structuredClone(original);delete omitted.original.expected_account_id;
 const nulled={...omitted,original:{...omitted.original,expected_account_id:null}};
 assert.equal(new Set(await Promise.all([original,omitted,nulled].map(async input=>(await prepareDocumentDeletion(input)).payloadHash))).size,3);
});
test('package read is a bounded account/hash pointer and cannot accept individual deletion evidence',async()=>{
 let calls=0;
 const client=sdk(async(url,init)=>{calls++;assert.equal(init?.method,'GET');const args=JSON.parse(new URL(String(url)).searchParams.get('arguments')!);assert.deepEqual(args,await documentDeletionRead(original));assert.equal(args.operation_name,'delete_document_package_v2');assert.equal('expected_document_ids' in args,false);return Response.json(receipt());});
 assert.equal((await client.documentDeletions.check(original)).document_id,root);assert.equal(calls,1);
 await assert.rejects(sdk(async()=>Response.json(receipt('delete_document_v2'))).documentDeletions.check(original),/invalid_response/u);
});
test('package discriminator, account and complete member identifiers validate before I/O',()=>{
 for(const input of [{...original,operation_name:undefined},{...original,operation_name:'delete_document_v2'},{...original,original:{...original.original,expected_document_ids:[]}},{...original,original:{...original.original,expected_document_ids:[root,root]}},{...original,original:{...original.original,expected_document_ids:[root,'not-an-id']}}])assert.throws(()=>documentDeletionOriginal(input));
});
test('closure uses the same operation namespace and validates exact returned hash',async()=>{
 const {payloadHash}=await prepareDocumentDeletion(original);let writes=0;
 const client=sdk(async(url,init)=>{writes++;assert.ok(String(url).endsWith('/close_document_delete_original_v1'));assert.deepEqual(JSON.parse(String(init?.body)),{...original,confirm_close:true});return Response.json(ready({request_id:original.original.request_id,document_id:root,payload_hash:payloadHash,outcome:'closed'}));});
 assert.equal((await client.documentDeletions.close(original,true)).outcome,'closed');assert.equal(writes,1);
});
test('CLI check/close retain full 1000-member original without the old16KiB carrier limit',async()=>{
 const input=structuredClone(original);input.original.expected_document_ids=[root,...Array.from({length:999},(_,i)=>(i+1).toString(16).padStart(8,'0')+'-5555-4555-8555-555555555555')];
 const text=JSON.stringify(input,null,2);assert.ok(text.length>16384);
 const {payloadHash}=await prepareDocumentDeletion(input);let writes=0;
 const client=sdk(async(_url,init)=>{if(init?.method==='POST'){writes++;return Response.json(ready({request_id:input.original.request_id,document_id:root,payload_hash:payloadHash,outcome:'recorded'}));}return Response.json(receipt());});
 const stdin=()=>Readable.from([text]);
 assert.equal((await documentCommand('documents check-delete',undefined,{file:'-'},client,stdin()) as {document_id:string}).document_id,root);
 await assert.rejects(documentCommand('documents close-delete',undefined,{file:'-',confirm:child},client,stdin()));assert.equal(writes,0);
 assert.equal((await documentCommand('documents close-delete',undefined,{file:'-',confirm:root},client,stdin()) as {outcome:string}).outcome,'recorded');assert.equal(writes,1);
});
