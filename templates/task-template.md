---
id: TASK-ID
title: Short descriptive title
project: your-project-name
repo: .
branch: task/TASK-ID-short-slug
type: feature
priority: medium
status: backlog
agent: fullstack-builder
depends_on: []
files_likely_affected: []
verification:
  - npm run build
  - npm run test
---

## Goal

Describe the business outcome in plain English. What problem does this solve and why does it matter? One to three sentences.

## Context

Relevant background, constraints, and assumptions the agent needs to know. Include links to related tasks, PRs, or decisions. If this depends on something not yet built, say so here.

## Acceptance Criteria

- Criterion 1 — specific, verifiable outcome
- Criterion 2 — another specific outcome
- Criterion 3 — add as many as needed

## Expected Artifacts

- List files that will be created or modified
- Note any migrations, config changes, or docs required

## Failure Conditions

- What would cause this task to be rejected?
- build fails
- tests fail
- acceptance criteria not fully met

## Reviewer Checklist

- [ ] All acceptance criteria satisfied
- [ ] No unintended scope changes
- [ ] Build and test output clean
- [ ] Code is readable and reviewable
