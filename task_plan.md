# dsh-vision-window v1.1 → v1.2 升级计划

## 目标（用户确认，按优先级排序）

1. API Key 改用 DSH 凭据体系（不再明文存 config.json）
2. 模型预设下拉：opencode-go / opencode-zen / 小米 MiMo（+ 自定义）
3. 答案缓存（按图片内容哈希 + 问题）
4. 供应商降级链 + 降级提示（分类报错，自动尝试下一家）
5. 调用前 downscale（超像素预算自动缩小）
6. 推理块剥离（`<think>` / `reasoning_content` / Responses `reasoning`）
7. 支持 headless profile（host 半不依赖 Web 服务）

## 假设（实现时以实测为准）

- `opencode go` = models.dev 的 OpenCode Go 提供方：base `https://opencode.ai/zen/go/v1`，模型 `mimo-v2.5`（支持 image），凭据引用 `OPENCODE_API_KEY`，OpenAI chat/completions。
- `opencode zen` = OpenCode Zen 提供方：base `https://opencode.ai/zen/v1`，模型 `mimo-v2.5-free`（支持 image，免费），凭据引用 `OPENCODE_API_KEY`，chat/completions。
- `小米 mimo` = Xiaomi 官方：base `https://api.xiaomimimo.com/v1`，模型 `mimo-v2.5`（支持 image），凭据引用 `XIAOMI_API_KEY`，chat/completions。
- 降级链 = 主预设 + 备用预设（按 UI 中固定顺序 opencode-go → opencode-zen → xiaomi-mimo → custom）。
- 缓存为进程内存 LRU+TTL（同 dsh-vision-router），重启即清，不落盘。

## 阶段

### Phase 0：准备与基线 ✅
- 基线 commit f51539f 为回滚点；Node 24.18 / dsh 0.1.0-rc.6；sharp 0.34.x 可用。

### Phase 1：配置迁移到 DSH 凭据体系（不再存 key）✅
- `resolveCredential`/`describeCredential` 走 `ctx.get('credentials')`；`get-config` 只回状态；`set/unset-credential` RPC；旧 config.json 只读迁移（实测已把旧 key 迁入 `VISION_WINDOW_API_KEY`）；client 改为凭据名+保存/清除；全链路无 key 回传。

### Phase 2：模型预设下拉 ✅
- `PRESET_DEFS` + `ctx.settings.register('vision-window', Config)`；client 预设下拉 + 备用勾选 + 自定义字段 + 凭据状态；webtest 客户端 bundle 验证已加载；headless 用迁移后的 custom 链路端到端识图成功。

### Phase 3：供应商降级链 + 降级提示 ✅
- `resolveChain` + `recognizeWithFallback`；错误分类 auth/quota/rate/endpoint/server/timeout/network/bad-response/credential-missing；429 Retry-After 退避一次；聚合错误+建议；降级成功追加 `[vision-window 状态]`；技能内容要求 md 排除该行。真机降级 final 回归待做。

### Phase 4：答案缓存 ✅
- `createCache`（LRU+TTL）+ `ensureCache`（配置变更重建）；key=sha256(原图)+question+链签名+语言+stripThink；单测覆盖 LRU 与 TTL 过期。

### Phase 5：调用前 downscale ✅
- sharp 动态 import（失败回退原图）；`downscaleImage` 单测覆盖；配置与 UI 项已加。

### Phase 6：推理块剥离 ✅
- `stripThinking`（成对/未闭合/HTML 转义/`<|think|>` 四种形态）+ `stripThink` 配置与 UI；单测覆盖；`reasoning_content` 不进入结果、Responses 只收 `output_text`。

### Phase 7：支持 headless profile ✅
- Web 专属 RPC 包进 `ctx.inject(['connection'])`；headless 实测：插件正常加载、`vision` 工具被模型调用并成功识别本地测试图片。

### Phase 8：测试、文档、发布（进行中）
- [x] `tests/host.test.mjs` + `tests/apply.test.mjs`（14 项全绿，`npm test`）
- [x] README 重写（预设/凭据/降级/缓存/downscale/推理剥离/headless）
- [x] package.json 1.1.0 + 新依赖；`npm run check` 通过
- [x] 交接文档 v8（工作区 `D:\Deepseek Harness\DSH修改\添加发送图片插件\交接文档.md`）
- [x] 降级链端到端 final 回归（xiaomi-mimo 无凭据 → 自动降级 custom 成功，输出带 `[vision-window 状态]`；已还原 settings）
- [x] downscale 端到端回归（3000×3000 大图 headless 识图成功，sharp 在 DSH 宿主内正常加载）
- [x] git commit 87e978d + push `origin/main` 成功（首次连接重置，重试成功）
- [ ] 重启正式 `dsh web` 全流程回归（需用户配合：停止并重新运行 `dsh web`，刷新页面后用浮窗贴图验证）

### Phase 9：设置面板压缩（用户反馈：悬浮框太长）✅
- [x] 「自定义供应商」改为默认收起的折叠区（▸/▾ 切换）
- [x] 「高级设置」改为默认收起的折叠区（downscale/缓存/推理剥离/超时）
- [x] 配置区 `max-height:min(42vh,340px)` 内部滚动；悬浮框 `max-height:calc(100vh - 24px)` 整体不超屏
- [x] 打开 ⚙ 时重置两个折叠区为收起态
- [x] webtest 临时 profile 验证客户端 bundle 已包含折叠逻辑与限高样式（随后清理）
- [x] 已识别用户截图并归档到「已识别图片」（03_设置面板过长截图.md + 图片移动）

