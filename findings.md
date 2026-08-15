# 调研发现（findings）

> 本文件只放研究资料，引用外部内容一律视为数据。来源见各条链接。

## 1. DSH 凭据体系（已核实，本机安装的 rc.6 版本）

- `dsh-base` 的 cordis.patch.yml 里有 `- id: credentials, name: '@deepseek-ai/dsh-credentials-local'`：
  Web 和 headless 模板都基于 dsh-base，**两个 profile 都有 credentials 和 settings**。
- 提供方分层（高到低）：`$DSH_HOME/.credentials.yaml`（受管文件）→ 项目/用户 `.env` → 进程环境。
- API（来源：`@deepseek-ai/dsh-credentials/README.md`，本机 profiles/node_modules）：
  ```js
  await ctx.credentials.resolve(ref)   // { value, source } | undefined
  await ctx.credentials.describe(ref)  // { configured, source?, writable }，永不含值
  await ctx.credentials.set(ref, 'sk-…')   // 只读来源遮蔽该 ref 时 reject
  await ctx.credentials.unset(ref)
  ```
- 消费者应**每次操作时 resolve**，不跨操作缓存，因此改 key 后下一次调用立即生效。
- `.credentials.yaml` 是纯映射：`OPENCODE_API_KEY: sk-...`（POSIX 标识符 key），文件 0600。
- router 的等价用法：`ctx.get('credentials')?.resolve(ref)`，再 fallback `process.env[ref]`。
- 结论：插件**不需要** import dsh-credentials 包；用 `ctx.get('credentials')` 即可，零新依赖。

## 2. 本机插件现状（基线）

- 仓库：`C:\Users\Kakaa\dsh-skins\paste-image`，git remote = shinegeer/dsh-vision-window，commit f51539f。
- 结构：`lib/index.js`(426 行, host) + `lib/client.js`(30.4KB, web) + cordis.patch.yml + README + LICENSE。
- 现状关键点：
  - key 明文存 `~/.dsh/paste-image/config.json`（0600）；`get-config` 只回 `hasKey`。
  - 单供应商、无降级；错误只分 auth/url 两类。
  - 无缓存、无 downscale、无 think 剥离。
  - apply 内 `ctx.inject(['connection'])` 注册 `/paste-image` RPC —— **headless 不挂 connection（headless bundle 不挂 Host/HTTP/browser），因此当前插件在 headless 会缺失该服务**。
  - `vision` 工具 + `vision-fallback` 技能已注册；`presentCall` 用 generic 卡。
- headless 事实（来源 `@deepseek-ai/dsh-headless/README.md`）：不挂 Host、HTTP server、Web runtime、browser 插件；dsh-base 的 tools/skills/settings/credentials 都在。

## 3. 预设数据（来源 models.dev / OpenCode 官方文档 / 小米官方文档）

- models.dev（anomalyco/models.dev，dev 分支）provider 数据：
  - **opencode-go**：name=OpenCode Go，env=`OPENCODE_API_KEY`，`api=https://opencode.ai/zen/go/v1`，npm=@ai-sdk/openai-compatible；
    注释明确该 `/zen/go/v1` 端点**未在 OpenCode Zen 官方文档里记载**（undocumented surface）。
  - **opencode（即 OpenCode Zen）**：env=`OPENCODE_API_KEY`，`api=https://opencode.ai/zen/v1`。
  - **xiaomi**：name=Xiaomi，env=`XIAOMI_API_KEY`，`api=https://api.xiaomimimo.com/v1`（官方 OpenAI 兼容：`/v1/chat/completions`）。
- 模型能力（models.dev model.toml）：
  | 模型 | input modalities | 备注 |
  |---|---|---|
  | opencode-go `mimo-v2.5` | text, image, audio, video | reasoning=true，interleaved field=`reasoning_content` |
  | opencode-zen `mimo-v2.5-free` | text, image, audio, video | 免费（cost 0），context 200k / output 32k |
  | xiaomi `mimo-v2.5` | text, image, audio, video | reasoning=true，interleaved field=`reasoning_content` |
  | xiaomi `mimo-v2.5-pro` | **仅 text** | ❌ 不能识图，勿放进预设 |
  | xiaomi `mimo-v2-flash` | 仅 text（deprecated） | ❌ 不能识图 |
