export const meetingFormat = {
  type: 'json_schema', name: 'meeting_notes', strict: true,
  schema: {
    type: 'object', additionalProperties: false,
    properties: {
      summary: { type: 'string' },
      decisions: { type: 'array', items: { type: 'string' } },
      tasks: { type: 'array', items: { type: 'object', additionalProperties: false,
        properties: { title: { type: 'string' }, owner: { type: ['string', 'null'] }, due: { type: ['string', 'null'] } }, required: ['title', 'owner', 'due'] } },
      questions: { type: 'array', items: { type: 'string' } }
    }, required: ['summary', 'decisions', 'tasks', 'questions']
  }
};
export function parseMeeting(value) {
  const notes = JSON.parse(value);
  if (typeof notes.summary !== 'string' || !Array.isArray(notes.tasks) || !Array.isArray(notes.decisions) || !Array.isArray(notes.questions) ||
    !notes.decisions.every(s => typeof s === 'string') || !notes.questions.every(s => typeof s === 'string') ||
    !notes.tasks.every(t => typeof t.title === 'string' && (typeof t.owner === 'string' || t.owner === null) && (typeof t.due === 'string' || t.due === null))) throw new Error('Invalid structured meeting notes.');
  const lines = [notes.summary];
  if (notes.decisions.length) lines.push('Decisions\n' + notes.decisions.map(s => `• ${s}`).join('\n'));
  if (notes.tasks.length) lines.push('Suggested tasks\n' + notes.tasks.map(t => `• ${t.title}${t.owner ? ` — ${t.owner}` : ''}${t.due ? ` (${t.due})` : ''}`).join('\n'));
  if (notes.questions.length) lines.push('Open questions\n' + notes.questions.map(s => `• ${s}`).join('\n'));
  return { summary: lines.join('\n\n'), tasks: notes.tasks, decisions: notes.decisions, questions: notes.questions };
}
