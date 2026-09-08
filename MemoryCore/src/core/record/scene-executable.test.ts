import { describe, it, expect } from "vitest";
import { checkSceneReadiness, publishScene, validateForm, type SceneDefinition } from "./scene-executable.js";

function makeScene(overrides: Partial<SceneDefinition> = {}): SceneDefinition {
  return {
    sceneId: "scn_1",
    title: "部署数据库",
    executorAgentId: "agent-1",
    toolsWhitelist: ["run_sql", "scp"],
    capabilities: ["sql_exec", "file_transfer"],
    constraints: [],
    persona: "数据库运维助手",
    knowledgeRefs: ["sp_team_t1_semantic"],
    formFields: [{ name: "target_host", type: "string", required: true }],
    ...overrides,
  };
}

describe("scene-executable — ExecutableScene 可运行性 + 发布快照（P1）", () => {
  it("能力齐备 → runnable=true", () => {
    const ready = checkSceneReadiness(makeScene(), new Set(["sql_exec", "file_transfer"]));
    expect(ready.runnable).toBe(true);
    expect(ready.missing).toEqual([]);
  });

  it("缺能力 → runnable=false + 逐条 reason_code", () => {
    const ready = checkSceneReadiness(makeScene({ capabilities: ["sql_exec", "file_transfer", "secret_scan"] }), new Set(["sql_exec"]));
    expect(ready.runnable).toBe(false);
    expect(ready.missing).toEqual([
      { capability: "file_transfer", reasonCode: "MISSING_CAPABILITY" },
      { capability: "secret_scan", reasonCode: "MISSING_CAPABILITY" },
    ]);
  });

  it("无工具白名单 → 不 runnable（NO_TOOLS_WL）", () => {
    const ready = checkSceneReadiness(makeScene({ toolsWhitelist: [] }), new Set(["sql_exec"]));
    expect(ready.runnable).toBe(false);
    expect(ready.missing.some((m) => m.reasonCode === "NO_TOOLS_WL")).toBe(true);
  });

  it("发布快照：深拷贝，草稿改动不影响已发布版", () => {
    const scene = makeScene();
    const release = publishScene(scene, 1);

    // 草稿修改后，manifest 保持不变
    scene.title = "改标题";
    scene.capabilities.push("new_cap");

    expect(release.manifest.title).toBe("部署数据库");
    expect(release.manifest.capabilities).toEqual(["sql_exec", "file_transfer"]);
    expect(release.version).toBe(1);
    expect(JSON.parse(release.manifestJson).title).toBe("部署数据库");
  });

  it("validateForm：required 槽位缺失 → 报 missing", () => {
    const scene = makeScene({
      formFields: [
        { name: "target_host", type: "string", required: true },
        { name: "rollback", type: "boolean", required: false },
      ],
    });
    expect(validateForm(scene, { target_host: "10.0.0.1" }).ok).toBe(true);
    const bad = validateForm(scene, { rollback: true });
    expect(bad.ok).toBe(false);
    expect(bad.missing).toEqual(["target_host"]);
  });
});