# dsh-vision-window（DSH 识图插件）

在 DeepSeek Harness（DSH）网页端输入框旁，加一个**可拖动的图片存储框**：粘贴 / 拖入 / 选择截图，点「识别并发送」把截图存到工作区、并把图片路径自动插到你输入文字的前面一起发送。之后 AI 会**自动调用 `vision` 工具识图**，并把结果整理到工作区的 **`已识别图片`** 文件夹（配 markdown 描述）。

> 适用于主模型是纯文本模型、本身读不了图片的场景。识图模型可选内置预设（OpenCode Go / OpenCode Zen / 小米 MiMo）或任意 OpenAI 兼容视觉模型；**API Key 走 DSH 凭据体系**（插件配置里只有凭据引用名，绝不存 key）。Web 与 Headless 双端可用。

---

## 特性

- 📎 输入框旁一个「识图」按钮，点开一个**像输入框一样**的图片存储框（不是文件选择框）。
- 🖼️ 支持**粘贴（Ctrl+V）**、**拖入**、**点击「选择图片」**三种方式加入截图；自动保存到当前工作区的 `pasted_images\` 目录。
- 📤 「识别并发送」= **保存图片 + 把图片路径插到你输入文字最前面 + 一起发送**（输入框不被污染）。
- 🤖 插件自带 **`vision` 工具**：AI 在长工程里也能随时自己调 `vision(路径)` 识图，不只是图片框。
- 📁 插件自带**识图技能**：AI 识图成功后自动建 **`已识别图片`** 文件夹，整理图片 + 写对应 markdown 结果。
- 🧭 **模型预设下拉**：OpenCode Go（MiMo-V2.5）、OpenCode Zen（MiMo-V2.5-Free 免费）、小米 MiMo（MiMo-V2.5）、自定义。
- 🔁 **供应商自动降级**：主供应商失败时按顺序尝试备用供应商，429 尊重 Retry-After 退避，失败原因分类并给出建议。
- 💾 **答案缓存**：同一张图 + 同一问题不重复调用视觉模型（进程内 LRU+TTL）。
- 🔍 **调用前 downscale**：超过像素预算的大图自动缩小（sharp），省流量、省延迟。
- 🧠 **推理块剥离**：自动去掉 `<think>` / `<thinking>` / `<reasoning>` / `<|think|>` 等推理块，只留识别结果。
- 🖥️ **Headless 支持**：`dsh --profile headless` 下 `vision` 工具照常可用。
- 🔐 **DSH 凭据体系**：配置只存 `OPENCODE_API_KEY` / `XIAOMI_API_KEY` 之类的引用名，key 放 `~/.dsh/.credentials.yaml` 或环境变量，每次调用现解析。
- 🌐 中英双语界面 + 双语识图提示词。

---

## 安装（一键）

要求：已安装 [DSH](https://github.com/deepseek-ai/deepseek-harness)（`dsh` 命令可用）、[pnpm](https://pnpm.io/)、Node ≥ 20.9（sharp 0.35 要求）。

### Web

```bash
dsh plugin --profile web add github:shinegeer/dsh-vision-window
```

### Headless

```bash
dsh plugin --profile headless add github:shinegeer/dsh-vision-window
```

安装完成后**重启** `dsh web` 生效（插件在服务启动时装载，仅刷新网页不够）：

```bash
dsh web
```

> 本插件无需构建步骤，`dsh plugin add github:...` 安装后直接可用。sharp 是普通依赖，pnpm 会自动安装预编译二进制。

---

## 快速配置

1. 点输入框旁的 **「识图」** 按钮，打开图片存储框。
2. 点浮窗右上角的 **⚙** 齿轮，展开配置面板。
3. 在「模型预设」里选一个，勾选需要的「备用供应商」，点 **「保存」**。

### 模型预设

| 预设 | 接口地址 | 模型 | 凭据引用 |
|---|---|---|---|
| OpenCode Go | `https://opencode.ai/zen/go/v1` | `mimo-v2.5` | `OPENCODE_API_KEY` |
| OpenCode Zen（免费） | `https://opencode.ai/zen/v1` | `mimo-v2.5-free` | `OPENCODE_API_KEY` |
| 小米 MiMo | `https://api.xiaomimimo.com/v1` | `mimo-v2.5` | `XIAOMI_API_KEY` |
| 自定义 | 自己填 | 自己填 | 自己填 |

> ⚠️ OpenCode Go 的 `/zen/go/v1` 是未在 OpenCode Zen 官方文档列出的端点（models.dev 收录），请先用「测试连接」确认你的 key 可用。`mimo-v2.5-pro` / `mimo-v2-flash` **只支持文本**，不能做识图预设。

