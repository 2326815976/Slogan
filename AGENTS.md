# Slogan 项目开发规范

在本仓库及其子目录开始开发、修复或代码审查前，读取并遵循 `docs/SOP/开发规范.md` 中 `开发规范：` 标题后的条款。每次任务以该文件的当前内容为准。

在仓库根目录用 PowerShell 仅读取规范正文，跳过文件开头的数据库连接信息。

```powershell
$guide = Get-Content -LiteralPath 'docs/SOP/开发规范.md' -Raw -Encoding UTF8
($guide -split '(?m)^开发规范[：:][ \t]*\r?$', 2)[1]
```
