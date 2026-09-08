import { describe, it, expect } from "vitest";
import { feedbackToAction, isUserExplicitSignal } from "./feedback.js";

describe("feedback — 反馈信号 → 动作（P1.2）", () => {
  it("correction/confirmation/contradiction/explicit_forget 是用户显式信号", () => {
    expect(isUserExplicitSignal("correction")).toBe(true);
    expect(isUserExplicitSignal("confirmation")).toBe(true);
    expect(isUserExplicitSignal("contradiction")).toBe(true);
    expect(isUserExplicitSignal("explicit_forget")).toBe(true);
    expect(isUserExplicitSignal("disregard")).toBe(false);
  });

  it("correction → update；confirmation → reinforce；explicit_forget → archive", () => {
    expect(feedbackToAction("correction", "user_explicit", { writePolicy: "automatic" }).action).toBe("update");
    expect(feedbackToAction("confirmation", "user_explicit", { writePolicy: "automatic" }).action).toBe("reinforce");
    expect(feedbackToAction("explicit_forget", "user_explicit", { writePolicy: "automatic" }).action).toBe("archive");
  });

  it("disregard（隐式降权）→ downgrade；但 explicit_only 不可降权", () => {
    expect(feedbackToAction("disregard", "system_implicit", { writePolicy: "automatic" }).action).toBe("downgrade");
    const guarded = feedbackToAction("disregard", "system_implicit", { writePolicy: "explicit_only" });
    expect(guarded.action).toBe("keep");
    expect(guarded.reason).toContain("explicit_only");
  });

  it("contradiction：用户显式可 update（纠正），隐式只 keep（待裁决）", () => {
    expect(feedbackToAction("contradiction", "user_explicit", { writePolicy: "automatic" }).action).toBe("update");
    expect(feedbackToAction("contradiction", "system_implicit", { writePolicy: "automatic" }).action).toBe("keep");
  });

  it("用户显式信号可作用于 explicit_only 持久更改", () => {
    expect(feedbackToAction("correction", "user_explicit", { writePolicy: "explicit_only" }).action).toBe("update");
    expect(feedbackToAction("explicit_forget", "user_explicit", { writePolicy: "explicit_only" }).action).toBe("archive");
  });
});