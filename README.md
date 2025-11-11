# Vocabulary Helper (Vue 3 + Vite)

一个轻量、纯前端的背单词与定时复习工具。支持多词库切换、渐进式复习调度、局部与整场复习、方向键与动画切换，所有数据均保存在浏览器 `localStorage`，无需后端。

## ✨ 功能特性

1. 多词库选择：内置 `IELTS 词库 (ielts.json)`, `IELTS 扩展 (ielts_vocabulary.json)`, 示例小词库。
2. 动态加载与转换：大型词库以原始 JSON 保留，运行时按需加载并映射到统一的 `Word` 类型。
3. 导航与动画：左右方向键切换单词，带平滑滑动过渡（前进/后退方向不同动画）。
4. 分块复习：每 5 分钟将本时间段看过的单词推入复习队列。
5. 整场复习：累计可见学习时间达到 30 分钟后，自动收集本场全部已见单词进行一次全面复习，结束后触发会话收尾。
6. 长期调度：会话结束时为所有已学习单词安排 2 天与 7 天后的复习（下次进入自动加入到期队列）。
7. 可见性计时：仅在页面可见 (`document.visibilityState === 'visible'`) 时累计学习秒数，切出标签页暂停。
8. 状态持久化：队列 / 历史 / 已见日志 / 计划复习 / 当前词库都会保存以便刷新后恢复。

## 📦 技术栈

Vue 3 + `<script setup>`、Pinia、Vite、TypeScript。

## 🚀 启动开发

```powershell
npm install
npm run dev
```

访问终端输出的本地地址即可。

生产构建：

```powershell
npm run build
```

预览构建产物：

```powershell
npm run preview
```

## 🗂 词库结构与映射

内部统一的 `Word` 类型 (`src/types.ts`):

```ts
export type Word = {
  id: string
  term: string
  phonetic?: string
  audio?: string
  meaning: string
  examples?: string[]
}
```

IELTS 原始条目字段（来自 `ielts*.json`）包含：`word`, `phonetic`, `translation`, `definition`, `example`。加载时：
- `term` ← `word`
- `meaning` ← 优先 `translation`，若空则用 `definition`
- `examples` ← 将 `example` 以换行分割 (若存在)
- `id` ← `term#index`（保证稳定检索与历史回溯）

示例词库已是接近目标结构，只做最小规范化处理。

加载逻辑见 `src/data/libraries.ts`：通过 `?url` 仅获取静态资源路径，避免在构建时把大 JSON 内联进 bundle。

## 🔁 会话与复习策略

时间参数（默认）：
- 分块大小：5 分钟（`blockSizeSec = 300`）
- 整场时长：30 分钟（`totalSessionSec = 1800`）

流程：
1. 初始化：加载已到期的计划复习条目插入 `dueNow` 队列。
2. 导航：`next()` 消费队列头部并记录 `seen`；`prev()` 通过历史索引回退（内容正确性由独立 `baseWords` 保证）。
3. 分块复习：每完成一个 5 分钟块，将该块内新出现的 `seen` 单词追加进 `reviewQueue`。
4. 整场复习：达到 30 分钟后，把整场所有已见单词补齐进入 `reviewQueue`（去重）。
5. 会话结束：所有队列清空后，为已见单词添加 2d / 7d 的 `ScheduledReview`。

## 🧠 关键文件

| 文件 | 说明 |
|------|------|
| `src/stores/session.ts` | 状态与复习调度核心，支持多词库切换与历史回溯修复。 |
| `src/data/libraries.ts` | 词库元数据与加载、字段映射。 |
| `src/components/WordCard.vue` | 单词展示组件与发音。 |
| `src/App.vue` | 布局、导航、动画与库选择。 |

## 🎯 已修复问题

- 上一个单词不刷新内容：通过维护 `baseWords`（不可变原列表）并用历史 `id` 解析，避免因队列 shift 导致回退时找不到正确条目。
- 支持切换词库时重置会话并持久化选择。

## 🖱 使用技巧

- 左右方向键快速切换；切换方向动态选择向左 / 向右滑动动画。
- 下拉框更换词库会重置当前会话计时与队列，不影响已计划的未来复习。

## 🧪 测试与验证

构建通过后可在浏览器中：
1. 加载默认 `IELTS` 词库。
2. 使用右方向键浏览多个词条，再按左键验证回退内容正确。
3. 切换到示例词库观察会话复位与新词展示。
4. 保持页面激活 5 分钟以上并继续浏览，查看复习队列数增加。

## 📌 后续可扩展

- 引入搜索与快速定位功能。
- 添加音频资源（若未来词库含发音文件 URL）。
- 增加自定义分块时长与整场时长设置界面。
- 接入 IndexedDB 以支持更大规模离线数据与增量更新。

## ⚖️ 许可

（根据你的需要补充 License 信息）

---
如需新增词库：在 `src/data` 放入 JSON，并在 `libraries.ts` 中添加条目及映射策略即可。