### 配置 DSH 凭据

在配置面板「新密钥值」里粘贴 key，点 **「保存凭据」**；或者直接编辑 `~/.dsh/.credentials.yaml`（`$DSH_HOME/.credentials.yaml`）：

```yaml
OPENCODE_API_KEY: sk-…
XIAOMI_API_KEY: sk-…
```

或用环境变量（`OPENCODE_API_KEY` / `XIAOMI_API_KEY`）。凭据**每次调用时现解析**，改完不用重启。配置面板只回显「已配置 / 来源」，绝不回传 key 明文。

### 降级链

- 「模型预设」= 主供应商；勾选「备用供应商」= 按显示顺序自动降级。
- 部分失败但降级成功时，识别结果末尾会带一行 `[vision-window 状态] …`；AI 写「已识别图片」md 时会自动跳过这一行。
- 全部失败时，`vision` 工具返回分类错误（auth / quota / rate / endpoint / server / timeout / network / credential-missing）和对应建议。

### 高级选项（⚙ 面板里可改）

| 选项 | 默认 | 说明 |
|---|---|---|
| downscale | 开 | 超过像素预算的图先缩小再上传 |
| downscaleMaxPixels | 4,000,000 | 像素预算（约 2000×2000） |
| 答案缓存 | 开 | 同图同问 1 小时内命中缓存；进程内，重启清空 |
| 缓存 TTL / 条数 | 3600s / 200 | 可调 |
| 剥离推理块 | 开 | 去掉 `<think>` 等推理输出 |
| 请求超时 | 60s | 单次视觉调用超时 |

---

## 使用

1. 点 **「识图」** → 在图片存储框里 **粘贴截图**（Ctrl+V），或把图片**拖入**框内，或点 **「选择图片」**。
2. 图片保存成功后显示缩略图（可点 × 移除）。
3. 在**聊天输入框**里正常输入你想说的话（可选）。
4. **最后，点击图片存储框里的「识别并发送」**（这一步最关键）→ 插件把 `识别图片 <路径>`（多图换行列表）插到你输入文字最前面，一起发给主模型。
5. 主模型（纯文本）读到路径 → 按技能调用 **`vision` 工具**识图 → 拿到描述 → 按技能把结果整理进 **`已识别图片\`** 文件夹（图片 + `NN_主题词.md` 描述文件）。

> ⚠️ **必须点击图片存储框里的「识别并发送」才会开始识图**：只粘贴 / 拖入图片、或只在输入框打字，都不会触发识图——图片路径要随这一步一起发出，AI 才会收到并调用 `vision`。

> 长工程里，你也可以直接给 AI 一个图片路径、贴一张附件、或说「识别工作区里的图片」——AI 都会自己调 `vision` 识图，并整理到 `已识别图片` 文件夹。

### Headless 用法

Headless 没有浮窗，配置写在 `~/.dsh/settings.yaml` 的 `vision-window` 段：

```yaml
vision-window:
  preset: opencode-zen          # opencode-go | opencode-zen | xiaomi-mimo | custom
  fallbacks:
    - xiaomi-mimo
  custom:                       # 仅 preset/fallbacks 用到 custom 时生效
    baseUrl: ""
    model: ""
    apiType: chat
    credential: MY_VISION_API_KEY
    maxTokens: 0
  language: zh
  downscale: true
  downscaleMaxPixels: 4000000
  cache: true
  cacheTtlSeconds: 3600
  cacheMaxEntries: 200
  stripThink: true
  timeoutMs: 60000
