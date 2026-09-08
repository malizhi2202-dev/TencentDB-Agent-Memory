import { describe, it, expect } from "vitest";
import { redactSensitive, hasSensitive } from "./redaction.js";

describe("redaction — 记忆内容敏感信息脱敏（P2 治理）", () => {
  it("邮箱脱敏", () => {
    const r = redactSensitive("联系邮箱 user@example.com 用于登录");
    expect(r.redacted).toBe("联系邮箱 <EMAIL> 用于登录");
    expect(r.findings[0].kind).toBe("email");
  });

  it("手机号 + 身份证脱敏", () => {
    const r = redactSensitive("手机 13812345678，身份证 110101199001011234");
    expect(r.redacted).toContain("<PHONE>");
    expect(r.redacted).toContain("<ID_CARD>");
    expect(r.count).toBe(2);
  });

  it("API key / JWT 脱敏", () => {
    const api = redactSensitive("用 sk-abcdefghijklmnop1234567890 调用");
    expect(api.redacted).toContain("<API_KEY>");

    const jwt = redactSensitive("token=eyJhbGciOiJIUzI1NiJ9.eyJzdWIiOiIxIn0.abcdefghijklmnop");
    expect(jwt.redacted).toContain("<JWT>");
  });

  it("密码赋值脱敏（保留 key，掩码 value）", () => {
    const r = redactSensitive("password=mySecret123");
    expect(r.redacted).toContain("password=<REDACTED>");
    expect(r.redacted).not.toContain("mySecret123");
  });

  it("无敏感信息 → changed=false，原样返回", () => {
    const r = redactSensitive("这是一段普通的记忆内容");
    expect(r.changed).toBe(false);
    expect(r.redacted).toBe("这是一段普通的记忆内容");
    expect(r.count).toBe(0);
  });

  it("hasSensitive 快速判定", () => {
    expect(hasSensitive("邮箱 a@b.com")).toBe(true);
    expect(hasSensitive("手机 13900000000")).toBe(true);
    expect(hasSensitive("普通内容无敏感")).toBe(false);
  });

  it("空字符串安全", () => {
    expect(redactSensitive("").changed).toBe(false);
    expect(hasSensitive("")).toBe(false);
  });
});