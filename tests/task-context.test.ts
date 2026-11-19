import assert from 'node:assert/strict';
import test from 'node:test';
import { taskReadInput, taskHistoryInput, taskUpdateInput, taskDeleteInput, taskCompletionInput, taskSkipInput, taskScheduleInput } from '../client/src/task-contracts.ts';

const id = '11111111-1111-4111-8111-111111111111';
const intent = {task_id: id, request_id: id, expected_revision: 1};
const dated = {...intent, expected_fingerprint: 'a'.repeat(64), occurrence_date: '2026-10-19'};
test('all task adapters preserve omitted, explicit null and UUID application bindings', () => {
  const cases: [((value: unknown) => unknown), object][] = [
    [taskReadInput, {task_id: id}], [taskHistoryInput, {task_id: id}],
    [taskUpdateInput, {...intent, title: 'Synthetic'}], [taskDeleteInput, intent],
    [taskCompletionInput, {...intent, expected_fingerprint: dated.expected_fingerprint, completion_date: dated.occurrence_date, completed: false}],
    [taskSkipInput, dated], [taskScheduleInput, {...dated, recurrence: {type: 'daily'}}],
  ];
  for (const [parse, input] of cases) {
    assert.deepEqual(parse(input), input);
    for (const value of [id, null]) assert.deepEqual(parse({...input, expected_application_id: value}), {...input, expected_application_id: value});
    for (const value of ['', '../application', true, 1]) assert.throws(() => parse({...input, expected_application_id: value}), /invalid_input/);
  }
});