```

然后直接跑一次性任务：

```bash
dsh --profile headless "调用 vision 工具识别图片 C:\path\a.png，告诉我内容"
```

---

## 支持的视觉模型（自定义预设）

任何 **OpenAI 兼容、支持图片输入（image input）** 的模型都能用，例如：

- OpenAI：`gpt-4o-mini`、`gpt-4o`、`gpt-4.1` …
- 阿里云百炼（DashScope）：`qwen-vl-max`、`qwen-vl-plus` …
- 各类中转网关 / 自建 vLLM / OneAPI / New API 等 OpenAI 兼容服务

接口类型：`chat`（`/chat/completions`，默认）| `responses`（`/responses`）| `completions`（仅测试，不支持图片）。

---

## 配置存到哪里

- **插件配置**：`~/.dsh/settings.yaml` 的 `vision-window` 段（Web 面板保存的也是这里）。
- **API Key**：`~/.dsh/.credentials.yaml`（0600）或环境变量——插件配置里只有凭据名。
- **旧版迁移**：v1.0 的 `~/.dsh/paste-image/config.json` 会在首次启动时自动迁移（key 转入 DSH 凭据 `VISION_WINDOW_API_KEY`，配置转入 settings）。旧文件保留用于回滚，确认无碍后可以手动删除。

---

## 常见问题（FAQ）

| 现象 | 原因 / 解决 |
|---|---|
| 点「识图」没反应 | 重启 `dsh web`（插件代码改动后需重启，仅刷新网页不够） |
| 测试连接 401 / 403 | 凭据里的 key 错误或无权限，去 `.credentials.yaml` 核对 |
| 测试连接 404 / 405 | 自定义地址错（是否漏了 `/v1`）或接口类型选错 |
| 提示「凭据 XXX 未配置」 | 把 key 写进 `.credentials.yaml` 或环境变量，再点保存 |
| AI 没自动调 `vision` 识图 | 确认已保存配置；确认消息里有图片路径/附件；或重启 `dsh web` 让技能生效 |
| 识别提示「模型不支持图片」 | 换一个声明支持 image 输入的模型 |
| 识别超时 / 网络失败 | 在 ⚙ 里调大超时、检查网络/代理；或换备用供应商 |
| 大图识别慢 | 默认已自动 downscale 到 400 万像素内，可在 ⚙ 调预算 |
| 缓存了旧答案 | 缓存按「图片内容哈希 + 问题 + 供应商链」区分；换供应商链即失效，重启进程清空 |
| 识别结果里少了思考过程 | 这是特性：`<think>` / reasoning 块默认剥离，可在 ⚙ 关闭 |
| 旧 config.json 还在 | 迁移后保留作回滚备份；插件不再读它写入，可手动删 |

---

## 目录结构与原理

```
dsh-vision-window/
├── package.json          # 包元信息、bundle 声明、sharp/schemastery 依赖
├── cordis.patch.yml      # 把宿主半插入 profile 的插件清单（web/headless 通用）
├── lib/
│   ├── index.js          # 宿主半：settings/凭据/vision 工具/识图技能 + loopback RPC
│   └── client.js         # 浏览器半：图片存储框 UI + 预设配置面板 + 发送
├── tests/
│   ├── host.test.mjs     # 推理剥离/降级链/缓存/downscale/schema 单测
│   └── apply.test.mjs    # apply() 在 web/headless 两种服务形态下的装配测试
├── README.md
└── LICENSE
```

- **宿主半（`lib/index.js`）**：
  - `ctx.settings.register('vision-window', …)` 存配置（预设、降级链、缓存、downscale 等）；
  - `ctx.tools.register` 注册 **`vision` 工具**；识图走供应商链：失败自动降级，429 退避，错误分类，答案缓存，sharp downscale，推理剥离；
  - `ctx.skills.register` 注册 **识图技能**；
  - Web 专属：`ctx.inject(['connection'])` 注册 loopback-only 的 `/paste-image` RPC（`save` / `get-config` / `set-config` / `test-vision` / `set-credential` / `unset-credential` / `credential-info`）。Headless 没有 `connection`，该 fiber 不会激活，工具/技能/设置照常工作。
- **浏览器半（`lib/client.js`）**：`conversation.input.right` 槽位注入「识图」按钮；⚙ 面板 = 预设下拉 + 备用供应商 + DSH 凭据管理 + 高级选项。
- **数据流**：粘贴 → `save` 写盘 → 点「识别并发送」→ 发 `识别图片 <路径>` → 主模型按技能调 `vision` 工具 → 按供应商链识图 → 整理到 `已识别图片` 文件夹。

---

## 开发

```bash
npm run check      # 语法检查（node --check 两个 lib 文件）
npm test           # node --test（单测 + 双形态装配测试）
npm pack           # 打包（prepack 会自动跑 check）
```

改动 `lib/*.js` / `cordis.patch.yml` 后需重启 `dsh web`。

**定位/尺寸微调**：见 `lib/client.js` 里 `measureComposer()`（横向 `- 260 - 12`、纵向 `vh - rect.bottom`）与 `.ui-paste-image-float` 的 `width:260px`。

**识图提示词 / 技能内容**：见 `lib/index.js` 里的 `visionPrompt()`、`SKILL_CONTENT`；预设表在 `PRESET_DEFS`。

---

## 已知限制

- 答案缓存是**进程内存**（LRU+TTL），重启即清，不做跨进程共享。
- downscale 对 GIF 只取首帧（sharp 行为）。
- OpenCode Go 的 `/zen/go/v1` 端点未在 OpenCode 官方文档记载，以实际测试为准。
- 密钥安全依赖 DSH 凭据库的 0600 文件与操作系统的用户隔离；插件侧保证配置里只存引用名、不回传不打印 key。

---

## License

[MIT](./LICENSE)
