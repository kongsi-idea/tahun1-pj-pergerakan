# 动物模仿秀 · 交接

## ⏯️ 目前做到哪
2026-10-10 v1.0 上线：https://tahun1-pj-haiwan.vercel.app ，Hub 已登记（封面由 cx 生成，另有老师的 4 张横式截图），`npm run check -- tahun1-pj-haiwan` 全过。

## 🚦 目前状态
- 可运行。流程：欢迎（名字、安全提示）→ 动作教学 → 站位检查（站进人像＋拖鞋记号）→ 7 只动物 → 雨林打卡卡 → 完成画面。
- 测试：单元测试 84 项全过、e2e 128 项全过（假摄像头）。老师在笔电上实测过站位检查才放行上线。
- 还没验证：真机 `navigator.share` 分享到 Classroom／WhatsApp；学生大量真人实测的侦测阈值。

## ➡️ 下一步
1. 1I 班学生用过后收集反馈：哪只动物「做对却不拍」→ 调 `js/poses.js` 的 `TH`。没把握的依序是青蛙蹲、小狗／鳄鱼侧身、红鹤手臂的门槛。
2. 决定要不要规定手机横放（直放时人要站很远）。
3. 需要的话写家长通告（用 class-group-announcement）。

## ⚠️ 注意事项
- 关键决定（人形外轮廓、雨林视觉、cx 生图流程、站位检查、`.vercelignore` 的坑、DSKP 出处）都写在 `agents.md`。
- 生图：agent 写 `img-src/PROMPT-cx-*.md`，由老师本人贴 cx 指令执行；画完跑 `python3 build-img.py`。
- 本机测试：8791 留给老师，自动测试用 8792。

## 🕐 最后更新
2026-10-10 · Claude Code (Opus 5.5) @ yquanloo 的 Mac · Git：✅ 已推
