# MAD Toolbox 架构重构设计

> 状态：实施基线 v2 · 2026-08-14
> 本文档沉淀已确认的架构决策、边界与实施顺序。未定案或需要外部输入的事项集中在 §10。

## 0. 现状与病因

本节记录计划制定时的重构前基线；当前迁移状态见 §11。

现状（`refactor/dev` 分支）：

- 后端集中在 `src-tauri/src/lib.rs`（约 3350 行，15 个 command）：设置、依赖检测、任务执行、musicdl 专用命令、媒体探测混在一个文件。
- CLI 参数拼装在**前端** `src/lib/commands.ts`（`buildBilibiliArgs` / `buildYtDlpArgs` / `buildFfmpegArgs` / `buildMusicdlArgs`），后端 `run_tool` 接收 `Vec<String>` 直接执行；同时 `run_tool` 内部又散布工具特判（BBDown login 分支、yt-dlp 自动注入 `--ffmpeg-location`、BBDown 强制工作目录）。
- `musicdl_search` / `musicdl_download` / `musicdl_playlist` 三个 command 绕过统一执行通路，自成一路。
- 前端约 2000 行全局 CSS；功能页把工具参数全量平铺（Bilibili 页 40+ 字段），已知存在"UI 显示与实际行为不符"的字段（冗余开关、静默改写，见 `docs/config-options.html`）。

**核心病因不是"代码没分文件"，而是边界放错了**："用户意图 → 命令行"这一核心业务知识住在 UI 层的 TypeScript 里，导致：

1. 知识撕裂在两侧——前端拼一半参数，后端补一半特判，没有单一位置能回答"这条命令最终长什么样"；
2. 拼装逻辑生长在 React 组件状态流里，无法单元测试——config-options.html 查出的"冗余/静默改写/被忽略"字段全是这个病的症状；
3. 后端暴露的实质是"执行任意 argv"，等于没有接口契约。

## 1. 产品定位推出的核心能力

MAD Toolbox 是既有 CLI 工具（BBDown、yt-dlp、FFmpeg、musicdl）之上的 GUI 壳。壳的价值不在表单本身，而在三个核心能力，重构围绕它们建设：

| 能力                 | 归属模块             | 说明                                                                                                                                                                    |
| -------------------- | -------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| 工具的获取与保鲜     | `core/deps`          | 工具的下载、校验、版本、应用内更新。yt-dlp 失效周期极短（上游站点一改接口即失效），**不带内建更新能力的发行版在发布数月后即不可用**，因此依赖管理是核心业务而非打包杂务 |
| 任务的编排与观测     | `core/task`          | 队列、并发、状态机、日志、历史                                                                                                                                          |
| 意图到命令的可靠翻译 | `features/*/adapter` | 结构化请求 → argv 的纯函数，可单测                                                                                                                                      |

配套原则：**工具已经会的事，壳不做。**

- 断点续传不自己实现（aria2c / yt-dlp 自带 `.part` 机制，重跑即续传）；
- 不承诺"暂停"（CLI 子进程跨平台挂起无干净做法，语义由 cancel + 重跑近似）；
- 长尾参数文档不自己重写，链接上游 README。

## 2. 前后端边界

**决策：前端只发送结构化意图（typed request），后端 adapter 负责翻译成 argv。前端不再拼装任何 CLI 参数。**

```
前端表单 ──(结构化意图 JSON)──► features/x/commands.rs
                                    │
                              adapter：意图 → argv（纯函数）
                                    │
                              core/task：排队、执行、观测
```

理由与否决方案：

- **否决：维持前端拼参数**。除 §0 列出的三条病因外，还有两个后来才显形的硬约束：(a) 任务详情页要展示"实际执行过的命令"，展示的必须是真跑过的那条，唯一真相源必须在执行侧；(b) argv 含敏感信息（`--cookie`、`--access-token`），脱敏需要"哪个 flag 是秘密"的知识，这个知识只应存在于 adapter 一处。
- **否决：后端只做通用执行器 + 白名单校验**。校验任意 argv 的白名单永远追不上工具版本迭代，且不解决知识撕裂。
- **工具特有的失败兜底同样归 adapter**。现状的 yt-dlp 浏览器 Cookie 兜底是 `fallback_args` hack：前端预先拼好两条完整命令一起发来，后端盯输出、见 "Sign in to confirm" 类字样即换备用命令重跑。新归属：兜底逻辑写在 network 的 adapter 内——首跑不带 cookie（多数视频无需登录，且浏览器运行中读其 cookie 库有失败风险），失败输出命中"需登录"特征时追加 `--cookies-from-browser <浏览器>` 在**同一任务内重试一次**，重试原因记入日志与任务详情；浏览器取自设置页 network 分栏（默认 Chrome，见 §8 设置页）。任务系统只提供一条通用机制："任务失败时询问该 feature 的 adapter 是否重试，至多一次"。**否决：TaskSpec 携带 fallback 声明**——错误特征与补救参数是 yt-dlp 的专属知识，进通用契约则每个 feature 都背一个只有一个工具使用的字段，且通用执行器仍需认识 yt-dlp 的错误字符串，知识照样外漏。

