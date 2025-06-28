# generator-commit-message

基于 AI 的 Git Commit Message 生成工具，可以根据 git diff 的内容自动生成规范的 commit message。

## ✨ 特性

- 🤖 **智能分析**：基于 AI 自动分析 git diff 和新增文件
- 📝 **规范格式**：支持 Flow ID 格式规范的 commit message 生成
- 🔄 **自动识别**：自动识别文件变更类型（修改/新增/删除）
- 📋 **便捷复制**：自动复制生成的 commit message 到剪贴板
- 🚀 **一站式操作**：支持交互式 git add、commit 和 push
- ⚡️ **快速易用**：一条命令完成从分析到提交的全流程

## 📦 安装

### 全局安装
```bash
npm install -g generator-commit-message
```

### 临时使用
```bash
npx generator-commit-message flow-xxxx
```

## 🚀 快速开始

### 1. 环境配置

在项目根目录创建 `.env` 文件并配置必要的环境变量：

```bash
# .env
OPENAI_API_KEY=your_api_key_here
BASE_URL=your_api_base_url_here
MODEL=gpt-3.5-turbo
```

或者直接设置环境变量：

```bash
export OPENAI_API_KEY=your_api_key_here
export BASE_URL=your_api_base_url_here
export MODEL=gpt-3.5-turbo
```

### 2. 使用方法

在你的 git 项目目录下，当有未提交的变更时：

```bash
# 使用全局安装的命令
gcm flow-22914

# 或使用 npx（无需全局安装）
npx gcm flow-22914
# 或者使用完整包名
npx generator-commit-message flow-22914
```

### 3. 工作流程

工具会自动执行以下步骤：

1. **检查环境**：验证当前目录是否为 git 仓库
2. **分析变更**：
   - 如果有 `git diff` 内容，分析代码变更
   - 如果有新增文件，分析文件内容和功能
3. **生成消息**：基于 AI 生成符合规范的 commit message
4. **复制到剪贴板**：自动复制生成的内容
5. **交互式操作**：
   - 询问是否执行 `git add . && git commit`
   - 询问是否执行 `git push`

## 📋 生成格式

工具生成的 commit message 遵循以下格式：

```
<type>(<flow-id>): <简短的变更描述>

- <详细变更点1>
- <详细变更点2>
- <详细变更点3>
- <变更影响和意义总结>
```

### Commit Type 说明

| Type | 说明 | 示例 |
|------|------|------|
| `feat` | 新功能 | feat(flow-22914): 新增用户登录功能 |
| `fix` | 修复问题 | fix(flow-22914): 修复购物车数量更新问题 |
| `docs` | 文档变更 | docs(flow-22914): 更新 API 使用文档 |
| `style` | 代码格式 | style(flow-22914): 统一代码缩进格式 |
| `refactor` | 代码重构 | refactor(flow-22914): 重构用户服务模块 |
| `perf` | 性能优化 | perf(flow-22914): 优化首页加载性能 |
| `test` | 测试相关 | test(flow-22914): 添加用户模块单元测试 |
| `chore` | 构建/工具 | chore(flow-22914): 更新构建脚本配置 |

## 🔧 环境变量详解

| 变量名 | 必需 | 说明 | 示例 |
|--------|------|------|------|
| `OPENAI_API_KEY` | ✅ | OpenAI API 密钥 | `sk-xxxxxxxxxxxx` |
| `BASE_URL` | ✅ | API 服务地址 | `https://api.openai.com` |
| `MODEL` | ✅ | 使用的 AI 模型 | `gpt-3.5-turbo` |

## 📋 系统要求

- **Node.js**: >= 18.0.0
- **Git**: 任意版本
- **操作系统**: macOS、Linux、Windows
- **网络**: 需要访问配置的 AI API 服务

## 💡 使用示例

### 代码修改场景
```bash
# 修改了现有文件后
$ gcmsg flow-22914

生成的 commit message:

fix(flow-22914): 修复购物车数量更新时的状态同步问题

- 解决了购物车组件在数量变更时状态不同步的问题
- 优化了购物车数据更新的时序处理逻辑
- 修复了并发更新导致的数据不一致问题
- 确保购物车状态在各个组件间的正确同步

✅ 已复制到剪贴板！
? 是否执行 commit？(default no) (y/N)
```

### 新增文件场景
```bash
# 添加了新文件后
$ gcmsg flow-22914

生成的 commit message:

feat(flow-22914): 新增用户权限管理模块

- 新增了 UserPermission.vue 组件，实现权限列表展示功能
- 添加了权限查询、编辑和删除的交互逻辑
- 集成了角色权限的动态配置功能
- 提升了系统的权限管理灵活性和用户体验

✅ 已复制到剪贴板！
? 是否执行 commit？(default no) (y/N)
```

## ❓ 常见问题

### Q: 提示"当前目录不是 git 仓库"
**A**: 确保在 git 项目的根目录或子目录中运行命令。

### Q: 提示"请设置 OPENAI_API_KEY 环境变量"
**A**: 检查 `.env` 文件是否存在且配置正确，或确保环境变量已正确设置。

### Q: API 调用失败
**A**: 
- 检查 `BASE_URL` 是否正确
- 确认 `OPENAI_API_KEY` 是否有效
- 检查网络连接是否正常

### Q: 没有生成 commit message
**A**: 确保工作目录中有未提交的变更（`git status` 显示有修改或新增的文件）。

### Q: 复制到剪贴板失败
**A**: 在 macOS 上需要 `pbcopy` 命令支持，该功能在其他操作系统上可能需要额外配置。

## 🔗 相关链接

- [语义化版本规范](https://semver.org/lang/zh-CN/)
- [约定式提交规范](https://www.conventionalcommits.org/zh-hans/)
- [OpenAI API 文档](https://platform.openai.com/docs/)

## 📄 许可证

ISC

## 👨‍💻 作者

**chaowei.hou** - [newweber@163.com](mailto:newweber@163.com)

---

如果这个工具对您有帮助，请给个 ⭐️ Star！