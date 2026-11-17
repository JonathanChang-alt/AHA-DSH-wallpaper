# AHA-DSH-wallpaper — 扩展接口设计草案

状态：preview.18 已有鎏金剧场、棋盘茶会、绯红戏法三款动态壁纸，欢愉登场保留静态。漫画镜像后与其他壁纸统一左侧聊天，为右下两倍无文字贴框风车留出空间。三款200px即梦动态头像、环境动效、三款动态欢迎和阅读UI已接入；音乐和紫白palette仍为扩展约定。

## 外观配置

- `src/client/palette.mjs` 通过 `ctx.theme.overrideTokens()` 管理页面、侧栏、正文、代码、菜单、强调色与状态。首版浅色 palette 同时覆盖宿主 light/dark token 分支，不修改宿主保存的模式选择；停用恢复原叠层。
- 首版只提供 `light-red-white` 外观。
- 为后续紫白外观保留独立 palette 注册位置；不在首版显示一个无法使用的主题切换项，也不提前规定其明度。
- 壁纸、动效、音乐等偏好独立于外观配置，日后换色不应清空用户资源和偏好。

## 壁纸资源

动态贴纸/壁纸规则见 `DYNAMIC_PLAYBACK_SPEC.md`。preview.5 已实现播放机制；没有对应视频素材时仍使用静态渲染。

`assets/catalog.json` 声明内置 ID、名称、文件、缩略图、布局和焦点。构建时生成 `{id, kind:'image', src, thumbnail, layout, position}` 描述，并内嵌本地资源；运行时偏好仅保存白名单 ID，不保存路径或 URL。来源与哈希另见 `assets/provenance.json`。

鎏金剧场增加 `originalFile` 与 `frame:'stage-gold'`。构建器将前者转换为 `originalSrc`，渲染器以原始立绘中心覆盖外围补绘，遮罩坐标跟随实际图片尺寸，避免窗口留白令旧框露出。透明九切金框单独跟随主区域边界，置于操作层下方；随装饰开关显示，与旧帷幕框互斥。未来视频应沿用这条独立画框边界，不将画框烘焙进每一帧。

preview.10 增加可选 `backdropFile`，构建为包内 `backdropSrc`。鎏金剧场使用无人物的清晰红幕衔接完整视频或静态画面的两侧，`stage` 布局明确取消底图模糊；没有该字段的资源沿用原有回退。此字段是作者资源配置，不开放用户路径或外部 URL。UI 第二轮样式在 `src/client/ui-refinements.css`，拼入同一个主题自有 style，停用时一起清除；设置的动态标记仅由真实 motion 资源产生。

preview.11 的 `src/client/reading.css` 仍拼入同一个自有 style；不注入 Markdown 或改写用户/模型正文。使用官方代码/表格/工具数据属性，少量版本限定 class 针对 0.2.1-rc.2 的原生错误行和确认框。`aha-host-center` 是 inline-size 容器，实际宽度 ≤900px 时收回聊天装饰留白，以适配被右侧文件预览压缩的窗口；媒体播放、随机欢迎和偏好机制不变。

漫画壁纸 `scarlet-trick` 使用 `layout:'manga'` / `frame:'manga'`，完整比例显示白底原图；独立 CSS 红黑边框随装饰开关显示。preview.18 使用作者字段`mirrored:true`在媒体层水平镜像，运行时`data-mirrored`控制完整媒体栈，设置缩略图同向；视频、海报和静态回退不分别处理。阅读与输入沿用所有壁纸的左侧布局，小窗口按主区域宽度收回装饰留白。切换资源自动移除镜像，不改变用户偏好或原始资源。

`src/client/wallpaper-surface.mjs` 提供 `update({wallpaper, opacity, motionEnabled, paused})`、`setPlaybackAllowed(boolean)`、`retryPlayback()`、`getState()` 和 `dispose()`。静态描述不变，可选 `motion:{src,poster?}` 关联包内视频；同一图库 ID 保留收藏。兼容 `kind:'video'` 加 `poster` 的描述，但新作者配置统一用独立 motion 清单。视频就绪时隐藏静态图与原图保护层，失败时恢复；金框始终独立。

`assets/motion-catalog.json` 为包作者的白名单清单，声明已有 wallpaper/welcome ID 对应的 MP4/WebM 与可选海报。构建校验包内文件名、已知 ID 与素材独立性，并生成 `WELCOME_MOTION` 与壁纸 `motion`。当前仍使用包内 data URI，只有当前选中的资源创建播放器。空清单不会渲染无可用资源的动态控件。文件哈希进入 provenance；同名 `.source.json` 存在时一同打包并记录来源、生成与处理方式。原始权利仍需在正式分发前确认。