前后端类型同步：初期手工镜像 TS 类型；待接口稳定后评估 tauri-specta 自动生成，消灭手工同步。

### 2.1 当前前后端契约面（2026-08-14）

前端当前调用 22 个 Tauri command，后端注册表与调用方已逐项核对：

| 领域       | command                                                                                        |
| ---------- | ---------------------------------------------------------------------------------------------- |
| 设置与依赖 | `dependency_status`、`app_settings`、`save_app_settings`                                       |
| 任务       | `tasks_snapshot`、`task_cancel`、`task_promote`、`pool_definitions`、`task_export_diagnostics` |
| Bilibili   | `bilibili_preview`、`bilibili_submit`、`bilibili_login_start`                                  |
| Network    | `network_preview`、`network_submit`、`network_probe`                                           |
| Media      | `media_preview`、`media_submit`、`media_pr_submit`、`ffmpeg_encoders`、`inspect_media`         |
| Music      | `musicdl_search`、`musicdl_download`、`musicdl_playlist`                                       |

事件契约共 4 个：主任务统一使用 `task-event`；扫码登录使用 `bbdown-login-qr` 与 `job-state`；music 搜索使用 `musicdl-search-result` 与共享的 `job-state`。无人消费的 `job-log` 已删除。

由此得到前端重构的影响边界：

- 页面布局、路由、组件库、主题、表单拆分和 Zustand 内部组织可以独立重构，只要上述 command 名、请求/返回 JSON 和事件载荷不变。
- Bilibili、Network、Media、Music 的字段名、枚举或默认值变化，会影响对应 feature 的 TypeScript 表单类型与 Rust `types/adapter`，但通常不穿透 `core/task`。
- `TaskEnvelope`、`TaskEvent`、七态状态机和任务历史语义的变化会同时影响前端 store、`core/task` 与 SQLite。
- `TaskIntent.data` 既是提交 DTO，也是落库后的重跑协议。历史任务会把它直接回填到表单，因此字段改名必须提供兼容读取或数据迁移，不能当作纯前端改动。

## 3. 后端模块划分

**决策：feature 按业务域垂直切分，横切基础设施归入共享内核。**

```
src-tauri/src/
├── core/                  # 技术层：所有 feature 共用
│   ├── process.rs         # spawn / kill 进程树 / stdout·stderr 流式读取
│   ├── task/              # 任务系统（§4）
│   ├── deps/              # 工具解析、安装、更新（§7）
│   └── settings.rs
├── features/              # 业务域：互相不 import
│   ├── bilibili/          #   commands.rs  薄壳：反序列化 → 调 adapter → 返回
│   ├── network/           #   adapter.rs   意图→argv 纯函数 + 输出解析器 + 参数注册表
│   ├── media/             #   types.rs     意图结构体
│   └── music/
└── lib.rs                 # 只做装配：注册插件、挂载各模块 command
```

判定标准与否决方案：

- **划分标准是变化源，不是相似度。** BBDown 与 yt-dlp 同为"视频下载"，但变化原因和节奏完全不同（yt-dlp 高频跟随上游站点；BBDown 有登录态/分P/BiliPlus 等专有概念），**分开**。它们的共同点只有"产出一个进程任务"，该共同点表达为 core 的抽象（都提交 `TaskSpec`），不共享实现代码。
- **否决：纯技术分层（handlers/ services/ utils/）**。所有 feature 的变更都会横穿全部层，任何一个工具的迭代都污染公共文件；且无法满足"一个功能的故障不影响其他功能"的隔离诉求。
- **纪律：commands.rs 必须薄。** 只做反序列化、调 adapter、返回。现 `run_tool` 内的工具特判分别归位到对应 feature 的 adapter。commands.rs 里出现 if-else 即为业务逻辑外漏的信号。
- **musicdl 三个旁路 command 取消**：搜索按 §4.1 判据归为查询（普通 command，归位 `features/music`），下载/歌单产出 TaskSpec 走任务系统。

## 4. 任务系统 core/task

### 4.1 两类通路

| 类型 | 判据                                                                 | 通路                                     |
| ---- | -------------------------------------------------------------------- | ---------------------------------------- |
| 查询 | 时长有界且短（不随输入规模增长）、结果由发起页面即时消费、不产出文件 | 普通 command，不进任务系统               |
| 作业 | 产出文件，或时长随输入/文件规模增长                                  | 经过 core/task：队列可见、有历史、可取消 |

- **判据不是"是否 spawn 子进程"。** 依赖检测、设置读写是查询；媒体探测（ffprobe）、格式/信息解析（yt-dlp 的 formats/metadata、BBDown 的 info 模式）同样是查询——它们 spawn 进程，但结果直接回填发起页面（如供用户挑选格式），不需要历史、置顶、队列可见性，进队列反而是打扰。
- spawn 进程的查询必须带**超时**与**内部并发上限**（用户不可见的小信号量）：前者防挂死的解析进程堵住页面，后者防重复点击堆积进程。错误就地显示在发起页。

### 4.2 任务信封（TaskEnvelope）

一份 struct，三处使用：运行时调度对象、SQLite `tasks` 表的一行、推给前端的事件载荷。

