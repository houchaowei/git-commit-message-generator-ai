# Git Commit Message Generator MCP Service

基于 MCP（Model Context Protocol）协议的 Git Commit Message 生成工具，可以根据 git diff 的内容自动生成规范的 commit message。

## 特性

- 🤖 基于 AI 自动分析代码变更
- 📝 生成符合规范的 commit message
- 🔄 支持 Flow 工作流格式（Flow-XXXXX）
- 🔧 提供完整的 git 操作工具
- 🚀 基于 MCP 协议，可与各种 AI 助手集成

## 安装

```bash
npm install
```

## 环境配置

创建 `.env` 文件并配置以下环境变量：

```env
OPENAI_API_KEY=your_openai_api_key
BASE_URL=https://api.openai.com
MODEL=gpt-3.5-turbo
```

## 使用方式

### 作为 MCP 服务运行

1. 启动 MCP 服务：
```bash
npm start
```

2. 在支持 MCP 的 AI 助手中配置此服务

### 可用工具

#### 1. generate_commit_message
根据 git diff 或新增文件生成规范的 commit message

参数：
- `flowId` (必需): Flow ID，格式如 `Flow-22914`
- `workingDirectory` (可选): Git 仓库的工作目录路径

示例：
```json
{
  "flowId": "Flow-22914",
  "workingDirectory": "/path/to/your/project"
}
```

#### 2. analyze_git_changes
分析当前 git 仓库的变更情况

参数：
- `workingDirectory` (可选): Git 仓库的工作目录路径

#### 3. execute_git_commit
执行 git commit 操作

参数：
- `message` (必需): Commit message 内容
- `workingDirectory` (可选): Git 仓库的工作目录路径
- `addAll` (可选): 是否执行 git add .，默认为 true

#### 4. execute_git_push
执行 git push 操作

参数：
- `workingDirectory` (可选): Git 仓库的工作目录路径

## Commit Message 规范

### 基本格式
```
<type>(<Flow-XXXXX>): <简洁的变更描述>

- <详细变更点1>
- <详细变更点2>
- <详细变更点3>
- <变更影响和意义总结>
```

### 类型说明
- `feat`: 新增功能
- `fix`: 修复问题
- `refactor`: 重构代码
- `style`: 代码格式调整
- `chore`: 构建过程或辅助工具的变动
- `docs`: 文档变更
- `test`: 测试相关变更
- `perf`: 性能优化

### 示例

#### 功能新增
```
feat(Flow-22914): 优化门店切换时优惠券数据刷新机制

- 在addressList组件中添加对selectShop.deptId的监听，实现门店变化时自动刷新优惠券数据
- 通过ref引用menuCoupon组件，调用refreshCouponData方法清除单例缓存
- 保持现有单例优化逻辑不变，仅在门店真正变化时触发数据刷新
- 提升用户体验，确保门店切换后优惠券信息的准确性
```

#### 问题修复
```
fix(Flow-23456): 修复购物车数量更新时的状态同步问题

- 解决了购物车组件在数量变更时状态不同步的问题
- 优化了购物车数据更新的时序处理逻辑
- 修复了并发更新导致的数据不一致问题
- 确保购物车状态在各个组件间的正确同步
```

## MCP 客户端配置

### Claude Desktop
在 Claude Desktop 的配置文件中添加：

```json
{
  "mcpServers": {
    "git-commit-generator": {
      "command": "node",
      "args": ["/path/to/your/project/src/mcp.js"],
      "env": {
        "OPENAI_API_KEY": "your_api_key",
        "BASE_URL": "https://api.openai.com",
        "MODEL": "gpt-3.5-turbo"
      }
    }
  }
}
```

### 其他 MCP 客户端
参考各客户端的文档进行配置。

## 开发

### 构建
```bash
npm run build
```

### 发布
```bash
npm run pub
```

## 技术栈

- Node.js (>=18.0.0)
- MCP SDK
- OpenAI API
- ES Modules

## 许可证

ISC License