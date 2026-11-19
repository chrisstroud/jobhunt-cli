/** Complete intake/review originals. Server checks preserve the Python hash contract. */
import {record} from './protocol.ts';
import {fail,intent,intentKeys,isOperationReceipt,resourceId,shape,uuid,type MutationIntent,type OperationReceipt,type JourneyResult} from './journey-contracts.ts';
import {resumeTextImportInput,confirmResumeImportInput,type ResumeTextImport,type ConfirmResumeImport} from './document-contracts.ts';
import {resumeHostFileInput,importUploadedResumeInput,resumeFileKind,type ResumeHostFileImport,type ImportUploadedResume} from './import-file-contracts.ts';
import {stableJsonValue} from './native-json.ts';
import {digest} from './highlight-file-contracts.ts';

export type ResumeImportCommand=
 {operation_name:'import_resume_text';original:ResumeTextImport}|
 {operation_name:'import_resume_file';original:ResumeHostFileImport}|
 {operation_name:'import_resume_upload';original:ResumeTextImport&{source_sha256:string;source_type:'pdf_import'|'docx_import'}}|
 {operation_name:'import_uploaded_resume';original:ImportUploadedResume}|
 {operation_name:'confirm_resume_import';original:ConfirmResumeImport};
export type ResumeImportOriginal={expected_account_id:string;command:ResumeImportCommand};
export type ResumeImportFileOriginal=MutationIntent&{expected_account_id:string;original_account_unbound?:true};
export type ResumeImportClosure={operation_name:ResumeImportCommand['operation_name'];request_id:string;
 payload_hash:string;outcome:'closed'|'recorded'|'expired';recorded_resource_id:string|null};
const hash=(v:unknown):v is string=>typeof v==='string'&&/^[a-f0-9]{64}$/u.test(v);
export function resumeImportOriginal(value:unknown):ResumeImportOriginal{
 shape(value,['expected_account_id','command']);shape(value.command,['operation_name','original']);
 const c=value.command;
 if(typeof value.expected_account_id!=='string'||!value.expected_account_id.startsWith('jh_')||!uuid(value.expected_account_id.slice(3)))fail();
 if(c.operation_name==='import_resume_text')resumeTextImportInput(c.original);
 else if(c.operation_name==='import_resume_file')resumeHostFileInput(c.original);
 else if(c.operation_name==='import_uploaded_resume')importUploadedResumeInput(c.original);
 else if(c.operation_name==='confirm_resume_import')confirmResumeImportInput(c.original);
 else if(c.operation_name==='import_resume_upload'){
  shape(c.original,[...intentKeys,'text','source_sha256','source_type']);
  const {source_sha256,source_type,...text}=c.original;
  resumeTextImportInput(text);
  if(!hash(source_sha256)||!['pdf_import','docx_import'].includes(String(source_type)))fail();
 }else fail();
 if(!record(c.original)||c.original.expected_account_id!=null&&c.original.expected_account_id!==value.expected_account_id)fail();
 const bytes=new TextEncoder().encode(JSON.stringify(stableJsonValue(c.original)));
 if(bytes.length>524288)fail();
 const captured=JSON.parse(JSON.stringify(value)) as ResumeImportOriginal;
 captured.command.original.request_id=captured.command.original.request_id.toLowerCase();
 return captured;
}
export async function resumeImportOriginalHash(value:ResumeImportOriginal){
 const captured=resumeImportOriginal(value);
 return digest(new TextEncoder().encode(JSON.stringify(stableJsonValue(captured.command.original))));
}
export function resumeImportReceipt(value:unknown,operation:ResumeImportCommand['operation_name']):JourneyResult<OperationReceipt>{
 if(!record(value)||!isOperationReceipt(value.data)||value.data.kind!==operation||value.data.resource?.kind!=='document'
  ||!resourceId(value.data.resource.id)||!record(value.next_action)||typeof value.next_action.kind!=='string'||typeof value.next_action.label!=='string'
  ||!['ready','pending','failed'].includes(String(value.outcome))||!isOperationReceipt(value.operation)
  ||JSON.stringify(stableJsonValue(value.operation))!==JSON.stringify(stableJsonValue(value.data)))fail(true);
 if(value.outcome!==(value.data.status==='failed'?'failed':['pending','running'].includes(value.data.status)?'pending':'ready'))fail(true);
 return value as unknown as JourneyResult<OperationReceipt>;
}
export async function resumeImportClosure(value:unknown,operation:ResumeImportCommand['operation_name'],requestId:string,expectedHash?:string):Promise<ResumeImportClosure>{
 if(!record(value)||value.outcome!=='ready'||!record(value.data))fail(true);
 const d=value.data;
 if(Object.keys(d).sort().join()!=='operation_name,outcome,payload_hash,recorded_resource_id,request_id'
  ||d.operation_name!==operation||d.request_id!==requestId||!hash(d.payload_hash)||expectedHash!==undefined&&d.payload_hash!==expectedHash
  ||!['closed','recorded','expired'].includes(String(d.outcome))||d.recorded_resource_id!==null&&!resourceId(d.recorded_resource_id)
  ||d.outcome==='recorded'&&d.recorded_resource_id===null||d.outcome==='closed'&&d.recorded_resource_id!==null)fail(true);
 return d as ResumeImportClosure;
}
type Request=(path:string,options:{method:'POST';body:Record<string,unknown>|FormData})=>Promise<unknown>;
export class ResumeImportOriginalClient{
 private request:Request;
 constructor(request:Request){this.request=request;}
 async check(input:ResumeImportOriginal){
  const captured=resumeImportOriginal(input);
  return resumeImportReceipt(await this.request('/api/v1/journey/check_resume_import_original_v1',{method:'POST',body:captured}),captured.command.operation_name);
 }
 async close(input:ResumeImportOriginal){
  const captured=resumeImportOriginal(input),expectedHash=await resumeImportOriginalHash(captured);
  return resumeImportClosure(await this.request('/api/v1/journey/close_resume_import_original_v1',{method:'POST',body:{...captured,confirm_close:true}}),
   captured.command.operation_name,captured.command.original.request_id,expectedHash);
 }
 async file(input:ResumeImportFileOriginal,source:Uint8Array,closing?:false):Promise<JourneyResult<OperationReceipt>>;
 async file(input:ResumeImportFileOriginal,source:Uint8Array,closing:true):Promise<ResumeImportClosure>;
 async file(input:ResumeImportFileOriginal,source:Uint8Array,closing=false){
  shape(input,[...intentKeys,'original_account_unbound']);intent(input);
  if(input.expected_account_id==null)fail();
  if(input.original_account_unbound!==undefined&&input.original_account_unbound!==true)fail();
  const captured={...input,request_id:input.request_id.toLowerCase()},bytes=new Uint8Array(source),kind=resumeFileKind(bytes),form=new FormData();
  form.set('request_id',captured.request_id);form.set('expected_account_id',captured.expected_account_id!);
  if(captured.original_account_unbound)form.set('original_account_unbound','true');
  form.set('file',new Blob([bytes]),'resume.'+kind);
  if(closing)form.set('confirm_close','true');
  const value=await this.request('/api/v1/journey/resume-upload-original/'+(closing?'close':'check'),{method:'POST',body:form});
  return closing?resumeImportClosure(value,'import_resume_upload',captured.request_id):resumeImportReceipt(value,'import_resume_upload');
 }
}