| 字段                                    | 写方                                            | 对应需求                                                |
| --------------------------------------- | ----------------------------------------------- | ------------------------------------------------------- |
| `id`                                    | 枢纽                                            | —                                                       |
| `kind`                                  | feature                                         | 派生 feature（UI 着色/徽章）与 pool（并发池路由，§4.4） |
| `title`                                 | feature                                         | 任务列表显示（如"下载 BV1xxx…"）                        |
| `status`                                | 枢纽                                            | 状态机（§4.3）                                          |
| `created_at / started_at / finished_at` | 枢纽                                            | 按时间排序、跨会话归档                                  |
| `tool / tool_version`                   | feature                                         | 详情页、排障                                            |
| `argv_redacted`                         | feature                                         | 详情页展示"实际执行的命令"（脱敏版）                    |
| `working_dir`                           | feature                                         | [打开输出位置] 的兜底锚点（Inherit 时取进程实际 cwd）   |
| `output_paths`                          | feature（提交时已知）＋输出解析器（运行中回填） | 详情页 [打开目录]                                       |
| `exit_code`                             | 枢纽                                            | —                                                       |
| `log_path`                              | 枢纽                                            | 日志落盘（§4.5）                                        |
| `intent`                                | feature                                         | 再次运行 / 基于此任务新建                               |
| `progress`                              | 输出解析器                                      | 进度条（运行期内存态，不落库）                          |

```rust
enum TaskIntent {
    Form(serde_json::Value),      // 表单提交的结构化意图
    Manual { argv: Vec<String> }, // 专家模式手改的命令原文
}
```

- **intent 与 argv 双存，职责不同**：intent 面向未来（重跑时由当前版本 adapter 重新翻译），argv 面向过去（审计档案，永不重新解释）。只存 argv 则工具升级后重跑走旧参数；只存 intent 则详情页无法如实展示历史。
- **`TaskIntent` 的 tag 即"表单/手改"标志位**，服务于 [基于此任务新建]：`Form` 灌回表单，`Manual` 灌回专家模式文本框。若无此区分，手改任务恢复时被迫走表单，手补的参数会无声丢失。
- **纪律：枢纽不解开 `intent`，不解析工具 stdout。** 进度/输出路径解析属于 feature 提交时附带的解析器，枢纽只转发结果。否则每接入一个工具都要改 core/task。
- **事件通道支持 feature 自定义载荷。** 交互式作业（运行中需向用户递交内容）不为其单设第三类通路——解析器发射自定义事件（`TaskEvent::Custom { name, payload }`），发起页面订阅消费。**实施期修正**：bilibili 扫码登录实际是 Rust 原生 reqwest 流（不 spawn BBDown 进程），QR 以 SVG dataUrl 经事件推送——比早先设想的"解析进程输出中的 `qr-ready: <path>`"更好，登录因此是"带自定义事件的长时查询"，不进任务系统；扩展点本身仍为其他交互式作业保留。

### 4.3 状态机

```
                        用户取消
       ┌─────────┐ ──────────────────────────────► canceled
       │ queued  │                                     ▲
       └────┬────┘                                     │ 进程确认退出
            │ 调度器分派（池内有空位）                    │
       ┌────┴────┐        用户取消              ┌──────┴─────┐
       │ running │ ─────────────────────────►  │ canceling  │
       └────┬────┘                              └────────────┘
            │
            ├─ exit code = 0 ──────► success
            ├─ exit code ≠ 0 ──────► failed
            │
   （app 崩溃/强退，下次启动对账）──► interrupted
```

- **canceled vs interrupted 的判据是"谁做的决定"**：前者是用户意志（UI 中性显示），后者是外力（UI 警示 + 主动提供 [再次运行]）。合并则无法差异化处理。
- **canceling 是必需的中间态**：杀进程树非瞬时（点✕到进程退出有秒级窗口）。不建模则出现二次取消、或进程未死时用户重跑导致两进程争写同一输出文件。cancel queued 任务无此问题，直接出队落 canceled。
- **启动对账**：启动时将库中遗留的 `running` / `queued` 统一翻成 `interrupted`（queued 备注"排队中未执行"）。**不自动续跑**——用户不在场时软件自行启动下载是意外行为。
- **正常退出确认**：存在未完成任务时弹一次"还有 N 个任务未完成，确认退出？"。
- **半成品文件政策（v1）**：不删不管，详情页如实展示输出目录；续传交给工具原生机制。
- `archived` **不是状态字段**，是视图规则（"非本会话创建的任务"）。做成字段则每次启动需批量改写全表。

### 4.4 并发控制

**决策：按资源画像分池，单一有序队列 + 跳过式调度。**

池的划分依据是任务消耗的资源类型，与任务所属功能页**正交**：

| 池                  | 容量（初始值，后续开放为设置项） | 归入的任务                                                  |
| ------------------- | -------------------------------- | ----------------------------------------------------------- |
| `download`（网络）  | 3                                | bilibili / network / music 的下载，含仅封面/字幕/弹幕等小件 |
| `local`（本地处理） | 按 CPU 核数                      | media 转码、remux、GIF、抽帧                                |

