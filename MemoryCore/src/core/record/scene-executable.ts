/**
 * ExecutableScene（可执行场景，P1 资产演进）.
 *
 * 补齐对比文档 §5.2 的「ExecutableScene」缺失：TencentDB 有 L2 scene（行程/场景
 * 分组）但没有「可执行场景」——把「执行者 + 能力面 + 知识引用 + 输入表单」固化成
 * 一等资产，并在执行前做「可运行性检查」（引用能力齐备才 runnable），发布时做
 * 版本快照（草稿改动不影响已发布版）。
 *
 * 对标 Agent OS 的 ExecutableScene + SceneReadiness + SceneRelease：
 * - 可运行性检查：执行前校验能力面引用的能力是否齐备，缺一逐条 reason_code，
 *   任一阻断 → runnable=false（fail-closed，不降级执行）
 * - 发布快照：SceneRelease 带版本号 + runtime_manifest_json 落盘快照，
 *   编辑草稿不影响已发布版
 *
 * 本模块是纯逻辑（无 IO）：场景定义 + 就绪检查 + 发布快照，可单测。
 */

export interface SceneParam {
  name: string;
  type: string;
  required: boolean;
  default_value?: string;
}

export interface SceneDefinition {
  sceneId: string;
  title: string;
  /** 执行者 agent */
  executorAgentId: string;
  /** 能力面：工具白名单（执行者被允许调用的工具） */
  toolsWhitelist: string[];
  /** 声明能力（执行此场景所需能力，逐一校验） */
  capabilities: string[];
  constraints: string[];
  persona: string;
  /** 知识引用（关联的知识空间/资产 id） */
  knowledgeRefs: string[];
  /** 输入表单（具名槽位） */
  formFields: SceneParam[];
}

export interface ReadinessIssue {
  capability: string;
  reasonCode: string;
}

export interface SceneReadiness {
  runnable: boolean;
  missing: ReadinessIssue[];
}

export interface SceneRelease {
  version: number;
  sceneId: string;
  /** 发布时深拷贝快照（编辑草稿不影响已发布版） */
  manifest: SceneDefinition;
  manifestJson: string;
  publishedAt: string;
}

/**
 * 可运行性检查：能力面引用的能力是否齐备。
 * - capabilities 全部在 availableCapabilities → runnable=true
 * - 任一缺失 → runnable=false + 逐条 reason_code（MISSING_CAPABILITY）
 * - 核对 toolsWhitelist 是否为空（无工具 = 无法执行 → 不 runnable）
 */
export function checkSceneReadiness(scene: SceneDefinition, availableCapabilities: ReadonlySet<string>): SceneReadiness {
  const missing: ReadinessIssue[] = [];

  for (const cap of scene.capabilities) {
    if (!availableCapabilities.has(cap)) {
      missing.push({ capability: cap, reasonCode: "MISSING_CAPABILITY" });
    }
  }
  if (scene.toolsWhitelist.length === 0) {
    missing.push({ capability: "<tools>", reasonCode: "NO_TOOLS_WL" });
  }

  return { runnable: missing.length === 0, missing };
}

/**
 * 发布快照：深拷贝场景定义（草稿隔离），生成版本化 manifest。
 */
export function publishScene(scene: SceneDefinition, version: number, publishedAt: string = new Date().toISOString()): SceneRelease {
  const manifest = structuredClone(scene as unknown as Record<string, unknown>) as unknown as SceneDefinition;
  return {
    version,
    sceneId: scene.sceneId,
    manifest,
    manifestJson: JSON.stringify(manifest),
    publishedAt,
  };
}

/** 校验输入表单：required 槽位是否都已提供值。 */
export function validateForm(scene: SceneDefinition, supplied: Record<string, unknown>): { ok: boolean; missing: string[] } {
  const missing: string[] = [];
  for (const field of scene.formFields) {
    if (field.required && (supplied[field.name] === undefined || supplied[field.name] === null || supplied[field.name] === "")) {
      missing.push(field.name);
    }
  }
  return { ok: missing.length === 0, missing };
}