preview.16 新增 `teatime` / `scarlet-trick` motion条目，原图库ID和静态资源不变。两段收到的MP4原样保存；编码规范为96帧、24fps、4秒静音MP4，采用固定BT.709/方形像素，最后六帧逐步混合到首姿态，不倒放。场景和漫画的新视频不启用隐式模糊铺底，只有stage或显式backdrop/original组合保留该层；避免漫画留白处出现模糊的重复人物。

- 首版资源类型：静态图片。每张阿哈立绘独立配置焦点和裁切，不能统一 `center/cover`。
- 后续资源类型：本地视频。与图片共用壁纸选取和焦点配置；动画壁纸额外支持暂停、恢复和释放资源。
- 动态壁纸默认静音，不承载音乐；音乐为独立资源与用户操作。
- 遵守窗口不可见、减少动态、主题停用等生命周期条件。具体宿主信号在实现阶段验证。
- 图片、视频均须有静态回退。缺资源时保留可用的红白主题，不显示损坏图标。
- 发行包资源不依赖开发者的 `C:\AHA` 路径；当前使用包内资源生成 data URI，不需要平台文件路径。

## 新会话欢迎区

`src/core/welcome.mjs` 为新会话随机选择 `wink / heart / shy`，不与风车状态或外观设置联动。`src/client/welcome-hero.mjs` 通过官方根级 hero brand slot 呈现，并只读订阅 `uiSession.adapter.current` 的主会话 key。选择按会话 ID 缓存，重复渲染、悬停、输入、设置变更或重连不重新抽取；不存在的临时绑定不触发切换。三个形象均保留，前两个整体居中，第三个保留探头布局。风车继续使用独立素材。

`welcome-surface.mjs` 单独管理可选视频：自然结束后默认等待 6000ms，暂停在收尾帧，随后从头播放。普通偏好变更不会重建播放器，新会话才重置；第一次原生绑定只认领已经显示的欢迎。后台/减少动态暂停，并保留间隔剩余时间。`video-playback.mjs` 统一静音、异步 play 竞争、错误及释放；所有计时器在停用时清理。

新增偏好 `welcomeMotionEnabled`、`dynamicWallpaperEnabled` 默认 true，`wallpaperPaused` 默认 false；继续兼容 version 1 的已有设置。壁纸暂停独立于风车和模型活动，输入区动效开关不改变这些偏好。

## 输入区与任务动效

`ambient-surface.mjs` 单独持有两个代码绘制的 SVG 吊星、两个光点与一个微光节点，`ambient.css` 拼入同一个主题自有 style。`environmentMotionEnabled` 默认 true，兼容原 version 1 存储，独立于输入/欢迎/风车；`scene.mjs` 用已有活动、偏好与布局信号控制显示和 CSS 播放状态。暂停壁纸、后台及减少动态会暂停时间线；关闭装饰/环境、非 stage 资源、非会话面板或不足 850×600 的主区域隐藏。没有新 JS 动画循环，停用移除整个节点。

`src/client/stage-components.mjs` 通过官方 `conversation.input.overlay` 和 `conversation.composer.dock` 插槽加入不接收输入的边缘装饰和任务徽章。原生输入框、发送、停止与附件交互继续由宿主负责；不捕获发送快捷键，不触发模型调用。

`src/client/stage-presentation.mjs` 只读使用现有 activity 事件与主区域 DOM 标记。任务 ID 的 turn 必须与 `data-chat-turn` 相同，且原生过程组仍有实时 shimmer，才允许过程组动画；单行思考同时检查原生 running 状态。完整 turn 结束、切会话或停用时回收自有标记。观察器不监听正文字符变化，只处理结构和有限状态属性。

偏好 `interfaceMotionEnabled` 默认开启，沿用 version 1 的向后兼容默认值；与 `windEnabled` / `windPaused` 独立。动画需同时满足此偏好、页面可见及系统未启用减少动态。此开关只控制本主题新增的输入/任务动画，不改写宿主本身的加载动效。

## 风车小阿哈：播放约定