- **划分依据是资源画像（网络带宽 vs 本地算力），与功能页面正交。** 否决按页面分池：页面与资源画像不重合（media 页同时有 CPU 型转码与 IO 型 remux；music 页的下载与 bilibili 的下载抢的是同一份带宽）。
- 每个任务携带两个正交属性，均由 feature 提交 TaskSpec 时静态声明：`feature`（bilibili/network/media/music，决定 UI 着色与徽章）与 `pool`（决定调度）。池归属是设计期映射表，不是运行时判断。
- **否决：为秒级短作业增设第三个 `light` 池。** 曾为防"短任务被长任务饿死"考虑过，被两点推翻：(a) 其多数候选成员（info / formats / metadata 解析）按 §4.1 判据根本不是作业而是查询，移出任务系统后饿死场景大幅萎缩；(b) 残余场景（下载池满时只想下个封面）低频且损失小，用户取消一个长下载让位即可兜底，不值得引入第三类标签的分类歧义——remux 时长随文件体积增长、曾被误归入"轻量"，即是该歧义的实证。
- **调度算法：单一有序队列，自顶向下扫描，池满则跳过。** 任何槽位空出时，从队首起找到第一个所属池有空位的 queued 任务启动。用户心智模型保持"从上到下执行，池满的暂时跳过"一句话可解释；[置顶]（及二期拖拽）的语义是**全局的**、无歧义的。否决每池独立队列：置顶/拖拽需要向用户解释"只在同类任务内生效"，且视觉列表顺序与真实执行顺序脱节。

### 4.5 持久化

- **SQLite**（`tasks` 一张表 = 信封 schema）。否决 JSON 文件：任务是按时间查询 + 追加写 + 定期清理的典型负载，文件堆到几百条后查询/归档/清理都要手写。
- **日志不进库**：写 `logs/<task_id>.log`，信封只存路径。ffmpeg 单次转码可产出数万行，进库拖垮全表。
- **保留策略：15 天**，超期任务连库记录带日志文件一起清。无此策略则用户目录无限膨胀。纯时间制的两个已知边界，均判定可接受：隔很久再打开的用户历史为空（含上次的 interrupted 任务，会话回顾条随之无内容）；重度使用者 15 天内归档量级为数百条（普通渲染无压力，见 §8 虚拟列表）。
- **脱敏是持久化的前置条件**：adapter 参数注册表标记 `sensitive` 的 flag（`--cookie`、`--access-token` 等），落库与展示一律用脱敏版 argv，完整版只存在于进程启动瞬间。否则登录态明文存盘、明文上屏。
- **实施期补充两条推论**（样板落地时发现的设计洞）：
  1. **实况输出与事件同样脱敏**——日志文件、事件流里的每一行先过 `redact_output_line` 再落盘/上屏（屏幕即截图泄漏面）。这是对旧行为的变更：旧任务中心刻意保留原文。
  2. **intent 落库前必须 sanitize**——intent 双存供重跑，但表单原文含敏感字段值，照存即明文泄漏。Form：敏感注册表字段清空，重跑由当前登录态/设置补充（旧凭证多半已过期，语义反而更正确）；Manual：argv 存脱敏版，手改命令中的敏感值不保存、重跑需重填（UI 提示）。构造性防线：`TaskEnvelope` 不含完整 argv 字段，完整版只存在于不可序列化的 `AdapterPlan` / `TaskSpec`，并在 spawn 瞬间消费。

## 5. 命令行可见可编辑（专家模式）

**决策：表单为源、命令为影的单向绑定 + 显式分叉。禁止反向解析（改命令→回填表单）。**

三个状态：

1. **普通模式**：表单下方常驻只读命令预览，实时跟随表单（由后端 adapter 返回预览文本，保证所见即所执行）。
2. **专家模式**：点 [编辑] 后预览变为可编辑文本域，**表单整体锁定置灰**，横幅提示"提交将按命令原文执行"；[还原为表单] 丢弃手改。提交产出 `TaskIntent::Manual`，工具本体锁死不可换，argv 过安全校验。
3. **任务详情**：展示脱敏命令 + [再次运行] / [基于此任务新建]。

理由与否决方案：

- **否决：双向绑定**。任意 argv 反向解析回表单状态存在本质歧义（flag 顺序、重复、引号、表单不认识的参数），实现即泥潭。业界同类交互（JetBrains Run Configuration、DevTools Copy as cURL）均为单向。
- **否决：给高级用户裸终端**。绕过任务系统即失去队列、日志、取消、并发、历史全部能力。
- 产品意义：常驻预览是新手→专家的过渡通道（表单教认 flag，缺参数时点编辑手补），这允许**表单只保留高频参数**——现有 40+ 字段中的长尾（BiliPlus 三件套、各类 host/path 覆盖）从表单删除，由专家模式承接。

## 6. 参数注册表

每个 feature 的 adapter 维护参数元数据，**一份数据喂三张嘴**，消灭"UI 说一套、代码做一套"：

```
{ field: "accessToken", flag: "--access-token",
  sensitive: true, level: "advanced",
  condition: "仅 api ≠ web 时生效",
  help: "TV/APP/BiliPlus 接口所需的登录凭证……" }
```

消费方：① 表单字段的内联提示；② 功能页 Help 入口的参数总表；③ 持久化脱敏（§4.5）。

