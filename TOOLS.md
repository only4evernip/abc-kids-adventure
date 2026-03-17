# TOOLS.md - Local Notes

Skills define _how_ tools work. This file is for _your_ specifics — the stuff that's unique to your setup.

## What Goes Here

Things like:

- Camera names and locations
- SSH hosts and aliases
- Preferred voices for TTS
- Speaker/room names
- Device nicknames
- Anything environment-specific

## Examples

```markdown
### Cameras

- living-room → Main area, 180° wide angle
- front-door → Entrance, motion-triggered

### SSH

- home-server → 192.168.1.100, user: admin

### TTS

- Preferred voice: "Nova" (warm, slightly British)
- Default speaker: Kitchen HomePod
```

## Why Separate?

Skills are shared. Your setup is yours. Keeping them apart means you can update skills without losing your notes, and share skills without leaking your infrastructure.

---

### QQ 音乐控制（macOS）

使用 URL scheme 控制 QQ 音乐：

| 功能 | 命令 |
|------|------|
| 播放 | `open "qqmusicmac://play"` |
| 暂停 | `open "qqmusicmac://pause"` |
| 下一首 | `open "qqmusicmac://next"` |
| 上一首 | `open "qqmusicmac://prev"` |
| 音量+ | `open "qqmusicmac://volumeUp"` |
| 音量- | `open "qqmusicmac://volumeDown"` |
| 搜索歌曲 | `open "qqmusicmac://search/关键词"` |

**执行规则（很重要）**：
- 当用户说“打开 QQ 音乐并播放 / 播放音乐 / QQ 音乐来一首”时，优先直接执行 `open "qqmusicmac://play"`
- 不要只做“打开 QQ 音乐 App”这种 GUI 动作；那样经常只打开不播放
- 涉及暂停/切歌也优先走 URL scheme，而不是 UI 点击
- 这台机器的实际 App 路径是：`/Applications/QQMusic.app`
- 若 `qqmusicmac://play` 唤起后仍未播放，兜底顺序：启动 `/Applications/QQMusic.app` → 再发一次 `qqmusicmac://play` → 如仍无效，激活 QQMusic 后发送系统空格键
- 不要使用 `tell application "QQMusic" to play`，该 App 不支持这个 AppleScript 命令

---

Add whatever helps you do your job. This is your cheat sheet.
