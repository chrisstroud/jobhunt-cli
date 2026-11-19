/** Exact preparation originals reuse canonical typed preparation inputs and receipt evidence. */
import {prepareApplicationPackageInput,type PrepareApplicationPackage} from './package-contracts.ts';
import {shape,uuid,resourceId,fail,isOperationReceipt,journeyResult} from './journey-contracts.ts';
import {record} from './protocol.ts';
import {isNativeJson,stableJsonValue} from './native-json.ts';
import {digest} from './highlight-file-contracts.ts';
export type PreparationOriginal={expected_account_id:string;original:PrepareApplicationPackage};
export type PreparationClosure={application_id:string;request_id:string;payload_hash:string;outcome:'closed'|'recorded'|'expired';recorded_resource_id:string|null};
export function preparationOriginal(value:unknown):PreparationOriginal{
 shape(value,['expected_account_id','original']);
 if(typeof value.expected_account_id!=='string'||!value.expected_account_id.startsWith('jh_')||!resourceId(value.expected_account_id.slice(3)))fail();
 const captured=structuredClone(value),input=prepareApplicationPackageInput(captured.original);
 if(input.expected_account_id!=null&&input.expected_account_id!==captured.expected_account_id)fail();
 input.request_id=input.request_id.toLowerCase();const result=JSON.parse(JSON.stringify({...captured,original:input}));if(!isNativeJson(result))fail();
 return result;
}
export async function preparePreparationOriginal(value:PreparationOriginal){
 const captured=preparationOriginal(value),bytes=new TextEncoder().encode(JSON.stringify(stableJsonValue(captured.original)));
 if(bytes.length>524288)fail();const payloadHash=await digest(bytes);
 return {captured,payloadHash,read:{expected_account_id:captured.expected_account_id,operation_name:'prepare_application_package',request_id:captured.original.request_id,expected_payload_hash:payloadHash}};
}
export async function preparationReceipt(value:unknown,input:PreparationOriginal){
 await preparePreparationOriginal(input);
 if(!record(value)||!['ready','pending','failed'].includes(String(value.outcome))||!isOperationReceipt(value.data))fail(true);
 const row=value.data;
 if(row.kind!=='prepare_application_package'||row.resource?.kind!=='package'||!uuid(row.resource.id)||!Number.isSafeInteger(row.resource.revision)||Number(row.resource.revision)<1)fail(true);
 const pending=row.status==='pending'||row.status==='running';
 if(pending?(value.outcome!=='pending'||row.retry_after_seconds<1||row.error!=null):row.retry_after_seconds!==0)fail(true);
 if(row.status==='failed'){
  if(value.outcome!=='failed'||!record(value.error)||value.error.code!=='processing_failed'||row.error?.code!=='processing_failed')fail(true);
 }else if(!pending&&(value.outcome!=='ready'||row.error!=null))fail(true);
 if(value.operation!=null&&(!isOperationReceipt(value.operation)||value.operation.id!==row.id||value.operation.resource?.id!==row.resource.id||value.operation.status!==row.status))fail(true);
 if(row.status!=='failed'&&value.error!=null)fail(true);
 journeyResult(value.outcome==='failed'?{...value,outcome:'ready'}:value,isOperationReceipt);
 return row;
}
export async function preparationClosure(value:unknown,input:PreparationOriginal):Promise<PreparationClosure>{
 const {captured,payloadHash}=await preparePreparationOriginal(input);
 const result=journeyResult(value,(row):row is PreparationClosure=>record(row)&&row.application_id===captured.original.application_id
  &&row.request_id===captured.original.request_id&&row.payload_hash===payloadHash&&['closed','recorded','expired'].includes(String(row.outcome))
  &&(row.recorded_resource_id===null||typeof row.recorded_resource_id==='string'&&uuid(row.recorded_resource_id)));
 if(result.outcome!=='ready'||!result.data||result.data.outcome==='recorded'&&!result.data.recorded_resource_id)fail(true);return result.data;
}
