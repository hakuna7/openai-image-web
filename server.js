import express from "express";
import OpenAI from "openai";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
const port = process.env.PORT || 3000;
const serverApiKey = process.env.OPENAI_API_KEY || "";
const serverBaseUrl = process.env.OPENAI_BASE_URL || "https://lucen.cc/v1";
const serverImageModel = process.env.OPENAI_IMAGE_MODEL || "gpt-image-2";
const serverTextModel = process.env.OPENAI_TEXT_MODEL || "gpt-4o-mini";

app.use(express.json({ limit: "2mb" }));
app.use(express.static(path.join(__dirname, "public")));

function getResolvedClient({ apiKey, baseUrl }) {
  const resolvedApiKey =
    typeof apiKey === "string" && apiKey.trim() ? apiKey.trim() : serverApiKey;
  const resolvedBaseUrl =
    typeof baseUrl === "string" && baseUrl.trim() ? baseUrl.trim() : serverBaseUrl;

  if (!resolvedApiKey) {
    return {
      error: "请先配置 API Key，或在页面中输入有效的 API Key。"
    };
  }

  return {
    client: new OpenAI({
      apiKey: resolvedApiKey,
      baseURL: resolvedBaseUrl
    })
  };
}

function buildFallbackPrompt(prompt) {
  return [
    prompt,
    "主体清晰，画面干净，构图平衡，细节丰富",
    "自然光影，真实材质，高质量画面，电影感镜头",
    "避免文字水印、畸形结构、低清晰度、过度噪点"
  ].join("，");
}

function withTimeout(promise, timeoutMs) {
  return Promise.race([
    promise,
    new Promise((_, reject) => {
      setTimeout(() => reject(new Error("文本模型响应超时")), timeoutMs);
    })
  ]);
}

app.get("/api/config", (req, res) => {
  res.json({
    hasServerApiKey: Boolean(serverApiKey),
    hasServerBaseUrl: Boolean(serverBaseUrl),
    imageModel: serverImageModel,
    textModel: serverTextModel
  });
});

app.get("/healthz", (req, res) => {
  res.status(200).json({ ok: true });
});

app.post("/api/optimize-prompt", async (req, res) => {
  const { apiKey, baseUrl, prompt, model } = req.body ?? {};
  const originalPrompt = typeof prompt === "string" ? prompt.trim() : "";
  const resolvedModel =
    typeof model === "string" && model.trim() ? model.trim() : serverTextModel;

  if (!originalPrompt) {
    return res.status(400).json({ error: "请输入要优化的提示词。" });
  }

  const { client, error } = getResolvedClient({ apiKey, baseUrl });

  if (error) {
    return res.status(400).json({ error });
  }

  try {
    const completion = await withTimeout(
      client.chat.completions.create({
        model: resolvedModel,
        messages: [
          {
            role: "system",
            content:
              "你是专业的 AI 生图提示词优化助手。把用户的想法改写成一段适合图片生成模型的中文提示词。只输出优化后的提示词，不要解释。"
          },
          {
            role: "user",
            content: `请优化这段生图提示词，保留原意并增强主体、场景、光线、镜头、风格和细节：${originalPrompt}`
          }
        ],
        temperature: 0.8
      }),
      12000
    );

    const optimizedPrompt = completion.choices?.[0]?.message?.content?.trim();

    if (!optimizedPrompt) {
      return res.status(502).json({ error: "优化成功返回了空内容，请重试。" });
    }

    res.json({ optimizedPrompt });
  } catch (error) {
    res.json({
      optimizedPrompt: buildFallbackPrompt(originalPrompt),
      fallback: true,
      warning: error?.error?.message || error?.message || "文本模型暂时不可用，已使用本地优化。"
    });
  }
});

app.post("/api/generate-image", async (req, res) => {
  const {
    apiKey,
    baseUrl,
    model,
    prompt,
    size = "1024x1024",
    quality = "medium",
    background = "auto"
  } = req.body ?? {};

  const resolvedModel =
    typeof model === "string" && model.trim() ? model.trim() : serverImageModel;
  const cleanPrompt = typeof prompt === "string" ? prompt.trim() : "";

  if (!cleanPrompt) {
    return res.status(400).json({ error: "请输入图片提示词。" });
  }

  const { client, error } = getResolvedClient({ apiKey, baseUrl });

  if (error) {
    return res.status(400).json({ error });
  }

  try {
    const result = await client.images.generate({
      model: resolvedModel,
      prompt: cleanPrompt,
      size,
      quality,
      background
    });

    const firstImage = result.data?.[0];
    const imageBase64 = firstImage?.b64_json;

    if (!imageBase64) {
      return res.status(502).json({ error: "接口返回成功，但没有拿到图片数据。" });
    }

    res.json({
      imageBase64,
      revisedPrompt: firstImage?.revised_prompt ?? null
    });
  } catch (error) {
    const status = error?.status ?? 500;
    const message =
      error?.error?.message ||
      error?.message ||
      "图片生成失败，请检查 API Key、额度或提示词后重试。";

    res.status(status).json({ error: message });
  }
});

app.use((error, req, res, next) => {
  if (error instanceof SyntaxError && "body" in error) {
    return res.status(400).json({ error: "请求内容不是合法的 JSON。" });
  }

  return next(error);
});

app.listen(port, () => {
  console.log(`Image app running at http://localhost:${port}`);
});
