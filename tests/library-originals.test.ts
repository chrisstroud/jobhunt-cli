import assert from 'node:assert/strict';
import test from 'node:test';
import { Readable } from 'node:stream';
import { JobHuntClient,libraryOriginal,prepareLibraryOriginal,libraryOriginalRead,libraryReceipt,type LibraryOriginal,type LibraryOperation } from '../client/src/index.ts';
import { documentCommand } from '../cli/src/documents.ts';
const account='jh_11111111-1111-4111-8111-111111111111',source='22222222-2222-4222-8222-222222222222',copy='33333333-3333-4333-8333-333333333333';
const operations:LibraryOperation[]=['rename_document_v2','duplicate_document_v2','set_default_document_v2'];
const plan=(operation:LibraryOperation):LibraryOriginal=>({expected_account_id:account,operation_name:operation,original:{document_id:source,request_id:'44444444-4444-4444-8444-444444444444',expected_revision:4,...(operation==='set_default_document_v2'?{}:{name:'Synthetic reviewed name'})}} as LibraryOriginal);
const ready=(data:unknown)=>({outcome:'ready',data,next_action:{kind:'none',label:''}});
const result=(operation:LibraryOperation)=>ready({id:crypto.randomUUID(),kind:operation,status:'succeeded',resource:{id:operation==='duplicate_document_v2'?copy:source,kind:'document',label:'Saved document',revision:operation==='rename_document_v2'?5:operation==='duplicate_document_v2'?1:4},retry_after_seconds:0,retry_expires_at:'2030-01-01T00:00:00Z'});
for(const operation of operations){
 test(operation+' snapshots and checks only its exact receipt',async()=>{
  const input=plan(operation),pending=prepareLibraryOriginal(input);input.original.expected_revision=7;
  const prepared=await pending;assert.equal(prepared.captured.original.expected_revision,4);
  const original=plan(operation),nullAccount=libraryOriginal({...original,original:{...original.original,expected_account_id:null}});
  assert.notEqual((await prepareLibraryOriginal(original)).payloadHash,(await prepareLibraryOriginal(nullAccount)).payloadHash);
  let reads=0;const client=new JobHuntClient({credential:{origin:'https://jobhunt.app',token:'synthetic-token'},fetchImpl:async(url,init)=>{
   reads++;assert.equal(init?.method,'GET');assert.deepEqual(JSON.parse(new URL(String(url)).searchParams.get('arguments')!),await libraryOriginalRead(original));return Response.json(result(operation));
  }});
  assert.equal((await client.libraryOriginals.check(original)).resource_id,operation==='duplicate_document_v2'?copy:source);assert.equal(reads,1);
  const other=operation==='rename_document_v2'?'duplicate_document_v2':'rename_document_v2';await assert.rejects(libraryReceipt(result(other),original));
 });
 test(operation+' closure binds exact hash and CLI requires source confirmation',async()=>{
  const input=plan(operation),{payloadHash}=await prepareLibraryOriginal(input);let writes=0;
  const client=new JobHuntClient({credential:{origin:'https://jobhunt.app',token:'synthetic-token'},fetchImpl:async(url,init)=>{
   writes++;assert.ok(String(url).endsWith('/close_document_library_original_v1'));assert.deepEqual(JSON.parse(String(init?.body)),{...input,confirm_close:true});
   return Response.json(ready({request_id:input.original.request_id,document_id:source,payload_hash:payloadHash,outcome:'closed'}));
  }});
  const stdin=()=>Readable.from([JSON.stringify(input)]);
  await assert.rejects(documentCommand('documents close-library',undefined,{file:'-',confirm:copy},client,stdin()));assert.equal(writes,0);
  assert.equal((await documentCommand('documents close-library',undefined,{file:'-',confirm:source},client,stdin()) as {outcome:string}).outcome,'closed');assert.equal(writes,1);
 });
}
test('strict action/name/account validation and UUID normalization precede I/O',()=>{
 const valid=plan('rename_document_v2');
 for(const input of [{...valid,operation_name:'delete_document_v2'},{...valid,operation_name:'set_default_document_v2'},{...valid,original:{...valid.original,name:' Unreviewed trim '}},{...valid,original:{...valid.original,expected_account_id:'jh_'+copy}}])assert.throws(()=>libraryOriginal(input));
 const upper={...valid,original:{...valid.original,request_id:'ABCDEFAB-4444-4444-8444-444444444444'}};assert.equal(libraryOriginal(upper).original.request_id,'abcdefab-4444-4444-8444-444444444444');
});

test('profile binding uses shared library check/close commands and preserves captured resource spelling',async()=>{
 const id='ABCDEFAB-2222-4222-8222-222222222222',profile='ABCDEFAB-5555-4555-8555-555555555555';
 const input:LibraryOriginal={expected_account_id:account,operation_name:'link_document_package_profile_v2',original:{expected_account_id:account,
  document_id:id,expected_revision:4,profile_id:profile,expected_profile_updated_at:'2026-10-22T12:00:00',acknowledge_linked_updates:true,request_id:'ABCDEFAB-4444-4444-8444-444444444444'}};
 const pending=prepareLibraryOriginal(input);input.original.expected_profile_updated_at=null;
 const {captured,payloadHash}=await pending;assert.equal(captured.original.document_id,id);assert.equal(captured.original.request_id,'abcdefab-4444-4444-8444-444444444444');
 assert.equal(captured.operation_name,'link_document_package_profile_v2');if(captured.operation_name!=='link_document_package_profile_v2')assert.fail();
 assert.equal(captured.original.expected_profile_updated_at,'2026-10-22T12:00:00');assert.notEqual(payloadHash,(await prepareLibraryOriginal(input)).payloadHash);
 const data={id:crypto.randomUUID(),kind:captured.operation_name,status:'succeeded',resource:{id:id.toLowerCase(),kind:'document',label:'Saved document',revision:5},retry_after_seconds:0,retry_expires_at:'2030-01-01T00:00:00Z'},receipt=ready(data);
 let reads=0,writes=0;
 const client=new JobHuntClient({credential:{origin:'https://jobhunt.app',token:'synthetic-token'},fetchImpl:async(url,init)=>{
  if(init?.method==='GET'){reads++;assert.deepEqual(JSON.parse(new URL(String(url)).searchParams.get('arguments')!),await libraryOriginalRead(captured));return Response.json(receipt);}
  writes++;assert.deepEqual(JSON.parse(String(init?.body)),{...captured,confirm_close:true});return Response.json(ready({request_id:captured.original.request_id,document_id:id,payload_hash:payloadHash,outcome:'recorded'}));
 }});
 const stdin=()=>Readable.from([JSON.stringify(captured)]);
 assert.equal((await documentCommand('documents check-library',undefined,{file:'-'},client,stdin()) as {revision:number}).revision,5);
 await assert.rejects(documentCommand('documents close-library',undefined,{file:'-',confirm:id.toLowerCase()},client,stdin()));assert.equal(writes,0);
 assert.equal((await documentCommand('documents close-library',undefined,{file:'-',confirm:id},client,stdin()) as {outcome:string}).outcome,'recorded');
 assert.equal(reads,1);assert.equal(writes,1);
 for(const invalid of [{...captured,operation_name:'set_default_document_v2'},{...captured,original:{...captured.original,acknowledge_linked_updates:false}},
  {...captured,original:{...captured.original,name:'Wrong action'}}])assert.throws(()=>libraryOriginal(invalid));
 for(const revision of [3,4])await assert.rejects(libraryReceipt({...receipt,data:{...data,resource:{...data.resource,revision}}},captured));
});
