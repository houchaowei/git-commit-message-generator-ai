#!/usr/bin/env node
import { execSync } from 'child_process';
import fs from 'fs';
import path from 'path';
import dotenv from 'dotenv';
import os from 'os';
import inquirer from 'inquirer';

dotenv.config();

const { OPENAI_API_KEY, BASE_URL } = process.env;

// 获取命令行参数
const [, , flowId] = process.argv;
if (!flowId) {
    console.log('请传入参数: npx gcmsg <flow-xxxx>');
    process.exit(1);
}

// 检查是否为 git 仓库
const currentDir = process.cwd();
if (!fs.existsSync(path.join(currentDir, '.git'))) {
    console.log('当前目录不是 git 仓库，请在 git 项目目录下运行。');
    process.exit(1);
}

// 执行命令的包装函数
function execCommand(command, options = {
    encoding: 'utf8',
    maxBuffer: 1024 * 1024 * 10, // 10MB buffer
    stdio: 'pipe'
}) {
    try {
        const defaultOptions = {
            encoding: 'utf8',
            maxBuffer: 1024 * 1024 * 10, // 10MB buffer
            stdio: 'pipe'
        };
        return execSync(command, { ...defaultOptions, ...options });
    } catch (error) {
        if (error.stderr) {
            console.error(`命令执行错误: ${error.stderr.toString()}`);
        }
        throw error;
    }
}

// 通用处理函数：AI 生成、复制、commit、push
async function generateCommitMessageAndHandle({ prompt, aiContent }) {
    if (!OPENAI_API_KEY) {
        console.log('请设置 OPENAI_API_KEY 环境变量');
        process.exit(1);
    }
    const message = prompt + '\n' + aiContent;
    const response = await fetch(`${BASE_URL}/v1/chat/completions`, {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${OPENAI_API_KEY}`
        },
        body: JSON.stringify({
            model: process.env.MODEL,
            messages: [{ role: 'user', content: message }],
            temperature: 0.7
        })
    });
    const data = await response.json();
    if (!data.choices || !data.choices[0]) {
        console.log('API 响应格式错误:', data);
        process.exit(1);
    }
    const commitMessage = data.choices[0].message.content;
    console.log('\n生成的 commit message:\n');
    console.log(commitMessage);
    // 复制到剪贴板
    try {
        const tempFile = path.join(os.tmpdir(), `.temp_commit_msg_${Date.now()}`);
        fs.writeFileSync(tempFile, commitMessage, 'utf8');
        execCommand(`cat "${tempFile}" | pbcopy`);
        fs.unlinkSync(tempFile);
        console.log('\n✅ 已复制到剪贴板！');
    } catch (copyError) {
        console.log('\n❌ 复制到剪贴板失败:', copyError.message);
    }
    // 询问是否 commit
    const isCommit = await inquirer.prompt([
        {
            type: 'confirm',
            name: 'isCommit',
            message: '是否执行 commit？(default no)',
            default: false,
        }
    ]);
    if (!isCommit.isCommit) {
        console.log('❌ 用户选择不执行 commit');
        process.exit(0);
    }
    // 执行 git add 和 commit
    console.log('\n执行 git add...');
    execCommand('git add .');
    console.log('✅ git add 成功！');
    console.log('\n执行 git commit...');
    execCommand(`git commit -m "${commitMessage.replace(/"/g, '\"')}"`);
    console.log('✅ commit 成功！');
    // 询问是否 push
    const isPush = await inquirer.prompt([
        {
            type: 'confirm',
            name: 'isPush',
            message: '是否执行 git push？(default no)',
            default: false,
        }
    ]);
    if (!isPush.isPush) {
        console.log('❌ 用户选择不执行 git push');
        process.exit(0);
    }
    execCommand('git push');
    console.log('✅ push 成功！');
}

// 主流程重构
async function main() {
    try {
        // 获取 git diff 变更
        const gitDiff = execCommand('git diff');
        // 执行 git status 获取当前分支的文件列表
        const gitStatus = execCommand('git status');
        // 优化文件过滤，支持 new file: 和 Untracked files: 两种格式
        const statusLines = gitStatus.split('\n');
        let inUntracked = false;
        const newFiles = [];
        for (let line of statusLines) {
            line = line.trimEnd();
            if (line.trim().startsWith('new file:')) {
                newFiles.push(line.replace('new file:', '').trim());
            } else if (line.trim().startsWith('Untracked files:')) {
                inUntracked = true;
            } else if (inUntracked) {
                if (line.startsWith('\t') && line.trim() && !line.includes('use "git add')) {
                    newFiles.push(line.trim());
                } else if (!line.trim()) {
                    inUntracked = false;
                }
            }
        }
        if (gitDiff.trim() !== '') {
            // 有 diff，走变更分析
            const prompt = `根据以下 git diff 变更，生成一个 git commit 信息，只需要返回文字和换行符，不需要返回其他的字符，需要包含：\n1. 变更修改的内容\n2. 变更修改的原因\n\n按照以下格式返回（使用实际的 flowId: ${flowId}）：\nfix(${flowId}): 修复xxx问题\n\n    - 详细变更点1\n    - 详细变更点2\n    - 详细变更点3\n    - 变更影响和意义总结\n`;
            await generateCommitMessageAndHandle({ prompt, aiContent: gitDiff });
        } else if (newFiles.length > 0) {
            // 有新增文件，走新增分析
            let filesContent = '';
            for (const file of newFiles) {
                try {
                    const content = fs.readFileSync(path.join(currentDir, file), 'utf8');
                    const lines = content.split('\n');
                    let displayContent = content;
                    if (lines.length > 400) {
                        displayContent = lines.slice(0, 200).join('\n') + '\n...\n' + lines.slice(-200).join('\n');
                    }
                    filesContent += `文件: ${file}\n内容:\n${displayContent}\n\n`;
                } catch (e) {
                    filesContent += `文件: ${file}\n读取失败: ${e.message}\n\n`;
                }
            }
            const prompt = `根据以下新增文件的代码内容，生成一个 git commit 信息，只需要返回文字和换行符，不需要返回其他的字符，需要包含：\n1. 新增了哪些文件及其主要功能\n2. 新增的业务或技术价值\n\n按照以下格式返回（使用实际的 flowId: ${flowId}）：\nfeat(${flowId}): 新增xxx功能\n\n    - 新增了xxx文件，实现了xxx功能\n    - 主要逻辑说明\n    - 业务或技术价值总结\n`;
            await generateCommitMessageAndHandle({ prompt, aiContent: filesContent });
        } else {
            console.log('当前分支没有新增文件，也没有未提交的变更。');
            process.exit(0);
        }
    } catch (err) {
        console.error('\n❌ 错误详情:');
        if (err.stderr) {
            console.error(err.stderr.toString());
        }
        if (err.message.includes('git')) {
            console.log('获取 git diff 失败，请确认该目录为 git 仓库。');
        } else if (err.message.includes('fetch')) {
            console.log('API 调用失败:', err.message);
        } else {
            console.log('发生错误:', err.message);
        }
        process.exit(1);
    }
}

// 运行主函数
main().catch(err => {
    console.error('程序执行失败:', err);
    process.exit(1);
});

