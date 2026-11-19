import assert from 'node:assert/strict';
import test from 'node:test';
import { Readable, Writable } from 'node:stream';
import { JobHuntClient } from '../client/src/index.ts';
import { runCLI } from '../cli/src/cli.ts';
const a='11111111-1111-4111-8111-111111111111',b='22222222-2222-4222-8222-222222222222';
const input={package_id:a,document_ids:[b,a],expected_fingerprint:'a'.repeat(64),request_id:'33333333-3333-4333-8333-333333333333'};
const data={package_id:a,document_ids:[b,a],fingerprint:'b'.repeat(64)};
const ready=(data:unknown)=>({outcome:'ready',data,next_action:{kind:'none',label:''}});
const client=(fetchImpl:typeof fetch)=>new JobHuntClient({credential:{origin:'https://jobhunt.app',token:'synthetic-order-token'},fetchImpl});
test('SDK sends the complete captured original once and validates account package readback',async()=>{
  let writes=0;const c=client(async(url,init)=>{assert.equal(init?.credentials,'omit');assert.equal(new URL(String(url)).pathname,'/api/v1/journey/reorder_document_package_v1');writes++;assert.deepEqual(JSON.parse(String(init?.body)),input);return Response.json(ready(data));});
  assert.deepEqual((await c.reorderDocumentPackage(input)).data,data);assert.equal(writes,1);
  await assert.rejects(client(async()=>Response.json(ready({...data,package_id:b}))).getDocumentPackageOrder({package_id:a}),/invalid_response/);
});
test('SDK refuses incomplete, duplicate, foreign-shaped and extra input before IO',async()=>{
  const c=client(async()=>assert.fail('No IO'));
  for(const patch of [{document_ids:[]},{document_ids:[a,a]},{document_ids:[b]},{document_ids:[a,'invalid']},{expected_fingerprint:'bad'},{extra:true}])await assert.rejects(c.reorderDocumentPackage({...input,...patch}),/invalid_input/);
});
for(const write of [false,true])test(`CLI package order ${write?'write':'read'} routes to the same service`,async()=>{
  let calls=0;const sink=new Writable({write(_c,_e,next){next();}});
  const code=await runCLI(write?['library','reorder','--file','-','--json']:['library','order',a,'--json'],{env:{JOBHUNT_TOKEN:'synthetic-order-token'},stdin:Readable.from([JSON.stringify(input)]),stdout:sink,stderr:sink,fetchImpl:async(url,init)=>{
    calls++;assert.equal(new URL(String(url)).pathname,'/api/v1/journey/'+(write?'reorder_document_package_v1':'get_document_package_order_v1'));if(write)assert.deepEqual(JSON.parse(String(init?.body)),input);return Response.json(ready(data));
  }},'test');assert.equal(code,0);assert.equal(calls,1);
});
