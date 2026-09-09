---
type: entity
title: MemoryKnowledge
description: A service that implements knowledge base ingestion and search, and
  also a higher-level semantic layer for organizing and querying information
  built upon MemoryCore.
sources:
  - knowledge-base.md
  - overview.md
tags:
  - memory
  - knowledge
  - agents
  - memory-system
  - semantic-layer
  - module
kind: service
---

# MemoryKnowledge

## Definition

MemoryKnowledge is the service that implements [[Knowledge Base]] ingestion and search. It is responsible for ingesting knowledge sources such as [[Wiki]] and [[Code Graph]] and making them searchable by agents.

It is also described as a higher-level semantic layer of the [[Memory System]] for organizing and querying information, built directly upon [[MemoryCore]] and feeding into the hierarchical structure defined by [[Memory Levels]].

> **Note:** The two sources disagree on the classification of MemoryKnowledge. The original source (`knowledge-base.md`) describes it as a **service**, while the newer source (`overview.md`) describes it as a **module**. Both perspectives are preserved here.

## Key Attributes

- Implements knowledge base ingestion.
- Implements knowledge base search.
- Provides meaningful, contextual knowledge retrieval.
- Distinguishes raw storage ([[MemoryCore]]) from semantic knowledge.
- Feeds into the [[Memory Levels]] hierarchy.

## Relationships

- Implements the [[Knowledge Base]].
- Ingests and searches [[Wiki]] and [[Code Graph]].
- Interacts with [[MemoryProxy]] and [[MemoryCore]] in the knowledge data flow.
- Built directly upon [[MemoryCore]].
- Feeds into [[Memory Levels]].
- Component of the [[Memory System]].
