import test from 'node:test';
import assert from 'node:assert/strict';
import {Readable} from 'node:stream';
import {JobHuntClient} from '../client/src/index.ts';
import {resumeImportOriginal,resumeImportOriginalHash,type ResumeImportOriginal} from '../client/src/resume-import-originals.ts';
import {documentCommand} from '../cli/src/documents.ts';
const account='jh_11111111-1111-4111-8111-111111111111',request='22222222-2222-4222-8222-222222222222',resource='33333333-3333-4333-8333-333333333333';
const input:ResumeImportOriginal={expected_account_id:account,command:{operation_name:'import_resume_text',original:{request_id:request,text:'Synthetic resume 🌱'}}};
const receipt={id:'44444444-4444-4444-8444-444444444444',kind:'import_resume_text',status:'running',resource:{id:resource,kind:'document',label:'Resume import',revision:1},retry_after_seconds:2,retry_expires_at:'2099-01-01T00:00:00Z'};
const operation={outcome:'pending',data:receipt,operation:receipt,next_action:{kind:'retry',label:'Check progress'}};
const ready=(data:unknown)=>({outcome:'ready',data,next_action:{kind:'none',label:''}});
const client=(fetchImpl:typeof fetch)=>new JobHuntClient({credential:{origin:'https://jobhunt.app',token:'synthetic-import-original-test'},fetchImpl});
test('original check captures nested text before dispatch and sends no private text in a URL',async()=>{
 const original=structuredClone(input);let calls=0;
 const api=client(async(url,init)=>{calls++;assert.equal(String(url),'https://jobhunt.app/api/v1/journey/check_resume_import_original_v1');
  assert.equal(init?.method,'POST');assert.deepEqual(JSON.parse(String(init?.body)),input);return Response.json(operation);});
 const pending=api.checkResumeImportOriginal(original);original.command.original.request_id=resource;
 assert.equal((await pending).data?.resource?.id,resource);assert.equal(calls,1);
});
test('accepted failed extraction remains historical evidence and conflicting evidence fails closed',async()=>{
 const failed={...receipt,status:'failed',retry_after_seconds:0,error:{code:'processing_failed',message:'Synthetic failure'}};
 assert.equal((await client(async()=>Response.json({...operation,outcome:'failed',data:failed,operation:failed})).checkResumeImportOriginal(input)).data?.status,'failed');
 for(const row of [{...receipt,kind:'confirm_resume_import'},{...receipt,resource:{...receipt.resource,kind:'application'}}])
  await assert.rejects(client(async()=>Response.json({...operation,data:row,operation:row})).checkResumeImportOriginal(input));
 await assert.rejects(client(async()=>Response.json({...operation,operation:{...receipt,id:request}})).checkResumeImportOriginal(input));
});
test('closure verifies the exact original hash, namespace, request and outcome',async()=>{
 const digest=await resumeImportOriginalHash(input),data={operation_name:'import_resume_text',request_id:request,payload_hash:digest,outcome:'recorded',recorded_resource_id:resource};
 assert.equal((await client(async(_url,init)=>{assert.deepEqual(JSON.parse(String(init?.body)),{...input,confirm_close:true});return Response.json(ready(data));}).closeResumeImportOriginal(input)).outcome,'recorded');
 for(const invalid of [{...data,payload_hash:'0'.repeat(64)},{...data,request_id:resource},{...data,recorded_resource_id:null},
  {...data,operation_name:'confirm_resume_import'},{...data,outcome:'closed'}])
  await assert.rejects(client(async()=>Response.json(ready(invalid))).closeResumeImportOriginal(input));
 const omitted=await resumeImportOriginalHash(input),explicit=structuredClone(input);explicit.command.original.expected_account_id=null;
 assert.notEqual(await resumeImportOriginalHash(explicit),omitted);
 const uppercase=structuredClone(input);uppercase.command.original.request_id='ABCDEFAB-CDEF-4ABC-8ABC-ABCDEFABCDEF';
 const lowercase=structuredClone(uppercase);lowercase.command.original.request_id=lowercase.command.original.request_id.toLowerCase();
 assert.equal(await resumeImportOriginalHash(uppercase),await resumeImportOriginalHash(lowercase));
});
test('malformed or cross-account originals are rejected without dispatch',async()=>{
 for(const value of [{...input,command:{...input.command,original:{...input.command.original,expected_account_id:'jh_'+resource}}},
  {...input,command:{operation_name:'get_resume_import',original:input.command.original}},
  {...input,command:{...input.command,original:{...input.command.original,text:'Synthetic',extra:true}}}])assert.throws(()=>resumeImportOriginal(value));
});
test('full-file recovery keeps byte identity and requires account context',async()=>{
 const bytes=new TextEncoder().encode('%PDF-1.7\nSynthetic'),fileReceipt={...receipt,kind:'import_resume_upload'};
 let calls=0;const api=client(async(url,init)=>{calls++;assert.ok(String(url).endsWith('/resume-upload-original/check'));
  const form=init?.body as FormData;assert.equal(form.get('request_id'),request);assert.equal(form.get('expected_account_id'),account);
  const file=form.get('file') as Blob;assert.deepEqual(new Uint8Array(await file.arrayBuffer()),bytes);
  return Response.json({...operation,data:fileReceipt,operation:fileReceipt});});
 await assert.rejects(api.checkResumeImportFileOriginal({request_id:request} as never,bytes));assert.equal(calls,0);
 assert.equal((await api.checkResumeImportFileOriginal({request_id:request,expected_account_id:account},bytes)).data?.kind,'import_resume_upload');
});
test('CLI original closure requires matching request confirmation before HTTP',async()=>{
 let calls=0;const digest=await resumeImportOriginalHash(input),api=client(async()=>{calls++;return Response.json(ready({
  operation_name:'import_resume_text',request_id:request,payload_hash:digest,outcome:'closed',recorded_resource_id:null}));});
 const run=(confirm?:string)=>documentCommand('resume-imports close-original',undefined,{file:'-',confirm},api,Readable.from([JSON.stringify(input)]));
 await assert.rejects(run());await assert.rejects(run(resource));assert.equal(calls,0);await run(request);assert.equal(calls,1);
});
test('historical unbound file input is explicit and keeps the captured account',async()=>{
 const bytes=new TextEncoder().encode('%PDF-1.7\nSynthetic');let calls=0;
 const api=client(async(_url,init)=>{calls++;const form=init?.body as FormData;
  assert.equal(form.get('expected_account_id'),account);assert.equal(form.get('original_account_unbound'),'true');
  const row={...receipt,kind:'import_resume_upload'};return Response.json({...operation,data:row,operation:row});});
 await api.checkResumeImportFileOriginal({request_id:request,expected_account_id:account,original_account_unbound:true},bytes);
 assert.equal(calls,1);
 await assert.rejects(api.checkResumeImportFileOriginal({request_id:request,expected_account_id:account,original_account_unbound:false} as never,bytes));
 assert.equal(calls,1);
});
