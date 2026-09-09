---
type: source
title: Wiki Schema（源文档）
description: 定义知识库页面类型、字段/章节要求、OKF 章节以及命名与语言约定的元文档。
sources: ["schema.md"]
tags: [schema, meta, knowledge-base]
---

# Wiki Schema（源文档）

本文档定义了知识库自身的结构规范，属于元文档（meta-document），用于约束所有知识库页面的组织方式。

## 摘要

- 定义页面类型：`entity`、`concept`、`source`，并允许按需创建其他类型（如 `comparison`、`synthesis`）。
- 规定每种类型的必填字段与章节：
  - `entity` 必须声明 `kind`（module | service | platform | external_system | user_role | other）。
  - `concept` 包含定义、意义、相关实体、常见主题。
  - `source` 必须声明 `source_type`（requirement | architecture | meeting | rfc | decision | other）。
- 规定 OKF 章节（`# Schema` / `# Examples` / `# Citations`）在适用时使用。
- 命名与语言约定：slug 使用小写、空格转连字符；输出语言跟随源文档。

## 关联

- 该文档是 [[Wiki Schema]] 概念页的直接来源。
- 它约束了 [[Knowledge Base]]、[[Memory Levels]]、[[Skills]] 等既有页面的结构。

# Citations

- 来源文件：`schema.md`
