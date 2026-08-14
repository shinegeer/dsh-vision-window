# dsh-vision-window（DSH 识图插件）

在 DeepSeek Harness（DSH）网页端输入框旁，加一个**可拖动的图片存储框**：粘贴 / 拖入 / 选择截图，点「识别并发送」把截图存到工作区、并把图片路径自动插到你输入文字的前面一起发送。之后 AI 会**自动调用 `vision` 工具识图**，并把结果整理到工作区的 **`已识别图片`** 文件夹（配 markdown 描述）。

> 适用于主模型是纯文本模型、本身读不了图片的场景。识图由你配置的**任意 OpenAI 兼容视觉模型**完成——插件自带 `vision` 工具和识图技能，**完全自包含**，别人装完填三行就能用。

---

## 特性

- 📎 输入框旁一个「识图」按钮，点开一个**像输入框一样**的图片存储框（不是文件选择框）。
- 🖼️ 支持**粘贴（Ctrl+V）**、**拖入**、**点击「选择图片」**三种方式加入截图；自动保存到当前工作区的 `pasted_images\` 目录。
- 📤 「识别并发送」= **保存图片 + 把图片路径插到你输入文字最前面 + 一起发送**（输入框不被污染）。
- 🤖 插件自带 **`vision` 工具**：AI 在长工程里也能随时自己调 `vision(路径)` 识图，不只是图片框。
- 📁 插件自带**识图技能**：AI 识图成功后自动建 **`已识别图片`** 文件夹，整理图片 + 写对应 markdown 结果。
- ⚙️ 浮窗内**配置面板**：填接口地址、密钥、模型名，密钥只存本地、不会回传浏览器。
- 🔌 支持三种 OpenAI 兼容接口：**Chat Completions** / **Responses** / **Completions**。
- 🌐 中英双语界面 + 双语识图提示词。
- 📍 浮窗默认**贴着输入框左端**，可拖动。

---

## 安装（一键）

要求：已安装 [DSH](https://github.com/deepseek-ai/deepseek-harness)（`dsh` 命令可用）、[pnpm](https://pnpm.io/)、Node ≥ 18。

### 方式 A：从 GitHub 安装（推荐）

```bash
dsh plugin --profile web add github:shinegeer/dsh-vision-window
```

### 方式 B：从 npm 安装（发布后）

```bash
dsh plugin --profile web add <你的包名>
```

### 方式 C：从本地 tarball / 目录安装

```bash
# 在插件源码目录里打包
npm pack
# 得到 dsh-external-dsh-client-ui-vision-window-1.0.0.tgz

# 安装
dsh plugin --profile web add ./dsh-external-dsh-client-ui-vision-window-1.0.0.tgz
# 或直接从源码目录安装
dsh plugin --profile web add file:C:/path/to/vision-window
```

安装完成后**重启** `dsh web` 生效（插件在服务启动时装载，仅刷新网页不够）：

```bash
dsh web
```

> 本插件无需构建步骤，`dsh plugin add github:...` 安装后直接可用（不会触发 pnpm 的 `prepare`/`allowBuilds` 提示）。

---

## 配置

1. 点输入框旁的 **「识图」** 按钮，打开图片存储框。
2. 点浮窗右上角的 **⚙** 齿轮，展开配置面板。
3. 填写下面字段，点 **「测试连接」** 验证，再点 **「保存」**。

这些配置同时决定 **`vision` 工具**（AI 自动识图）和图片框所用的识图模型。

| 字段 | 说明 | 示例 |
|---|---|---|
| 接口地址 baseURL | 视觉模型的 HTTP 地址，**需包含版本段 `/v1`** | `https://api.openai.com/v1`、`https://dashscope.aliyuncs.com/compatible-mode/v1` |
| 密钥 API Key | 以 `Authorization: Bearer <key>` 发送；留空表示不修改已存密钥 | `sk-…` |
| 模型名 model | 该地址下**支持图片输入**的模型 | `gpt-4o-mini`、`qwen-vl-max`、`mimo-v2.5` |
| 接口类型 | 见下表，默认 `chat`（兼容最广） | `chat` / `responses` / `completions` |
| maxTokens（可选） | 单次识图**输出**上限；**留空 = 不发送该字段**，交给模型用自身默认输出上限（最兼容，推荐） | `128000` 等，或留空 |
| 语言 Language | 插件界面 + 识图提示词/输出语言；`zh`=中文、`en`=英文 | `zh` / `en` |

### 三种接口类型

| 值 | 接口 | 说明 |
|---|---|---|
| `chat` | `POST {baseURL}/chat/completions` | **默认，兼容最广**，绝大多数视觉模型/中转网关都支持 |
| `responses` | `POST {baseURL}/responses` | OpenAI 新一代统一接口，部分网关只支持这一种 |
| `completions` | `POST {baseURL}/completions` | 旧版纯文本补全接口，**不支持图片输入**，仅用于「测试连接」 |

- 大多数情况选 `chat` 即可。
- 如果「测试连接」返回 **404 / 405**，先检查地址是否含 `/v1`，再尝试切换接口类型。
- `completions` 接口不能识图，请换回 `chat` 或 `responses`。

