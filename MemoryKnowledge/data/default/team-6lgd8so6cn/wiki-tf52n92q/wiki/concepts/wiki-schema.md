---
type: concept
title: Wiki Schema
description: 定义整个知识库页面类型、必填字段、OKF 章节以及命名与语言约定的元结构。
sources: ["schema.md"]
tags: [schema, meta, knowledge-base]
---

# Wiki Schema

## 定义

Wiki Schema 是知识库自身的元结构，规定了所有页面如何被组织与书写。它定义了三种核心页面类型（`entity`、`concept`、`source`），并允许按需扩展其他类型（如 `comparison`、`synthesis`）。

## 意义

该 schema 保证了知识库的一致性与可检索性：通过统一的页面类型、必填字段和命名约定，团队可以快速理解系统全貌及设计决策背后的理由。它是所有页面（包括本页）的结构依据。

## 页面类型

### entity（实体）

表示系统中的具体组件或角色，必须声明 `kind` 字段：

- `kind`：module | service | platform | external_system | user_role | other（必填）
- `definition`：职责 / 目的
- `key attributes`：关键属性
- `relationships`：与其他实体的关系

### concept（概念）

表示抽象的设计思想（系统架构、模块边界、数据流、部署模型、权限模型、评估框架等）：

- `definition`：概念定义
- `significance`：重要性 / 作用
- `related entities`：关联实体
- `common topics`：系统架构、模块边界、数据流、部署模型、权限模型、评估框架

### source（来源）

每个被摄入的源文档对应一个摘要页，必须声明 `source_type` 字段：

- `source_type`：requirement | architecture | meeting | rfc | decision | other（必填）
- 源文档摘要

## OKF 章节

在适用时使用可选章节：`# Schema` / `# Examples` / `# Citations`。

## 命名与语言约定

- slug：小写，空格转连字符（spaces→hyphens）。
- 输出语言：跟随源文档，不切换语言。

## 相关实体

- [[Knowledge Base]] — 该 schema 定义了知识库自身的结构。
- [[Memory Levels]] — 是 `concept` 页面类型的一个实例。
- [[Skills]] — 是 `concept` 页面类型的一个实例。

# Schema

- 页面格式：YAML frontmatter + markdown 正文。
- frontmatter 必填字段：`type`、`title`、`description`、`sources`；可选 `tags`、`timestamp`。
- 目录约定：`source` → `wiki/sources/`，`entity` → `wiki/entities/`，`concept` → `wiki/concepts/`，`comparison` → `wiki/comparisons/`，`synthesis` → `wiki/synthesis/`。

# Examples

- [[Knowledge Base]]、[[Memory Levels]]、[[Skills]] 均为遵循本 schema 的 `concept` 页面实例。

# Citations

- 来源文件：`schema.md`
