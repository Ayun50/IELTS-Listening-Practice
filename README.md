# 雅思听力高频单词听写

一个为雅思学生设计的浏览器听写工具，用来减少听力考试中因拼写错误造成的失分。无需注册，可部署到 GitHub Pages、Netlify、Vercel 或任何静态服务器。

## 本版本包含

- 剑桥雅思 21–4 词汇列表，根据听力答案词汇整理并人工排除选择题字母、电话号码、邮编和一次性人名
- 英美拼写、单复数和其他可接受形式通过 `variants` 字段统一处理
- 多词词组和不同长度变体的动态拼写框
- 首次作答正确率、计时、显示答案和一轮完成提示
- JSON 数据校验、重复项拦截和语音 API 降级处理

## 使用方法

1. 将 `index.html`、`style.css`、`script.js`、`words.json` 放在同一目录。
2. 不要直接双击用 `file://` 打开，因为浏览器通常会阻止 `fetch('words.json')`。
3. 在目录中启动静态服务器，例如：

```bash
python -m http.server 8000
```

4. 浏览器打开 `http://localhost:8000`。

## JSON 格式

```json
{
  "word": "colour",
  "translation": "n. 颜色",
  "tip": "the appearance produced by reflected light",
  "variants": ["colour", "color"]
}
```

`caseSensitive: true` 仅用于星期、月份、语言、国家或大洲等需要大写的项目。

## 项目结构

```text
.
├── index.html
├── style.css
├── script.js
├── words.json
└── README.md
```

MIT License. Designed & Developed by Jimmy Wu © 2025.
