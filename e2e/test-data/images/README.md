# 测试图片说明

本目录包含用于E2E测试的图片文件。

## 文件列表

### valid-vocabulary.jpg
- **用途**: 正常的词汇表图片，包含清晰的英文单词
- **内容**: apple, banana, orange, grape, watermelon
- **尺寸**: 800x600px
- **格式**: JPEG

### blurry-vocabulary.jpg  
- **用途**: 模糊的词汇表图片，用于测试OCR容错性
- **内容**: 模糊的英文单词
- **尺寸**: 800x600px
- **格式**: JPEG

### large-vocabulary.jpg
- **用途**: 大尺寸词汇表图片，用于测试性能
- **内容**: 大量英文单词
- **尺寸**: 2000x1500px
- **格式**: JPEG

### invalid-file.txt
- **用途**: 无效文件格式，用于测试文件验证
- **内容**: 纯文本
- **格式**: TXT

### empty-image.jpg
- **用途**: 空白图片，用于测试空内容处理
- **内容**: 纯白色图片
- **尺寸**: 100x100px
- **格式**: JPEG

## 使用说明

1. 在实际测试中，需要准备真实的图片文件
2. 图片应该包含清晰的英文单词，便于OCR识别
3. 建议使用不同质量和尺寸的图片来测试各种场景
4. 可以使用在线工具生成测试图片

## Mock数据

如果无法准备真实图片文件，可以使用Mock数据来模拟API响应：

```typescript
import mockData from '../test-data/mock-data.json';

// Mock VLM响应
await page.route('**/api/vlm/extract', async (route) => {
  await route.fulfill({
    status: 200,
    contentType: 'application/json',
    body: JSON.stringify(mockData.vlm.success)
  });
});
```

## 注意事项

- 确保图片文件大小不超过上传限制
- 测试时注意文件路径的正确性
- 在CI环境中可能需要使用Mock数据代替真实文件