const api = require('@forge/api');
const { route } = api;
const notes = require('./notes');

const FIELDS = ['summary', 'issuetype', 'status', 'priority', 'labels', 'assignee', 'fixVersions'];

async function readJson(res, what) {
  const text = await res.text();
  if (!res.ok) {
    let detail = text;
    try {
      const j = JSON.parse(text);
      detail = (j.errorMessages && j.errorMessages.join('; ')) || j.message || (j.errors && JSON.stringify(j.errors)) || text;
    } catch (_e) {
      /* keep text */
    }
    throw new Error(`${what} failed (${res.status}): ${String(detail).slice(0, 300)}`);
  }
  return text ? JSON.parse(text) : {};
}

async function getJiraBaseUrl() {
  try {
    const res = await api.asApp().requestJira(route`/rest/api/3/serverInfo`);
    const j = await readJson(res, 'Jira serverInfo');
    return j.baseUrl || '';
  } catch (_e) {
    return '';
  }
}

async function listVersions(projectKey) {
  const res = await api.asApp().requestJira(route`/rest/api/3/project/${projectKey}/versions`);
  const versions = await readJson(res, `Reading versions of ${projectKey}`);
  return versions
    .filter((v) => !v.archived)
    .map((v) => ({ id: v.id, name: v.name, released: !!v.released, releaseDate: v.releaseDate || '' }));
}

// Latest released version, else first unreleased.
async function pickDefaultVersion(projectKey) {
  const versions = await listVersions(projectKey);
  const released = versions.filter((v) => v.released);
  if (released.length) return released[released.length - 1].name;
  return versions.length ? versions[0].name : '';
}

async function searchIssues(jql, max = 100) {
  const issues = [];
  let nextPageToken;
  while (issues.length < max) {
    const body = { jql, fields: FIELDS, maxResults: Math.min(50, max - issues.length) };
    if (nextPageToken) body.nextPageToken = nextPageToken;
    const res = await api.asApp().requestJira(route`/rest/api/3/search/jql`, {
      method: 'POST',
      headers: { Accept: 'application/json', 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    });
    const j = await readJson(res, 'Jira search');
    issues.push(...(j.issues || []));
    if (!j.nextPageToken || !(j.issues || []).length) break;
    nextPageToken = j.nextPageToken;
  }
  return issues;
}

async function buildRelease({ projectKey, fixVersion, jql } = {}) {
  let version = fixVersion;
  if (!jql && projectKey && !version) version = await pickDefaultVersion(projectKey);
  const query = notes.buildJql({ projectKey, fixVersion: version, jql });
  const [issues, baseUrl] = await Promise.all([searchIssues(query), getJiraBaseUrl()]);
  const grouped = notes.groupIssues(issues, baseUrl);
  const label = jql ? 'the selected issues' : `${String(projectKey).toUpperCase()}${version ? ' ' + version : ''}`;
  const title = jql ? 'Release notes' : `Release notes - ${label}`;
  const summary = notes.defaultSummary(grouped.total, grouped.groups, label);
  const markdown = notes.toMarkdown({ title: '', summary, groups: grouped.groups, contributors: grouped.contributors });
  return { jql: query, fixVersion: version || '', title, label, summary, markdown, ...grouped };
}

async function listSpaces() {
  const res = await api.asApp().requestConfluence(route`/wiki/api/v2/spaces?limit=50&status=current`);
  const j = await readJson(res, 'Listing Confluence spaces');
  return (j.results || []).map((s) => ({ id: s.id, key: s.key, name: s.name }));
}

async function createPage({ spaceKey, title, storage }) {
  const sres = await api.asApp().requestConfluence(route`/wiki/api/v2/spaces?keys=${spaceKey}`);
  const sj = await readJson(sres, 'Looking up Confluence space');
  const space = (sj.results || [])[0];
  if (!space) throw new Error(`Confluence space "${spaceKey}" was not found or the app cannot see it.`);
  const res = await api.asApp().requestConfluence(route`/wiki/api/v2/pages`, {
    method: 'POST',
    headers: { Accept: 'application/json', 'Content-Type': 'application/json' },
    body: JSON.stringify({
      spaceId: space.id,
      status: 'current',
      title,
      body: { representation: 'storage', value: storage },
    }),
  });
  const page = await readJson(res, 'Creating Confluence page');
  const links = page._links || {};
  const url = links.base && links.webui ? `${links.base}${links.webui}` : '';
  return { id: page.id, title: page.title, url };
}

module.exports = { listVersions, buildRelease, listSpaces, createPage };
