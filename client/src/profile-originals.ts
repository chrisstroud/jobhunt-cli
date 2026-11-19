/** Exact profile retry closure; canonical identity JSON stays server-authoritative. */
import type {JobHuntClient} from './index.ts';
import {record} from './protocol.ts';
import {fail,journeyResult,shape,uuid} from './journey-contracts.ts';
import {captureProfileIdentityOriginal,captureProfileIdentitySource,type ProfileIdentityOriginal} from './profile-contracts.ts';
import {profileHostFileInput,profilePhotoFileOriginal,type ProfilePhotoHostFile,type ProfilePhotoFileOriginal} from './profile-file-contracts.ts';
import {digest} from './highlight-file-contracts.ts';
import {stableJsonValue} from './native-json.ts';
export type ProfilePhotoOriginal={expected_account_id:string;original:ProfilePhotoFileOriginal|ProfilePhotoHostFile};
export type ProfileOriginalClosure={request_id:string;profile_id:string|null;payload_hash:string;outcome:'closed'|'recorded'|'expired'};
export function captureProfilePhotoOriginal(value:unknown):ProfilePhotoOriginal {
 shape(value,['expected_account_id','original']);
 if(typeof value.expected_account_id!=='string'||!value.expected_account_id.startsWith('jh_')||!uuid(value.expected_account_id.slice(3))||!record(value.original))fail();
 const original=Object.hasOwn(value.original,'file')?structuredClone(profileHostFileInput(value.original)):profilePhotoFileOriginal(value.original);
 original.request_id=original.request_id.toLowerCase();original.profile_id=original.profile_id.toLowerCase();
 if(original.expected_account_id!=null&&original.expected_account_id!==value.expected_account_id)fail();
 return {expected_account_id:value.expected_account_id,original};
}
/** The closure source includes explicit confirm_close=true without re-encoding JSON. */
export function captureProfileIdentityClosureSource(bytes:Uint8Array) {
 if(!(bytes instanceof Uint8Array)||!bytes.length||bytes.length>524288)fail();
 const source=new Uint8Array(bytes);
 let value:unknown;try{value=JSON.parse(new TextDecoder('utf-8',{fatal:true}).decode(source));}catch{fail();}
 shape(value,['expected_account_id','original','confirm_close']);if(value.confirm_close!==true)fail();
 const {captured}=captureProfileIdentitySource(new TextEncoder().encode(JSON.stringify({expected_account_id:value.expected_account_id,original:{...(record(value.original)?value.original:{}),personal_data:{}}})));
 if(!record(value.original)||!record(value.original.personal_data))fail();
 captured.original.personal_data=value.original.personal_data;
 return {source,captured};
}
export function profileOriginalClosureResult(value:unknown,input:ProfileIdentityOriginal|ProfilePhotoOriginal,expectedHash?:string):ProfileOriginalClosure {
 const profile=input.original.profile_id,request=input.original.request_id.toLowerCase();
 const result=journeyResult(value,(row):row is ProfileOriginalClosure=>record(row)&&row.request_id===request
  &&typeof row.payload_hash==='string'&&/^[a-f0-9]{64}$/u.test(row.payload_hash)&&(expectedHash===undefined||row.payload_hash===expectedHash)
  &&['closed','recorded','expired'].includes(String(row.outcome))
  &&(profile!=null?typeof row.profile_id==='string'&&row.profile_id.toLowerCase()===profile.toLowerCase()
   :row.outcome==='closed'?row.profile_id===null:row.profile_id===null||uuid(row.profile_id))
  &&(row.outcome!=='recorded'||uuid(row.profile_id)));
 if(result.outcome!=='ready'||!result.data)fail(true);return result.data;
}
export class ProfileOriginalClient {
 private readonly client:Pick<JobHuntClient,'request'>;
 constructor(client:Pick<JobHuntClient,'request'>){this.client=client;}
 async closeIdentity(input:ProfileIdentityOriginal,confirm:true) {
  if(confirm!==true)fail();const captured=captureProfileIdentityOriginal(input);
  return profileOriginalClosureResult(await this.client.request('/api/v1/journey/close_profile_identity_original_v1',
   {method:'POST',body:{...captured,confirm_close:true}}),captured);
 }
 async closeIdentitySource(bytes:Uint8Array) {
  const {source,captured}=captureProfileIdentityClosureSource(bytes);
  return profileOriginalClosureResult(await this.client.request('/api/v1/journey/close_profile_identity_original_v1',
   {method:'POST',jsonSource:source}),captured);
 }
 async closePhoto(input:ProfilePhotoOriginal,confirm:true) {
  if(confirm!==true)fail();const captured=captureProfilePhotoOriginal(input);
  const hash=await digest(new TextEncoder().encode(JSON.stringify(stableJsonValue(captured.original))));
  return profileOriginalClosureResult(await this.client.request('/api/v1/journey/close_profile_photo_original_v1',
   {method:'POST',body:{...captured,confirm_close:true}}),captured,hash);
 }
}
