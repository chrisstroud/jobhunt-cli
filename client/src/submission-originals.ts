/** Exact submission originals reuse canonical typed report inputs and receipt evidence. */
import {recordSubmissionInput,type RecordSubmission} from './submission-contracts.ts';
import {shape,uuid,resourceId,fail,operationResult,journeyResult} from './journey-contracts.ts';
import {record} from './protocol.ts';
import {isNativeJson,stableJsonValue} from './native-json.ts';
import {digest} from './highlight-file-contracts.ts';
export type SubmissionOriginal={expected_account_id:string;original:RecordSubmission};
export type SubmissionClosure={application_id:string;request_id:string;payload_hash:string;outcome:'closed'|'recorded'|'expired';recorded_resource_id:string|null};
export function submissionOriginal(value:unknown):SubmissionOriginal{
 shape(value,['expected_account_id','original']);
 if(typeof value.expected_account_id!=='string'||!value.expected_account_id.startsWith('jh_')||!resourceId(value.expected_account_id.slice(3)))fail();
 const captured=structuredClone(value),input=recordSubmissionInput(captured.original);
 if(input.expected_account_id!=null&&input.expected_account_id!==captured.expected_account_id)fail();
 input.request_id=input.request_id.toLowerCase();const result=JSON.parse(JSON.stringify({...captured,original:input}));if(!isNativeJson(result))fail();
 return result;
}
export async function prepareSubmissionOriginal(value:SubmissionOriginal){
 const captured=submissionOriginal(value),bytes=new TextEncoder().encode(JSON.stringify(stableJsonValue(captured.original)));
 if(bytes.length>524288)fail();const payloadHash=await digest(bytes);
 return {captured,payloadHash,read:{expected_account_id:captured.expected_account_id,operation_name:'record_submission',request_id:captured.original.request_id,expected_payload_hash:payloadHash}};
}
export async function submissionReceipt(value:unknown,input:SubmissionOriginal){
 const {captured}=await prepareSubmissionOriginal(input),result=operationResult(value),row=result.data;
 if(result.outcome!=='ready'||!row||row.kind!=='record_submission'||row.status!=='succeeded'||row.error!=null||row.retry_after_seconds!==0
  ||row.resource?.kind!=='application'||row.resource.id.toLowerCase()!==captured.original.application_id.toLowerCase()||!Number.isSafeInteger(row.resource.revision)||Number(row.resource.revision)<1||row.related_ids?.length!==1||!uuid(row.related_ids[0]))fail(true);
 return row;
}
export async function submissionClosure(value:unknown,input:SubmissionOriginal):Promise<SubmissionClosure>{
 const {captured,payloadHash}=await prepareSubmissionOriginal(input);
 const result=journeyResult(value,(row):row is SubmissionClosure=>record(row)&&row.application_id===captured.original.application_id
  &&row.request_id===captured.original.request_id&&row.payload_hash===payloadHash&&['closed','recorded','expired'].includes(String(row.outcome))
  &&(row.recorded_resource_id===null||typeof row.recorded_resource_id==='string'&&uuid(row.recorded_resource_id)&&row.recorded_resource_id.toLowerCase()===captured.original.application_id.toLowerCase()));
 if(result.outcome!=='ready'||!result.data||result.data.outcome==='recorded'&&!result.data.recorded_resource_id)fail(true);return result.data;
}
