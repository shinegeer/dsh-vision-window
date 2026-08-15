# 进度记录（progress）

## 会话 1（计划阶段，2026-08-15）

- [x] 确认对比对象；克隆三仓库做研究；确认本地与 GitHub 无 diff
- [x] 调研 DSH 凭据/headless/预设数据/router 可复用实现
- [x] 创建 task_plan.md / findings.md / progress.md，计划获批

## 会话 1（实施阶段）

- [x] 重写 `lib/index.js`：settings schema、预设、凭据解析、降级链、缓存、downscale、推理剥离、headless 化
- [x] 重写 `lib/client.js` 配置面板：预设下拉、备用勾选、凭据管理、高级选项
- [x] package.json 1.1.0 + sharp/schemastery；npm approve sharp install script
- [x] 测试：`tests/host.test.mjs`（10 项）+ `tests/apply.test.mjs`（3 项）+ Config（1）= 14 项全绿
- [x] 修复 4 个实施错误：schemastery int、think 正则、node --test 目录、npm allowScripts
- [x] headless 实测：`dsh plugin --profile headless add link:...` → dump-config 含插件行 → 最小任务正常 → 本地图片经 `vision` 工具识别成功（红图 → “红色”）
- [x] 实测旧配置迁移：`~/.dsh/settings.yaml` 出现 `vision-window` 段（custom + `VISION_WINDOW_API_KEY` 引用），`.credentials.yaml` 新增该凭据，旧 config.json 保留
- [x] web 端间接验证：创建 `webtest` 临时 profile（base+web-app+插件），`dsh --profile webtest --port 3999` 启动成功，HTML 注册了 `/plugins/@dsh-external/dsh-client-ui-vision-window/client.js`，bundle 含 `ui-paste-image`/预设/`保存凭据` 标记；已停止并删除该测试 profile
- [x] 降级链真机 final 回归：临时把主预设设为 xiaomi-mimo（无凭据）+ fallback=custom，headless 识图成功且输出带 `[vision-window 状态]`；settings 已还原
- [x] downscale 端到端回归：3000×3000 大图 headless 识图成功（sharp 宿主内加载正常）
- [x] 交接文档 v8 更新（工作区文档）
- [x] sharp 0.34 → 0.35.3（npm audit 0 漏洞；engines → Node ≥20.9；升级后 headless 复测通过）
- [x] git commit 87e978d + push origin/main（首次连接 reset，重试成功）
- [ ] 正式 `dsh web` 重启后浮窗贴图全流程回归（需用户配合：重启会断开当前会话）

## 会话 2（用户反馈：设置面板太长）

- [x] 用 vision 识别用户贴的截图：确认为配置面板全平铺导致悬浮框过长
- [x] client 改造：自定义供应商 + 高级设置折叠（默认收起），配置区限高滚动，悬浮框限高不超屏
- [x] `npm run check` / `npm test` 全绿
- [x] webtest:3999 验证客户端 bundle 含折叠与限高样式，随后删除临时 profile
- [x] 按插件归档规则：图片移入「已识别图片」+ 写 `03_设置面板过长截图.md`
- [x] 提交并推送（commit `686cec0`）

## 会话 3（v1.2 零配置本地工具，中断点）

- [x] 用户确认：7 个全量工具 + `vw_*` 命名
- [x] 新增 `lib/image-utils.js`（sharp/魔数/downscale/哈希共享模块）；index 改为导入
- [x] 新增 `lib/local-tools.js`：vw_crop / vw_pixel_diff / vw_colors / vw_trace / vw_ocr / vw_html_screenshot / vw_extract_foreground（全部零配置，产物 `.dsh-vision-window/artifacts`）
- [x] settings schema 增 `localTools` / `artifactsDir`；client 高级区增两项
- [x] 技能内容更新：教模型自动组合 `vision` + `vw_*`
- [x] 依赖：potrace@^2.1.8、puppeteer-core@^25.7.0（npm install 完成）
- [x] `npm run check` 通过；`npm test` 21 项全绿
- [x] 版本号 → 1.2.0 + description 更新
- [x] 真机 zero-config 验证（headless 调 vw_colors/vw_pixel_diff；settings 已还原）
- [x] webtest 验证 web 客户端 bundle
- [x] README 重写（英文默认 + 中文版）；交接文档 v9 定稿与 commit/push 见会话 4
- [ ] 提醒用户重启 `dsh web`

## 会话 4（v1.2 收尾：版本号 + 真机验证 + README 重写）

- [x] package.json → 1.2.0；description 补 7 个 vw_* 说明
- [x] `npm run check` / `npm test` 23 项全绿（新增 trace 1MP 上限、大图前景提取两项回归）
- [x] 代码审查（五轴）→ 3 必修项已修：前景洪泛改索引指针（O(n)）、vw_trace 1MP 上限在 downscale=false 时也强制、vw_html_screenshot 拦截非 file: 请求；另修 check 脚本覆盖四个 lib、图片读取错误双语、LOCALAPPDATA 浏览器路径、parseRegion 先取整再校验、diff 英文标点、边缘网格宽高
- [x] 零配置真机：临时 preset=xiaomi-mimo（无 XIAOMI_API_KEY），headless 调 vw_colors 返回 `#cc0404 50% / #0404cc 50%`；settings 备份还原、哈希一致
- [x] vw_pixel_diff 真机：换色图 100% 差异；80×40 对 40×20 为 2.50%（resizedRebuilt:true）；修复尺寸不一致提示未返回；复测提示出现
- [x] vw_crop 真机（20×20 全红 PNG）、vw_ocr 未装 tesseract 返回安装指引、vw_html_screenshot 系统 Chrome 1200×720
- [x] webtest:3999 客户端 bundle 含 `vw_*`/`localTools`/`artifactsDir`/零配置文案；停服并删除 webtest profile
- [x] README 重写：README.md 默认英文 + README.zh.md 中文；少 emoji；模仿 router/toolkit 文风；加入用户截图 `assets/vision-window-demo.png`
- [x] npm audit 调查：5 moderate = potrace→jimp→phin 远程加载链，插件只传本地 Buffer 不可达；尝试 jimp overrides（0.22.12 / 1.6.1）后回退基线，结论写入 findings + README 安全说明
- [x] commit 9e16f5a + push origin/main（v1.2.0）
- [ ] 提醒用户重启正式 `dsh web`

## 验证过的命令

```powershell
dsh plugin --profile headless add link:C:/Users/Kakaa/dsh-skins/paste-image
dsh --profile headless --dump-config          # 插件行已挂载
dsh --profile headless "只回复两个字：正常"      # 插件加载无报错
dsh --profile headless '调用 vision 工具识别图片 "D:\...\test-color.png"...'  # 识别成功
dsh --profile webtest --port 3999             # 临时 web 验证（已停用并删除 profile）
```
