import type { Readable } from 'node:stream';
import { JobHuntClient, JobHuntError } from '../../client/src/index.ts';
import { templateWriteInput, templateRemoveInput, templateReorderInput } from '../../client/src/stage-template-contracts.ts';
import { inputJSON } from './input.ts';

export async function stageTemplateCommand(command: string, id: string | undefined,
  values: Record<string, unknown>, client: JobHuntClient, stdin: Readable) {
  if (command === 'stage-templates list') {
    const page = values.page === undefined ? 1 : Number(values.page);
    return client.listStageTemplates({ page, ...(values['stage-id'] ? { stage_id: String(values['stage-id']) } : {}),
      ...(values['include-detached'] ? { include_detached: true } : {}) });
  }
  if (command === 'stage-templates get') return client.getStageTemplate(id ?? '');
  const json = await inputJSON(values.file as string | undefined, stdin, 128 * 1024);
  if (command === 'stage-templates update') return client.updateStageTemplate(templateWriteInput(json));
  if (command === 'stage-templates reorder') return client.reorderStageTemplates(templateReorderInput(json));
  const input = templateRemoveInput(json);
  if (values.confirm !== input.template_id) throw new JobHuntError('confirmation_required');
  return client.removeStageTemplate(input);
}
