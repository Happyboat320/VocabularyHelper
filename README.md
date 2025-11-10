# Vocabulary Helper (Vue 3 + Vite)

本地网页形式的背单词工具，支持：
- 方向键导航（左：上一个，右：下一个）
- 每 5 分钟复习当段学习过的单词
- 每 30 分钟复习本次会话学过的所有单词，复习完结束会话
- 记录并计划两天、七天后的再次复习（下次打开优先过期复习）
- 按页面可见时间计时，关闭/切出时不计时
- 本地持久化 localStorage

## 运行方式

```powershell
npm install
npm run dev
```

浏览器打开开发服务器地址即可。

## 替换词库
- 文件：`src/data/vocab.example.json`
- 结构：
```json
[
  {
    "id": "w1",
    "term": "abandon",
    "phonetic": "əˈbændən",
    "meaning": "to leave...",
    "examples": ["They had to abandon the car."]
  }
]
```

## 说明
- 仅在页面可见时累计计时；每过 5 分钟触发本段复习；到 30 分钟触发整场复习，复习完会话结束。
- 会话结束时为本场学过的每个单词安排 2 天和 7 天后的复习。
- 每次启动优先显示已到期的复习队列，其次是进行中的 5 分钟/30 分钟复习队列，最后才是新词。
