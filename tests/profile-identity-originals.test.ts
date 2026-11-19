import assert from 'node:assert/strict';
import {Readable} from 'node:stream';
import test from 'node:test';
import {JobHuntClient,captureProfileIdentityOriginal,type ProfileIdentityOriginal} from '../client/src/index.ts';
import {profileCommand} from '../cli/src/profiles.ts';
const account='jh_11111111-1111-4111-8111-111111111111',id='22222222-2222-4222-8222-222222222222';
const original:ProfileIdentityOriginal={expected_account_id:account,original:{request_id:'33333333-3333-4333-8333-333333333333',expected_account_id:account,profile_id:id,expected_updated_at:null,name:'Synthetic identity',personal_data:{name:'Synthetic owner',retained:{'10':true,'2':false,small:4.5e-7,'𐀀':'a','\ue000':'b'}},is_default:true,acknowledge_linked_updates:true}};
const ready=()=>Response.json({outcome:'ready',data:{id,kind:'save_hunt_profile_v2',status:'succeeded',resource:{id,kind:'profile',label:'Saved profile',revision:null},retry_after_seconds:0,retry_expires_at:'2030-01-01T00:00:00Z'},next_action:{kind:'none',label:''}});
const client=(fetchImpl:typeof fetch)=>new JobHuntClient({credential:{origin:'https://jobhunt.app',token:'synthetic-profile-original'},fetchImpl});
test('identity originals use a private read-only body, retain nested input and never compute a browser hash',async()=>{
 const input=structuredClone(original),captured=structuredClone(input);let calls=0;
 const task=client(async(url,init)=>{calls++;assert.equal(String(url),'https://jobhunt.app/api/v1/journey/check_profile_identity_original_v1');assert.equal(init?.method,'POST');assert.deepEqual(JSON.parse(String(init?.body)),captured);input.original.personal_data={name:'Later unsent'};return ready();}).checkProfileIdentity(input);
 input.original.expected_updated_at='2026-10-25T12:00:00';await task;assert.equal(calls,1);
});
test('SDK and CLI preserve original JSON bytes including legacy float and unsafe-integer spellings',async()=>{
 const envelope=JSON.stringify(original).replace('"small":4.5e-7','"small":4.5e-07,"legacy_float":1.0,"legacy_integer":9007199254740993');
 let calls=0;const api=client(async(url,init)=>{calls++;assert.ok(String(url).endsWith('/check_profile_identity_original_v1'));assert.ok(init?.body instanceof Uint8Array);assert.equal(new TextDecoder().decode(init.body),envelope);return ready();});
 const bytes=new TextEncoder().encode(envelope),pending=api.checkProfileIdentitySource(bytes);bytes.fill(0);await pending;
 await profileCommand('profiles check-identity',undefined,{file:'-'},api,Readable.from([envelope]));assert.equal(calls,2);
});
test('original reads preserve legacy omission/null semantics while refusing foreign or invalid metadata',async()=>{
 const withoutVersion=structuredClone(original);delete withoutVersion.original.expected_updated_at;
 assert.ok(!Object.hasOwn(captureProfileIdentityOriginal(withoutVersion).original,'expected_updated_at'));
 const absentAccount=structuredClone(original);delete absentAccount.original.expected_account_id;assert.ok(!Object.hasOwn(captureProfileIdentityOriginal(absentAccount).original,'expected_account_id'));
 assert.equal(captureProfileIdentityOriginal({...absentAccount,original:{...absentAccount.original,expected_account_id:null}}).original.expected_account_id,null);
 for(const value of [{...original,extra:true},{...original,original:{...original.original,expected_account_id:'jh_'+id}},{...original,original:{...original.original,request_id:'bad'}}])assert.throws(()=>captureProfileIdentityOriginal(value));
 let calls=0;await assert.rejects(client(async()=>{calls++;return ready();}).checkProfileIdentitySource(new TextEncoder().encode('not JSON')));assert.equal(calls,0);
});
test('identity receipt parsing rejects wrong actions, profiles, pending/error and non-profile revisions',async()=>{
 const good=await ready().json();
 for(const change of [{kind:'save_contact_profile_v2'},{status:'pending'},{retry_after_seconds:1},{resource:{...good.data.resource,id:'44444444-4444-4444-8444-444444444444'}},{resource:{...good.data.resource,revision:1}},{error:{code:'processing_failed',message:'Synthetic'}}]){
  await assert.rejects(client(async()=>Response.json({...good,data:{...good.data,...change}})).checkProfileIdentity(original));
 }
});
