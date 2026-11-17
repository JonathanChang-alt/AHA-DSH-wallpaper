# AHA-DSH-wallpaper

DeepSeek Harness 的非官方阿哈红金剧场主题，当前预览版 **0.1.0-preview.19**。

红幕、金框和角色装饰围绕阅读区呈现，保留 DSH 原有的会话、输入、工具和面板操作。默认静音，动效可以关闭。

## 下载与安装

1. 前往 [Releases](https://github.com/JonathanChang-alt/AHA-DSH-wallpaper/releases) 下载 `dsh-aha-theme-0.1.0-preview.19.tgz`。
2. 在 DSH 的插件页面安装本地 tarball，选择下载的 `.tgz`，无需解压。
3. 启用 `dsh-aha-theme`。左栏底部「阿哈主题」打开设置。

请先在独立试用环境中评审。与其他完整皮肤的正式切换尚未验证；本项目提供的隔离试用不会更改现有桌面 profile。

## 已有内容

- 深红侧栏、原立绘「星神·阿哈」字标、红幕金框及浅色阅读面。
- 四张内置壁纸：鎏金剧场、欢愉登场、棋盘茶会、绯红戏法；其中三款支持动态，欢愉登场保持静态。
- 绯红戏法镜像呈现，阅读区和输入框靠左，右下留给小阿哈；其他壁纸使用同样的聊天布局。
- 三款透明动态欢迎贴纸：每个新会话随机，同会话保持；播完停6秒再循环。
- 右上200px红金框头像：原「剧场肖像」为新安装默认静态头像，另有欢笑、贴脸眨眼、比耶微笑三款动态头像。
- 右下透明风车小阿哈：仅回复或执行任务时播放，点击暂停/恢复，形象下沿贴框，无状态文字框。
- 壁纸收藏、显影、阅读遮罩、装饰及独立动态开关；设置自动保存。
- 壁纸暂停定格、静态回退；后台和系统减少动态时暂停，空间不足时优先保留原生阅读和输入。

音乐和紫白外观暂未实现。

## 兼容与验证

| 项目 | 当前范围 |
| --- | --- |
| DSH | 0.2.1-rc.2 |
| Windows | 已验证该安装自带的官方Web Host隔离环境；原生Electron窗口的最终装载仍待单独实测 |
| macOS | 尚未完成原生界面实机验证 |
| 开发环境 | Node.js 22.15及以上 |
| 布局 | 2560×1600、1706×1066、1280×800、1024×768逻辑视口 |

40项Node测试已通过；安装包已在独立DSH profile中实际安装并检查静态默认头像、三款动态头像切换、壁纸、风车和媒体释放。源码已在本地通过测试和构建，不等同于macOS/原生窗口实测。自动构建配置作为`design/ci-template.yml`模板提供，当前发布未启用GitHub Actions。

## 从源码构建与独立试用

```powershell
npm ci --ignore-scripts
npm test
npm run build
npm pack --ignore-scripts
```

Windows上已安装DSH后，可在项目目录运行：

```powershell
npm run trial
npm run trial:open
```

使用项目目录内的 `.trial-home` 和独立 `aha-trial` profile，默认只监听 `127.0.0.1:19659`。停止用 `npm run trial:stop`；更新构建后停止、启动再打开。首次使用可关闭DSH原生登录提示评审外观，需要模型功能时在隔离环境内自行登录。

安装目录不同可使用 `scripts/start-trial.ps1 -DshInstallDir 'D:\Apps\DeepSeek Harness' -Port 19660`。试用状态、账号和会话不得提交到仓库。

## 许可与素材

原创代码和文档采用 [MIT](LICENSE)。插画、角色形象、字标、视频及衍生视觉素材不在MIT授权范围内，权利属于各自所有者；来源和处理记录见 [NOTICE](NOTICE) 及 [素材记录](assets/provenance.json)。资源的可分发状态尚未逐项确认，本预览不声明已获得完整素材授权。

这是非官方同人主题，与DeepSeek、HoYoverse或相关作品权利方无隶属或背书关系。