**边界：元数据只管语义（说明/敏感/层级/条件），不驱动表单布局。** 否决 schema 驱动的表单生成器：条件联动、布局、交互都要在 schema 里再发明一遍 DSL，复杂度高于手写表单本身。

## 7. 依赖管理 core/deps

**决策：以"工具清单 + 两种来源"取代 FULL/Lite 双发行版模型。** "一键安装"入口 = deps 模块的 UI；Lite 版当前"仍需安装且残留 BBDown 二进制"的拧巴状态随之消失。**应用内更新工具是必选项而非增强**：yt-dlp 的失效节奏决定了发行版自带的版本必然过期。

### 7.1 来源模型

| 来源                  | 含义                                                      | 解析位置                |
| --------------------- | --------------------------------------------------------- | ----------------------- |
| `managed`（应用管理） | 应用自行下载与更新；FULL 版安装时预置的工具是它的初始种子 | 应用数据目录下 `tools/` |
| `system`（系统安装）  | 用户经 PATH / winget / brew 自行安装                      | PATH 探测               |

- **managed = 应用托管**：应用在自己可写的目录里全权负责工具的下载、校验、更新、回退（类比 VS Code 之于扩展）。
- **早先设想的 `bundled`（随包附带）不再是独立的运行时来源，降级为打包期动作**：FULL 版安装器把工具预填进 managed 目录（"种子"），此后 FULL 与 Lite 运行状态完全同构。否决 bundled 独立立户的推理：随包文件在 Program Files 中只读且版本冻结于打包时刻，第一次应用内更新只能写到数据目录，于是同一工具出现两份——安装目录的旧份从此被永久遮蔽、再不会被用到，解析器却要一直维护"资源目录 vs 数据目录谁新"的比较逻辑，纯属负债。运行时自始至终只看一个应用侧位置。`dependencyPreference` 维持两值（应用管理优先 / 系统优先），语义不变，**默认应用管理优先**：managed 版本受 manifest 校验与应用内更新体系管辖，行为可预期；system 来源的版本与更新节奏不受应用控制，作兜底与用户显式偏好。
- **managed 目录放应用数据目录**（Windows `%LOCALAPPDATA%\MAD-Toolbox\tools`，macOS `~/Library/Application Support/…`）。**否决：安装目录下 `tools/`**——两条硬伤：Program Files 无管理员权限不可写（下载和更新都会失败）；应用更新时安装目录可能被安装器清空重建，工具被无谓重下。
- 目录按版本分层：`tools/<tool>/<version>/…` + 记录激活版本的状态文件，理由见 §7.3。
- **FULL 版种子注入：安装器直写 managed 目录**（`%LOCALAPPDATA%\MAD-Toolbox\tools`），利用安装时机一次到位，无首次运行复制的等待，也无"应用资源 + 数据目录"双份磁盘占用。**前提约束：安装模式保持 per-user**（Tauri NSIS 默认，装入 `%LOCALAPPDATA%\Programs`，全程无提权，`$LOCALAPPDATA` 指向正确用户）。若未来改发 per-machine 安装包，提权后的安装器解析用户目录不可靠，届时切换为"首次运行从应用资源复制"。注意与 §7.1 的区分：这里定的只是**注入手段**，工具的常驻位置仍是应用数据目录——安装目录常驻已被否决（更新会清空重建、运行时不可写）。

### 7.2 manifest 与下载

- manifest 为**纯数据 JSON**：工具名、GitHub repo、平台 → release 资产名模式、校验和来源、包内可执行文件相对路径、版本探测命令。v1 内嵌应用；做成纯数据是为了后续平滑改为远程拉取——**资产命名模式是全链路最脆弱的环节**（Windows FFmpeg 依赖 BtbN/gyan 第三方构建，命名变更已实际发生过，见 commit "pin Windows FFmpeg build asset"），远程 manifest 可在不发版的情况下修复 URL。
- 下载源 v1 仅 GitHub Releases；manifest 的下载源字段设计为**数组**，为 Gitee 等镜像预留位置但暂不实现。
- 校验：HTTPS + 上游校验文件能验则验（yt-dlp 发布 SHA2-256SUMS），并本地记录已下载文件哈希供完整性复查。
- **作用域：manifest 只覆盖单一二进制形态的工具**（BBDown / yt-dlp / FFmpeg / MediaInfo / Deno）。musicdl 是 pip 包且依赖 Python 运行时，不符合该模型，**v1 维持 system-only**：依赖页展示 `pip install musicdl` 命令 + [重新检测]（复用 §7.4 哲学）；managed 化（内嵌 Python 发行版 + venv）列为二期。
- **deps 下载必须走代理**，由此产生新的横切需求：设置页增加**全局代理**项（默认读系统代理/环境变量），deps 下载与各 feature 默认继承，feature 内的代理框降级为逐任务覆盖。

### 7.3 更新检查与替换

- **时机：启动时后台自动检查一次 + 手动触发。** 三条护栏：
  1. **非阻塞、静默失败**——目标用户环境下 GitHub API 不可达是常态而非异常。启动检查不挡 UI、失败不弹窗，依赖页只显示"上次检查时间"；
  2. **TTL 缓存**——GitHub 匿名 API 限额 60 次/小时/IP，检查结果缓存（约 6 小时内不重复请求，频繁重启 app 不重复打 API）；手动检查绕过 TTL；
  3. **检查 ≠ 安装**——发现新版仅亮徽标，下载安装需用户点击。否决静默自动更新：正在运行的任务可能正在用旧版本。
