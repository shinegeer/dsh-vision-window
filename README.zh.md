<p align="center">
  <img src="assets/vision-window-demo.png" width="100%" alt="dsh-vision-window：DSH Web 输入框旁的悬浮图片存储框" />
</p>

<h1 align="center">dsh-vision-window</h1>

<p align="center"><strong>贴一张图、点一个按钮，纯文本的 DeepSeek Harness 智能体就能“看见”它——另外附赠 7 个零配置本地像素 / OCR 工具。</strong></p>

<p align="center">一个自包含的 DSH bundle 插件：Web 输入框旁可拖动的图片存储框、<code>vision</code> 工具、<code>vision-fallback</code> 识图技能，以及 7 个不需要供应商、不需要密钥、不需要 Python 的 <code>vw_*</code> 本地工具。</p>

<p align="center">
  <a href="https://github.com/shinegeer/dsh-vision-window/releases/tag/v1.2.0"><img src="https://img.shields.io/badge/release-v1.2.0-5B4CF0?style=flat-square" alt="Release v1.2.0" /></a>
  <img src="https://img.shields.io/badge/verified-23%20tests-2EA44F?style=flat-square" alt="Verified: 23 tests" />
  <a href="LICENSE"><img src="https://img.shields.io/badge/license-MIT-2EA44F?style=flat-square" alt="License: MIT" /></a>
  <a href="package.json"><img src="https://img.shields.io/badge/Node.js-%3E%3D20.9-339933?style=flat-square&amp;logo=nodedotjs&amp;logoColor=white" alt="Node.js >=20.9" /></a>
  <img src="https://img.shields.io/badge/runtime-no%20Python-8A2BE2?style=flat-square" alt="No Python" />
  <img src="https://img.shields.io/badge/DSH-Web%20%2B%20Headless-5B4CF0?style=flat-square" alt="DSH Web + Headless" />
</p>

<p align="center"><a href="README.md">English</a> · 中文</p>

## 为什么需要它

DeepSeek Harness 经常由纯文本模型驱动：往聊天框直接贴图会被拦下，主模型本身也没有图片通道。旧的方案是手工拼一个“视觉子代理 + 本地技能 + profile 接线”的组合——在一台机器上能跑，但很难交给别人装。

这个插件把整条链路打进一个可安装的包：

- **图片框是入口。** 粘贴、拖入或选择图片后，插件把图存进工作区；点“识别并发送”时把图片路径插到你输入文字的最前面一起发出，输入框保持干净。
- **`vision` 是工具，不是绕路。** 长工程里智能体需要看图时随时自己调 `vision`，答案直接来自你配置的任意 OpenAI 兼容视觉模型。
- **`vw_*` 工具负责像素活。** 裁剪、像素对比、取色、SVG 矢量化、OCR、HTML 截图、抠图全部本地执行、零配置，不需要视觉供应商或 API Key。
- **技能闭环。** 插件注册的 `vision-fallback` 技能教智能体何时用 `vision`、何时优先 `vw_*`，以及识别后如何把结果整理进「已识别图片」文件夹并配 markdown。

设计上保持增量：不替换现有组件、不拦截输入框键盘事件。插件自身唯一的网络出口是你配置的视觉模型地址——`vw_*` 工具全部离线执行，`vw_html_screenshot` 渲染本地文件时还会拦截并阻断网络请求。

## 效果演示

上面的截图就是 DSH Web 里的悬浮图片存储框。使用流程：

1. 点输入框旁的 **「识图」** 按钮。
2. `Ctrl+V` 粘贴截图、把图片拖进框里，或点 **「选择图片」**。
3. 照常在聊天输入框里打字，输入框不受影响。
4. 点 **「识别并发送」**。插件把图片存到 `<工作区>/pasted_images/`，在你的文字最前面加上 `识别图片 <路径>` 一起发送，然后清空输入并关闭浮窗。
5. 智能体按技能调用 `vision` 识图，然后把图片和 `NN_主题词.md` 说明整理进 `已识别图片/`。

Headless 或长工程里可以跳过图片框：直接告诉智能体一个绝对图片路径，它会自己调 `vision`。

## 快速开始

前置条件：已安装 DeepSeek Harness（有 Web 或 Headless profile），`dsh plugin` 可用 pnpm。

```sh
# Web
dsh plugin --profile web add github:shinegeer/dsh-vision-window

# Headless
dsh plugin --profile headless add github:shinegeer/dsh-vision-window
```

重启正在运行的 Web profile，然后确认插件行已挂载：

