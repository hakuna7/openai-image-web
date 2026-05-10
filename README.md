# OpenAI 生图网页

这是一个可以本地运行，也可以部署到 Render 的生图网页。

## 本地启动

```powershell
npm install
npm start
```

打开 `http://localhost:3000`

## Render 部署

1. 把当前目录上传到 GitHub 仓库
2. 登录 Render
3. 新建 `Web Service`
4. 选择你的 GitHub 仓库
5. 使用下面这组配置：

```text
Build Command: npm install
Start Command: npm start
```

6. 在 Render 的环境变量里添加：

```text
OPENAI_API_KEY=你的_OpenAI_API_Key
OPENAI_BASE_URL=你的中转站接口地址
OPENAI_IMAGE_MODEL=图片模型名
```

7. 部署完成后，打开 Render 分配给你的 `https://xxxx.onrender.com`

## 说明

- 如果你用的是中转站，并且它兼容 OpenAI 接口，可以配置：
  - `OPENAI_API_KEY`
  - `OPENAI_BASE_URL`
  - `OPENAI_IMAGE_MODEL`
- 如果服务端配置了 `OPENAI_API_KEY`，网页里就不需要再手动输入 Key
- 如果服务端没配置，仍然可以在网页里临时输入 Key
- 默认模型配置为 `gpt-image-2`
- 生成后可以直接在页面预览并下载 PNG
