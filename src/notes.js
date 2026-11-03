// Pure helpers (no Forge imports) so they can be unit-tested outside Forge.

const GROUPS = [
  { id: 'breaking', title: 'Breaking changes' },
  { id: 'features', title: 'New features' },
  { id: 'improvements', title: 'Improvements' },
  { id: 'bugs', title: 'Bug fixes' },
  { id: 'other', title: 'Other changes' },
];

const FEATURE_TYPES = ['story', 'epic', 'new feature', 'feature'];
const IMPROVEMENT_TYPES = ['improvement', 'task', 'sub-task', 'subtask', 'enhancement', 'change'];
const BUG_TYPES = ['bug', 'defect', 'incident', 'problem'];
const BREAKING_LABELS = ['breaking', 'breaking-change', 'breaking_change'];

function quote(value) {
  return `"${String(value).replace(/\\/g, '\\\\').replace(/"/g, '\\"')}"`;
}

function buildJql({ projectKey, fixVersion, jql } = {}) {
  if (jql && String(jql).trim()) return String(jql).trim();
  if (!projectKey) throw new Error('Provide a Jira project key and fix version, or a JQL query.');
  const parts = [`project = ${quote(String(projectKey).trim().toUpperCase())}`];
  if (fixVersion) parts.push(`fixVersion = ${quote(String(fixVersion).trim())}`);
  return `${parts.join(' AND ')} ORDER BY issuetype ASC, priority DESC, key ASC`;
}

function classify(issue) {
  const f = issue.fields || {};
  const labels = (f.labels || []).map((l) => String(l).toLowerCase());
  if (labels.some((l) => BREAKING_LABELS.includes(l))) return 'breaking';
  const type = String((f.issuetype && f.issuetype.name) || '').toLowerCase();
  if (BUG_TYPES.includes(type)) return 'bugs';
  if (FEATURE_TYPES.includes(type)) return 'features';
  if (IMPROVEMENT_TYPES.includes(type)) return 'improvements';
  return 'other';
}

function simplify(issue, baseUrl) {
  const f = issue.fields || {};
  return {
    key: issue.key,
    summary: f.summary || '(no summary)',
    type: (f.issuetype && f.issuetype.name) || 'Issue',
    status: (f.status && f.status.name) || '',
    priority: (f.priority && f.priority.name) || '',
    assignee: (f.assignee && f.assignee.displayName) || '',
    labels: f.labels || [],
    url: baseUrl ? `${baseUrl.replace(/\/$/, '')}/browse/${issue.key}` : '',
    group: classify(issue),
  };
}

function groupIssues(issues, baseUrl) {
  const simple = issues.map((i) => simplify(i, baseUrl));
  const groups = GROUPS.map((g) => ({ ...g, issues: simple.filter((i) => i.group === g.id) })).filter(
    (g) => g.issues.length > 0
  );
  const contributors = [...new Set(simple.map((i) => i.assignee).filter(Boolean))].sort();
  return { total: simple.length, groups, contributors };
}

function toMarkdown({ title, summary, groups, contributors }) {
  const out = [];
  if (title) out.push(`# ${title}`, '');
  if (summary) out.push(summary, '');
  for (const g of groups) {
    out.push(`## ${g.title}`);
    for (const i of g.issues) {
      const ref = i.url ? `[${i.key}](${i.url})` : i.key;
      out.push(`- ${i.summary} (${ref})`);
    }
    out.push('');
  }
  if (contributors && contributors.length) out.push(`**Contributors:** ${contributors.join(', ')}`, '');
  return out.join('\n').trim() + '\n';
}

function defaultSummary(total, groups, label) {
  if (!total) return `No issues were found for ${label}.`;
  const counts = groups.map((g) => `${g.issues.length} ${g.title.toLowerCase()}`).join(', ');
  return `This release (${label}) includes ${total} change${total === 1 ? '' : 's'}: ${counts}.`;
}

function escapeXml(s) {
  return String(s)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

// Inline markdown -> storage: links, bold, italics, code.
function inline(text) {
  let s = escapeXml(text);
  s = s.replace(/\[([^\]]+)\]\((https?:[^)\s]+)\)/g, (_m, t, u) => `<a href="${u}">${t}</a>`);
  s = s.replace(/\*\*([^*]+)\*\*/g, '<strong>$1</strong>');
  s = s.replace(/(^|[^*])\*([^*]+)\*/g, '$1<em>$2</em>');
  s = s.replace(/`([^`]+)`/g, '<code>$1</code>');
  return s;
}

// Minimal markdown -> Confluence storage format (headings, bullets, numbered lists, paragraphs).
function markdownToStorage(md) {
  const lines = String(md || '').replace(/\r/g, '').split('\n');
  const html = [];
  let list = null;
  let para = [];
  const flushPara = () => {
    if (para.length) html.push(`<p>${inline(para.join(' '))}</p>`);
    para = [];
  };
  const closeList = () => {
    if (list) html.push(`</${list}>`);
    list = null;
  };
  for (const raw of lines) {
    const line = raw.trimEnd();
    const h = line.match(/^(#{1,6})\s+(.*)$/);
    const ul = line.match(/^\s*[-*+]\s+(.*)$/);
    const ol = line.match(/^\s*\d+[.)]\s+(.*)$/);
    if (!line.trim()) {
      flushPara();
      closeList();
    } else if (h) {
      flushPara();
      closeList();
      const level = Math.min(h[1].length, 6);
      html.push(`<h${level}>${inline(h[2])}</h${level}>`);
    } else if (ul || ol) {
      flushPara();
      const want = ul ? 'ul' : 'ol';
      if (list !== want) {
        closeList();
        html.push(`<${want}>`);
        list = want;
      }
      html.push(`<li>${inline((ul || ol)[1])}</li>`);
    } else {
      closeList();
      para.push(line.trim());
    }
  }
  flushPara();
  closeList();
  return html.join('');
}

module.exports = {
  GROUPS,
  buildJql,
  classify,
  groupIssues,
  toMarkdown,
  defaultSummary,
  markdownToStorage,
};
