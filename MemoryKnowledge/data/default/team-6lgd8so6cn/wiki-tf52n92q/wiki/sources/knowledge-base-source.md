---
type: source
title: Knowledge Base (Source)
description: Source document defining the Knowledge Base concept and its related services.
sources: ["knowledge-base.md"]
source_type: other
tags: [memory, knowledge, agents]
timestamp: 2024-01-01T00:00:00Z
---

# Knowledge Base (Source)

## Summary

This source document defines the [[Knowledge Base]] concept — a set of ingestible and searchable knowledge sources ([[Wiki]] and [[Code Graph]]) that agents leverage to enhance responses with structured, domain-specific information. It positions the knowledge base as an extension of the memory system beyond conversational data, and names three related services that implement ingestion, injection, and routing: [[MemoryKnowledge]], [[MemoryProxy]], and [[MemoryCore]].

The document is definitional in nature, serving primarily as a hub that points to related entities rather than providing deep implementation detail.

## Key Points

- The knowledge base consists of ingestible and searchable knowledge sources.
- It extends the memory system beyond conversational data.
- [[MemoryKnowledge]] implements knowledge base ingestion and search.
- [[MemoryProxy]] may inject knowledge-derived context into LLM requests.
- [[MemoryCore]] is the gateway that routes knowledge queries.

## Related Pages

- [[Knowledge Base]]
- [[Wiki]]
- [[Code Graph]]
- [[MemoryKnowledge]]
- [[MemoryProxy]]
- [[MemoryCore]]
- [[Memory Levels]]
