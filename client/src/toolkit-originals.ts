/** Complete toolkit originals bind existing typed inputs to exact receipt reads. */
import {selectApplicationDocumentsInput,customizeApplicationDocumentsInput,createCoverLetterInput,
 type SelectApplicationDocuments,type CustomizeApplicationDocuments,type CreateCoverLetter} from './package-contracts.ts';
import {shape,uuid,fail,operationResult,journeyResult,resourceId,type OperationReceipt} from './journey-contracts.ts';
import {record} from './protocol.ts';
import {isNativeJson,stableJsonValue} from './native-json.ts';
import {digest} from './highlight-file-contracts.ts';
export type ToolkitOriginal={expected_account_id:string}&(
 {operation_name:'select_application_documents_v2';original:SelectApplicationDocuments}|
 {operation_name:'customize_application_documents_v2';original:CustomizeApplicationDocuments}|
 {operation_name:'create_cover_letter_document_v2';original:CreateCoverLetter});
export type ToolkitClosure={operation_name:ToolkitOriginal['operation_name'];request_id:string;payload_hash:string;
 outcome:'closed'|'recorded'|'expired';recorded_resource_id:string|null};
export function toolkitOriginal(value:unknown):ToolkitOriginal {
 shape(value,['expected_account_id','operation_name','original']);
 if(typeof value.expected_account_id!=='string'||!value.expected_account_id.startsWith('jh_')||!uuid(value.expected_account_id.slice(3)))fail();
 const captured=structuredClone(value);
 const input=captured.operation_name==='select_application_documents_v2'?selectApplicationDocumentsInput(captured.original)
  :captured.operation_name==='customize_application_documents_v2'?customizeApplicationDocumentsInput(captured.original)
  :captured.operation_name==='create_cover_letter_document_v2'?createCoverLetterInput(captured.original):fail();
 if(input.expected_account_id!=null&&input.expected_account_id!==captured.expected_account_id)fail();
 // Request UUID spelling is normalized by the established Python model.
 input.request_id=input.request_id.toLowerCase();
 const result=JSON.parse(JSON.stringify({...captured,original:input}));if(!isNativeJson(result))fail();
 return result as ToolkitOriginal;
}
export async function prepareToolkitOriginal(value:ToolkitOriginal){
 const captured=toolkitOriginal(value),bytes=new TextEncoder().encode(JSON.stringify(stableJsonValue(captured.original)));
 if(bytes.length>524288)fail();
 const payloadHash=await digest(bytes);
 return {captured,payloadHash,read:{expected_account_id:captured.expected_account_id,operation_name:captured.operation_name,
  request_id:captured.original.request_id,expected_payload_hash:payloadHash}};
}
export async function toolkitReceipt(value:unknown,input:ToolkitOriginal):Promise<OperationReceipt>{
 const {captured}=await prepareToolkitOriginal(input),result=operationResult(value),operation=result.data;
 if(result.outcome!=='ready'||!operation||operation.kind!==captured.operation_name||operation.status!=='succeeded'
  ||operation.error!=null||operation.retry_after_seconds!==0||operation.resource?.kind!=='package'
  ||!uuid(operation.resource.id)||!Number.isSafeInteger(operation.resource.revision)||Number(operation.resource.revision)<1)fail(true);
 if(captured.operation_name==='customize_application_documents_v2'&&(!Array.isArray(operation.related_ids)
  ||operation.related_ids.length!==1||!operation.related_ids.every(resourceId)))fail(true);
 return operation;
}
export async function toolkitClosure(value:unknown,input:ToolkitOriginal):Promise<ToolkitClosure>{
 const {captured,payloadHash}=await prepareToolkitOriginal(input);
 const result=journeyResult(value,(row):row is ToolkitClosure=>record(row)&&row.operation_name===captured.operation_name
  &&row.request_id===captured.original.request_id&&row.payload_hash===payloadHash
  &&['closed','recorded','expired'].includes(String(row.outcome))&&(row.recorded_resource_id===null||uuid(row.recorded_resource_id)));
 if(result.outcome!=='ready'||!result.data||(result.data.outcome==='recorded'&&!result.data.recorded_resource_id))fail(true);
 return result.data;
}