- **版本目录 + 激活指针**解决替换问题：Windows 拒绝覆盖运行中的 exe，且更新不得影响进行中的任务。新版本下载到独立目录、校验通过后翻转激活指针（新任务用新版，进行中任务跑完旧版），旧版本保留一代后清理——**顺带免费获得回退能力**，yt-dlp 偶发上游坏版本，回退是刚需。
- Windows 的 [重新检测] 需从注册表读 PATH（运行中的进程看不到 PATH 变更），否则用户刚用 winget 装完回来点检测会误报未安装。

### 7.4 与系统包管理器的关系

**否决：由应用驱动 winget / homebrew 安装。** 理由：winget 在部分 Windows 版本（LTSC 等）缺席且可能触发 UAC；brew 未预装、首次运行极慢；版本由包管理器仓库决定，应用失去"已知可用版本"的控制；驱动交互式 CLI 并解析其失败输出十分脆弱。

**替代：依赖页对每个工具展示可复制的安装命令**（`winget install yt-dlp` / `brew install ffmpeg`）+ [重新检测] 按钮。与 §5 专家模式同一哲学：把命令亮给用户，执行交还用户。覆盖该诉求九成价值，实现成本接近零；装好后按 `system` 来源被探测到，天然享受包管理器自己的更新体系。

## 8. 前端信息架构与 UI / UX

### 8.1 导航与工作区

**决策：采用 `Top L1 + 可选 Left L2 + Workspace`。** 操作系统原生标题栏保留；应用导航是原生标题栏下方的一条 WebView 工具栏，不把 React 控件伪装成系统菜单或窗口控制。

顶栏使用不受左右内容宽度影响的三列布局 `1fr auto 1fr`：

- 左侧：应用图标与 `MAD Toolbox`；
- 中间：按 `Tasks → Bilibili → Network Video → Media → Music → Settings` 排列的 L1 纯图标导航；
- 右侧：GitHub 等低频外部入口。公司品牌入口只有在提供正式 Logo 资产与目标 URL 后才加入，不使用占位素材。

L1 图标必须有顶部 Tooltip（鼠标悬浮与键盘聚焦均可触发）、`aria-label`、`aria-current="page"`、明确的 active/focus 状态。后台搜索、未提交草稿和错误不能共用一个含义不明的圆点；如需状态提示，图标徽标与 Tooltip 必须表达具体状态。

L2 只在确有并列工作流时出现：

| L1            | L2                                                          | Workspace 规则                        |
| ------------- | ----------------------------------------------------------- | ------------------------------------- |
| Tasks         | 无                                                          | 全宽；承担启动页与跨 feature 状态入口 |
| Bilibili      | 无                                                          | 全宽下载工作区                        |
| Network Video | 无                                                          | 探测与下载属于同一工作流，不拆 L2     |
| Media         | PR 智能兼容 / 转码 / 重新封装 / 流提取 / GIF / 图片与帧导出 | 左侧 L2；每页只展示该工作流需要的参数 |
| Music         | 无                                                          | 搜索、结果选择与歌单作为同页内部模式  |
| Settings      | General / Dependencies / About & Licenses                   | 左侧 L2                               |

否决全局常驻左栏：Bilibili、Network、Music 与 Tasks 不需要 L2，空侧栏只会压缩工作区。壳使用稳定的 `WorkspaceFrame`，通过 `navigation` 插槽组合 L2；不能在两种父容器之间替换 Workspace，否则会卸载内部 Activity 缓存。取消全局 `maxWidth: 980px`；结果列表和任务页可以铺满，普通表单由页面自己限制可读宽度。

Home route 删除，原职责按所有权迁移：

- 任务回顾进入 Tasks，并在顶部 Tasks 图标展示准确计数；
- 依赖异常进入 Settings / Dependencies，同时在受影响的功能页就地提示；
- 版本、发行模式、平台、项目说明与许可进入 Settings / About & Licenses；
- GitHub 进入顶栏右侧；
- 功能入口卡片由 L1 导航取代，不保留第二套入口。

启动 route 明确定义为 Tasks，不依赖导航数组第一项，也不恢复上次页面。任务提交后的导航与会话释放解耦：默认留在原工具页，以通知和 Tasks 徽标反馈；用户主动进入 Tasks 查看进度。Music 必须留在原页以连续创建多批下载任务。

### 8.2 类型化路由

当前平坦 `NavPage` 改为判别联合，使不合法的 L1/L2 组合无法通过编译：

```ts
type MediaPageId = "pr-compatible" | "transcode" | "remux" | "extract" | "gif" | "image-export";

type SettingsPageId = "general" | "dependencies" | "about";

type AppRoute =
  | { section: "tasks" }
  | { section: "bilibili" }
  | { section: "network" }
  | { section: "music" }
  | { section: "media"; page: MediaPageId }
  | { section: "settings"; page: SettingsPageId };
```

