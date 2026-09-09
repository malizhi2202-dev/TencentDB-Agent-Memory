---
type: concept
title: Memory Levels
description: A four-tier memory hierarchy in the TencentDB Agent Memory system,
  distinguishing short-term vs. long-term retention.
sources:
  - README.md
  - memory-levels.md
  - overview.md
tags:
  - memory
  - hierarchy
  - memory-system
  - memory-levels
timestamp: 2024-01-01T00:00:00Z
---

# Memory Levels

## Definition

Memory Levels (L0–L3) represent a four-tier memory hierarchy in the [[TencentDB Agent Memory system]] (also referenced as [[TencentDB Agent Memory README]]), distinguishing short-term vs. long-term retention:

- **L0**: Raw conversation logs
- **L1**: Atomic facts extracted from conversations
- **L2**: Scenario/topic blocks
- **L3**: Long-term profile memory

## Significance

This hierarchy enables progressive abstraction and refinement of memory, from raw data to durable, high-level profiles of an agent's behavior and preferences. Each tier distills the previous one, moving from raw, unstructured data toward stable, reusable knowledge about the agent.

Memory Levels is one of the three core conceptual pillars of the [[Memory System]]. The hierarchy is fed by [[MemoryKnowledge]] and its fluidity is respected throughout the operational loop.

## Related Entities

- [[MemoryCore]] — the gateway service that manages and exposes the memory hierarchy.
- [[MemoryProxy]] — may influence how memory is surfaced in LLM requests.
- [[MemoryKnowledge]] — feeds into the Memory Levels hierarchy.
- [[Memory System]] — the overarching architecture.

## Common Topics

- System architecture
- Data flow: Retrievals respect the fluidity of Memory Levels (e.g., short-term vs. long-term retention).

## Related Concepts

- [[Knowledge Base]] — another ingestible knowledge source agents can leverage alongside memory.
- [[Skills]] — executable knowledge packages injected into LLM requests, complementing memory surfacing.

## Citations

- Source: `README.md`
- Source: `memory-levels.md`
- Source: `overview.md`
