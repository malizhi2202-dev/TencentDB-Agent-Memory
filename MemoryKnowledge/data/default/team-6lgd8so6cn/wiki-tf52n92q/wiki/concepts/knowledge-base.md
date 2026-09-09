---
type: concept
title: Knowledge Base
description: Ingestible and searchable knowledge sources that agents can
  leverage; accumulates and organizes engineering knowledge of software systems
  into a structured, cross-referenced knowledge graph.
sources:
  - README.md
  - knowledge-base.md
  - overview.md
  - purpose.md
tags:
  - memory
  - knowledge
  - agents
  - memory-system
  - knowledge-base
  - knowledge-graph
  - ingestion
timestamp: 2024-01-01T00:00:00Z
---

# Knowledge Base

## Definition

The Knowledge Base consists of ingestible and searchable knowledge sources, including [[Wiki]] and [[Code Graph]]. Agents can leverage these sources to enhance their responses with structured, domain-specific information. It is one of the three core conceptual pillars of the [[Memory System]].

Additionally, the knowledge base accumulates and organizes engineering knowledge of software systems. It ingests requirement documents, architecture designs, meeting notes, RFCs, technical decisions, and other source documents to build a structured, cross-referenced knowledge graph that helps team members quickly understand the system landscape and the rationale behind design decisions.

## Significance

The knowledge base extends the memory system beyond conversational data, enabling agents to access persistent, structured knowledge for improved accuracy and context. This positions the knowledge base as a tier/extension of the broader memory hierarchy (see [[Memory Levels]]), spanning both ephemeral conversation history and persistent structured knowledge sources. As a core pillar of the [[Memory System]], the Knowledge Base stores relevant facts during the operational loop. Retrievals from the Knowledge Base are mediated by [[MemoryProxy]].

It serves as the central repository of ingestible and searchable knowledge sources that agents can leverage. The cross-referenced structure supports rapid comprehension of the system landscape and the reasoning behind design decisions.

## Scope

The knowledge base covers engineering knowledge of software systems, including:

- System architecture
- Module design
- Data flow
- Deployment models
- Permission models

## Ingestion Mechanism

Source documents — requirement documents, architecture designs, meeting notes, RFCs, technical decisions, and others — are ingested and organized into a structured, cross-referenced knowledge graph.

## Related Entities

- [[MemoryKnowledge]] — the service that implements knowledge base ingestion and search.
- [[MemoryProxy]] — mediates retrievals from the Knowledge Base and may inject knowledge-derived context into LLM requests.
- [[MemoryCore]] — the gateway that routes knowledge queries.
- [[Wiki]] — a structured, human-curated knowledge source type within the knowledge base.
- [[Code Graph]] — a structured representation of code relationships within the knowledge base.
- [[Memory System]] — the overarching architecture of which the Knowledge Base is a core pillar.
- [[Wiki Purpose]] — the foundational purpose statement of this knowledge base.
- [[Memory Levels]] — a four-tier memory hierarchy in the TencentDB Agent Memory system.
- [[Skills]] — executable knowledge packages that agents load and use.

## Common Topics

- System architecture
- Data flow: Agent input → fact storage via Knowledge Base → retrieval mediated by MemoryProxy.

## Citations

- purpose.md — Wiki Purpose
