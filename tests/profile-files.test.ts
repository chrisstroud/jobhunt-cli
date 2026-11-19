import assert from 'node:assert/strict';import {mkdtemp,writeFile,rm} from 'node:fs/promises';import {tmpdir} from 'node:os';import {join} from 'node:path';import {Readable,Writable} from 'node:stream';import test from 'node:test';
import {JobHuntClient} from '../client/src/index.ts';import {profileFileKind,profileHostFileInput,MAX_PROFILE_FILE_BYTES} from '../client/src/profile-file-contracts.ts';import {runCLI} from '../cli/src/cli.ts';
const id='11111111-1111-4111-8111-111111111111';const intent={request_id:id,expected_account_id:'jh_'+id,profile_id:id,expected_updated_at:null,acknowledge_linked_updates:true as const};
const data={id,name:'',personal_data:{hunt_photo_id:id},updated_at:null,public_use:false};const ready=()=>Response.json({outcome:'ready',data,next_action:{kind:'none',label:''}});
const source=()=>{const b=new Uint8Array(400000);b.set([137,80,78,71,13,10,26,10]);return b;};
const client=(fetchImpl:typeof fetch)=>new JobHuntClient({credential:{origin:'https://jobhunt.app',token:'synthetic_profile_credential'},fetchImpl});
test('native full-file client freezes supplied bytes and sends exact intent without paths or implicit retries',async()=>{
 const bytes=source(),before=new Uint8Array(bytes);let calls=0;
 const task=client(async(url,init)=>{calls++;assert.equal(String(url),'https://jobhunt.app/api/v1/journey/profile-photo-upload');assert.equal(init?.redirect,'error');assert.equal(init?.credentials,'omit');assert.equal(new Headers(init?.headers).get('authorization'),'Bearer synthetic_profile_credential');assert.ok(init?.body instanceof FormData);
 assert.deepEqual(JSON.parse(String(init.body.get('intent'))),intent);const photo=init.body.get('photo') as File;assert.equal(photo.name,'photo.png');assert.equal(photo.type,'image/png');assert.deepEqual(new Uint8Array(await photo.arrayBuffer()),before);return ready();}).uploadProfilePhotoFile(intent,bytes);
 bytes.fill(0);assert.equal((await task).data?.id,id);assert.equal(calls,1);
});
test('JPEG/PNG full file bounds remain separate from compact PNG validation',async()=>{
 assert.equal(profileFileKind(Uint8Array.from([255,216,255,1])),'image/jpeg');assert.equal(profileFileKind(source()),'image/png');
 for(const bytes of [new Uint8Array(),new Uint8Array(MAX_PROFILE_FILE_BYTES+1),Uint8Array.from([60,115,118,103])])assert.throws(()=>profileFileKind(bytes),/invalid_input/);
 let calls=0;await assert.rejects(client(async()=>{calls++;return Response.json({ok:false},{status:503});}).uploadProfilePhotoFile(intent,source()),/service_unavailable/);assert.equal(calls,1);
});
test('private host input retains source fingerprint/reference and rejects malformed metadata',async()=>{
 const input={...intent,source_size:400000,source_sha256:'a'.repeat(64),media_type:'image/png' as const,file:{download_url:'https://approved.example.test/file',file_id:'synthetic'}};
 assert.deepEqual(profileHostFileInput(input),input);
 await client(async(url,init)=>{assert.ok(String(url).endsWith('/upload_profile_photo_file'));assert.deepEqual(JSON.parse(String(init?.body)),input);return ready();}).uploadProfilePhotoHostFile(input);
 for(const change of [{source_size:0},{source_sha256:'bad'},{media_type:'image/svg+xml'},{file:{download_url:'',file_id:'synthetic'}}])assert.throws(()=>profileHostFileInput({...input,...change}),/invalid_input/);
 await assert.rejects(client(async()=>Response.json({outcome:'ready',data:{...data,id:'22222222-2222-4222-8222-222222222222'},next_action:{kind:'none',label:''}})).uploadProfilePhotoFile(intent,source()),/invalid_response/);
});
test('full-file CLI requires explicit profile confirmation and retains original JSON/file',async()=>{
 const dir=await mkdtemp(join(tmpdir(),'photo-file-cli-'));try{const image=join(dir,'synthetic.png'),file=join(dir,'intent.json');await writeFile(image,source());await writeFile(file,JSON.stringify(intent));let calls=0;
 async function run(confirm:boolean){let stdout='',stderr='';const code=await runCLI(['profiles','photo-upload-file','--file',file,'--image',image,...(confirm?['--confirm',id]:[]),'--json','--non-interactive'],{env:{JOBHUNT_TOKEN:'synthetic_profile_credential'},stdin:Readable.from([]),fetchImpl:async(url,init)=>{calls++;assert.ok(String(url).endsWith('/profile-photo-upload'));assert.ok(init?.body instanceof FormData);assert.deepEqual(JSON.parse(String(init.body.get('intent'))),intent);return ready();},stdout:new Writable({write(v,_e,done){stdout+=v.toString();done();}}),stderr:new Writable({write(v,_e,done){stderr+=v.toString();done();}})},'test');return {code,stdout,stderr};}
 assert.equal((await run(false)).code,2);assert.equal(calls,0);const good=await run(true);assert.equal(good.code,0);assert.equal(calls,1);assert.equal(JSON.parse(good.stdout).data.id,id);
 }finally{await rm(dir,{recursive:true,force:true});}
});

