import { describe, it, expect } from "vitest";
import { synthesizePlaybooks } from "./playbook-synthesis.js";
import type { WorkMemory } from "./playbook.js";

function wm(id: string, type: WorkMemory["type"], content: string, taskId?: string): WorkMemory {
  return { id, type, content, priority: 50, taskId };
}

describe("playbook-synthesis — 沉淀检测编排（P1.3）", () => {
  it("同一 taskId 的 task+method+artifact → 1 个可复用 playbook", () => {
    const { playbooks, skippedNoSteps } = synthesizePlaybooks([
      wm("t1", "work_task", "部署数据库到生产", "tk1"),
      wm("m1", "work_method", "备份现有数据", "tk1"),
      wm("m2", "work_method", "执行迁移脚本", "tk1"),
      wm("a1", "work_artifact", "部署日志", "tk1"),
    ]);
    expect(playbooks).toHaveLength(1);
    expect(playbooks[0].name).toBe("部署数据库到生产");
    expect(playbooks[0].steps).toHaveLength(2);
    expect(skippedNoSteps).toBe(0);
  });

  it("两个独立任务簇 → 2 个 playbook", () => {
    const { playbooks } = synthesizePlaybooks([
      wm("t1", "work_task", "任务A", "tk-A"),
      wm("m-a", "work_method", "A步骤", "tk-A"),
      wm("t2", "work_task", "任务B", "tk-B"),
      wm("m-b", "work_method", "B步骤", "tk-B"),
    ]);
    expect(playbooks).toHaveLength(2);
  });

  it("缺 method 的簇 → skippedNoSteps 计数，不产出 playbook", () => {
    const { playbooks, skippedNoSteps } = synthesizePlaybooks([
      wm("t1", "work_task", "只有任务没有步骤", "tk1"),
    ]);
    expect(playbooks).toHaveLength(0);
    expect(skippedNoSteps).toBe(1);
  });

  it("无 taskId 的 method 按 type 兜底分组（taskless:work_method 合并）", () => {
    const { playbooks } = synthesizePlaybooks([
      wm("m1", "work_method", "通用步骤甲"),
      wm("m2", "work_method", "通用步骤乙"),
    ]);
    // 同 type 兜底分组，有 method 但无 task + artifact → confidence 0.35 封顶 0.5 < 0.6，不可复用
    expect(playbooks).toHaveLength(0);
  });

  it("reusable=false 的簇不产出 playbook", () => {
    // 无 task（封顶 0.5 < 0.6）→ 不产出
    const { playbooks } = synthesizePlaybooks([
      wm("m1", "work_method", "一个方法"),
      wm("a1", "work_artifact", "一个产物"),
    ]);
    expect(playbooks).toHaveLength(0);
  });
});