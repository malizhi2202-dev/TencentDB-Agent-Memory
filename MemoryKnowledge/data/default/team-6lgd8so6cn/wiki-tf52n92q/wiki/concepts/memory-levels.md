---
type: concept
title: Memory Levels
description: A four-tier memory hierarchy in the TencentDB Agent Memory system.
sources: ["README.md"]
tags: [memory, hierarchy]
timestamp: 2024-01-01T00:00:00Z
---

# Memory Levels

## Definition

Memory Levels (L0–L3) represent a four-tier memory hierarchy in the TencentDB Agent Memory system:

- **L0**: Raw conversation logs
- **L1**: Atomic facts extracted from conversations
- **L2**: Scenario/topic blocks
- **L3**: Long-term profile memory

## Significance

This hierarchy enables progressive abstraction and refinement of memory, from raw data to durable, high-level profiles of an agent's behavior and preferences.

## Related Entities

- [[MemoryCore]] — the gateway service that manages and exposes the memory hierarchy.
- [[MemoryProxy]] — may influence how memory is surfaced in LLM requests.

## Common Topics

- System architecture
- Data flow