### 配置存到哪里

`<DSH 主目录>/paste-image/config.json`（Windows 默认 `C:\Users\<你>\.dsh\paste-image\config.json`），文件权限 `0600`。密钥只存本地，`get-config` 仅回传「是否已设置密钥」，不会把密钥明文发回浏览器。

---

## 使用

1. 点 **「识图」** → 在图片存储框里 **粘贴截图**（Ctrl+V），或把图片**拖入**框内，或点 **「选择图片」**。
2. 图片保存成功后显示缩略图（可点 × 移除）。
3. 在**聊天输入框**里正常输入你想说的话（可选）。
4. 点 **「识别并发送」** → 插件把 `识别图片 <路径>`（多图换行列表）插到你输入文字最前面，一起发给主模型。
5. 主模型（纯文本）读到路径 → 按技能调用 **`vision` 工具**识图 → 拿到描述 → 按技能把结果整理进 **`已识别图片\`** 文件夹（图片 + `NN_主题词.md` 描述文件）。

> 长工程里，你也可以直接给 AI 一个图片路径、贴一张附件、或说「识别工作区里的图片」——AI 都会自己调 `vision` 识图，并整理到 `已识别图片` 文件夹。

---

## 支持的视觉模型

任何 **OpenAI 兼容、支持图片输入（image input）** 的模型都能用，例如：

- OpenAI：`gpt-4o-mini`、`gpt-4o`、`gpt-4.1` …
- 阿里云百炼（DashScope）：`qwen-vl-max`、`qwen-vl-plus` …
- 各类中转网关 / 自建 vLLM / OneAPI / New API 等 OpenAI 兼容服务

---

## 常见问题（FAQ）

| 现象 | 原因 / 解决 |
|---|---|
| 点「识图」没反应 | 重启 `dsh web`（插件代码改动后需重启，仅刷新网页不够） |
| 测试连接返回 401 / 403 | 密钥错误或无权限，重新核对密钥 |
| 测试连接返回 404 / 405 | 地址错（是否漏了 `/v1`）或接口类型选错，切换 `chat`/`responses` 重试 |
| AI 没自动调 `vision` 识图 | 确认已配置模型；确认消息里有图片路径/附件；或重启 `dsh web` 让技能生效 |
| `vision` 报「尚未配置识图模型」 | 进 ⚙ 填地址/密钥/模型名并保存 |
| 识别提示「模型不支持图片」 | 换一个声明支持 image 输入的模型名 |
| 识别超时 | 默认 60s 超时；检查网络/代理 |
| 图片没保存到工作区 | 看当前会话工作目录是否有 `pasted_images\`；超 20MiB 或非 png/jpg/webp/gif 会被拒绝 |
| 密钥安全吗 | 密钥只写在本地 `config.json`（0600），RPC 全程 loopback，不经过浏览器回显 |
| 改动代码后不生效 | 重启 `dsh web` |

---

## 目录结构与原理

```
dsh-vision-window/
├── package.json          # 包元信息、bundle 声明（dsh.bundle.patch + dsh.client）
├── cordis.patch.yml      # 把宿主半插入 web profile 的插件清单
├── lib/
│   ├── index.js          # 宿主半：写图 RPC + 配置存取 + vision 工具 + 识图技能
│   └── client.js         # 浏览器半：图片存储框 UI + 配置面板 + 发送
├── README.md
└── LICENSE
```

- **宿主半（`lib/index.js`）**：
  - 注册 loopback-only 的 `/paste-image` RPC：`save` / `get-config` / `set-config` / `test-vision`；
  - 用 `ctx.tools.register` 注册 **`vision` 工具**（AI 可随时调用），用配置的模型 + Node 原生 `fetch` 识图（硬超时 60s）；
  - 用 `ctx.skills.register` 注册 **识图技能**（教 AI 何时调 `vision`、以及「已识别图片」文件夹整理规则）。
- **浏览器半（`lib/client.js`）**：通过 `conversation.input.right` 槽位注入「识图」按钮，浮窗用 `ReactDOM.createPortal` 渲染，`[data-composer-card]` 作为定位锚点。
- **数据流**：粘贴 → `save` 写盘 → 点「识别并发送」→ 发 `识别图片 <路径>` → 主模型按技能调 `vision` 工具 → 直连识图 → 整理到 `已识别图片` 文件夹。

---

## 开发

```bash
npm run check      # 语法检查（node --check 两个 lib 文件）
npm pack           # 打包（prepack 会自动跑 check）
```

改动 `lib/*.js` / `cordis.patch.yml` 后需重启 `dsh web`。

**定位/尺寸微调**：见 `lib/client.js` 里 `measureComposer()`（横向 `- 260 - 12`、纵向 `vh - rect.bottom`）与 `.ui-paste-image-float` 的 `width:260px`。

**识图提示词 / 技能内容**：见 `lib/index.js` 里的 `visionPrompt()`、`SKILL_CONTENT`。

---

## License

[MIT](./LICENSE)
