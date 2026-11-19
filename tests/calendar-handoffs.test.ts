import assert from 'node:assert/strict';
import {Readable,Writable} from 'node:stream';
import test from 'node:test';
import {JobHuntClient} from '../client/src/index.ts';
import {runCLI} from '../cli/src/cli.ts';
const id='11111111-1111-4111-8111-111111111111',other='22222222-2222-4222-8222-222222222222',hash='a'.repeat(64);
const selection={connection_id:other,source_kind:'task' as const,source_id:other,action:'sync' as const,recover_of:null};
const state={id,selection,status:'failed' as const,admission:'not_admitted' as const,change_id:null,failure_code:'source_or_access_changed' as const,
  can_review:true,can_resolve:true,fingerprint:hash};
const ready=(data:unknown)=>({outcome:'ready',data,next_action:{kind:'none',label:''}});
const api=(fetchImpl:typeof fetch)=>new JobHuntClient({credential:{origin:'https://jobhunt.app',token:'synthetic-handoff-key'},fetchImpl});
const review={handoff:state,review:{selection,mode:'create',calendar_id:'Synthetic Calendar',event_id:null,source_fingerprint:hash,event_fingerprint:hash,
  fingerprint:hash,review_token:'synthetic-signed-proof',status_prefix:'',previous_event_retained:false}};
const input={handoff_id:id,expected_fingerprint:hash,expected_account_id:'jh_'+id,request_id:other,review_token:'synthetic-signed-proof'};
test('handoff status preserves unknown related requests and rejects invented delivery or private fields',async()=>{
  assert.deepEqual((await api(async()=>Response.json(ready(state))).getCalendarHandoff({handoff_id:id})).data,state);
  const unknown={...state,status:'needs_review',admission:'unconfirmed',change_id:other,failure_code:'receipt_conflict',can_review:false};
  assert.deepEqual((await api(async()=>Response.json(ready(unknown))).getCalendarHandoff({handoff_id:id})).data,unknown);
  const closed={...unknown,status:'resolved',can_resolve:false};
  assert.deepEqual((await api(async()=>Response.json(ready(closed))).getCalendarHandoff({handoff_id:id})).data,closed);
  for(const unsafe of [{...state,authorization:{}},{...state,review_token:'synthetic-private-proof'},
    {...state,admission:'confirmed'},{...state,status:'queued',change_id:other},{...state,id:other},
    {...unknown,can_review:true},{...closed,can_resolve:true},{...state,source_body:'Synthetic notes'}]){
    await assert.rejects(api(async()=>Response.json(ready(unsafe))).getCalendarHandoff({handoff_id:id}),/invalid_response/);
  }
});
test('handoff pages and reviews bind complete shape, source identity and original fingerprint',async()=>{
  const page={items:[state],page:1,total:1,has_more:false};
  assert.deepEqual((await api(async()=>Response.json(ready(page))).listCalendarHandoffs()).data,page);
  assert.deepEqual((await api(async()=>Response.json(ready(review))).reviewCalendarHandoff({handoff_id:id,expected_fingerprint:hash})).data,review);
  for(const unsafe of [{...page,items:[state,state]},{...page,has_more:true},{...page,items:[{...state,notes:'Synthetic private notes'}]}])
    await assert.rejects(api(async()=>Response.json(ready(unsafe))).listCalendarHandoffs(),/invalid_response/);
  await assert.rejects(api(async()=>Response.json(ready({...review,review:{...review.review,selection:{...selection,source_id:id}}})))
    .reviewCalendarHandoff({handoff_id:id,expected_fingerprint:hash}),/invalid_response/);
});
test('typed handoff writes keep original request and proof while refusing malformed or unconfirmed input',async()=>{
  let calls=0;
  const client=api(async(url,init)=>{calls++;assert.equal(new URL(String(url)).pathname,'/api/v1/journey/resume_calendar_handoff');
    assert.deepEqual(JSON.parse(String(init?.body)),input);return Response.json(ready({...state,status:'pending',can_review:false,failure_code:null}));});
  assert.equal((await client.resumeCalendarHandoff(input)).data?.status,'pending');
  for(const unsafe of [{...input,review_token:''},{...input,expected_account_id:undefined},{...input,expected_fingerprint:'invalid'},{...input,authorization:{}}])
    await assert.rejects(client.resumeCalendarHandoff(unsafe as never),/invalid_input/);
  await assert.rejects(client.resolveCalendarHandoff({...input,confirm_leave_unchanged:1} as never),/invalid_input/);
  assert.equal(calls,1);
});
test('CLI handoff leave needs matching explicit confirmation before any HTTP request',async()=>{
  const leave={handoff_id:id,expected_fingerprint:hash,expected_account_id:'jh_'+id,request_id:other,confirm_leave_unchanged:true};
  for(const confirmation of [other,id]){
    let calls=0,output='',errors='';
    const status=await runCLI(['calendar','handoff-leave','--file','-','--confirm',confirmation,'--json','--non-interactive'],{
      env:{JOBHUNT_TOKEN:'synthetic-handoff-key'},stdin:Readable.from([JSON.stringify(leave)]),
      stdout:new Writable({write(chunk,_,done){output+=chunk.toString();done();}}),stderr:new Writable({write(chunk,_,done){errors+=chunk.toString();done();}}),
      fetchImpl:async(url,init)=>{calls++;assert.equal(new URL(String(url)).pathname,'/api/v1/journey/resolve_calendar_handoff');assert.deepEqual(JSON.parse(String(init?.body)),leave);
        return Response.json(ready({...state,status:'resolved',can_review:false,can_resolve:false}));},
    },'test');
    assert.equal(status,confirmation===id?0:2);assert.equal(calls,confirmation===id?1:0);
    if(confirmation===id)assert.equal(JSON.parse(output).data.status,'resolved');else assert.equal(JSON.parse(errors).error.code,'confirmation_required');
  }
});
