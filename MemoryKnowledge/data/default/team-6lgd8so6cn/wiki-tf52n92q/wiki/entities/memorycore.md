---
type: entity
title: MemoryCore
description: The gateway that routes knowledge queries and manages the memory
  hierarchy in the TencentDB Agent Memory system, and also serves as the
  foundational engine handling CRUD operations for all memory artifacts in the
  Memory System.
sources:
  - knowledge-base.md
  - memory-levels.md
  - overview.md
tags:
  - memory
  - knowledge
  - agents
  - service
  - gateway
  - memory-system
  - storage
  - module
timestamp: 2024-01-01T00:00:00Z
kind: service
---

# MemoryCore

## Definition

MemoryCore is the gateway that routes knowledge queries and manages the memory hierarchy. It directs queries to the appropriate knowledge sources and services within the [[Knowledge Base]] system, and also manages and exposes the [[Memory Levels]] (L0–L3) hierarchy in the [[TencentDB Agent Memory system]]. It acts as the central access point through which the memory tiers are stored, retrieved, and surfaced to consumers.

Additionally, MemoryCore is the foundational engine of the [[Memory System]], responsible for handling the essential CRUD (create, read, update, delete) operations for all memory artifacts. It represents the raw storage layer of the system.

> **Note on classification:** The original source (`knowledge-base.md`, `memory-levels.md`) describes MemoryCore as a *service*, while a newer source (`overview.md`) describes it as a *module*. Both perspectives are retained here; the frontmatter `kind` reflects the original classification.

## Key Attributes

- Gateway for knowledge queries.
- Routes queries to appropriate services.
- Gateway service responsible for the memory hierarchy.
- Manages the L0–L3 tiers (raw logs → atomic facts → scenario blocks → long-term profiles).
- Exposes the memory hierarchy to other components and services.
- Handles CRUD operations for all memory artifacts.
- Serves as the raw storage layer.
- Foundation upon which higher-level semantic layers are built.

## Relationships

- Routes knowledge queries for the [[Knowledge Base]].
- Interacts with [[MemoryKnowledge]] and [[MemoryProxy]] in the knowledge data flow.
- Manages and exposes [[Memory Levels]].
- Interacts with [[MemoryProxy]] in the memory data flow — MemoryProxy may influence how the memory surfaced by MemoryCore is presented in LLM requests.
- Operates within the [[TencentDB Agent Memory system]].
- Built upon by [[MemoryKnowledge]] — MemoryKnowledge provides a higher-level semantic layer directly on top of MemoryCore.
- Accessed by [[MemoryProxy]] — MemoryProxy provides constrained, cached access to the underlying memory stores.
- Managed by [[MemoryPanel]] — MemoryPanel offers a dashboard for monitoring and managing memory contents stored by MemoryCore.
- Component of the [[Memory System]].

## Citations

- Source: `knowledge-base.md`
- Source: `memory-levels.md`
- Source: `overview.md`
