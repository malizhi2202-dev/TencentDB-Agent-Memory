---
type: concept
title: Skills
description: Executable knowledge packages that agents load and use, injected into every LLM request.
sources: ["README.md"]
tags: [memory, agents, skills]
timestamp: 2024-01-01T00:00:00Z
---

# Skills

## Definition

Skills are executable knowledge packages that agents can load and use. They are injected into every LLM request via [[MemoryProxy]].

## Significance

Skills enhance agent capability by providing modular, executable knowledge that is automatically available during LLM interactions.

## Related Entities

- [[MemoryProxy]] — the service that injects skills into every LLM request.
- [[knowledge-base]] — skills may be derived from or supplemented by knowledge base content.

## Common Topics

- Data flow
- System architecture