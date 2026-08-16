# NIKKE 指挥官工具箱

一个面向 NIKKE 玩家的轻量工具界面，当前包含三个功能入口：

- 装备词条（角色与四部位管理、截图 OCR、15 阶数值校验）
- 资源计算
- 定制模组记录

## 运行

直接用浏览器打开 `index.html` 即可。装备截图 OCR 会按需从 CDN 加载 Tesseract.js，首次识别需要联网；识别结果可在保存前手动校正。

也可以在项目目录启动任意静态文件服务器，例如：

```powershell
python -m http.server 8080
```

然后访问 `http://localhost:8080`。
