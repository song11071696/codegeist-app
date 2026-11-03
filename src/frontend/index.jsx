import React, { useEffect, useState } from 'react';
import ForgeReconciler, {
  Box,
  Button,
  Heading,
  Inline,
  Label,
  Link,
  Lozenge,
  SectionMessage,
  Select,
  Spinner,
  Stack,
  Text,
  TextArea,
  Textfield,
  useProductContext,
} from '@forge/react';
import { invoke } from '@forge/bridge';

const App = () => {
  const context = useProductContext();
  const projectKey = context && context.extension && context.extension.project ? context.extension.project.key : undefined;

  const [loading, setLoading] = useState(true);
  const [versions, setVersions] = useState([]);
  const [spaces, setSpaces] = useState([]);
  const [warnings, setWarnings] = useState([]);
  const [version, setVersion] = useState(null);
  const [jql, setJql] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [release, setRelease] = useState(null);
  const [markdown, setMarkdown] = useState('');
  const [title, setTitle] = useState('');
  const [space, setSpace] = useState(null);
  const [page, setPage] = useState(null);

  useEffect(() => {
    if (!context) return;
    invoke('init', { projectKey })
      .then((r) => {
        setVersions(r.versions || []);
        setSpaces(r.spaces || []);
        setWarnings(r.errors || []);
        const released = (r.versions || []).filter((v) => v.released);
        const def = released.length ? released[released.length - 1] : (r.versions || [])[0];
        if (def) setVersion({ label: def.name, value: def.name });
        if ((r.spaces || []).length) setSpace({ label: `${r.spaces[0].name} (${r.spaces[0].key})`, value: r.spaces[0].key });
      })
      .catch((e) => setWarnings([String(e && e.message ? e.message : e)]))
      .finally(() => setLoading(false));
  }, [context]);

  const generate = async () => {
    setBusy(true);
    setError('');
    setPage(null);
    const r = await invoke('generate', { projectKey, fixVersion: version ? version.value : undefined, jql });
    setBusy(false);
    if (!r.ok) {
      setError(r.error);
      return;
    }
    setRelease(r.release);
    setMarkdown(r.release.markdown);
    setTitle(r.release.title);
  };

  const publish = async () => {
    if (!space) {
      setError('Pick a Confluence space first.');
      return;
    }
    setBusy(true);
    setError('');
    const r = await invoke('publish', { spaceKey: space.value, title, markdown });
    setBusy(false);
    if (!r.ok) setError(r.error);
    else setPage(r.page);
  };

  if (loading) return <Spinner label="Loading project releases" />;

  return (
    <Stack space="space.200">
      <Heading as="h2">Release Notes Copilot</Heading>
      <Text>
        Turn a Jira release into grouped release notes (breaking changes, features, improvements, bug fixes) and publish them to
        Confluence in one click. Prefer chatting? Ask the "Release Notes Copilot" agent in Rovo.
      </Text>
      {warnings.map((w) => (
        <SectionMessage key={w} appearance="warning">
          <Text>{w}</Text>
        </SectionMessage>
      ))}

      <Box>
        <Label labelFor="version">Fix version {projectKey ? `in ${projectKey}` : ''}</Label>
        <Select
          id="version"
          options={versions.map((v) => ({ label: `${v.name}${v.released ? ' (released)' : ''}`, value: v.name }))}
          value={version}
          onChange={(v) => setVersion(v)}
          placeholder={versions.length ? 'Choose a fix version' : 'No versions yet - use JQL below'}
          isClearable
        />
      </Box>
      <Box>
        <Label labelFor="jql">Or a JQL query (overrides the fix version)</Label>
        <Textfield id="jql" value={jql} placeholder={`project = ${projectKey || 'KEY'} AND statusCategory = Done AND resolved >= -14d`} onChange={(e) => setJql(e.target.value)} />
      </Box>
      <Inline space="space.100">
        <Button appearance="primary" onClick={generate} isDisabled={busy}>
          Generate release notes
        </Button>
        {busy && <Spinner size="small" />}
      </Inline>

      {error && (
        <SectionMessage appearance="error">
          <Text>{error}</Text>
        </SectionMessage>
      )}

      {release && (
        <Stack space="space.150">
          <Inline space="space.100">
            <Lozenge appearance="inprogress">{`${release.total} issues`}</Lozenge>
            {release.groups.map((g) => (
              <Lozenge key={g.id} appearance={g.id === 'bugs' ? 'removed' : g.id === 'features' ? 'success' : g.id === 'breaking' ? 'moved' : 'default'}>
                {`${g.title}: ${g.issues.length}`}
              </Lozenge>
            ))}
          </Inline>
          <Text>{`JQL: ${release.jql}`}</Text>
          <Box>
            <Label labelFor="title">Page title</Label>
            <Textfield id="title" value={title} onChange={(e) => setTitle(e.target.value)} />
          </Box>
          <Box>
            <Label labelFor="md">Release notes (markdown, editable)</Label>
            <TextArea id="md" value={markdown} onChange={(e) => setMarkdown(e.target.value)} minimumRows={12} />
          </Box>
          <Box>
            <Label labelFor="space">Confluence space</Label>
            <Select
              id="space"
              options={spaces.map((s) => ({ label: `${s.name} (${s.key})`, value: s.key }))}
              value={space}
              onChange={(s) => setSpace(s)}
              placeholder="Choose a space"
            />
          </Box>
          <Button appearance="primary" onClick={publish} isDisabled={busy || !markdown}>
            Publish to Confluence
          </Button>
        </Stack>
      )}

      {page && (
        <SectionMessage appearance="success">
          <Text>
            Published "{page.title}". {page.url ? <Link href={page.url} openNewTab>Open the Confluence page</Link> : null}
          </Text>
        </SectionMessage>
      )}
    </Stack>
  );
};

ForgeReconciler.render(
  <React.StrictMode>
    <App />
  </React.StrictMode>
);
