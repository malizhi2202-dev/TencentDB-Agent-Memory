---
type: overview
title: Overview
description: A global overview of this wiki
timestamp: 2026-08-18T10:13:09.588Z
---

This knowledge base documents the architecture and operational model of a **Memory System** designed for AI agents, structured around three core conceptual pillars: **Knowledge Base**, **Memory Levels**, and **Skills**. The system’s primary goal is to provide persistent, tiered, and skill-driven memory management, enabling agents to retain context, learn from interactions, and adapt their behavior over time.

At the heart of the system are several interconnected software entities. **MemoryCore** serves as the foundational engine, handling the essential CRUD (create, read, update, delete) operations for all memory artifacts. Directly built upon it, **MemoryKnowledge** provides a higher-level semantic layer for organizing and querying information, likely feeding into the hierarchical structure defined by [[Memory Levels]]. This separation allows the system to distinguish between raw storage ([[MemoryCore]]) and meaningful, contextual knowledge retrieval ([[MemoryKnowledge]]).

Supporting this infrastructure are two critical interface components. **MemoryPanel** acts as the user-facing or developer-facing dashboard, offering a graphical or API-based control surface for monitoring and managing memory contents directly. In contrast, **MemoryProxy** serves as a gatekeeper or abstraction layer, providing a constrained and cached access point to the underlying memory stores, which is essential for performance optimization and enforcing security or access policies.

The interaction between these components creates a cohesive operational loop: an agent’s input is processed, relevant facts are stored via the [[Knowledge Base]], and retrievals are mediated by the [[MemoryProxy]], all while respecting the fluidity of [[Memory Levels]] (e.g., short-term vs. long-term retention). This design is concretely grounded by the **TencentDB Agent Memory README**, which serves as the primary source document, outlining the system’s intended deployment, configuration, and integration patterns—effectively bridging the conceptual pages with real-world implementation. Together, these pages describe not just a storage solution, but a dynamic, skill-aware cognitive layer for advanced AI agents.