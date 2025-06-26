# generator-commit-message

基于 AI 的 Git Commit Message 生成工具，可以根据 git diff 的内容自动生成规范的 commit message。

## 特性

- 🤖 基于 AI 自动生成 commit message
- 📝 支持 Flow ID 格式规范
- 🔄 自动分析 git diff 变更
- 📋 自动复制到剪贴板
- ⚡️ 快速且易用

## 安装

```bash
npm install -g generator-commit-message
```

## 使用方法

1. 在你的项目目录下，当有未提交的变更时，运行：

```bash
npx gcmsg flow-xxxx
```

例如：
```bash
npx gcmsg flow-22914
```

2. 工具会自动：
   - 分析当前的 git diff 变更
   - 生成符合规范的 commit message
   - 将生成的内容复制到剪贴板

## 环境变量配置

工具需要配置以下环境变量：

1. 在项目根目录创建 `.env` 文件：

```bash
# .env
OPENAI_API_KEY=your_api_key_here
BASE_URL=your_api_base_url_here  # 例如：https://api.chatanywhere.tech
```

2. 或者直接设置环境变量：

```bash
export OPENAI_API_KEY=your_api_key_here
export BASE_URL=your_api_base_url_here
```

## Commit Message 格式

生成的 commit message 将遵循以下格式：

```
type(flow-xxxx): 简短的变更描述

- 详细变更点1
- 详细变更点2
- 详细变更点3
- 变更影响和意义总结
```

其中 type 可能是：
- `feat`: 新功能
- `fix`: 修复问题
- `docs`: 文档变更
- `style`: 代码格式调整
- `refactor`: 代码重构
- `test`: 测试相关
- `chore`: 构建过程或辅助工具的变动

## 要求

- Node.js >= 18.0.0
- Git 仓库环境

## 常见问题

1. **环境变量未设置**
   - 确保已正确设置 `OPENAI_API_KEY` 和 `BASE_URL`
   - 检查 `.env` 文件是否在正确的位置

2. **生成失败**
   - 确保当前目录是 git 仓库
   - 确保有未提交的变更（git diff 不为空）

## License

ISC

## 作者

chaowei.hou