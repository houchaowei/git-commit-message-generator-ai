#!/usr/bin/env node

import fs from 'fs';
import path from 'path';
import crypto from 'crypto';
import { fileURLToPath } from 'url';
import { dirname } from 'path';
import inquirer from 'inquirer';
import dotenv from 'dotenv';

// 加载环境变量
const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const envPath = path.resolve(process.cwd(), '.env');

if (fs.existsSync(envPath)) {
  dotenv.config();
} else {
  // 如果当前目录没有.env文件，尝试从全局配置加载
  const homeDir = process.env.HOME || process.env.USERPROFILE;
  const globalEnvPath = path.join(homeDir, '.gcm-config');
  
  if (fs.existsSync(globalEnvPath)) {
    dotenv.config({ path: globalEnvPath });
  }
}

// 有道翻译API配置
const YOUDAO_API_URL = 'https://openapi.youdao.com/api';
const APP_KEY = process.env.YOUDAO_APP_KEY;
const APP_SECRET = process.env.YOUDAO_APP_SECRET;

// 检查API密钥是否存在
if (!APP_KEY || !APP_SECRET) {
  console.error('错误: 未找到有道翻译API密钥。请设置环境变量 YOUDAO_APP_KEY 和 YOUDAO_APP_SECRET');
  console.error('您可以在项目根目录创建.env文件或在用户目录创建.gcm-config文件，添加以下内容:');
  console.error('YOUDAO_APP_KEY=您的应用ID');
  console.error('YOUDAO_APP_SECRET=您的应用密钥');
  process.exit(1);
}

// 生成随机数
function generateSalt() {
  return Math.floor(Math.random() * 10000).toString();
}

// 生成签名
function generateSign(query, salt, curtime) {
  const str = APP_KEY + truncate(query) + salt + curtime + APP_SECRET;
  return crypto.createHash('sha256').update(str).digest('hex');
}

// 截取字符串
function truncate(q) {
  const len = q.length;
  return len <= 20 ? q : q.substring(0, 10) + len + q.substring(len - 10, len);
}

// 发送翻译请求
async function translate(text, from = 'auto', to = 'zh-CHS') {
  const salt = generateSalt();
  const curtime = Math.floor(Date.now() / 1000).toString();
  const sign = generateSign(text, salt, curtime);
  
  const params = new URLSearchParams({
    q: text,
    from,
    to,
    appKey: APP_KEY,
    salt,
    sign,
    signType: 'v3',
    curtime
  });
  
  try {
    const response = await fetch(`${YOUDAO_API_URL}?${params.toString()}`);
    const data = await response.json();
    
    if (data.errorCode === '0') {
      return data.translation[0];
    } else {
      console.error(`翻译错误: ${data.errorCode}`);
      return null;
    }
  } catch (error) {
    console.error('翻译请求失败:', error.message);
    return null;
  }
}

// 主函数
async function main() {
  // 获取命令行参数
  const args = process.argv.slice(2);
  let text = args.join(' ');
  let from = 'auto';
  let to = 'zh-CHS';
  
  // 如果没有提供文本，则交互式询问
  if (!text) {
    const answers = await inquirer.prompt([
      {
        type: 'input',
        name: 'text',
        message: '请输入要翻译的文本:',
        validate: input => input.trim() !== '' ? true : '请输入文本'
      },
      {
        type: 'list',
        name: 'direction',
        message: '请选择翻译方向:',
        choices: [
          { name: '自动检测 → 中文', value: { from: 'auto', to: 'zh-CHS' } },
          { name: '中文 → 英文', value: { from: 'zh-CHS', to: 'en' } },
          { name: '英文 → 中文', value: { from: 'en', to: 'zh-CHS' } },
          { name: '日文 → 中文', value: { from: 'ja', to: 'zh-CHS' } },
          { name: '韩文 → 中文', value: { from: 'ko', to: 'zh-CHS' } }
        ]
      }
    ]);
    
    text = answers.text;
    from = answers.direction.from;
    to = answers.direction.to;
  }
  
  console.log('正在翻译...');
  const result = await translate(text, from, to);
  
  if (result) {
    console.log('\n原文:', text);
    console.log('译文:', result);
  }
}

// 执行主函数
main().catch(error => {
  console.error('程序执行错误:', error);
  process.exit(1);
}); 