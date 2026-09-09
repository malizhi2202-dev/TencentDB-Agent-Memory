---
type: concept
title: Memory System
description: The overarching architecture concept for persistent, tiered, skill-driven memory management for AI agents.
sources: ["overview.md"]
tags: [memory-system, architecture]
---

# Memory System

## Definition

The Memory System is the overarching architecture concept of this knowledge base: a persistent, tiered, and skill-driven memory management layer for AI agents. Its primary goal is to enable agents to retain context, learn from interactions, and adapt their behavior over time.

## Significance

The Memory System ties together three core conceptual pillars — [[Knowledge Base]], [[Memory Levels]], and [[Skills]] — with four interconnected software entities: [[MemoryCore]], [[MemoryKnowledge]], [[MemoryPanel]], and [[MemoryProxy]]. It is concretely grounded by the [[TencentDB Agent Memory README]].

## Related Entities

- [[MemoryCore]] — foundational storage engine.
- [[MemoryKnowledge]] — semantic layer.
- [[MemoryPanel]] — dashboard.
- [[MemoryProxy]] — gatekeeper/abstraction layer.

## Common Topics

- **System architecture**: Persistent, tiered, skill-driven memory management.
- **Data flow**: See the Operational Loop below.

## Operational Loop

The interaction between components creates a cohesive operational loop: an agent's input is processed, relevant facts are stored via the [[Knowledge Base]], and retrievals are mediated by the [[MemoryProxy]], all while respecting the fluidity of [[Memory Levels]] (e.g., short-term vs. long-term retention).
