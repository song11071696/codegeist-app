import { createRequire } from 'module';
const require = createRequire(import.meta.url);
const n = require('../src/notes.js');
const assert = (c, m) => { if (!c) { console.error('FAIL', m); process.exit(1); } };
const issues = [
  { key: 'SCRUM-1', fields: { summary: 'Login with SSO', issuetype: { name: 'Story' }, assignee: { displayName: 'Ana' }, labels: [] } },
  { key: 'SCRUM-2', fields: { summary: 'Crash on save', issuetype: { name: 'Bug' }, labels: [] } },
  { key: 'SCRUM-3', fields: { summary: 'Drop v1 API', issuetype: { name: 'Task' }, labels: ['breaking'] } },
  { key: 'SCRUM-4', fields: { summary: 'Speed up search', issuetype: { name: 'Task' }, assignee: { displayName: 'Bo' }, labels: [] } },
];
const g = n.groupIssues(issues, 'https://x.atlassian.net');
assert(g.total === 4 && g.groups.map((x) => x.id).join() === 'breaking,features,improvements,bugs', 'grouping');
const md = n.toMarkdown({ summary: n.defaultSummary(g.total, g.groups, 'SCRUM v1'), groups: g.groups, contributors: g.contributors });
const html = n.markdownToStorage(md);
assert(html.includes('<h2>Bug fixes</h2>') && html.includes('<a href="https://x.atlassian.net/browse/SCRUM-2">SCRUM-2</a>'), 'storage');
assert(n.buildJql({ projectKey: 'scrum', fixVersion: 'v1 "x"' }) === 'project = "SCRUM" AND fixVersion = "v1 \\"x\\"" ORDER BY issuetype ASC, priority DESC, key ASC', 'jql');
console.log(md); console.log('selftest ok');
