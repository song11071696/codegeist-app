# Release Notes Copilot (Atlassian Forge)

Turn a Jira release into polished, grouped release notes and publish them to Confluence.

- **Rovo agent "Release Notes Copilot"** with two Rovo actions:
  - `fetch-release-issues` - reads the issues of a fix version (or any JQL), groups them into Breaking changes / New features / Improvements / Bug fixes / Other, and returns a markdown draft.
  - `publish-release-notes` - creates a Confluence page from the final notes.
- **Jira project page (UI Kit)** - pick a fix version or JQL, generate notes, edit them, choose a Confluence space and publish. Works without Rovo or any LLM.

No external services, no paid APIs: everything runs on Forge and the Jira/Confluence REST APIs.

## Grouping rules
- Label `breaking` / `breaking-change` -> Breaking changes
- Story / Epic / New Feature -> New features
- Task / Sub-task / Improvement -> Improvements
- Bug -> Bug fixes

## Deploy
CI (`.github/workflows/forge.yml`) registers the app once, then lints, deploys to `development` and installs/upgrades it on the target site for Jira and Confluence. Secrets: `FORGE_EMAIL`, `FORGE_API_TOKEN`.