test('host-file CLI confirms the reviewed profile and preserves the JSON transport',async()=>{
 const dir=await mkdtemp(join(tmpdir(),'photo-host-cli-'));try{const file=join(dir,'intent.json');const input={...intent,source_size:400000,source_sha256:'a'.repeat(64),media_type:'image/png',file:{download_url:'https://approved.example.test/file',file_id:'synthetic'}};await writeFile(file,JSON.stringify(input));let calls=0;
 async function run(confirm:boolean){return runCLI(['profiles','photo-upload-host-file','--file',file,...(confirm?['--confirm',id]:[]),'--json','--non-interactive'],{env:{JOBHUNT_TOKEN:'synthetic_profile_credential'},stdin:Readable.from([]),fetchImpl:async(url,init)=>{calls++;assert.ok(String(url).endsWith('/upload_profile_photo_file'));assert.deepEqual(JSON.parse(String(init?.body)),input);return ready();},stdout:new Writable({write(_v,_e,done){done();}}),stderr:new Writable({write(_v,_e,done){done();}})},'test');}
 assert.equal(await run(false),2);assert.equal(calls,0);assert.equal(await run(true),0);assert.equal(calls,1);
 }finally{await rm(dir,{recursive:true,force:true});}
});

test('photo originals capture file bytes, nullable versions and Python-normalized UUIDs before waits',async()=>{
 const {prepareProfilePhotoFile,prepareProfilePhotoOriginal,profilePhotoFileReceipt,profilePhotoFileOriginal}=await import('../client/src/profile-file-contracts.ts');
 const bytes=source(),originalBytes=new Uint8Array(bytes),input={...intent,profile_id:'ABCDEFAB-1111-4111-8111-111111111111',request_id:'ABCDEFAB-2222-4222-8222-222222222222'};
 const pending=prepareProfilePhotoFile(input,bytes);bytes.fill(0);input.profile_id=id;input.expected_account_id='jh_22222222-2222-4222-8222-222222222222';
 const prepared=await pending;assert.equal(prepared.original.profile_id,'abcdefab-1111-4111-8111-111111111111');assert.equal(prepared.read.request_id,'abcdefab-2222-4222-8222-222222222222');
 assert.equal(prepared.read.expected_account_id,intent.expected_account_id);assert.equal(prepared.original.source_sha256,await import('node:crypto').then(c=>c.createHash('sha256').update(originalBytes).digest('hex')));
 const absent={...prepared.original};delete absent.expected_account_id;assert.notEqual((await prepareProfilePhotoOriginal(absent)).payloadHash,(await prepareProfilePhotoOriginal({...absent,expected_account_id:null})).payloadHash);
 const good={outcome:'ready',data:{id,kind:'upload_profile_photo_file',status:'succeeded',resource:{id:prepared.original.profile_id,kind:'profile',label:'Saved profile',revision:null},related_ids:[id],retry_after_seconds:0,retry_expires_at:'2030-01-01T00:00:00Z'},next_action:{kind:'none',label:''}};
 assert.equal(profilePhotoFileReceipt(good,prepared.original).photoId,id);
 for(const change of [{kind:'save_hunt_profile_photo_v2'},{status:'pending'},{related_ids:undefined},{related_ids:[id,id]},{related_ids:['bad']},{retry_after_seconds:1},{error:{code:'processing_failed',message:'Synthetic'}},{resource:{...good.data.resource,revision:1}}])assert.throws(()=>profilePhotoFileReceipt({...good,data:{...good.data,...change}},prepared.original));
 assert.throws(()=>profilePhotoFileOriginal({...prepared.original,file:{download_url:'https://approved.example.test/file',file_id:'synthetic'}}));
});

test('identity SDK replies validate the captured nested original rather than a mutable caller object',async()=>{
 const input={...intent,profile_id:id,name:'Synthetic profile',personal_data:{name:'Synthetic owner',nested:{value:true}},is_default:false};
 await client(async(_url,init)=>{input.profile_id='22222222-2222-4222-8222-222222222222';input.personal_data.nested.value=false;assert.equal(JSON.parse(String(init?.body)).personal_data.nested.value,true);
  return Response.json({outcome:'ready',data:{...data,name:'Synthetic profile',is_default:false,linked_package_count:0,linked_hunt_page:false},operation:{id,kind:'save_hunt_profile_v2',status:'succeeded',resource:{id,kind:'profile',label:'Saved profile',revision:null},retry_after_seconds:0,retry_expires_at:'2030-01-01T00:00:00Z'},next_action:{kind:'none',label:''}});
 }).saveProfileIdentity(input);
});
