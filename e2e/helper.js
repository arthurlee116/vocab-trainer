#!/usr/bin/env node

/**
 * E2E测试工具脚本
 * 提供测试执行、报告生成、环境管理等辅助功能
 */

const { execSync } = require('child_process');
const fs = require('fs');
const path = require('path');

const CONFIG = {
  REPORT_DIR: 'e2e-results',
  TEST_FILES: [
    'auth.spec.ts',
    'practice-flow.spec.ts', 
    'error-handling.spec.ts',
    'responsive.spec.ts',
    'performance.spec.ts',
    'landing.spec.ts'
  ]
};

class E2EHelper {
  constructor() {
    this.ensureReportDir();
  }

  /**
   * 确保报告目录存在
   */
  ensureReportDir() {
    if (!fs.existsSync(CONFIG.REPORT_DIR)) {
      fs.mkdirSync(CONFIG.REPORT_DIR, { recursive: true });
    }
  }

  /**
   * 清理旧的测试结果
   */
  cleanResults() {
    console.log('🧹 清理旧测试结果...');
    if (fs.existsSync(CONFIG.REPORT_DIR)) {
      fs.rmSync(CONFIG.REPORT_DIR, { recursive: true, force: true });
    }
    this.ensureReportDir();
    console.log('✅ 清理完成');
  }

  /**
   * 安装Playwright浏览器
   */
  installBrowsers() {
    console.log('🌐 安装Playwright浏览器...');
    try {
      execSync('npx playwright install --with-deps', { stdio: 'inherit' });
      console.log('✅ 浏览器安装完成');
    } catch (error) {
      console.error('❌ 浏览器安装失败:', error.message);
      process.exit(1);
    }
  }

  /**
   * 运行所有测试
   */
  runAllTests(options = {}) {
    const { browser = 'chromium', headed = false, debug = false } = options;
    
    console.log(`🧪 运行E2E测试 (浏览器: ${browser})...`);
    
    const args = [
      'npx', 'playwright', 'test',
      '--project=' + browser,
      '--reporter=html,list',
      '--output-dir=' + CONFIG.REPORT_DIR
    ];

    if (headed) args.push('--headed');
    if (debug) args.push('--debug');

    try {
      execSync(args.join(' '), { stdio: 'inherit' });
      console.log('✅ 测试执行完成');
    } catch (error) {
      console.error('❌ 测试执行失败:', error.message);
      process.exit(1);
    }
  }

  /**
   * 运行特定测试文件
   */
  runTestFile(testFile, options = {}) {
    const { browser = 'chromium', headed = false } = options;
    
    if (!CONFIG.TEST_FILES.includes(testFile)) {
      console.error(`❌ 未知的测试文件: ${testFile}`);
      console.log('可用测试文件:', CONFIG.TEST_FILES.join(', '));
      process.exit(1);
    }

    console.log(`🧪 运行测试文件: ${testFile}...`);
    
    const args = [
      'npx', 'playwright', 'test', testFile,
      '--project=' + browser,
      '--reporter=html,list',
      '--output-dir=' + CONFIG.REPORT_DIR
    ];

    if (headed) args.push('--headed');

    try {
      execSync(args.join(' '), { stdio: 'inherit' });
      console.log('✅ 测试执行完成');
    } catch (error) {
      console.error('❌ 测试执行失败:', error.message);
      process.exit(1);
    }
  }

  /**
   * 生成测试报告
   */
  generateReport() {
    console.log('📊 生成测试报告...');
    
    const reportPath = path.join(CONFIG.REPORT_DIR, 'html-report', 'index.html');
    
    if (fs.existsSync(reportPath)) {
      console.log(`📱 报告已生成: file://${path.resolve(reportPath)}`);
      
      // 尝试打开报告
      const start = process.platform === 'darwin' ? 'open' : 
                   process.platform === 'win32' ? 'start' : 'xdg-open';
      
      try {
        execSync(`${start} "${reportPath}"`, { stdio: 'ignore' });
      } catch (error) {
        console.log('请手动打开报告:', reportPath);
      }
    } else {
      console.log('❌ 未找到测试报告，请先运行测试');
    }
  }