- 独立开关，右下壁纸留白处显示，不能挡住正文与输入框。
- 可控播放层提供 `play`、`pause`、`dispose` 及播放状态；暂停时保留当前画面，再次点击恢复。
- 正式实现优先验证现有 MP4 的播放控制；GIF 本身不提供可靠的原生逐帧暂停接口。
- 已使用正式 MP4 验证浏览器播放、暂停定格、恢复、隐藏、减少动态与销毁；画面为不透明小卡片，不冒充透明人物贴纸。
- `src/core/activity.mjs` 统一任务状态；`src/client/host-adapter.mjs` 只读观察当前主会话。只有新运行任务的 `completed` 结束才触发印章；失败、取消、历史与重连不触发。
- 无声音。主题关闭后，节点、播放器与计时器必须清理。

## 右上角剧场肖像

`src/client/portrait-surface.mjs` 创建头像按钮，`portrait.css`拼入同一个主题自有style。`assets/portrait-catalog.json`提供`smile / cheek-wink / peace`三款方形静态图，motion清单的`portraits`分组关联各自视频；构建导出`PORTRAITS`。头像仅持有当前选择的一段静音循环视频，复用`createVideoPlayback`；切换和停用释放旧视频，关闭动效或播放失败显示对应静态图，不复用欢迎和风车素材。

`selectedPortrait`默认`cheek-wink`，`portraitMotionEnabled`默认true，`portraitPaused`默认false，兼容旧v1设置并保存；手动选择，不自动轮换。壁纸暂停、风车和任务状态不改变头像播放。后台、减少动态及布局隐藏时暂停，独立暂停定格当前帧。

`portraitEnabled` 默认 true，与其他偏好同属 v1 存储；旧偏好缺失此项时补默认值，不重置壁纸或暂停状态。场景按主区域实际边界放置 200×200px 头像，右距 100px、上距 124px，不改变宿主布局。关闭装饰、非会话、主区域小于 850×600 或碰到原生阅读/输入/欢迎/顶栏内容时隐藏。ResizeObserver 观察相关区域尺寸，空间恢复时重新显示；不用全正文 MutationObserver 追踪流式消息。

按钮支持鼠标及原生 Enter/Space 激活，复用现有主题设置对话框。关闭设置返回头像焦点；若头像已关闭或因布局隐藏，则返回侧栏主题入口。轻微悬停变化随界面动效和减少动态条件控制，停用时节点与 CSS 一同移除。

## 音乐资源：仅预留

用户之后会选择歌曲并作为 GitHub 下载资源提供。本阶段不制作音频导入、播放列表或播放器，不下载曲包，也不内置音频。

未来曲包可用一个 manifest 描述曲包版本、曲目 ID、显示名称、本地资源位置、可选封面与来源信息。下载与播放职责分开：只在本地资源可用且用户主动播放后启动音频。

预留播放器控制的职责为加载曲包、播放、暂停、切曲、调节音量和释放资源。具体函数签名、持久化方式与跨平台资源定位在开始接入曲包时确定，不能把本草案当作已经可调用的接口。

默认无声、不自动播放；切壁纸、开会话、完成任务或启用主题均不自动触发音乐。

## 验证边界

隔离的真实 DSH web 运行时已验证装载、设置、启停及短只读模型任务联动；长任务、Electron 原生窗口、86 切换与 macOS 仍需后续验证，详见 `../VALIDATION.md`。

## 右下风车媒体

preview.15 将画布放大为原来的两倍，仅保留视频子元素，彻底移除可见状态胶囊和其CSS。`WIND_VISIBLE_BOUNDS` 为现有25帧视频的 alpha≥16 联合可见边界(132,16)-(504,486)/512，来源元数据记录在 `wind-aha-v2.source.json`。保持固定布局锚点，按 stage-gold/manga/curtain 的26/12/10px内缘距离定位；不每帧重新扫描或移动容器。按钮及碰撞范围使用可见联合范围，完整视频由内部负偏移原样呈现，不裁切人物、不让透明留白拦截输入或造成误隐藏。新增欢迎、肖像及顶栏避让，谢幕印章在可见形象上方留18px。风车仍由原生按钮语义、title、aria-pressed与设置表达控制状态，媒体与原视频哈希不变。

preview.9 使用包内 `wind-aha-v2.webm` 和透明 WebP poster。构建导出 `WIND_ASPECT_RATIO`，场景据此计算完整贴纸高度与碰撞范围，并让谢幕印章留在其上方；不能继续使用旧宽幅视频的高度常数。媒体与欢迎/壁纸资源分开，保留独立暂停偏好。旧宽幅素材归档到作者目录，原始手机录屏也不随包分发。