```sh
dsh --profile web --dump-config | grep ui-vision-window
```

无需构建步骤。`sharp` 通过 pnpm 安装预编译二进制；`potrace` 和 `puppeteer-core` 都是普通依赖。

配置分两层：

- **零配置**——7 个 `vw_*` 本地工具装上就能用，从不读取供应商配置或凭据。
- **`vision`（理解 / 描述图片）**——在图片框的 ⚙ 里（Web）或 `~/.dsh/settings.yaml`（Headless）选一个预设、保存 DSH 凭据，智能体就能随时调 `vision`。

## 特性

- **真正的图片框，不是文件选择框。** 悬浮框支持粘贴 / 拖入 / 选择三种方式，缩略图可移除，窗口可拖动且不超出屏幕。
- **一个显式动作才发送。** 只有点“识别并发送”时，草稿文字才和图片路径合并发出——不会误发，也不污染输入框。
- **模型预设 + 降级链。** 内置 OpenCode Go、OpenCode Zen（免费）、小米 MiMo 预设，外加自定义 OpenAI 兼容供应商；失败分类后按顺序降级，429 尊重 Retry-After 退避一次。
- **按内容缓存答案。** 缓存 key = 图片内容哈希 + 问题 + 供应商链签名；换链、改配置立即失效。
- **大图先缩小再上传。** 超过像素预算由 `sharp` 自动 downscale，失败则回退原图。
- **剥离推理块。** 成对、未闭合、HTML 转义和 `<|think|>` 四种形态都会在结果交给模型前移除。
- **像素结果可验证。** `vw_pixel_diff` 返回差异率、红色热力图和 JSON 报告——UI 还原变成可测量的数字，而不是肉眼对比。
- **Headless 工具不减配。** Web 专属 RPC 包在 `connection` 注入里；headless 同样拿到 `vision`、技能和全部 `vw_*` 工具。
- **密钥只进 DSH 凭据。** 配置里只有 `OPENCODE_API_KEY` 这类引用名；值每次调用现解析，不回传浏览器、不进日志。

## 工具

### `vision`

一个工具：必填绝对路径 `image_path`，可选 `question`。执行时读配置、校验图片（魔数 + 20 MiB 上限）、按需 downscale、沿供应商链调用并分类报错、剥离推理块后返回描述。降级成功时结果末尾会带一行 `[vision-window 状态]`。

### `vw_*` 本地工具

常驻注册，由 `localTools`（默认 `true`）总开关控制。所有入参都必须是绝对路径；产物默认写到会话工作区下的 `.dsh-vision-window/artifacts`，可用 `artifactsDir` 修改。

| 工具 | 用途 | 执行方式 | 产物 |
|---|---|---|---|
| `vw_crop` | 按像素框 `"x1,y1,x2,y2"` 裁剪 | 本地 `sharp` | PNG |
| `vw_pixel_diff` | 逐像素对比：差异率、差异像素数、最差 8×8 网格 | 本地 `sharp` | 红色热力图 PNG + JSON 报告 |
| `vw_colors` | 主色（hex + 占比） | 本地 `sharp` | — |
| `vw_trace` | 位图转 SVG（分层 posterize，适合图标 / logo） | 本地 `potrace` | SVG |
| `vw_ocr` | 文字转写，默认 `chi_sim+eng` | 系统 `tesseract`；未安装时返回安装指引 | — |
| `vw_html_screenshot` | 本地 HTML 截图，默认视口 1200×720 | `puppeteer-core` + 系统 Chrome/Edge | PNG |
| `vw_extract_foreground` | 移除与边界连通的背景（纯色 / 近纯色背景） | `sharp` 像素级洪泛 | 透明 PNG |

说明：

- `vw_pixel_diff` 遇到两张图尺寸不一致时，会把 rebuilt 缩放到 original 尺寸再比，并在结果里注明。
- 本地工具同样受 `downscale` 像素预算约束；`vw_trace` 有独立的 100 万像素硬上限，即使 `downscale` 关闭也会执行。
- 只有 `vw_ocr` 和 `vw_html_screenshot` 依赖外部系统组件，其余工具只用插件自带的 Node 依赖。

常用组合：

```text
vw_crop              image="ref.png" region="1067,841,1108,881"
vw_pixel_diff        original="ref.png" rebuilt="screenshot.png"
vw_colors            image="ref.png" top=8
vw_trace             image="icon.png" steps=4
vw_ocr               image="screenshot.png"
vw_html_screenshot   source="page.html" width=1200 height=720
vw_extract_foreground image="logo.png"
```