  /**
   * 检查测试环境
   */
  checkEnvironment() {
    console.log('🔍 检查测试环境...');
    
    // 检查Node.js版本
    const nodeVersion = process.version;
    console.log(`Node.js版本: ${nodeVersion}`);
    
    // 检查依赖
    try {
      const packageJson = JSON.parse(fs.readFileSync('package.json', 'utf8'));
      const playwrightVersion = packageJson.devDependencies['@playwright/test'];
      console.log(`Playwright版本: ${playwrightVersion}`);
    } catch (error) {
      console.log('❌ 无法读取package.json');
    }
    
    // 检查端口占用
    try {
      execSync('lsof -ti:5173', { stdio: 'ignore' });
      console.log('⚠️  端口5173被占用');
    } catch (error) {
      console.log('✅ 端口5173可用');
    }
    
    try {
      execSync('lsof -ti:4000', { stdio: 'ignore' });
      console.log('⚠️  端口4000被占用');
    } catch (error) {
      console.log('✅ 端口4000可用');
    }
    
    console.log('🔍 环境检查完成');
  }

  /**
   * 启动开发服务器
   */
  startDevServer() {
    console.log('🚀 启动开发服务器...');
    
    try {
      // 检查服务器是否已运行
      execSync('curl -f http://localhost:5173', { stdio: 'ignore' });
      console.log('✅ 开发服务器已在运行');
    } catch (error) {
      console.log('启动开发服务器...');
      execSync('npm run dev', { stdio: 'inherit' });
    }
  }

  /**
   * 显示帮助信息
   */
  showHelp() {
    console.log(`
🧪 E2E测试工具

用法: node e2e-helper.js [命令] [选项]

命令:
  clean              清理测试结果
  install            安装Playwright浏览器
  run [options]     运行所有测试
  test <file>        运行特定测试文件
  report             生成并显示测试报告
  check              检查测试环境
  start              启动开发服务器
  help               显示帮助信息

选项:
  --browser <name>   指定浏览器 (chromium, firefox, webkit)
  --headed           显示浏览器界面
  --debug            调试模式

示例:
  node e2e-helper.js run --browser firefox --headed
  node e2e-helper.js test auth.spec.ts --browser chromium
  node e2e-helper.js clean && node e2e-helper.js run
  node e2e-helper.js report

可用测试文件:
${CONFIG.TEST_FILES.map(f => `  - ${f}`).join('\n')}
    `);
  }
}

// 主程序
function main() {
  const helper = new E2EHelper();
  const args = process.argv.slice(2);
  
  if (args.length === 0) {
    helper.showHelp();
    return;
  }

  const command = args[0];
  const options = {};
  
  // 解析选项
  for (let i = 1; i < args.length; i++) {
    if (args[i] === '--browser' && i + 1 < args.length) {
      options.browser = args[i + 1];
      i++;
    } else if (args[i] === '--headed') {
      options.headed = true;
    } else if (args[i] === '--debug') {
      options.debug = true;
    }
  }

  switch (command) {
    case 'clean':
      helper.cleanResults();
      break;
      
    case 'install':
      helper.installBrowsers();
      break;
      
    case 'run':
      helper.runAllTests(options);
      break;
      
    case 'test':
      const testFile = args[1];
      if (!testFile) {
        console.error('❌ 请指定测试文件');
        process.exit(1);
      }
      helper.runTestFile(testFile, options);
      break;
      
    case 'report':
      helper.generateReport();
      break;
      
    case 'check':
      helper.checkEnvironment();
      break;
      
    case 'start':
      helper.startDevServer();
      break;
      
    case 'help':
      helper.showHelp();
      break;
      
    default:
      console.error(`❌ 未知命令: ${command}`);
      helper.showHelp();
      process.exit(1);
  }
}

// 运行主程序
if (require.main === module) {
  main();
}

module.exports = E2EHelper;