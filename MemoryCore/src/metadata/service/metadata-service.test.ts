import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { SqliteMetadataStore } from "../store/sqlite-adapter.js";
import { MetadataService } from "./metadata-service.js";
import { buildChatMemoryAssetId } from "../utils/chat-memory-asset.js";
import { mountSpacesForAgent } from "../../core/record/memory-space.js";

describe("addTeamMember 个人 Agent（agent_id = user_id）", () => {
  let store: SqliteMetadataStore;
  let svc: MetadataService;

  beforeEach(() => {
    store = new SqliteMetadataStore(":memory:");
    store.init();
    svc = new MetadataService(store);
  });

  afterEach(() => {
    store.close();
  });

  async function seed() {
    const owner = await svc.createNormalUser({ username: "owner" });
    const team = await svc.createTeam({ name: "T", owner_user_id: owner.user_id });
    const member = await svc.createNormalUser({ username: `bob-${Date.now()}-${Math.random().toString(36).slice(2, 6)}` });
    return { owner, team, member };
  }

  it("默认（不传 create_default_agent）创建个人 Agent，agent_id = user_id", async () => {
    const { team, member } = await seed();
    await svc.addTeamMember({ team_id: team.team_id, user_id: member.user_id });

    const agent = await svc.getAgentById(member.user_id);
    expect(agent).not.toBeNull();
    expect(agent!.agent_id).toBe(member.user_id);
    expect(agent!.owner_user_id).toBe(member.user_id);
  });

  it("个人 Agent 创建后 mint chat_memory 资产 chat_memory-{team}-{user_id}", async () => {
    const { team, member } = await seed();
    await svc.addTeamMember({ team_id: team.team_id, user_id: member.user_id });

    const asset = await svc.getAssetById(buildChatMemoryAssetId(team.team_id, member.user_id));
    expect(asset).not.toBeNull();
    expect(asset!.asset_type).toBe("chat_memory");
    expect(asset!.owner_user_id).toBe(member.user_id);
  });

  it("显式 create_default_agent=false 不建 agent", async () => {
    const { team, member } = await seed();
    await svc.addTeamMember({
      team_id: team.team_id,
      user_id: member.user_id,
      create_default_agent: false,
    });

    expect(await svc.getAgentById(member.user_id)).toBeNull();
  });

  it("同一 user 加入第二个 team 复用个人 agent + 补 mint 第二个 team 资产", async () => {
    const { owner, team, member } = await seed();
    await svc.addTeamMember({ team_id: team.team_id, user_id: member.user_id });

    const team2 = await svc.createTeam({ name: "T2", owner_user_id: owner.user_id });
    await svc.addTeamMember({ team_id: team2.team_id, user_id: member.user_id });

    // 复用同一 agent（agent_id 仍是 user_id，不重复创建）
    const agent = await svc.getAgentById(member.user_id);
    expect(agent).not.toBeNull();
    expect(agent!.agent_id).toBe(member.user_id);

    // 第一个 team 的资产仍在
    const asset1 = await svc.getAssetById(buildChatMemoryAssetId(team.team_id, member.user_id));
    expect(asset1).not.toBeNull();

    // 第二个 team 的资产也 mint 了（个人 agent 跨 team）
    const asset2 = await svc.getAssetById(buildChatMemoryAssetId(team2.team_id, member.user_id));
    expect(asset2).not.toBeNull();
    expect(asset2!.team_id).toBe(team2.team_id);
  });
});

describe("createAgent 自动挂载记忆空间（agent 创建时持久化挂载）", () => {
  let store: SqliteMetadataStore;
  let svc: MetadataService;

  beforeEach(() => {
    store = new SqliteMetadataStore(":memory:");
    store.init();
    svc = new MetadataService(store);
  });

  afterEach(() => {
    store.close();
  });

  it("createAgent 后按默认策略落库挂载空间（agent4 + team4 + user2 = 10）", async () => {
    const owner = await svc.createNormalUser({ username: "owner" });
    const team = await svc.createTeam({ name: "T", owner_user_id: owner.user_id });
    const agent = await svc.createAgent({
      team_id: team.team_id,
      owner_user_id: owner.user_id,
      name: "a1",
    });

    const spaces = await svc.getMountedSpaces(agent.agent_id);
    expect(spaces.length).toBe(10);

    const domains = new Set(spaces.map((s) => s.domain));
    expect(domains.has("episodic")).toBe(true); // agent 自有
    expect(domains.has("instruction")).toBe(true); // team 共享
    expect(domains.has("persona")).toBe(true); // user 个人
    // 全部是 default_mount 来源
    expect(spaces.every((s) => s.source === "default_mount")).toBe(true);
  });

  it("挂载空间与 mountSpacesForAgent 纯函数一致（space_id 确定性）", async () => {
    const owner = await svc.createNormalUser({ username: "owner" });
    const team = await svc.createTeam({ name: "T", owner_user_id: owner.user_id });
    const agent = await svc.createAgent({
      team_id: team.team_id,
      owner_user_id: owner.user_id,
      name: "a2",
    });

    const expected = mountSpacesForAgent(agent.agent_id, {
      teamId: team.team_id,
      userId: owner.user_id,
    });
    const persisted = await svc.getMountedSpaces(agent.agent_id);
    const persistedIds = new Set(persisted.map((s) => s.space_id));
    for (const s of expected) {
      expect(persistedIds.has(s.spaceId)).toBe(true);
    }
    expect(persisted.length).toBe(expected.length);
  });

  it("幂等：重复 mountDefaultSpaces 不产生重复记录", async () => {
    const owner = await svc.createNormalUser({ username: "owner" });
    const team = await svc.createTeam({ name: "T", owner_user_id: owner.user_id });
    const agent = await svc.createAgent({
      team_id: team.team_id,
      owner_user_id: owner.user_id,
      name: "a3",
    });

    await svc.mountDefaultSpaces(agent);
    await svc.mountDefaultSpaces(agent);
    expect((await svc.getMountedSpaces(agent.agent_id)).length).toBe(10);
  });

  it("挂 project 的 agent 额外挂载 project 空间（+2）", async () => {
    const owner = await svc.createNormalUser({ username: "owner" });
    const team = await svc.createTeam({ name: "T", owner_user_id: owner.user_id });
    const project = await store.createProject({
      team_id: team.team_id,
      owner_user_id: owner.user_id,
      name: "P1",
    });
    const agent = await svc.createAgent({
      team_id: team.team_id,
      owner_user_id: owner.user_id,
      project_id: project.project_id,
      name: "a4",
    });

    const spaces = await svc.getMountedSpaces(agent.agent_id);
    // agent 4 + team 4 + user 2 + project 2 = 12
    expect(spaces.length).toBe(12);
    const projectSpaces = spaces.filter((s) => s.owner_type === "project");
    expect(projectSpaces.length).toBe(2);
  });
});