# Obsidian Anki Sync

基于 [AnkiConnect](https://foosoft.net/projects/anki-connect/) 的 Obsidian 闪卡同步插件。插件会扫描当前打开的笔记，提取带有特定标识的内容，并生成 Anki Basic 类型的卡片。同步时会按照笔记所在的文件夹层级自动创建子牌组，并在卡片中加入面包屑路径和快速跳转回 Obsidian 的链接。

## 功能特性

- 自定义闪卡标识，通过注释块（例如 `<!--ANKI-START-->`）编写卡片内容。
- 依照笔记所在目录结构自动生成牌组名称，可在设置中指定顶层牌组。
- 在 Anki 卡片顶部显示笔记所在位置的面包屑路径。
- 卡片正面自动包含一个跳转回对应笔记行的 `obsidian://` 链接。
- 记住已同步的卡片并在修改后更新，而不是重复创建。

## 闪卡书写格式

1. 在插件设置中设定闪卡标识（默认 `ANKI`）。
2. 在笔记中使用以下结构编写卡片：

   ```markdown
   <!--ANKI-START-->
   光合作用的主要器官？
   <!--ANKI-BACK-->
   叶片
   <!--ANKI-END-->
   ```

   如果自定义了标识，例如填写 `BIO`, 则应写作 `<!--BIO-START-->`/`<!--BIO-BACK-->`/`<!--BIO-END-->`。

3. 可在一个文件中编写多张卡片，插件会依次提取并同步。

## 使用方法

1. 在桌面端启动 Anki，并确保已安装并启用 AnkiConnect 插件。
2. 在 Obsidian 中安装并启用本插件。
3. 打开包含闪卡的 Markdown 文件。
4. 通过命令面板执行「同步当前笔记到 Anki」，或为该命令绑定快捷键。
5. 同步完成后可在 Anki 中查看生成的卡片。

## 插件设置

- **闪卡标识：** 生成注释标记时使用的关键字，默认 `ANKI`。
- **顶层牌组名称：** 同步时创建的根牌组名称，子牌组会按照文件夹层级自动生成。
- **AnkiConnect 地址：** AnkiConnect 服务的访问地址，默认 `http://127.0.0.1:8765`。

## 开发与构建

```bash
npm install
npm run dev   # 开发模式
npm run build # 生成生产版本
```

构建完成后，将 `manifest.json`、`main.js` 与（如果有的话）`styles.css` 复制到 `<Vault>/.obsidian/plugins/obsidian-anki-sync/` 目录即可在 Obsidian 中手动安装。
