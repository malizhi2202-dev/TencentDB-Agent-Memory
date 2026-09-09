---
type: source
title: Memory Levels
description: Defines the four-tier memory hierarchy (L0–L3) in the TencentDB Agent Memory system.
sources: ["memory-levels.md"]
source_type: architecture
tags: [memory, hierarchy, architecture]
timestamp: 2024-01-01T00:00:00Z
---

# Memory Levels

## Source Document Summary

This document defines **Memory Levels (L0–L3)**, a four-tier memory hierarchy in the [[TencentDB Agent Memory system]]:

- **L0**: Raw conversation logs
- **L1**: Atomic facts extracted from conversations
- **L2**: Scenario/topic blocks
- **L3**: Long-term profile memory

The hierarchy enables progressive abstraction and refinement of memory, from raw data to durable, high-level profiles of an agent's behavior and preferences.

## Key Concepts Introduced

- [[Memory Levels]] — the four-tier memory hierarchy itself.
- Progressive abstraction / refinement — the mechanism by which raw conversation data is distilled into durable, high-level agent profiles.

## Related Entities

- [[MemoryCore]] — the gateway service that manages and exposes the memory hierarchy.
- [[MemoryProxy]] — may influence how memory is surfaced in LLM requests.

## Common Topics

- System architecture
- Data flow

## Citations

- Source: `memory-levels.md` (originally `README.md`)
