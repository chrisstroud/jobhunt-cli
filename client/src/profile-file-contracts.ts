/** Full native photo files remain distinct from the retained compact PNG contract. */
import {record} from './protocol.ts';
import {shape,fail,intentKeys,uuid,integer,operationResult,type MutationIntent} from './journey-contracts.ts';
import {profilePhotoInput,type ProfilePhotoWrite} from './profile-contracts.ts';
import {digest} from './highlight-file-contracts.ts';
import {stableJsonValue} from './native-json.ts';
import {resumeHostFileInput,type HostResumeFile} from './import-file-contracts.ts';
export const MAX_PROFILE_FILE_BYTES=5*1024*1024;
export type ProfilePhotoHostFile=ProfilePhotoWrite&{source_sha256:string;source_size:number;media_type:'image/png'|'image/jpeg';file:HostResumeFile};
export function profileFileKind(bytes:Uint8Array):'image/png'|'image/jpeg'{
 if(!(bytes instanceof Uint8Array)||!bytes.length||bytes.length>MAX_PROFILE_FILE_BYTES)fail();
 if([137,80,78,71,13,10,26,10].every((b,i)=>bytes[i]===b))return 'image/png';
 if(bytes[0]===255&&bytes[1]===216&&bytes[2]===255)return 'image/jpeg';
 fail();
}
export function profileHostFileInput(value:unknown):ProfilePhotoHostFile{
 shape(value,[...intentKeys,'profile_id','expected_updated_at','acknowledge_linked_updates','source_sha256','source_size','media_type','file']);
 const shared=Object.fromEntries(intentKeys.filter(key=>Object.hasOwn(value,key)).map(key=>[key,value[key]])) as MutationIntent;
 profilePhotoInput({...shared,profile_id:value.profile_id,expected_updated_at:value.expected_updated_at,acknowledge_linked_updates:value.acknowledge_linked_updates});
 resumeHostFileInput({...shared,file:value.file});
 if(!record(value)||typeof value.source_sha256!=='string'||!/^[a-f0-9]{64}$/u.test(value.source_sha256)||
  !Number.isInteger(value.source_size)||Number(value.source_size)<1||Number(value.source_size)>MAX_PROFILE_FILE_BYTES||
  !['image/png','image/jpeg'].includes(String(value.media_type)))fail();
 return value as ProfilePhotoHostFile;
}

/** The multipart route hashes this exact scalar payload after validating bytes. */
export type ProfilePhotoFileOriginal=ProfilePhotoWrite&{source_sha256:string;source_size:number;media_type:'image/png'|'image/jpeg'};
export function profilePhotoFileOriginal(value:unknown):ProfilePhotoFileOriginal {
 shape(value,[...intentKeys,'profile_id','expected_updated_at','acknowledge_linked_updates','source_sha256','source_size','media_type']);
 const raw=Object.fromEntries([...intentKeys,'profile_id','expected_updated_at','acknowledge_linked_updates'].filter(key=>Object.hasOwn(value,key)).map(key=>[key,value[key]]));
 const intent=structuredClone(profilePhotoInput(raw));
 if(typeof value.source_sha256!=='string'||!/^[a-f0-9]{64}$/u.test(value.source_sha256)||!integer(value.source_size,1,MAX_PROFILE_FILE_BYTES)||!['image/png','image/jpeg'].includes(String(value.media_type)))fail();
 return {...intent,request_id:intent.request_id.toLowerCase(),profile_id:intent.profile_id.toLowerCase(),source_sha256:value.source_sha256,source_size:Number(value.source_size),media_type:value.media_type as 'image/png'|'image/jpeg'};
}
export async function prepareProfilePhotoOriginal(value:ProfilePhotoFileOriginal) {
 const original=profilePhotoFileOriginal(value),payloadHash=await digest(new TextEncoder().encode(JSON.stringify(stableJsonValue(original))));
 return {original,payloadHash,read:{operation_name:'upload_profile_photo_file',request_id:original.request_id,
  ...(original.expected_account_id!==undefined?{expected_account_id:original.expected_account_id}:{}),expected_payload_hash:payloadHash}};
}
export async function prepareProfilePhotoFile(input:ProfilePhotoWrite,bytes:Uint8Array) {
 const intent=structuredClone(profilePhotoInput(input));if(!(bytes instanceof Uint8Array))fail();
 const source=new Uint8Array(bytes),media_type=profileFileKind(source);
 return prepareProfilePhotoOriginal({...intent,source_sha256:await digest(source),source_size:source.length,media_type});
}
export function profilePhotoFileReceipt(value:unknown,original:ProfilePhotoFileOriginal) {
 const result=operationResult(value),operation=result.data;
 if(result.outcome!=='ready'||result.error!=null||!operation||operation.kind!=='upload_profile_photo_file'||operation.status!=='succeeded'
  ||operation.error!=null||operation.retry_after_seconds!==0||operation.resource?.kind!=='profile'||operation.resource.id.toLowerCase()!==original.profile_id.toLowerCase()
  ||operation.resource.revision!==null||!Array.isArray(operation.related_ids)||operation.related_ids.length!==1||!uuid(operation.related_ids[0]))fail(true);
 return {operationId:operation.id,profileId:operation.resource.id,photoId:operation.related_ids[0]};
}
