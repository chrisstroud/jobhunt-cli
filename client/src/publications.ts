/** Targeted saved-document/application publication, separate from live Hunt Pages. */
import {record} from './protocol.ts';
import {fail,integer,intent,intentKeys,isOperationReceipt,journeyResult,shape,uuid,type JourneyResult} from './journey-contracts.ts';
import {isNativeJson,stableJsonValue} from './native-json.ts';
import {digest} from './highlight-file-contracts.ts';

export type PublicationKind='document'|'application';
type Base={request_id:string;expected_account_id:string;source_id:string;expected_revision:number;expected_fingerprint:string};
export type PublicationPublish=Base&{action:'publish';privacy_tier:'unlisted'|'public'|'password';target:string;
 password?:string|null;handle?:string|null;document_slug?:string|null;confirm_publication:true};
export type PublicationUnpublish=Base&{action:'unpublish';confirm_unpublish:true};
export type PublicationOriginal={expected_account_id:string;source_type:PublicationKind;original:PublicationPublish|PublicationUnpublish};
export type PublicationState={source_id:string;source_type:PublicationKind;revision:number;fingerprint:string;published:boolean;
 published_slug:string|null;published_at:string|null;privacy_tier:'unlisted'|'public'|'password';public_path:string|null;
 handle:string|null;document_slug:string|null;has_unpublished_changes:boolean;target:string;allowed_targets:string[];can_publish:boolean};
export type PublicationAccepted={source_id:string;source_type:PublicationKind;action:'publish'|'unpublish';accepted_revision:number};
export type PublicationClosure={source_id:string;source_type:PublicationKind;request_id:string;payload_hash:string;
 outcome:'closed'|'recorded'|'expired';recorded_resource_id:string|null};
