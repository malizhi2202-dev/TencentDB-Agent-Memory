/**
 * TaskCreateDialog — 「新建 Task」弹窗。
 *
 * 必填字段（前端校验）：
 *   - title         任务标题
 *   - description   任务描述
 *
 * 关于 team 归属：
 *   不再让用户在 dialog 里选 team。team 由右上角全局 TeamSwitcher 决定，
 *   这里只 readonly 展示「将创建到 team：name (team_id)」，避免出现「右上角是 A
 *   但弹窗里默认选了 B、用户没注意一切就走偏」的两套上下文不一致问题。
 *