## 模型预设

| 预设 | 接口地址 | 模型 | 凭据引用 |
|---|---|---|---|
| `opencode-go` | `https://opencode.ai/zen/go/v1` | `mimo-v2.5` | `OPENCODE_API_KEY` |
| `opencode-zen` | `https://opencode.ai/zen/v1` | `mimo-v2.5-free` | `OPENCODE_API_KEY` |
| `xiaomi-mimo` | `https://api.xiaomimimo.com/v1` | `mimo-v2.5` | `XIAOMI_API_KEY` |
| `custom` | 自填 | 自填 | 自填 |

OpenCode Go 的 `/zen/go/v1` 端点来自 models.dev 收录，官方 OpenCode Zen 文档未列出，请先用“测试连接”确认 key 可用。`mimo-v2.5-pro` / `mimo-v2-flash` 只支持文本，不能做识图预设。

## 凭据

把 key 写进 `~/.dsh/.credentials.yaml`（文件权限 `0600`），或导出为环境变量：

```yaml
OPENCODE_API_KEY: sk-...
XIAOMI_API_KEY: sk-...
```

Web 面板通过 DSH 凭据服务保存 / 清除 key，只回显 `configured / source / writable` 状态。凭据每次调用现解析，改完不用重启。

## 配置项

所有字段都在 `~/.dsh/settings.yaml` 的 `vision-window` 段；Web 面板保存的也是这一段。schema 默认值：

| 字段 | 默认 | 含义 |
|---|---|---|
| `preset` | `opencode-go` | 主供应商：`opencode-go` / `opencode-zen` / `xiaomi-mimo` / `custom` |
| `fallbacks` | `[opencode-zen, xiaomi-mimo]` | 备用供应商，按顺序降级 |
| `custom` | `{ baseUrl: "", model: "", apiType: chat, credential: "", maxTokens: 0 }` | 自定义 OpenAI 兼容供应商 |
| `language` | `zh` | 界面与结果语言 |
| `downscale` / `downscaleMaxPixels` | `true` / `4000000` | 调用前缩小与像素预算 |
| `cache` / `cacheTtlSeconds` / `cacheMaxEntries` | `true` / `3600` / `200` | 进程内答案缓存 |
| `stripThink` | `true` | 剥离 `<think>` / reasoning 块 |
| `timeoutMs` | `60000` | 单次视觉调用超时 |
| `localTools` | `true` | 7 个 `vw_*` 工具总开关 |
| `artifactsDir` | `.dsh-vision-window/artifacts` | 产物目录；相对路径基于会话工作区，绝对路径直接用 |

## Headless 用法

Headless 没有浮窗，在 `~/.dsh/settings.yaml` 里配置后直接跑一次性任务：

```yaml
vision-window:
  preset: opencode-go
  fallbacks:
    - opencode-zen
    - xiaomi-mimo
  custom:
    baseUrl: ""
    model: ""
    apiType: chat
    credential: ""
    maxTokens: 0
  language: zh
  downscale: true
  downscaleMaxPixels: 4000000
  cache: true
  cacheTtlSeconds: 3600
  cacheMaxEntries: 200
  stripThink: true
  timeoutMs: 60000
  localTools: true
  artifactsDir: .dsh-vision-window/artifacts
```

```sh
dsh --profile headless "用 vision 识别 C:\path\a.png 并告诉我内容"
dsh --profile headless "用 vw_colors 提取 C:\path\a.png 的主色，top=2"
dsh --profile headless "用 vw_pixel_diff 对比 C:\path\ref.png 和 C:\path\impl.png"
```

## 环境要求

- 已安装 DeepSeek Harness（Web 或 Headless profile），`dsh plugin` 可用 pnpm。
- Node ≥ 20.9（sharp 0.35 的要求）。
- 只有 `vision` 需要视觉供应商和 DSH 凭据；`vw_*` 两者都不需要。
- 只有 `vw_html_screenshot` 需要 Chrome / Chromium / Edge；可用 `CHROME_PATH` 环境变量指定浏览器路径。
- 只有 `vw_ocr` 需要 Tesseract；未安装时工具返回清晰的安装指引，其余工具不受影响。

## 安装与生命周期

### 安装

```sh
dsh plugin --profile web add github:shinegeer/dsh-vision-window
dsh plugin --profile headless add github:shinegeer/dsh-vision-window
```

安装后重启常驻的 Web profile。宿主在进程启动时通过 `dsh.client` 发现浏览器 bundle，只刷新页面不够。

### 停用 / 重新启用

