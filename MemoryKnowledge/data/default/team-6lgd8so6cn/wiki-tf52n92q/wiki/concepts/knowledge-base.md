---
type: concept
title: Knowledge Base
description: Ingestible and searchable knowledge sources that agents can leverage.
sources: ["README.md"]
tags: [memory, knowledge, agents]
timestamp: 2024-01-01T00:00:00Z
---

# Knowledge Base

## Definition

The Knowledge Base consists of ingestible and searchable knowledge sources, including Wiki and Code Graph. Agents can leverage these sources to enhance their responses with structured, domain-specific information.

## Significance

The knowledge base extends the memory system beyond conversational data, enabling agents to access persistent, structured knowledge for improved accuracy and context.

## Related Entities

- [[MemoryKnowledge]] — the service that implements knowledge base ingestion and search.
- [[MemoryProxy]] — may inject knowledge-derived context into LLM requests.
- [[MemoryCore]] — the gateway that routes knowledge queries.

## Common Topics

- System architecture
- Data flow