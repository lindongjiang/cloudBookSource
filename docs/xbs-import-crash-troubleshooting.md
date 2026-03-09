# XBS 导入闪退排查（StandarReader 2.56.1）

## 结论

本次导入闪退并非 `xbs` 解密失败，而是客户端在解析书源 JSON 结构时发生类型错误。

- 崩溃关键信息：
  - `NSInvalidArgumentException`
  - `-[__NSArrayI allKeys]: unrecognized selector sent to instance`
- 解释：
  - 客户端把某字段当作字典读取（调用 `allKeys`），但实际收到的是数组（`NSArray`）。

## 触发根因

触发字段为 `bookWorld.categories` 的数组形态。例如：

```json
"bookWorld": {
  "actionID": "bookWorld",
  "categories": [
    { "id": "xuanhuan", "name": "玄幻小说" }
  ]
}
```

在 StandarReader 2.56.1（Mac Catalyst）中，这种结构会触发导入阶段崩溃。

## 兼容修复策略

1. `bookWorld.categories` 数组改为旧版稳定结构：`bookWorld.{分类名}` 字典。
2. `enable` 统一输出 `1/0`（不用 `true/false`）。
3. `responseFormatType` 统一小写：`html/json/xml/text`。
4. `requestInfo` 若为对象，转为：
   - 仅 `url` 时：直接字符串模板
   - 否则：`@js:return {...};`

## 项目内已落地实现

- 导出前规范化：`normalizeSourceForXbs`  
  [server.js](/Users/mantou/Documents/idea/3.5/server.js:2021)
- 上传校验规范化：`normalizeXiangseShuyuanPayload`  
  [server.js](/Users/mantou/Documents/idea/3.5/server.js:2282)
- `bookWorld.categories` 自动展开：`normalizeLegacyBookWorldStructure`  
  [server.js](/Users/mantou/Documents/idea/3.5/server.js:2655)

## 快速验证步骤

1. 导入“去掉 bookWorld”版（仅用于断因）。
2. 导入“bookWorld 字典展开”版（正式兼容版）。
3. 若 1 成功且 2 成功，说明根因就是 `categories` 数组结构。

## 经验规则（后续新增书源）

- 不要在香色导入产物里输出 `bookWorld.categories` 数组。
- 优先使用旧版可兼容的 `bookWorld.{分类名}` 字典写法。
- 新规则上线前，用 `xbs2json` 回读一次，确认最终结构不是数组。