const hash=(v:unknown)=>typeof v==='string'&&/^[a-f0-9]{64}$/u.test(v);
const chars=(v:unknown,min:number,max:number):v is string=>typeof v==='string'&&[...v].length>=min&&[...v].length<=max;
const nullable=(v:unknown,max:number)=>v===null||chars(v,0,max);
export function publicationKind(v:unknown):PublicationKind{if(v!=='document'&&v!=='application')fail();return v;}
export function publicationOperation(kind:PublicationKind,action:'publish'|'unpublish'){
 publicationKind(kind);if(action!=='publish'&&action!=='unpublish')fail();return action+'_'+kind+'_v1';
}
export function publicationInput(v:unknown):PublicationPublish|PublicationUnpublish{
 if(!record(v))fail();
 const common=[...intentKeys,'source_id','expected_revision','expected_fingerprint','action'];
 if(v.action==='publish')shape(v,[...common,'privacy_tier','target','password','handle','document_slug','confirm_publication']);
 else if(v.action==='unpublish')shape(v,[...common,'confirm_unpublish']);else fail();
 intent(v);
 if(typeof v.expected_account_id!=='string'||!v.expected_account_id.startsWith('jh_')||!uuid(v.expected_account_id.slice(3))
  ||!uuid(v.source_id)||!integer(v.expected_revision)||!hash(v.expected_fingerprint))fail();
 if(v.action==='publish'){
  if(!['unlisted','public','password'].includes(String(v.privacy_tier))||!chars(v.target,1,80)||v.confirm_publication!==true)fail();
  if(v.password!=null&&!chars(v.password,8,256)||v.privacy_tier==='password'&&v.password==null||v.privacy_tier!=='password'&&v.password!=null)fail();
  if(v.handle!=null&&!chars(v.handle,3,48)||v.document_slug!=null&&!chars(v.document_slug,3,80))fail();
 }else if(v.confirm_unpublish!==true)fail();
 const result=JSON.parse(JSON.stringify({...v,request_id:String(v.request_id).toLowerCase(),source_id:String(v.source_id).toLowerCase()}));
 if(!isNativeJson(result))fail();return result;
}
export function publicationOriginal(v:unknown):PublicationOriginal{
 shape(v,['expected_account_id','source_type','original']);const kind=publicationKind(v.source_type),original=publicationInput(v.original);
 if(v.expected_account_id!==original.expected_account_id)fail();
 return {expected_account_id:original.expected_account_id,source_type:kind,original};
}
export async function preparePublicationOriginal(v:PublicationOriginal){
 const captured=publicationOriginal(v),bytes=new TextEncoder().encode(JSON.stringify(stableJsonValue(captured.original)));
 if(bytes.length>524288)fail();const payloadHash=await digest(bytes);
 return {captured,payloadHash,read:{expected_account_id:captured.expected_account_id,
  operation_name:publicationOperation(captured.source_type,captured.original.action),request_id:captured.original.request_id,expected_payload_hash:payloadHash}};
}
export function isPublicationState(v:unknown):v is PublicationState{
 return record(v)&&Object.keys(v).every(k=>['source_id','source_type','revision','fingerprint','published','published_slug','published_at','privacy_tier',
  'public_path','handle','document_slug','has_unpublished_changes','target','allowed_targets','can_publish'].includes(k))&&
  uuid(v.source_id)&&['document','application'].includes(String(v.source_type))&&integer(v.revision)&&hash(v.fingerprint)&&typeof v.published==='boolean'&&
  nullable(v.published_slug,255)&&nullable(v.published_at,64)&&['unlisted','public','password'].includes(String(v.privacy_tier))&&nullable(v.public_path,2048)&&
  nullable(v.handle,48)&&nullable(v.document_slug,80)&&typeof v.has_unpublished_changes==='boolean'&&chars(v.target,0,80)&&
  Array.isArray(v.allowed_targets)&&v.allowed_targets.length<=3&&v.allowed_targets.every(t=>chars(t,0,80))&&typeof v.can_publish==='boolean';
}
export function publicationStateResult(v:unknown,kind:PublicationKind,sourceId:string){
 const result=journeyResult(v,isPublicationState);
 if(result.outcome!=='ready'||result.data?.source_type!==kind||result.data.source_id!==sourceId.toLowerCase())fail(true);return result;
}
export function publicationAccepted(v:unknown,input:PublicationOriginal):JourneyResult<PublicationAccepted>{
 const {source_type:kind,original}=publicationOriginal(input),resource=kind==='document'?'document':'package';
 const result=journeyResult(v,(data):data is PublicationAccepted=>record(data)&&Object.keys(data).length===4&&
  data.source_id===original.source_id&&data.source_type===kind&&data.action===original.action&&integer(data.accepted_revision));
 if(result.outcome!=='ready'||!result.data||!isOperationReceipt(result.operation)||result.operation.kind!==publicationOperation(kind,original.action)
  ||result.operation.status!=='succeeded'||result.operation.retry_after_seconds!==0||result.operation.error!=null||result.operation.resource?.kind!==resource||result.operation.resource.id!==original.source_id
  ||result.operation.resource.revision!==result.data.accepted_revision)fail(true);return result;
}
export async function publicationReceipt(v:unknown,input:PublicationOriginal){
 const {captured}=await preparePublicationOriginal(input),result=journeyResult(v,isOperationReceipt),row=result.data;
 if(result.outcome!=='ready'||!row||row.kind!==publicationOperation(captured.source_type,captured.original.action)||row.status!=='succeeded'||row.retry_after_seconds!==0||row.error!=null
  ||row.resource?.kind!==(captured.source_type==='document'?'document':'package')||row.resource.id!==captured.original.source_id
  ||!integer(row.resource.revision))fail(true);
 if(result.operation!=null&&JSON.stringify(stableJsonValue(result.operation))!==JSON.stringify(stableJsonValue(row)))fail(true);
 return row;
}
export async function publicationClosure(v:unknown,input:PublicationOriginal):Promise<PublicationClosure>{
 const {captured,payloadHash}=await preparePublicationOriginal(input);
 const result=journeyResult(v,(data):data is PublicationClosure=>record(data)&&Object.keys(data).length===6&&data.source_id===captured.original.source_id
  &&data.source_type===captured.source_type&&data.request_id===captured.original.request_id&&data.payload_hash===payloadHash
  &&['closed','recorded','expired'].includes(String(data.outcome))&&(data.recorded_resource_id===null||data.recorded_resource_id===captured.original.source_id));
 if(result.outcome!=='ready'||!result.data||result.data.outcome==='recorded'&&!result.data.recorded_resource_id)fail(true);return result.data;
}
