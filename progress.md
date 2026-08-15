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
- [ ] 交接文档 v8 更新（工作区文档）
- [ ] 正式 `dsh web` 重启回归（需用户配合；重启会断开当前会话）
- [ ] git add/commit/push

## 验证过的命令

```powershell
dsh plugin --profile headless add link:C:/Users/Kakaa/dsh-skins/paste-image
dsh --profile headless --dump-config          # 插件行已挂载
dsh --profile headless "只回复两个字：正常"      # 插件加载无报错
dsh --profile headless '调用 vision 工具识别图片 "D:\...\test-color.png"...'  # 识别成功
dsh --profile webtest --port 3999             # 临时 web 验证（已停用并删除 profile）
```
