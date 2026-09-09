---
type: concept
title: Skills
description: Executable knowledge packages that agents load and use, injected
  into every LLM request.
sources:
  - README.md
  - skills.md
  - overview.md
tags:
  - memory
  - agents
  - skills
  - memory-system
timestamp: 2024-01-01T00:00:00Z
---

# Skills

## Definition

Skills are executable knowledge packages that agents load and use. They are injected into every LLM request via [[MemoryProxy]]. They are one of the three core conceptual pillars of the [[Memory System]].

## Significance

Skills enhance agent capability by providing modular, executable knowledge that is automatically available during LLM interactions. As a core pillar of the [[Memory System]], Skills enable skill-driven memory management, allowing agents to adapt their behavior over time.

## Related Entities

- [[MemoryProxy]] — the service that injects skills into every LLM request.
- [[knowledge-base]] — skills may be derived from or supplemented by knowledge base content.
- [[Memory System]] — the overarching architecture.

## Common Topics

- Data flow
- System architecture
- Skill-driven memory management
