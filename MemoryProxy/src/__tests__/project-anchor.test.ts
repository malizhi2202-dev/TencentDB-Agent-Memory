import { describe, expect, it } from "vitest";
import {
  resolveProjectAnchor,
  type AnchorableProject,
} from "../session/project-anchor.js";

const P1: AnchorableProject = {
  project_id: "prj_1",
  repo_url: "https://github.com/acme/platform.git",
  git_repo_urls: JSON.stringify([
    "https://github.com/acme/platform.git",
    "git@github.com:acme/platform-web.git",
  ]),
  path_globs: JSON.stringify(["/workspace/acme/**"]),
};

const P2: AnchorableProject = {
  project_id: "prj_2",
  repo_url: null,
  git_repo_urls: "[]",
  path_globs: JSON.stringify(["/home/dev/data-*"]),
};

const PROJECTS = [P1, P2];

describe("resolveProjectAnchor", () => {
  it("显式声明优先级最高：member 项目直接命中", () => {
    expect(resolveProjectAnchor({ explicitProjectId: "prj_1" }, PROJECTS)).toEqual(["prj_1"]);
  });

  it("显式声明非 member 项目 → 空（宁可少给）", () => {
    expect(resolveProjectAnchor({ explicitProjectId: "prj_unknown" }, PROJECTS)).toEqual([]);
  });

  it("git remote 命中主 repo（忽略 .git / 协议差异）", () => {
    expect(
      resolveProjectAnchor({ gitRemote: "git@github.com:acme/platform.git" }, PROJECTS),
    ).toEqual(["prj_1"]);
  });

  it("git remote 命中 git_repo_urls 里的多 repo 之一", () => {
    expect(
      resolveProjectAnchor({ gitRemote: "https://github.com/acme/platform-web" }, PROJECTS),
    ).toEqual(["prj_1"]);
  });

  it("git remote 匹配不到任何 project → 空（不猜测）", () => {
    expect(
      resolveProjectAnchor({ gitRemote: "https://github.com/elsewhere/x" }, PROJECTS),
    ).toEqual([]);
  });

  it("路径 glob 命中（** 任意深度）", () => {
    expect(
      resolveProjectAnchor({ cwdPath: "/workspace/acme/sub/project" }, PROJECTS),
    ).toEqual(["prj_1"]);
  });

  it("路径 glob 命中（* 单段）", () => {
    expect(
      resolveProjectAnchor({ cwdPath: "/home/dev/data-mart" }, PROJECTS),
    ).toEqual(["prj_2"]);
  });

  it("路径 glob 匹配不到 → 空", () => {
    expect(
      resolveProjectAnchor({ cwdPath: "/tmp/random" }, PROJECTS),
    ).toEqual([]);
  });

  it("显式声明优先于 git remote", () => {
    expect(
      resolveProjectAnchor(
        { explicitProjectId: "prj_2", gitRemote: "https://github.com/acme/platform" },
        PROJECTS,
      ),
    ).toEqual(["prj_2"]);
  });

  it("git remote 优先于 path glob", () => {
    expect(
      resolveProjectAnchor(
        { gitRemote: "https://github.com/acme/platform", cwdPath: "/home/dev/data-x" },
        PROJECTS,
      ),
    ).toEqual(["prj_1"]);
  });

  it("无信号 → 全部 member project 兜底", () => {
    expect(resolveProjectAnchor({}, PROJECTS)).toEqual(["prj_1", "prj_2"]);
  });

  it("空 projects → 空", () => {
    expect(resolveProjectAnchor({}, [])).toEqual([]);
  });
});
