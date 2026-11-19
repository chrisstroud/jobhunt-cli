import assert from 'node:assert/strict';
import test from 'node:test';
import { Readable } from 'node:stream';
import { JobHuntClient,libraryOriginal,libraryReceipt,libraryOriginalRead,prepareLibraryOriginal,type LibraryOriginal } from '../client/src/index.ts';
import { documentCommand } from '../cli/src/documents.ts';
const account='jh_11111111-1111-4111-8111-111111111111',root='abcdefab-2222-4222-8222-222222222222',member='33333333-3333-4333-8333-333333333333';
const plan=(archetype:'structured'|'letter'|'reference'|'statement'):LibraryOriginal=>({expected_account_id:account,operation_name:'add_package_document_v2',original:{expected_account_id:account,document_id:root,expected_revision:4,request_id:crypto.randomUUID(),name:'Synthetic package member',archetype}});
const ready=(data:unknown)=>({outcome:'ready',data,next_action:{kind:'none',label:''}});
const receipt=(resource=member)=>ready({id:crypto.randomUUID(),kind:'add_package_document_v2',status:'succeeded',resource:{id:resource,kind:'document',label:'Saved document',revision:1},retry_after_seconds:0,retry_expires_at:'2030-01-01T00:00:00Z'});
for(const archetype of ['structured','letter','reference','statement'] as const){
 test(archetype+' retains the exact package and archetype through checks and CLI closure',async()=>{
  const input=plan(archetype),pending=prepareLibraryOriginal(input);input.original.expected_revision=99;
  const captured=(await pending).captured;assert.equal(captured.original.expected_revision,4);assert.equal('archetype' in captured.original&&captured.original.archetype,archetype);
  const {payloadHash}=await prepareLibraryOriginal(captured);let writes=0;
  const client=new JobHuntClient({credential:{origin:'https://jobhunt.app',token:'synthetic-token'},fetchImpl:async(url,init)=>{
   if(init?.method==='POST'){writes++;assert.ok(String(url).endsWith('/close_document_library_original_v1'));assert.deepEqual(JSON.parse(String(init.body)),{...captured,confirm_close:true});return Response.json(ready({request_id:captured.original.request_id,document_id:root,payload_hash:payloadHash,outcome:'closed'}));}
   assert.deepEqual(JSON.parse(new URL(String(url)).searchParams.get('arguments')!),await libraryOriginalRead(captured));return Response.json(receipt());
  }});
  assert.equal((await client.libraryOriginals.check(captured)).resource_id,member);
  const stdin=()=>Readable.from([JSON.stringify(captured)]);
  await assert.rejects(documentCommand('documents close-library',undefined,{file:'-',confirm:member},client,stdin()));assert.equal(writes,0);
  assert.equal((await documentCommand('documents close-library',undefined,{file:'-',confirm:root},client,stdin()) as {outcome:string}).outcome,'closed');
 });
}
test('legacy UUID spelling is preserved and root aliases cannot prove a new member',async()=>{
 const input=plan('letter');input.original.document_id=root.toUpperCase();const captured=libraryOriginal(input);
 assert.equal(captured.original.document_id,root.toUpperCase());assert.equal((await libraryReceipt(receipt(),captured)).resource_id,member);
 await assert.rejects(libraryReceipt(receipt(root),captured),/invalid_response/u);
});
test('archetype, action and unknown content fields cannot change a captured command',()=>{
 const input=plan('letter');
 for(const bad of [{...input,operation_name:'duplicate_document_v2'}, {...input,original:{...input.original,archetype:'contact'}}, {...input,original:{...input.original,content:{}}}, {...input,original:{...input.original,archetype:undefined}}])assert.throws(()=>libraryOriginal(bad));
});
