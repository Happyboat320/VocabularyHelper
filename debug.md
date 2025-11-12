# Debug: 释义换行符 `\n` 显示为文字的问题

问题现象：
- `ielts.json`/`ielts_vocabulary.json` 中的字段（如 translation/definition/example）包含 `\n` 作为换行。
- 在浏览器中渲染时，出现了字面量的 `\n` 被显示出来，而不是换成真正的换行。

根因分析：
- 源数据文件是 JSON 文本，其中为了表达换行，使用了转义形式 `\n`。
- 如果在加载映射过程中直接把字符串原样赋值而不做清理，有些条目会保留字面量反斜杠+字母 n。
- CSS 的 `white-space` 或分段渲染并不会把字面量 `\n` 自动转换为换行字符，需要在数据层进行规范化处理。

解决方案：
1) 在 `src/data/libraries.ts` 中增加 `normalizeText()`，对所有文本字段统一做：
   - `\r\n?` 标准化为 `\n`。
   - 将字面量的 `\\n` 替换为真实换行 `\n`。
2) IELTS 映射（`mapIelts`）与示例映射（`mapExample`）都调用 `normalizeText()`，并在需要时按 `\n` 切分。
3) 在 `WordCard.vue` 中不再直接显示一整段字符串，而是将 `meaning` 按 `\n` 分割为多行，逐段渲染成 `<p>` 列表，彻底规避了字面 `\n` 显示。

涉及文件：
- `src/data/libraries.ts`：增加 `normalizeText()`，对 translation/definition/example/meaning/examples 调用。
- `src/components/WordCard.vue`：`meaningLines` 计算属性基于 `\n` 切分并渲染。

验证方式：
- 运行开发环境，打开任意带有 `\n` 的释义，确认换行正确显示且不再出现 `\n` 字面量。
- 切换不同词库验证（IELTS 与示例），示例中的数组 `examples` 同样会被规范化。

附注：
- 即便未来引入其他词库，只要在进入前映射阶段调用 `normalizeText()`，即可保证换行一致性。
# Debug: 释义换行显示为 \n 的问题

## 现象
- 在单词卡中，释义本应分行显示，但部分词条显示了字面量的 `\n`，而不是换行。

## 根因分析
- 词库 `src/data/ielts*.json` 中的字段（例如 `translation`、`definition`、`example`）包含了换行标记。
- 数据来源中换行既可能是：
  1) JSON 转义后的真正换行（`\n` 在 JSON 解码后变成实际的换行字符），或
  2) 被双重转义为字面量两个字符 `\` 与 `n`（即“字面量 \n”）。
- 浏览器 `fetch(...).json()` 解析后，对于情况 (2) 会保留为字面量两字符，从而在 UI 渲染中仍显示 `\\n`。

## 解决方案
1. 在加载词库阶段进行统一归一化，将字面量 `\\n` 转换为真正的换行：
   - 修改文件 `src/data/libraries.ts`：新增 `normalizeText()`：
     - 将 `\r\n?` 归一化为 `\n`；
     - 将字面量 `\\n` 替换为真实 `\n`。
   - 在 `mapIelts()` 中对 `term / phonetic / translation / definition / example` 全量应用 `normalizeText()`。
2. 在展示阶段按 `\n` 切分并分段渲染：
   - 修改 `src/components/WordCard.vue`：将 `meaning` 拆分为 `meaningLines`（逐行 `<p>` 渲染）。
3. 适当加宽卡片，防止断行拥挤：
   - 提升卡片内边距与字号（已在 `WordCard.vue` 调整）。

## 涉及提交
- `src/data/libraries.ts`：新增 `normalizeText()` 并应用到映射流程。
- `src/components/WordCard.vue`：释义按行渲染；样式微调。

## 验证方式
- 运行开发环境后，打开含有多段释义/定义的词条，确认 `\n` 不再以字面量显示，而是分行呈现。
- 测试包含 `translation` 与仅有 `definition` 的不同词条，示例能正常换行。

## 备注
- 如果后续导入新的词库文件，也应复用该归一化流程，避免 UI 层重复处理异常文本。
