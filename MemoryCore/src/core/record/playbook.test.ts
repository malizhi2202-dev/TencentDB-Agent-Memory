import { describe, it, expect } from "vitest";
import { assemblePlaybook, groupKeyForWorkMemory, type WorkMemory } from "./playbook.js";

function wm(id: string, type: WorkMemory["type"], content: string, extra: Partial<WorkMemory> = {}): WorkMemory {
  return { id, type, content, priority: 50, ...extra };
}

describe("playbook — 沉淀链 + 可复用固化（P1.3）", () => {
  it("task + method + artifact 齐全 → confidence 1.0，可复用", () => {
    const pb = assemblePlaybook(
      wm("t1", "work_task", "部署数据库到生产"),
      [wm("m1", "work_method", "备份现有数据"), wm("m2", "work_method", "执行迁移脚本")],
      [wm("a1", "work_artifact", "部署日志 artifact.log")],
    );
    expect(pb.confidence).toBe(1.0);
    expect(pb.reusable).toBe(true);
    expect(pb.steps).toEqual(["备份现有数据", "执行迁移脚本"]);
    expect(pb.artifacts).toEqual(["部署日志 artifact.log"]);
    expect(pb.name).toBe("部署数据库到生产");
  });

  it("缺 artifact → confidence 0.65 以下仍可复用（有步骤）", () => {
    const pb = assemblePlaybook(
      wm("t1", "work_task", "部署数据库"),
      [wm("m1", "work_method", "执行迁移脚本")],
      [],
    );
    expect(pb.confidence).toBeCloseTo(0.7);
    expect(pb.reusable).toBe(true); // 0.7 >= 0.6
  });

  it("无 task（目标不明）→ confidence 封顶 0.5，不可复用", () => {
    const pb = assemblePlaybook(
      undefined,
      [wm("m1", "work_method", "执行迁移脚本")],
      [wm("a1", "work_artifact", "日志")],
    );
    expect(pb.confidence).toBeCloseTo(0.5);
    expect(pb.reusable).toBe(false);
  });

  it("method 按 priority 降序（越重要越靠前）", () => {
    const pb = assemblePlaybook(
      wm("t1", "work_task", "任务"),
      [wm("m1", "work_method", "次要步骤", { priority: 10 }), wm("m2", "work_method", "关键步骤", { priority: 90 })],
      [],
    );
    expect(pb.steps).toEqual(["关键步骤", "次要步骤"]);
  });

  it("无 method 步骤 → 即使有 task+artifact 也不可复用（minSteps 不满足）", () => {
    const pb = assemblePlaybook(
      wm("t1", "work_task", "任务"),
      [],
      [wm("a1", "work_artifact", "产物")],
    );
    expect(pb.reusable).toBe(false); // steps.length 0 < minSteps 1
  });

  it("sourceIds 收录 task + method + artifact 全部来源", () => {
    const pb = assemblePlaybook(
      wm("t1", "work_task", "任务"),
      [wm("m1", "work_method", "步骤")],
      [wm("a1", "work_artifact", "产物")],
    );
    expect(new Set(pb.sourceIds)).toEqual(new Set(["t1", "m1", "a1"]));
  });

  it("groupKeyForWorkMemory：有 taskId 用 taskId，否则 taskless:<type>", () => {
    expect(groupKeyForWorkMemory(wm("x", "work_method", "c", { taskId: "tk9" }))).toBe("tk9");
    expect(groupKeyForWorkMemory(wm("x", "work_method", "c"))).toBe("taskless:work_method");
  });
});