当前没有 URL、浏览器历史或 deep-link 需求，不引入 React Router。`navigateL1` 进入 Media/Settings 时恢复本次进程内最后访问的合法 L2；`navigateL2` 只能接受当前 L1 的页面 ID。Tasks 的“基于此任务新建”通过纯函数把 `TaskIntent` 映射到精确 route，Media 必须依据 `intent.data.operation` 进入对应 L2；若目标工作区已有未完成草稿，不得静默覆盖。

### 8.3 工作区会话生命周期

**决策：保护的是未完成的业务会话，不以 route 或 DOM 是否挂载充当业务真相。** 四个 Feature 工作区首次访问时才创建并挂载；之后导航只切换 `visible/background`。会话宿主独立于高频 Task store，至少记录 `generation`、`phase` 与待处理查询：

```text
pristine → editing → submitting ──成功返回 taskId/taskIds──→ releasable
                  └──失败──────────────────────────────→ editing
editing ──用户明确放弃────────────────────────────────→ releasable
```

- Bilibili、Network 与每个 Media L2：后端返回有效任务 ID 后才允许释放；预览、探测或登录成功不等于进入任务队列。
- `releasable` 表示“离开时允许卸载”，不是让当前页面提交成功后瞬间消失。提交失败完整保留输入、专家命令、预览与错误。
- 正在运行的扫码登录、格式探测等异步操作必须先结束、取消，或通过 generation token 保证旧结果不会写入新会话，页面才可淘汰。
- 每个 Media L2 拥有独立的可变草稿；编码器能力、默认设置等只读数据可以共享。复用另一页输入应是显式动作，不能由共享可变字段暗中传播。
- 会话只驻留当前应用进程。Cookie、Token、代理凭据等敏感字段不得为了恢复页面而写入 `localStorage` / `sessionStorage`。

React 19.2 的 `<Activity>` 用于保留后台页面的 DOM 与本地状态，同时停止隐藏页面的 Effect；否决只用 `display: none`，因为它不会停止预览计时器、事件监听或 Portal。页面首次访问前不加载，避免用户从未进入 Media 时就探测 FFmpeg。所有 Modal、Menu 与 Tooltip 的打开状态仍须由 active route 限制，后台页面必须 `inert` / `aria-hidden`，焦点回到当前工作区。

Music 搜索是例外状态机：

```text
idle → searching(jobId) → ready(sessionId) → enqueueing → ready（可重复）
ready ──新搜索成功启动──→ searching(newJobId)
ready ──结束本次搜索───→ releasable
```

- 一次 `musicdl_download` 入队后保留结果与后端 `sessionId`，允许继续选择其他结果；成功项应有明确标记，默认清空本次选择以避免误重复。
- 修改关键词本身不释放旧结果；只有新搜索成功返回新 `jobId` 后才替代。新搜索启动失败时恢复旧会话。
- “停止正在运行的搜索”与“结束已完成的结果会话”是两个操作。前者必须真正终止后端子进程，不能用卸载页面冒充取消。
- Music 与 Bilibili 的全局 Tauri 事件各注册一次，写入常驻控制器或 store；不能依赖隐藏页面内部的 Effect 接收后台终态。
- UI 释放不能立即删除 Music 会话文件；排队和运行中的下载任务仍可能引用 `results.pickle`，文件清理由后端在引用结束后延迟执行。

### 8.4 前端目录与组件纪律

```text
src/
├── main.tsx                       # src 根目录唯一 React 文件
├── app/
│   ├── App.tsx                    # 装配 provider、route 与页面
│   ├── navigation.ts              # 纯导航数据
│   └── route.ts                   # AppRoute 与任务→route 映射
├── pages/
│   ├── tasks/TasksPage.tsx
│   ├── bilibili/BilibiliPage.tsx
│   ├── network/NetworkVideoPage.tsx
│   ├── media/                     # 六个显式 L2 page
│   ├── music/MusicPage.tsx
│   └── settings/                  # General / Dependencies / About
├── components/                    # 所有非 page 视觉组件，单层放置
├── contracts/                     # Tauri DTO / event 镜像
├── stores/                        # task 与 workspace 分离
├── hooks/
├── lib/                           # 无 UI 的纯工具
├── styles/                        # 全局样式与动画 keyframes，唯一自定义 CSS 位置
└── assets/
```

- Page 是路由入口，只负责编排命名明确的原子组件；一个 `.tsx` 文件只公开一个具体组件或一个不可拆的紧密组件族。
- 所有非 Page 的视觉组件（包括 TopNavigation、LeftNavigation、Workspace、导航项）统一放在 `components/`，不再设 `layouts/` 或前端 `features/`。
- 组件名必须表达领域与职责，如 `MediaInputPicker`、`BilibiliDownloadOptions`；禁止脱离语境的 `Header`、`Section`、`Item`，也不为单个 Label/Input 制造包装组件。
- API、form、template 与解析逻辑是非视觉代码，可与对应 `pages/<domain>/` 共置；Tauri command 名与载荷类型仍以 `contracts/` 为边界。避免 barrel export，使用可静态分析的直接 import。
- Mantine 是唯一组件与主题体系；不混入第二套 CSS 框架。动画仅使用 Mantine 自带能力，长列表没有实测瓶颈前不引虚拟列表。

