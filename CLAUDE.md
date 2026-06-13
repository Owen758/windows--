# CLAUDE.md — 项目工作指引

## 项目概述

**历史粘贴板** — Windows 桌面剪贴板管理工具。自动记录用户复制的文字和图片，支持搜索、置顶、删除，可按设定天数自动清理过期内容。

## 标准文件路径

| 文档 | 路径 | 说明 |
|------|------|------|
| 需求文档 | [docs/requirements.md](docs/requirements.md) | 项目功能需求、交互方式、存储规则 |
| 技术规范 | [docs/tech-spec.md](docs/tech-spec.md) | 技术栈、架构设计、模块划分 |
| 设计规范 | [docs/design-spec.md](docs/design-spec.md) | UI 设计规范、主题、配色、布局 |
| 实施计划 | [docs/implementation-plan.md](docs/implementation-plan.md) | 分阶段开发步骤和里程碑 |

## 开发日志

- 位置：[devlog/](devlog/)
- 每次开发会话结束后，在 devlog 中创建 `YYYY-MM-DD.md` 文件
- 日志格式：完成事项 + 待办事项

## 工作约定

1. **分阶段推进** — 按实施计划逐阶段执行，一个阶段完成后复盘再进入下一阶段
2. **先问后做** — 遇到不确定的设计选择，先与用户确认
3. **保持简洁** — UI 和代码都遵循简洁原则，不过度设计
4. **文档先行** — 需求或设计变更时，先更新对应文档再编码
