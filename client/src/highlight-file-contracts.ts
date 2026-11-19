/** Full native records travel as verified private JSON, not compact field models. */
import {record,JobHuntError,type JsonObject} from './protocol.ts';
import {shape,fail,intent,intentKeys,uuid,integer,journeyResult,type MutationIntent} from './journey-contracts.ts';
import {resumeHostFileInput,type HostResumeFile} from './import-file-contracts.ts';
export const MAX_HIGHLIGHT_FIELDS_BYTES=16*1024*1024;
export type HighlightFileIntent=MutationIntent&{expected_account_id:string;action:'create'|'update';highlight_id?:string;expected_fingerprint?:string};
export type HighlightHostFile=HighlightFileIntent&{source_sha256:string;source_size:number;file:HostResumeFile};
export type HighlightFileManifest={account_id:string;highlight_id:string;fingerprint:string;title:string;date:string;filename:string;mime:'application/json';format:'jobhunt.highlight-record/v1';size_bytes:number;chunk_bytes:24000;chunk_count:number;sha256:string};
export type HighlightFileChunkRead={highlight_id:string;expected_fingerprint:string;expected_sha256:string;chunk_index:number};
export type HighlightFileChunk=HighlightFileManifest&{chunk_index:number;content_base64:string;chunk_sha256:string};
export type HighlightFilePage={account_id:string;items:HighlightFileManifest[];page:number;pages:number;per_page:number;total:number};
export type HighlightFileSaved={highlight_id:string;current:HighlightFileManifest|null};
const hash=(v:unknown):v is string=>typeof v==='string'&&/^[a-f0-9]{64}$/u.test(v);
const account=(v:unknown):v is string=>typeof v==='string'&&v.startsWith('jh_')&&uuid(v.slice(3));
export function highlightFileIntent(value:unknown):HighlightFileIntent{
 shape(value,[...intentKeys,'action','highlight_id','expected_fingerprint']);intent(value);
 if(!account(value.expected_account_id)||!['create','update'].includes(String(value.action)))fail();
 if(value.action==='create'){
  if(value.highlight_id!=null||value.expected_fingerprint!=null)fail();
 }else if(!uuid(value.highlight_id)||!hash(value.expected_fingerprint))fail();
 return value as HighlightFileIntent;
}
export function highlightHostFileInput(value:unknown):HighlightHostFile{
 shape(value,[...intentKeys,'action','highlight_id','expected_fingerprint','source_sha256','source_size','file']);
 const original=Object.fromEntries([...intentKeys,'action','highlight_id','expected_fingerprint'].filter(k=>Object.hasOwn(value,k)).map(k=>[k,value[k]]));
 highlightFileIntent(original);resumeHostFileInput({request_id:value.request_id,expected_account_id:value.expected_account_id,file:value.file});
 if(!hash(value.source_sha256)||!integer(value.source_size,1,MAX_HIGHLIGHT_FIELDS_BYTES))fail();
 return value as HighlightHostFile;
}
export function highlightFileChunkInput(value:unknown):HighlightFileChunkRead{
 shape(value,['highlight_id','expected_fingerprint','expected_sha256','chunk_index']);
 if(!uuid(value.highlight_id)||!hash(value.expected_fingerprint)||!hash(value.expected_sha256)||!integer(value.chunk_index,1,Number.MAX_SAFE_INTEGER))fail();
 return {...value,highlight_id:String(value.highlight_id).toLowerCase()} as HighlightFileChunkRead;
}
export function manifest(value:unknown):value is HighlightFileManifest{
 return record(value)&&account(value.account_id)&&uuid(value.highlight_id)&&hash(value.fingerprint)&&
  typeof value.title==='string'&&[...value.title].length<=500&&typeof value.date==='string'&&/^\d{4}-\d{2}-\d{2}$/u.test(value.date)&&
  value.filename==='highlight-'+value.highlight_id+'.json'&&value.mime==='application/json'&&value.format==='jobhunt.highlight-record/v1'&&
  integer(value.size_bytes,1,Number.MAX_SAFE_INTEGER)&&value.chunk_bytes===24000&&integer(value.chunk_count,1,Number.MAX_SAFE_INTEGER)&&
  value.chunk_count===Math.ceil(Number(value.size_bytes)/24000)&&hash(value.sha256);
}
export const highlightFileManifestResult=(v:unknown)=>journeyResult(v,manifest);
export const highlightFileSavedResult=(v:unknown)=>journeyResult(v,(data):data is HighlightFileSaved=>record(data)&&uuid(data.highlight_id)&&(data.current===null||manifest(data.current)&&data.current.highlight_id===data.highlight_id));
export const highlightFilePageResult=(v:unknown)=>journeyResult(v,(data):data is HighlightFilePage=>record(data)&&account(data.account_id)&&
 Array.isArray(data.items)&&data.items.length<=100&&data.items.every(v=>manifest(v)&&v.account_id===data.account_id)&&
 new Set(data.items.map(v=>v.highlight_id)).size===data.items.length&&integer(data.page,1,10000)&&integer(data.pages,1,Number.MAX_SAFE_INTEGER)&&
 integer(data.total,0,Number.MAX_SAFE_INTEGER)&&integer(data.per_page,1,100)&&data.pages===Math.max(1,Math.ceil(Number(data.total)/Number(data.per_page)))&&
 Number(data.page)<=Number(data.pages)&&data.items.length===Math.min(Number(data.per_page),Math.max(0,Number(data.total)-(Number(data.page)-1)*Number(data.per_page))));
