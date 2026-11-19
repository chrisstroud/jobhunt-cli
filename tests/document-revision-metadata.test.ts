import assert from 'node:assert/strict';
import test from 'node:test';
import { Readable } from 'node:stream';
import { JobHuntClient } from '../client/src/index.ts';
import { documentRevisionReadInput, documentRevisionsResult } from '../client/src/document-contracts.ts';
import { documentCommand } from '../cli/src/documents.ts';
const account='jh_11111111-1111-4111-8111-111111111111',document='abcdefab-2222-4222-8222-222222222222';
const page=()=>({outcome:'ready',data:{items:[{id:'saved-1',kind:'document',label:'Saved revision',revision:null}],has_more:false,next_before_id:null,
 details:{account_id:account,document_id:document,total:1,items:[{id:'saved-1',name:null,trigger:'manual_save',created_at:'2026-10-01T00:00:00Z'}]}},next_action:{kind:'select',label:'Select'}});
test('SDK and CLI use the existing cursor operation with opt-in metadata',async()=>{
 const calls:Record<string,unknown>[]=[];
 const client=new JobHuntClient({credential:{origin:'https://jobhunt.app',token:'synthetic-token'},fetchImpl:async url=>{
  assert.equal(new URL(String(url)).pathname,'/api/v1/journey/list_document_revisions');
  const args=JSON.parse(new URL(String(url)).searchParams.get('arguments')!);calls.push(args);
  const value=page();if(!args.include_metadata)delete (value.data as {details?:unknown}).details;return Response.json(value);
 }});
 const rich=await client.documentRevisions({document_id:document,expected_account_id:account,include_metadata:true});
 assert.equal(rich.data?.details?.items[0].name,null);
 await documentCommand('documents revisions',document,{'include-metadata':true,'before-id':'newest'},client,Readable.from([]));
 await documentCommand('documents revisions',document,{},client,Readable.from([]));
 assert.deepEqual(calls,[{document_id:document,expected_account_id:account,include_metadata:true},{document_id:document,before_id:'newest',include_metadata:true},{document_id:document}]);
});
test('metadata responses must bind owner, source, ordered IDs, dates and progressing cursor',()=>{
 const input={document_id:document,expected_account_id:account,include_metadata:true};
 for(const change of ['owner','source','ids','date','cursor','absent','total']){
  const value=page();
  if(change==='owner')value.data.details.account_id='jh_other';
  if(change==='source')value.data.details.document_id='other';
  if(change==='ids')value.data.details.items[0].id='different';
  if(change==='date')value.data.details.items[0].created_at='not-a-date';
  if(change==='cursor'){value.data.has_more=true;value.data.next_before_id='same' as never;}
  if(change==='absent')delete (value.data as {details?:unknown}).details;
  if(change==='total')value.data.details.total=0;
  assert.throws(()=>documentRevisionsResult(value,input),/invalid_response/u);
 }
 for(const flag of [null,'true',1,{},[]])assert.throws(()=>documentRevisionReadInput({document_id:document,include_metadata:flag}));
});
test('an in-flight caller cannot replace the requested metadata account',async()=>{
 let release!:()=>void;const gate=new Promise<void>(resolve=>{release=resolve;});
 const input={document_id:document,expected_account_id:account,include_metadata:true};
 const client=new JobHuntClient({credential:{origin:'https://jobhunt.app',token:'synthetic-token'},fetchImpl:async()=>{await gate;return Response.json(page());}});
 const pending=client.documentRevisions(input);input.expected_account_id='jh_other';input.include_metadata=false;release();
 assert.equal((await pending).data?.details?.account_id,account);
});

test('metadata binds canonical UUID identity while preserving valid caller spelling',()=>{
 const input={document_id:document.toUpperCase(),include_metadata:true,expected_account_id:account};
 assert.equal(documentRevisionReadInput(input).document_id,document.toUpperCase());
 assert.equal(documentRevisionsResult(page(),input).data?.details?.document_id,document);
});