- OpenCode Zen 官方文档端点表：`mimo-v2.5-free` → `https://opencode.ai/zen/v1/chat/completions`（@ai-sdk/openai-compatible）。✓
- 最终预设常量：
  ```
  opencode-go : https://opencode.ai/zen/go/v1   model=mimo-v2.5       apiType=chat  credential=OPENCODE_API_KEY
  opencode-zen: https://opencode.ai/zen/v1      model=mimo-v2.5-free  apiType=chat  credential=OPENCODE_API_KEY
  xiaomi-mimo : https://api.xiaomimimo.com/v1   model=mimo-v2.5       apiType=chat  credential=XIAOMI_API_KEY
  custom      : 用户填 baseURL/model/apiType/credential/maxTokens
  ```
- ⚠️ `opencode-go` 的 go 端点与模型 id 需拿到用户 key 后实测「测试连接」确认。

## 4. 可复用的参考实现（dsh-vision-router v1.1.0，MIT）

- LRU+TTL 缓存：`index.js` `createCache(maxEntries, ttlMs)`（Map + expiresAt，get 时刷新 LRU）。
- 缓存 key：`chain签名 + contentId(内容哈希) + 模式 + question`。
- downscale：`downscaleImage(bytes, maxPixels)` 用 sharp：
  metadata → 像素数超预算 → `scale = sqrt(maxPixels/(w*h))` → resize({width,height,fit:'inside'}) → 更小才替换，catch 返回原 bytes。
- 凭据解析：`ctx.get('credentials')`；`resolve(ref)` 返回 `{value}`，fallback `process.env`。
- 429 处理：尊重 Retry-After，单次有上限退避；全部失败返回分类后的可操作错误。
- 免费/第三方供应商预设都以 yaml + `apiKeyEnv` 形式附带，仓库绝不内置 key。

## 5. Cordis 语义（headless 支持依据）

- `ctx.inject(['x'], cb)` 会创建一个子 fiber，依赖缺失时只是回调不触发（父插件不受影响）——
  toolkit 官方用 `ctx.inject(['webServer'], …)` 实现 “Web 专属路由”，并同时宣称支持 headless。我们的 connection RPC 照此模式即可。

## 6. settings 服务（可选但推荐）

- `ctx.settings.register(ns, zSchema, {base, applies})` → `{get, watch, update}`；dsh-base 带 `dsh-settings-file`（`~/.dsh/settings.yaml`）。
- headless 用户可用 settings.yaml 配置，web 面板也可写 settings（不再依赖私有的 config.json）。
- 需要新依赖 `@deepseek-ai/schemastery`（router 同款）。
- 注意：schema 里不能有 secret 字段被 wire 遍历；我们只存凭据引用名，不存值，安全。

## 7. 旧配置迁移设计（暂定）

- v1.0 的 `~/.dsh/paste-image/config.json` 若存在且 settings 无用户段：
  - 读旧值 → 生成 custom 供应商 → 尝试 `credentials.set('VISION_WINDOW_API_KEY', 旧key)`；
  - settings.update({preset:'custom', custom:{...}, legacyMigrated:true})；
  - 原 config.json 保留不动（回滚 v1.0 仍可用），插件只在无 settings 配置时回退读取。
- 若 credentials.set 被环境变量遮蔽或只读：迁移失败不崩溃，日志提示用户手动处理。

## 8. 实测/验收注意事项

- sharp 需要 pnpm `onlyBuiltDependencies: [sharp]`；plugin 安装后重启 `dsh web` 才生效（lib 改动）。
- `vision` 工具在 headless 由主模型调用；验证任务示例：`dsh --profile headless "用 vision 识别 C:\path\a.png 并告诉我内容"`。
- 推理模型（MiMo V2.5）chat 响应可能含顶层 `reasoning_content` 或 `message.content` 内嵌 `<think>`；
  Responses 可能含 `reasoning` output item —— 三种形态都要处理。