### 8.5 其余产品规则

- 渐进披露建立在参数语义上：常用字段直接展示，高级字段折叠，长尾参数进入专家模式（§5）。
- 网络错、工具错、用户输入错分别给出重试、更新依赖、修正字段的提示；原始日志不是默认错误文案。
- Tasks 保持单列表 + feature 徽章，按运行、排队、本会话终态、历史归档分段；池占用使用离散槽位而非连续进度条。
- 设置页区分全局默认值与单次任务覆盖值。新 generation 才读取最新默认值，Settings 更新不能静默改写正在编辑的草稿。
- 模板字段改名必须有 schema 版本与迁移，或明确清空旧版本；不能静默读取成半有效状态。
- 不做应用内完整日志查看器；失败详情显示末尾若干行并提供打开完整日志/所在目录。

## 9. 进程生命周期（Windows 优先）

- app 退出时主动 kill 全部子进程树（Windows 上子进程不随父进程退出；ffmpeg 被遗弃会留半成品且占用文件句柄）。
- 子进程创建带 `CREATE_NO_WINDOW`；注意 stdout 编码（GBK/UTF-8 混杂的工具输出）。
- 取消 running 任务 = kill 进程树 + 等待退出确认，对应 canceling 态（§4.3）。

## 10. 未定案清单

| 事项                                                      | 现状                                            |
| --------------------------------------------------------- | ----------------------------------------------- |
| 全局智能粘贴入口（URL 分发并预填目标工作区）              | 二期；Home 已删除，未来若实现应成为显式全局动作 |
| 公司宣传 Logo 与目标 URL                                  | 等待正式品牌资产；顶栏不使用占位图              |
| tauri-specta 类型自动生成                                 | 接口稳定后评估；v1 手写 TS 镜像                 |
| 拖拽排序                                                  | 二期（已确认）                                  |
| BBDown 登录态与未来 managed 工具版本目录冲突              | deps 阶段迁至稳定应用数据目录                   |
| BBDown 进度解析                                           | `LineParser` 与事件通路已就绪，解析规则待接入   |
| 远程 manifest、镜像、系统包管理器驱动、musicdl managed 化 | 二期候选                                        |

## 11. 实施顺序

当前后端主作业链（结构化意图 → adapter → TaskHub → process/store/event）已经成立，但模块归位和前端信息架构仍未完成。后续按下列可独立验证的阶段推进，机械移动与行为变化不混在同一阶段：

1. **基线清理与契约盘点**：删除原测试代码及纯测试依赖/fixture；清理运行产物；统一跨平台 npm 脚本；核对前端调用与后端注册的 command/event。该阶段已完成，后续不得借重构恢复任意 argv 或双轨事件。
2. **文档冻结**：将 Top L1、可选 L2、Home 职责迁移、目录纪律和会话生命周期写入本文档；以本节而非旧 UI 作为验收基线。
3. **纯目录迁移**：`App.tsx → app/App.tsx`，页面迁入 `pages/<domain>/`，视觉组件统一到 `components/`，删除 `V2` 与 `layouts/features` 过渡命名；只改路径和 import，保证行为等价。
4. **类型化路由与新壳**：建立 `AppRoute`、TopNavigation、带可选导航插槽的稳定 WorkspaceFrame；恢复全平台原生标题栏；删除 Home route 和永久侧栏前先完成职责迁移。
5. **会话宿主**：四个 Feature 首次访问后缓存；普通页面按入队结果进入 releasable；Tauri 全局事件改单例订阅；处理后台 Portal、焦点和敏感字段。Music 先完成可重复入队，再增加真实搜索取消与显式结束会话。
6. **Media 拆页**：先修正批量提交的部分入队语义，再按六个 L2 工作流拆分；每个 L2 草稿独立，九种后端 operation 均有唯一入口，重跑进入精确页面。
7. **页面原子化**：按 Bilibili、Network、Music、Tasks/Settings 分域拆小提交；Page 只编排，组件使用领域+职责命名，不制造万能 FormSection 或布尔模式组件。
8. **后端边界收尾**：`core/redaction`、`core/deps`、`core/settings` 先断开 feature/core 对 crate root 的反向依赖；Bilibili login、Media query/策略、Music runtime 归回各域；TaskHub commands 归 core/task，淘汰旧状态/事件；最终 `lib.rs` 只保留模块声明、插件/State 装配、handler 列表和 `run()`。
9. **依赖管理**：在模块边界稳定后实现 §7 的 managed 工具、manifest、更新和代理策略，不与 UI 目录迁移并行混改。
10. **完成审计**：逐项核对 command/event、历史 `TaskIntent`、四域提交/重跑/取消、Music 多批下载、Media 全 operation、Settings/Home 职责迁移、Full/Lite 与 Windows/macOS 原生窗口行为；运行 TypeScript、Vite、Cargo 和打包配置检查。项目按要求不保留自动测试，因此不能以“测试绿色”代替这些契约与手动主路径验证。

**迁移策略仍为绞杀式，但“过渡态可运行”不等于“重构完成”。** 每一阶段结束即删除该阶段产生的旧入口与兼容壳；不同时保留两套导航、两套事件或两套状态真相源。