在 profile 补丁（`~/.dsh/profiles/<profile>/cordis.patch.yml`）里停用：

```yaml
- id: ui-vision-window
  disabled: true
```

改回 `false` 即重新启用。卸载会移除工具、技能和设置卡片；已保存的图片和产物文件保留。

### 升级

```sh
dsh plugin --profile web update github:shinegeer/dsh-vision-window
```

配置在 `~/.dsh/settings.yaml`，升级后保留。

### 卸载

```sh
dsh plugin --profile web remove @dsh-external/dsh-client-ui-vision-window
dsh plugin --profile headless remove @dsh-external/dsh-client-ui-vision-window
```

卸载不会删除 `pasted_images/`、`已识别图片/`、凭据或 `vision-window` 配置段。

## 安全说明

- 密钥走 DSH 凭据体系：插件只存引用名，每次调用现解析，不缓存、不打印、不经配置 RPC 回传。
- 图片文字属于**不可信证据**。内置技能要求智能体不执行图片里出现的指令；识别文字是数据，不是命令。
- 插件只接受 png / jpg / webp / gif（魔数校验）且不超过 20 MiB 的图片；本地产物只写入 `artifactsDir`。
- `vw_html_screenshot` 会在浏览器里开启请求拦截并中止所有非 `file:` 请求，被渲染页面无法拉取外网资源或回传数据。
- `npm audit --omit=dev` 会报告 5 个 moderate 级发现，全部来自同一条 `phin` 公告（`phin <3.7.1`，potrace → jimp 的传递依赖）。受影响的是 Jimp 的远程 URL 加载路径；本插件只向 potrace 传本地校验过的 Buffer，不会走到该路径。`sharp` 0.35.3 无任何公告。

## 架构

```
dsh-vision-window/
├── package.json            # bundle 声明、依赖（sharp/potrace/puppeteer-core）
├── cordis.patch.yml        # 把宿主半插入 profile 插件花名册
├── lib/
│   ├── index.js            # 宿主：settings、凭据、vision 工具、技能、RPC
│   ├── client.js           # 浏览器：图片框 UI + 配置面板
│   ├── image-utils.js      # 共享 sharp 加载 / 魔数校验 / downscale
│   └── local-tools.js      # 7 个 vw_* 本地工具
├── tests/
│   ├── host.test.mjs
│   ├── apply.test.mjs
│   └── local-tools.test.mjs
├── assets/
│   └── vision-window-demo.png
├── README.md / README.zh.md
└── LICENSE
```

数据流：

1. 浏览器：粘贴 → `save` RPC 写入 `<工作区>/pasted_images/...` → 显示缩略图。
2. 用户点发送 → 客户端读草稿，在最前面加上 `识别图片 <路径>`（多图一行一个）后发出；草稿清空、浮窗关闭。
3. 宿主：智能体按 `vision-fallback` 技能调用 `vision`，供应商链返回描述；智能体把图片和 markdown 说明整理进 `已识别图片/`。
4. 像素工作：智能体直接调 `vw_*`；工具校验绝对路径、本地执行，并把产物路径（位于 `.dsh-vision-window/artifacts`）报告出来。

Web 专属的 `/paste-image` RPC 注册在 `ctx.inject(['connection'])` 里，headless 跳过这一层，但工具、技能、设置和凭据全部保留。

## 开发

```sh
npm run check   # node --check 全部四个 lib 文件
npm test        # node --test，23 项测试
npm pack        # prepack 会自动跑 check
```

宿主半看 `lib/index.js`（提示词 `visionPrompt()`、技能 `SKILL_CONTENT`、预设 `PRESET_DEFS`），图片框与面板看 `lib/client.js`（定位 `measureComposer()`、宽度 `.ui-paste-image-float`），`vw_*` 工具看 `lib/local-tools.js`。改动宿主或客户端代码后都要重启 Web profile。

## 已知限制

- 答案缓存是进程内 LRU+TTL，重启即清，不跨进程共享。
- downscale 对 GIF 只取首帧（sharp 行为）。
- OpenCode Go 端点未见于官方文档，以“测试连接”实测为准。
- `vw_ocr` 需要系统 tesseract，`vw_html_screenshot` 需要系统浏览器；缺失时两者都会返回可操作的指引。
- 产物文件名带时间戳和随机后缀，只增不覆盖；清理直接删除 `artifactsDir`。
- `potrace` 带有安全说明里描述的传递依赖公告；本插件的本地 Buffer 调用路径不会触发它。

## License

[MIT](LICENSE)