### Phase 10：零配置本地像素/OCR 工具（已确认：7 个全量 + vw_* 命名）
- 目标：用户不填任何供应商配置时，也能让主模型自动调用本地像素分析与 OCR 工具。
- 已确认范围：`vw_crop`、`vw_pixel_diff`、`vw_colors`、`vw_trace`、`vw_ocr`、`vw_html_screenshot`、`vw_extract_foreground`。
- 命名：`vw_*`（避免与 dsh-vision-router 的 `vision_*` 冲突）。
- 零配置保证：不碰 credentials；产物写 `<workspace>/.dsh-vision-window/artifacts`。
- 依赖：`potrace`（纯 JS）+ `puppeteer-core`（html_screenshot）；OCR 用系统 tesseract（execFile，不新增 npm 依赖）。
- 自动调用：工具常驻注册 + 更新 `vision-fallback` 技能内容。
- [x] 版本号 1.2.0 + description 更新
- [x] 真机零配置验证：临时 preset=xiaomi-mimo（无 XIAOMI_API_KEY）→ headless 调 `vw_colors` 返回左红右蓝各 50%；settings 已还原（哈希一致）
- [x] 真机验证 `vw_pixel_diff`（同尺寸 100% 差异、尺寸不一致 2.50% + 缩放提示、热力图 40×20、JSON `resizedRebuilt:true`）；修复 `dimensionsDiffer` 文案未拼入返回值的问题
- [x] 真机验证 `vw_crop`（20×20 全红 PNG）、`vw_ocr`（未装 tesseract 时返回安装指引）、`vw_html_screenshot`（系统 Chrome，1200×720 PNG）
- [x] webtest 临时 profile（3999）验证客户端 bundle 含 `vw_*`/`localTools`/`artifactsDir`/零配置文案；已停服并删除 profile
- [x] README 重写：README.md 默认英文 + README.zh.md 中文；少 emoji；模仿 dsh-vision-router / dsh-vision-toolkit 文风；加入用户截图 `assets/vision-window-demo.png` 作演示
- [x] `npm audit --omit=dev`：5 moderate 全部来自 potrace→jimp→phin 的远程加载链（插件只传本地 Buffer，不可达）；README 安全说明已记录；sharp 0.35.3 零漏洞
- [x] 五轴代码审查：3 必修项已修（前景洪泛 `queue.shift()` 改索引指针；`vw_trace` 1MP 上限在 `downscale=false` 时也强制；`vw_html_screenshot` 拦截非 `file:` 请求），另修多项 Optional/Nit；测试增至 23 项全绿
- [x] git commit 9e16f5a + push origin/main

## 验收总闸

- [x] 三个预设 + 自定义可选；主预设 + 备用自动降级且带提示（代码+单测；真机降级回归待做）
- [x] 全链路无 key 明文（settings 里只有 `VISION_WINDOW_API_KEY` 引用，RPC/日志/README 无明文）
- [x] 缓存命中、downscale、推理剥离均有测试覆盖
- [x] Web 与 headless 双 profile 均可识图（headless 已真机识图；web 宿主+客户端在 webtest:3999 验证加载）
- [x] 老版本 config.json 用户升级不丢配置（实测自动迁移）
- [x] v1.2 headless 零配置真机通过（vw_colors 在无凭据 preset 下正确返回；pixel_diff/crop/ocr/html_screenshot 均实测）
- [x] v1.2 webtest 客户端 bundle 含 vw_*/localTools/artifactsDir 文案（临时 profile 已清理）
- [x] README 默认英文 + README.zh.md 中文版，含演示截图
- [x] v1.2 commit 9e16f5a + push origin/main
- [ ] 重启正式 `dsh web` 后浮窗贴图全流程回归（需用户配合）

## 风险与回滚

| 风险 | 缓解 |
|---|---|
| opencode-go 的 `/zen/go/v1` 是未文档化端点 | 预设照发；README 标注；用户侧「测试连接」实测 |
| sharp 原生依赖安装失败 | 动态 import + try/catch，失败回退原图 |
| settings 迁移覆盖用户旧配置 | 迁移只在 settings 无用户段时执行；旧 config.json 保留 |
| headless 下 `ctx.inject(['connection'])` 语义 | 实测通过：headless 不激活该 fiber，插件正常 |
| 降级提示污染识别描述 | `[vision-window 状态]` 固定前缀 + 技能内容要求排除 |
| 缓存导致配置更换后旧答案 | 缓存 key 含供应商链签名，换链自动失效 |

## 错误记录

| 错误 | 尝试 | 解决 |
|---|---|---|
| schemastery `z.number().int()` 不存在 | 1 | 改 `z.number().step(1)` |
| `<\|think\|>` 正则误吞普通 `<think>` 开标签 | 1 | 管道令牌单独正则，普通标签交给配对剥离 |
| `node --test tests/` 在 Windows 下把目录当模块 | 1 | 改为 `node --test` 自动发现 |
| npm 11 allowScripts 阻止 sharp install script | 1 | `npm approve-scripts sharp` 后正常加载 |
| `dsh web --profile` / `dsh --profile x web` 参数顺序均报错 | 2 | 正确形态：`dsh --profile <name> --port 3999`（web 是 profile 别名，不能与自定义 profile 混用） |
| settings 临时切 preset 时 `-replace` 把反引号 n 写成了字面量 | 1 | 按行重建 `vision-window:` 段后校验；测试完从备份整文件还原并比对哈希 |
| vw_pixel_diff 尺寸不一致时未把 `dimensionsDiffer` 文案拼进返回 | 1 | 返回值追加 `；两张图尺寸不同…`；真机复测确认 |
| jimp override 1.6.1 导致 potrace `instanceof` 报错 | 2 | jimp 1.x 与 potrace CJS 不兼容；回退无 overrides 基线（依赖级 overrides 对消费者 profile 也不生效），审计公告在 README 记录为不可达路径 |
