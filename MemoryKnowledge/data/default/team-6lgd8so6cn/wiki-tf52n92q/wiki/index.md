# Index

## Sources

* [Index](/sources/index.md) - An empty index/template page containing only section headers with no substantive content.
* [Knowledge Base (Source)](/sources/knowledge-base-source.md) - Source document defining the Knowledge Base concept and its related services.
* [Memory Levels](/sources/memory-levels.md) - Defines the four-tier memory hierarchy (L0–L3) in the TencentDB Agent Memory system.
* [Overview](/sources/overview.md) - A global overview of the wiki documenting the Memory System architecture for AI agents.
* [Skills](/sources/skills.md) - Defines Skills as executable knowledge packages injected into every LLM request via MemoryProxy.
* [TencentDB Agent Memory README](/sources/tencentdb-agent-memory-readme.md) - The primary source document outlining deployment, configuration, and integration patterns for the Memory System.
* [Wiki Purpose](/sources/wiki-purpose.md) - Foundational purpose statement of the knowledge base — accumulating and organizing engineering knowledge of software systems into a structured, cross-referenced knowledge graph.
* [Wiki Schema（源文档）](/sources/wiki-schema-源文档.md) - 定义知识库页面类型、字段/章节要求、OKF 章节以及命名与语言约定的元文档。

## Entities

* [Code Graph](/entities/code-graph.md) - A structured representation of code relationships within the Knowledge Base that agents can query.
* [MemoryCore](/entities/memorycore.md) - The gateway that routes knowledge queries and manages the memory hierarchy in the TencentDB Agent Memory system, and also serves as the foundational engine handling CRUD operations for all memory artifacts in the Memory System.
* [MemoryKnowledge](/entities/memoryknowledge.md) - A service that implements knowledge base ingestion and search, and also a higher-level semantic layer for organizing and querying information built upon MemoryCore.
* [MemoryPanel](/entities/memorypanel.md) - The user-facing or developer-facing dashboard for monitoring and managing memory contents.
* [MemoryProxy](/entities/memoryproxy.md) - A service and module that may inject knowledge-derived context and skills into LLM requests, influences how memory is surfaced, and also acts as a gatekeeper or abstraction layer providing constrained, cached access to memory stores for performance and security.
* [Wiki](/entities/wiki.md) - A structured, human-curated knowledge source type within the Knowledge Base that agents can search.

## Concepts

* [Knowledge Base](/concepts/knowledge-base.md) - Ingestible and searchable knowledge sources that agents can leverage; accumulates and organizes engineering knowledge of software systems into a structured, cross-referenced knowledge graph.
* [Memory Levels](/concepts/memory-levels.md) - A four-tier memory hierarchy in the TencentDB Agent Memory system, distinguishing short-term vs. long-term retention.
* [Memory System](/concepts/memory-system.md) - The overarching architecture concept for persistent, tiered, skill-driven memory management for AI agents.
* [Skills](/concepts/skills.md) - Executable knowledge packages that agents load and use, injected into every LLM request.
* [Wiki Schema](/concepts/wiki-schema.md) - 定义整个知识库页面类型、必填字段、OKF 章节以及命名与语言约定的元结构。
