---
type: entity
title: MemoryProxy
description: A service and module that may inject knowledge-derived context and
  skills into LLM requests, influences how memory is surfaced, and also acts as
  a gatekeeper or abstraction layer providing constrained, cached access to
  memory stores for performance and security.
sources:
  - knowledge-base.md
  - memory-levels.md
  - skills.md
  - overview.md
tags:
  - memory
  - knowledge
  - agents
  - service
  - proxy
  - skills
  - memory-system
  - module
timestamp: 2024-01-01T00:00:00Z
kind: service
---

# MemoryProxy

## Definition

MemoryProxy is a service (also described as a module) that may inject knowledge-derived context into LLM requests, and also injects [[Skills]] into every LLM request. It sits in the data flow between the [[Knowledge Base]] and the LLM, enriching requests with relevant knowledge, and acts as the key mechanism that makes skills automatically available during agent LLM interactions. Additionally, within the [[TencentDB Agent Memory system]], MemoryProxy may influence how memory is surfaced in LLM requests, shaping how the memory hierarchy is presented to language models.

In parallel, MemoryProxy is a gatekeeper or abstraction layer of the [[Memory System]] that provides a constrained and cached access point to the underlying memory stores. This role is essential for performance optimization and enforcing security or access policies. Note: the two descriptions are complementary — the proxy both enriches LLM requests and mediates access to memory stores.

## Key Attributes

- May inject knowledge-derived context into LLM requests.
- Injects skills into every LLM request.
- Part of the knowledge data flow.
- Service participating in the memory data flow.
- Influences how memory is surfaced in LLM requests.
- Serves as the delivery mechanism between skill packages and agents.
- Enables automatic availability of executable knowledge during LLM interactions.
- Complements the storage/management role of [[MemoryCore]].
- Constrained and cached access point to memory stores.
- Performance optimization.
- Enforces security and access policies.

## Relationships

- Draws on the [[Knowledge Base]] for knowledge-derived context.
- Interacts with [[MemoryKnowledge]] and [[MemoryCore]] in the knowledge data flow.
- Works alongside [[MemoryCore]] in the memory data flow — MemoryCore manages the hierarchy while MemoryProxy shapes its presentation in LLM requests.
- Surfaces memory from the [[Memory Levels]] hierarchy.
- Operates within the [[TencentDB Agent Memory system]].
- [[Skills]] — MemoryProxy injects skills into every LLM request (core relationship).
- [[Agents]] — MemoryProxy serves skills to agents during LLM interactions.
- [[knowledge-base]] — potential indirect link if MemoryProxy also serves knowledge base content (to be confirmed by other sources).
- Provides access to underlying memory stores ([[MemoryCore]]).
- Mediates retrievals from the [[Knowledge Base]].
- Component of the [[Memory System]].

## Common Topics

- Data flow
- System architecture
- Performance optimization
- Security and access control

## Citations

- Source: `knowledge-base.md`
- Source: `memory-levels.md`
- Source: `skills.md`
- Source: `overview.md`
