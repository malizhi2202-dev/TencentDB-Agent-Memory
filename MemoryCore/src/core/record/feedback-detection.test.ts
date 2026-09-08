import { describe, it, expect } from "vitest";
import { detectFeedbackSignal, hasFeedbackSignal } from "./feedback-detection.js";
import { feedbackToAction } from "./feedback.js";

describe("feedback-detection — 反馈信号检测（规则版，§4.2）", () => {
  it("遗忘 → explicit_forget（user_explicit）", () => {
    expect(detectFeedbackSignal("忘掉这条记忆")?.signal).toBe("explicit_forget");
    expect(detectFeedbackSignal("删除这条")!.source).toBe("user_explicit");
  });

  it("纠正 → correction；矛盾 → contradiction", () => {
    expect(detectFeedbackSignal("不对，应该是生产库")?.signal).toBe("correction");
    expect(detectFeedbackSignal("你之前说错了")?.signal).toBe("contradiction");
  });

  it("确认 → confirmation；忽略 → disregard（implicit）", () => {
    expect(detectFeedbackSignal("没错，就是这样")?.signal).toBe("confirmation");
    const d = detectFeedbackSignal("这个不相关，别扯");
    expect(d?.signal).toBe("disregard");
    expect(d?.source).toBe("system_implicit");
  });

  it("无反馈文本 → null", () => {
    expect(detectFeedbackSignal("今天天气不错")).toBeNull();
    expect(detectFeedbackSignal("")).toBeNull();
  });

  it("检测 + 动作 = 完整回路：纠正 → update", () => {
    const det = detectFeedbackSignal("不对，应该是生产库只读");
    const action = feedbackToAction(det!.signal, det!.source, { writePolicy: "automatic" });
    expect(action.action).toBe("update");
  });

  it("检测 + 动作：遗忘 explicit_only → archive（用户显式可归档持久更改）", () => {
    const det = detectFeedbackSignal("忘掉这个");
    const action = feedbackToAction(det!.signal, det!.source, { writePolicy: "explicit_only" });
    expect(action.action).toBe("archive");
  });

  it("hasFeedbackSignal 快速判定", () => {
    expect(hasFeedbackSignal("忘掉")).toBe(true);
    expect(hasFeedbackSignal("普通内容")).toBe(false);
  });
});