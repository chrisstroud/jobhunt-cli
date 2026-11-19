import assert from 'node:assert/strict';
import test from 'node:test';
import {Readable} from 'node:stream';
import {JobHuntClient,captureProfilePhotoOriginal,profileOriginalClosureResult,type ProfileIdentityOriginal,type ProfilePhotoOriginal} from '../client/src/index.ts';
import {profileCommand} from '../cli/src/profiles.ts';
import {digest} from '../client/src/highlight-file-contracts.ts';
import {stableJsonValue} from '../client/src/native-json.ts';
const account='jh_11111111-1111-4111-8111-111111111111',id='22222222-2222-4222-8222-222222222222',request='abcdefab-3333-4333-8333-333333333333';
const identity:ProfileIdentityOriginal={expected_account_id:account,original:{request_id:request,name:'Synthetic identity',personal_data:{number:1},is_default:true,acknowledge_linked_updates:true}};
const photo:ProfilePhotoOriginal={expected_account_id:account,original:{request_id:request,expected_account_id:account,profile_id:id,expected_updated_at:null,acknowledge_linked_updates:true,source_sha256:'a'.repeat(64),source_size:32,media_type:'image/png'}};
const data=(profile_id:string|null,outcome='closed',payload_hash='b'.repeat(64))=>({request_id:request,profile_id,payload_hash,outcome});
const ready=(row:unknown)=>Response.json({outcome:'ready',data:row,next_action:{kind:'none',label:''}});
const client=(fetchImpl:typeof fetch)=>new JobHuntClient({credential:{origin:'https://jobhunt.app',token:'synthetic-closure'},fetchImpl});
test('identity closure requires explicit intent and captures the complete original before I/O',async()=>{
 const input=structuredClone(identity),original=structuredClone(input);let calls=0;
 const api=client(async(url,init)=>{calls++;assert.ok(String(url).endsWith('/close_profile_identity_original_v1'));assert.equal(init?.method,'POST');assert.deepEqual(JSON.parse(String(init?.body)),{...original,confirm_close:true});return ready(data(null));});
 await assert.rejects(api.profileOriginals.closeIdentity(input,false as true));assert.equal(calls,0);
 const pending=api.profileOriginals.closeIdentity(input,true);input.original.personal_data.number=2;
 assert.equal((await pending).outcome,'closed');assert.equal(calls,1);
});
test('SDK and CLI closure preserve legacy JSON source numbers and require request confirmation',async()=>{
 const source=JSON.stringify({...identity,confirm_close:true}).replace('"number":1','"number":1.0,"large":9007199254740993');let calls=0;
 const api=client(async(url,init)=>{calls++;assert.ok(String(url).endsWith('/close_profile_identity_original_v1'));assert.ok(init?.body instanceof Uint8Array);assert.equal(new TextDecoder().decode(init.body),source);return ready(data(id,'recorded'));});
 const bytes=new TextEncoder().encode(source),pending=api.profileOriginals.closeIdentitySource(bytes);bytes.fill(0);await pending;
 await assert.rejects(profileCommand('profiles close-identity',undefined,{file:'-',confirm:id},api,Readable.from([source])));assert.equal(calls,1);
 assert.equal((await profileCommand('profiles close-identity',undefined,{file:'-',confirm:request.toUpperCase()},api,Readable.from([source])) as {outcome:string}).outcome,'recorded');assert.equal(calls,2);
 for(const invalid of [JSON.stringify(identity),source.replace('"confirm_close":true','"confirm_close":1')])await assert.rejects(api.profileOriginals.closeIdentitySource(new TextEncoder().encode(invalid)));
 assert.equal(calls,2);
});
for(const host of [false,true])test('photo '+(host?'host':'multipart')+' closure preserves exact original/hash and confirmation',async()=>{
 const input=structuredClone(photo);if(host)input.original={...input.original,file:{download_url:'https://files.example.test/synthetic.png',file_id:'synthetic-photo',mime_type:'image/png',file_name:'photo.png'}};
 const captured=captureProfilePhotoOriginal(input),hash=await digest(new TextEncoder().encode(JSON.stringify(stableJsonValue(captured.original))));let calls=0;
 const api=client(async(url,init)=>{calls++;assert.ok(String(url).endsWith('/close_profile_photo_original_v1'));assert.deepEqual(JSON.parse(String(init?.body)),{...captured,confirm_close:true});return ready(data(id,'closed',hash));});
 await assert.rejects(profileCommand('profiles close-photo',undefined,{file:'-',confirm:id},api,Readable.from([JSON.stringify(input)])));assert.equal(calls,0);
 const pending=api.profileOriginals.closePhoto(input,true);input.original.source_sha256='c'.repeat(64);await pending;
 assert.equal((await profileCommand('profiles close-photo',undefined,{file:'-',confirm:request.toUpperCase()},api,Readable.from([JSON.stringify(captured)])) as {outcome:string}).outcome,'closed');assert.equal(calls,2);
 await assert.rejects(client(async()=>ready(data(id,'closed','0'.repeat(64)))).profileOriginals.closePhoto(captured,true));
});
test('closure parsing rejects changed request/profile, fabricated creation evidence, and invalid outcomes',async()=>{
 for(const invalid of [{...data(null),request_id:id},data(id),data(null,'recorded'),data(null,'pending'),{...data(null),payload_hash:'invalid'}])assert.throws(()=>profileOriginalClosureResult({outcome:'ready',data:invalid,next_action:{kind:'none',label:''}},identity));
 assert.equal(profileOriginalClosureResult({outcome:'ready',data:data(null,'expired'),next_action:{kind:'none',label:''}},identity).outcome,'expired');
 assert.throws(()=>captureProfilePhotoOriginal({...photo,original:{...photo.original,expected_account_id:'jh_'+id}}));
});
