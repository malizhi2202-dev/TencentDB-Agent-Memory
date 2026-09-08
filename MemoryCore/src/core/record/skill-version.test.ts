import { describe, it, expect } from "vitest";
import { transitionSkillVersion, isSkillUsable, isSkillTerminal, skillLifecyclePath } from "./skill-version.js";
import type { SkillVersionEvent } from "./skill-version.js";

describe("skill-version — skill 版本生命周期（§5.3）", () => {
  it("完整发布链：draft → pending → published → evaluating → published", () => {
    expect(transitionSkillVersion("draft", "submit_review").next).toBe("pending");
    expect(transitionSkillVersion("pending", "approve").next).toBe("published");
    expect(transitionSkillVersion("published", "start_eval").next).toBe("evaluating");
    expect(transitionSkillVersion("evaluating", "pass_eval").next).toBe("published");
  });

  it("审核拒绝 → 回 draft（归属人裁决）", () => {
    expect(transitionSkillVersion("pending", "reject").next).toBe("draft");
  });

  it("发布后 supersede/rollback；评估失败 rollback", () => {
    expect(transitionSkillVersion("published", "supersede").next).toBe("superseded");
    expect(transitionSkillVersion("published", "rollback").next).toBe("rolled_back");
    expect(transitionSkillVersion("evaluating", "fail_eval").next).toBe("rolled_back");
  });

  it("非法转换拒绝（避免状态悬空）", () => {
    expect(transitionSkillVersion("draft", "publish" as never).allowed).toBe(false);
    expect(transitionSkillVersion("superseded", "rollback").allowed).toBe(false);
    expect(transitionSkillVersion("pending", "start_eval").allowed).toBe(false);
  });

  it("isSkillUsable：仅 published 可被调用", () => {
    expect(isSkillUsable("published")).toBe(true);
    expect(isSkillUsable("draft")).toBe(false);
    expect(isSkillUsable("evaluating")).toBe(false);
  });

  it("isSkillTerminal：superseded/rolled_back 终态", () => {
    expect(isSkillTerminal("superseded")).toBe(true);
    expect(isSkillTerminal("rolled_back")).toBe(true);
    expect(isSkillTerminal("published")).toBe(false);
  });

  it("skillLifecyclePath 是完整可达序列", () => {
    const path = skillLifecyclePath();
    for (let i = 0; i < path.length - 1; i++) {
      expect(transitionSkillVersion(path[i], eventFor(path[i], path[i + 1])).next).toBe(path[i + 1]);
    }
  });
});

function eventFor(from: string, to: string): SkillVersionEvent {
  const map: Record<string, SkillVersionEvent> = {
    "draft|pending": "submit_review",
    "pending|published": "approve",
    "published|evaluating": "start_eval",
    "evaluating|published": "pass_eval",
  };
  return map[`${from}|${to}`];
}