export const highlightFileChunkResult=(v:unknown)=>journeyResult(v,(data):data is HighlightFileChunk=>{
 if(!record(data))return false;
 const extra:Record<string,unknown>=data;
 return manifest(data)&&integer(extra.chunk_index,1,data.chunk_count)&&typeof extra.content_base64==='string'&&extra.content_base64.length>=4&&extra.content_base64.length<=32000&&
 extra.content_base64.length%4===0&&/^[A-Za-z0-9+/]*={0,2}$/u.test(extra.content_base64)&&hash(extra.chunk_sha256);
});
export async function digest(bytes:Uint8Array):Promise<string>{return Array.from(new Uint8Array(await crypto.subtle.digest('SHA-256',new Uint8Array(bytes))),b=>b.toString(16).padStart(2,'0')).join('');}
export function chunkBytes(value:HighlightFileChunk):Uint8Array{
 let encoded:string;try{encoded=atob(value.content_base64);}catch{throw new JobHuntError('invalid_response');}
 const part=Uint8Array.from(encoded!,c=>c.charCodeAt(0));
 if(btoa(encoded!)!==value.content_base64||part.length!==Math.min(24000,value.size_bytes-(value.chunk_index-1)*24000))throw new JobHuntError('invalid_response');
 return part;
}
export function verifiedRecord(bytes:Uint8Array,metadata:HighlightFileManifest):JsonObject{
 let value:unknown;try{value=JSON.parse(new TextDecoder('utf-8',{fatal:true}).decode(bytes));}catch{throw new JobHuntError('invalid_response');}
 if(!record(value)||value.format!==metadata.format||value.account_id!==metadata.account_id||value.fingerprint!==metadata.fingerprint||!record(value.highlight))throw new JobHuntError('invalid_response');
 const row=value.highlight;
 if(row.id!==metadata.highlight_id||row.user_id!==metadata.account_id.slice(3)||row.title!==metadata.title||row.date!==metadata.date||
  !['description','impact_raw','impact_refined','category','role','company_id','company_name','linked_campaign_id','linked_campaign_name','created_at','updated_at'].every(k=>row[k]===null||typeof row[k]==='string')||
  !Array.isArray(row.tags)||!row.tags.every(v=>typeof v==='string'))throw new JobHuntError('invalid_response');
 return value;
}
