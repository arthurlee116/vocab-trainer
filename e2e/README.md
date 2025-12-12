# E2E测试配置和最佳实践

## 测试执行策略

### 本地开发测试
```bash
# 安装浏览器
npm run test:e2e:install

# 运行所有测试
npm run test:e2e

# 运行特定测试文件
npm run test:e2e -- auth.spec.ts

# 调试模式运行
npm run test:e2e:debug

# 带界面运行
npm run test:e2e:headed

# UI交互模式
npm run test:e2e:ui
```

### CI/CD测试执行
- **并行执行**: 使用sharding策略，3个shard并行运行
- **多浏览器**: Chromium, Firefox, WebKit
- **超时控制**: 单个测试30分钟，整体工作流45分钟
- **失败重试**: CI环境下自动重试2次

## 测试报告

### 本地报告
```bash
# 查看HTML报告
npm run test:e2e:report

# 报告位置
open e2e-results/html-report/index.html
```

### CI报告
- **GitHub集成**: 自动在PR中评论测试结果
- **Artifacts**: 上传详细的HTML报告和截图
- **趋势分析**: 保存测试结果用于性能趋势分析

## Mock策略

### API Mock覆盖
- **认证API**: `/api/auth/*`
- **VLM API**: `/api/vlm/extract`
- **生成API**: `/api/generation/*`
- **分析API**: `/api/analysis/report`
- **历史API**: `/api/history/*`

### 测试数据管理
- **标准词汇**: 8个基础英文单词
- **动态生成**: 根据需要生成随机词汇
- **难度级别**: beginner, intermediate, advanced
- **题目类型**: 选择题、填空题、判断题

## 性能基准

### 页面加载时间
- **首页**: < 3秒
- **Dashboard**: < 2秒
- **上传页面**: < 2秒
- **答题页面**: < 3秒

### 交互响应时间
- **按钮点击**: < 200ms
- **表单输入**: < 500ms
- **页面切换**: < 1秒

### 资源使用
- **内存增长**: < 50%
- **布局偏移**: < 0.1
- **帧率**: > 30fps

## 错误处理覆盖

### 网络异常
- API请求失败
- 网络超时
- 服务器错误(5xx)
- 网络中断恢复

### 文件处理
- 不支持的格式
- 文件过大
- 空文件
- 损坏文件

### 用户体验
- 并发操作
- 页面刷新
- 数据持久化
- 状态恢复

## 响应式测试覆盖

### 设备类型
- **桌面端**: 1200x800
- **平板端**: iPad Pro (1024x1366)
- **手机端**: iPhone 12 (390x844)
- **小屏幕**: iPhone SE (320x568)

### 测试场景
- **横屏模式**: 800x600
- **高DPI屏幕**: 2x像素密度
- **字体缩放**: 系统字体大小调整
- **触摸交互**: 移动设备手势

## 维护指南

### 添加新测试
1. 在对应spec.ts文件中添加测试用例
2. 使用Page Object Model进行页面交互
3. 添加必要的Mock API
4. 更新测试数据（如需要）
5. 本地验证测试通过

### 更新Mock数据
1. 修改 `e2e/test-data/mock-data.json`
2. 更新 `e2e/helpers/mockDataManager.ts`
3. 确保Mock数据与真实API结构一致

### 性能监控
1. 定期检查测试执行时间
2. 监控内存使用趋势
3. 优化慢速测试用例
4. 更新性能基准值

## 故障排除

### 常见问题
1. **测试超时**: 检查网络连接和API响应
2. **元素不可见**: 验证页面加载完成状态
3. **Mock失败**: 确认路由匹配规则
4. **浏览器兼容**: 检查CSS和JS兼容性

### 调试技巧
```bash
# 调试特定测试
npx playwright test --debug auth.spec.ts

# 查看详细日志
DEBUG=pw:api npx playwright test

# 生成代码生成器
npx playwright codegen
```

## 持续改进

### 测试覆盖率目标
- **功能覆盖**: 100%关键用户流程
- **设备覆盖**: 主要浏览器和设备
- **场景覆盖**: 正常、异常、边界情况

### 质量指标
- **通过率**: > 95%
- **执行时间**: < 10分钟
- **稳定性**: CI环境无间歇性失败