const Resolver = require('@forge/resolver').default;
const notes = require('./notes');
const atl = require('./atlassian');

function pick(payload, key) {
  if (!payload) return undefined;
  const v = payload[key];
  return typeof v === 'string' ? v.trim() || undefined : v;
}

// ---------- Rovo actions ----------

async function fetchReleaseIssues(payload) {
  try {
    const release = await atl.buildRelease({
      projectKey: pick(payload, 'projectKey'),
      fixVersion: pick(payload, 'fixVersion'),
      jql: pick(payload, 'jql'),
    });
    return {
      status: 'ok',
      jql: release.jql,
      fixVersion: release.fixVersion,
      suggestedTitle: release.title,
      total: release.total,
      contributors: release.contributors,
      groups: release.groups.map((g) => ({
        title: g.title,
        issues: g.issues.map((i) => ({ key: i.key, summary: i.summary, type: i.type, status: i.status, assignee: i.assignee, url: i.url })),
      })),
      markdownDraft: release.markdown,
    };
  } catch (e) {
    return { status: 'error', message: e.message };
  }
}

async function publishReleaseNotes(payload) {
  try {
    const spaceKey = pick(payload, 'spaceKey');
    if (!spaceKey) throw new Error('spaceKey is required.');
    let content = pick(payload, 'content');
    let title = pick(payload, 'title');
    if (!content) {
      const release = await atl.buildRelease({
        projectKey: pick(payload, 'projectKey'),
        fixVersion: pick(payload, 'fixVersion'),
        jql: pick(payload, 'jql'),
      });
      content = release.markdown;
      title = title || release.title;
    }
    const page = await atl.createPage({
      spaceKey,
      title: title || `Release notes ${new Date().toISOString().slice(0, 10)}`,
      storage: notes.markdownToStorage(content),
    });
    return { status: 'ok', pageId: page.id, title: page.title, url: page.url };
  } catch (e) {
    return { status: 'error', message: e.message };
  }
}

// ---------- UI Kit resolver ----------

const resolver = new Resolver();

resolver.define('init', async ({ payload }) => {
  const projectKey = pick(payload, 'projectKey');
  const out = { versions: [], spaces: [], errors: [] };
  if (projectKey) {
    try {
      out.versions = await atl.listVersions(projectKey);
    } catch (e) {
      out.errors.push(e.message);
    }
  }
  try {
    out.spaces = await atl.listSpaces();
  } catch (e) {
    out.errors.push(`Confluence: ${e.message}`);
  }
  return out;
});

resolver.define('generate', async ({ payload }) => {
  try {
    const release = await atl.buildRelease({
      projectKey: pick(payload, 'projectKey'),
      fixVersion: pick(payload, 'fixVersion'),
      jql: pick(payload, 'jql'),
    });
    return { ok: true, release };
  } catch (e) {
    return { ok: false, error: e.message };
  }
});

resolver.define('publish', async ({ payload }) => {
  try {
    const page = await atl.createPage({
      spaceKey: pick(payload, 'spaceKey'),
      title: pick(payload, 'title') || 'Release notes',
      storage: notes.markdownToStorage(pick(payload, 'markdown') || ''),
    });
    return { ok: true, page };
  } catch (e) {
    return { ok: false, error: e.message };
  }
});

exports.handler = resolver.getDefinitions();
exports.fetchReleaseIssues = fetchReleaseIssues;
exports.publishReleaseNotes = publishReleaseNotes;
