import assert from 'node:assert/strict';
import test from 'node:test';
import { Readable, Writable } from 'node:stream';
import { JobHuntClient, type CreateApplication } from '../client/src/index.ts';
import { runCLI, type IO } from '../cli/src/cli.ts';
const id='11111111-1111-4111-8111-111111111111';
const attributes: CreateApplication = {title:'Synthetic role',company_name:'Synthetic employer',status:'Backlog',
  company_id:id,source_contact_id:id,resume_template_id:'synthetic-resume',job_search:'synthetic-hunt',source:'Referral',
  job_details:{description:'Synthetic complete posting.\n'.repeat(5000)+'FULL TAIL',custom:{preserve:[1,2]}},
  resume_overrides:{summary:'Synthetic user-authored summary'},cover_letter:{opening:'Synthetic user-authored letter'},
  contacts:[{name:'Synthetic contact',email:'contact@example.test',role:'recruiter',is_primary:true}],activity:[{type:'note',note:'Synthetic imported history'}]};
const resource={type:'application',id:'synthetic-role',attributes:{title:attributes.title,company_name:attributes.company_name,status:'Backlog',version:1}};
const credential={origin:'https://jobhunt.app',token:'synthetic_native_create_token'};

test('rich native creation preserves complete nested content and exact import metadata in one request',async()=>{
  let calls=0;const metadata={import_attempt_id:id,import_confirmed:true,import_review_revision:2};
  const client=new JobHuntClient({credential,fetchImpl:async(url,init)=>{
    calls++;assert.equal(new URL(String(url)).pathname,'/api/v1/applications');assert.equal(init?.method,'POST');
    assert.equal(init?.credentials,'omit');assert.equal(init?.redirect,'error');
    assert.deepEqual(JSON.parse(String(init?.body)),{data:{type:'application',attributes,meta:metadata}});
    return Response.json({data:resource});
  }});
  assert.equal((await client.createApplication(attributes,metadata)).data.id,'synthetic-role');assert.equal(calls,1);
});

test('malformed rich fields never dispatch and uncertain native creation never automatically retries',async()=>{
  let calls=0;const client=new JobHuntClient({credential,fetchImpl:async()=>{calls++;throw Error('Synthetic interrupted reply');}});
  const cycle:Record<string,unknown>={};cycle.self=cycle;
  for(const fields of [{...attributes,title:''},{...attributes,unknown:true},{...attributes,contacts:['bad']},{...attributes,resume_overrides:[]},{...attributes,job_details:cycle},{...attributes,source:'bad\0text'}])
    await assert.rejects(client.createApplication(fields as CreateApplication),/invalid_input/);
  await assert.rejects(client.createApplication(attributes,{import_confirmed:'true'} as never),/invalid_input/);
  assert.equal(calls,0);await assert.rejects(client.createApplication(attributes));assert.equal(calls,1);
});

function io(source:unknown,fetchImpl:typeof fetch){let output='',errors='';const value:IO={env:{JOBHUNT_TOKEN:credential.token},stdin:Readable.from([JSON.stringify(source)]),fetchImpl,
  stdout:new Writable({write(c,_e,next){output+=c;next();}}),stderr:new Writable({write(c,_e,next){errors+=c;next();}})};return{value,result:()=>({output,errors})};}

test('CLI file creation is exclusive of shorthand flags and carries the reviewed native envelope',async()=>{
  let calls=0;const envelope={data:{type:'application',attributes,meta:{import_attempt_id:id,import_confirmed:true,import_review_revision:2}}};
  const transport=async(_u:unknown,init?:RequestInit)=>{calls++;assert.deepEqual(JSON.parse(String(init?.body)),envelope);return Response.json({data:resource});};
  const saved=io(envelope,transport as typeof fetch);
  assert.equal(await runCLI(['applications','create','--file','-','--json','--non-interactive'],saved.value,'test'),0);
  assert.equal(calls,1);assert.equal(JSON.parse(saved.result().output).data.id,resource.id);assert.equal(saved.result().errors,'');
  const mixed=io(envelope,transport as typeof fetch);
  assert.equal(await runCLI(['applications','create','--file','-','--title','Other','--json'],mixed.value,'test'),2);assert.equal(calls,1);
  const invalid=io({...envelope,secret:'not allowed'},transport as typeof fetch);
  assert.equal(await runCLI(['applications','create','--file','-','--json'],invalid.value,'test'),2);assert.equal(calls,1);assert.ok(!invalid.result().errors.includes('not allowed'));
});
