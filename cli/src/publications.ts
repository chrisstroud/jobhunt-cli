import type {Readable} from 'node:stream';
import {JobHuntClient,JobHuntError} from '../../client/src/index.ts';
import {publicationKind,publicationOriginal} from '../../client/src/publications.ts';
import {inputJSON} from './input.ts';
export const publicationOptions:Record<string,string[]>={
 'publications get':['kind','account-id'], 'publications publish':['file','confirm'],
 'publications unpublish':['file','confirm'], 'publications check-original':['file'], 'publications close-original':['file','confirm']};
export const publicationTargets=new Set(['publications get']);
export async function publicationCommand(command:string,target:string|undefined,options:Record<string,string|boolean|undefined>,client:JobHuntClient,stdin:Readable){
 if(command==='publications get')return client.getPublication(publicationKind(options.kind),target!,options['account-id'] as string|undefined);
 const original=publicationOriginal(await inputJSON(options.file as string|undefined,stdin,524288));
 if(command==='publications check-original')return client.checkPublicationOriginal(original);
 if(options.confirm!==original.original.source_id)throw new JobHuntError('confirmation_required');
 if(command==='publications close-original')return client.closePublicationOriginal(original);
 if(command!==`publications ${original.original.action}`)throw new JobHuntError('invalid_input');
 return client.changePublication(original);
}
