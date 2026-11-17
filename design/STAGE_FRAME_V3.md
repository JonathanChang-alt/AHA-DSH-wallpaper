# 鎏金剧场完整金框 — preview.3

用户批准：补齐左侧金框，让整圈画框贴合壁纸区域。

## 最终构成

1. 外围场景补绘：[gilded-stage-scene.webp](../assets/gilded-stage-scene.webp)。去除原图烘焙的倾斜边框，延续红幕与舞台背景。
2. 透明完整金框：[stage-gold-frame.webp](../assets/stage-gold-frame.webp)。左、右、上、下与四个角闭合，使用九切拉伸贴合主区域；角花不会随窗口比例变扁。
3. 原图保护层：保留 [gilded-stage.webp](../assets/gilded-stage.webp)，在运行时覆盖人物中心，保持原始面部、服装和主体细节。外围发丝、舞台和过渡区域仍含 AI 衍生内容，不声称全图逐像素不变。
4. 清晰场景保持原比例；不同窗口比例的空隙由柔化背景承接。没有全图浅色雾层，显影仍由用户控制。

新框位于壁纸上方、原生控件下方，不接收鼠标事件；它与原帷幕框互斥，随装饰开关隐藏。其他两张壁纸继续使用原帷幕样式。动态壁纸后续可在相同框内替换媒体层。

## 生成与保存

使用 **内置 image_gen**，未使用 CLI/API fallback。两条最终提示词、透明背景选项及保护策略完整保存在 [stage-edit-prompts.json](../assets/stage-edit-prompts.json)。

工作区保留原始输出 `design/assets/stage-v3/stage-clean.png`、`design/assets/stage-v3/stage-frame.png`；这些仅是作者源文件，不随安装包分发。`scripts/prepare-stage-frame.py` 只负责等比缩放、编码 WebP 和检查透明中心，不重绘图像。源立绘文件及新资产 SHA-256 见 [provenance.json](../assets/provenance.json)。

## 本机检查

在 DSH `0.2.1-rc.2` 的独立官方 web 运行时检查 2560×1600、1706×1066、1280×800 和 1024×768：框与主区域四边一致，没有文档横向溢出，输入框仍能接收鼠标操作。人工检查旧框残边、接缝及面部清晰度；切换装饰和壁纸后正常恢复。完整验证范围见 [VALIDATION.md](../VALIDATION.md)。

源码目录的评审截图位于 `design/screenshots/windows-v3/`。媒体的公共分发条件仍沿用项目 NOTICE 中的待确认状态。

## preview.10 更新

本文件上方记录 preview.3 的制作过程。当前已将宽高差异处的柔化底图替换为清晰红色帷幕，见 `assets/gilded-stage-clear-backdrop.webp`；完整人物视频、静态原图保护层和独立金框继续保留。新背景不含人物或前景卡牌，不重复主体；stage 底图的滤镜明确为 `none`。提示词和来源见 `assets/stage-clear-backdrop.source.json`，当前真实界面截图见 `design/screenshots/ui-v10/clear-stage.png`。
