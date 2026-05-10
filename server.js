import express from "express";
import OpenAI from "openai";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
const port = process.env.PORT || 3000;
const defaultImageModel = "gpt-image-2";
const serverApiKey = process.env.OPENAI_API_KEY || "";
const serverBaseUrl = process.env.OPENAI_BASE_URL || "https://lucen.cc/v1";
const serverImageModel = normalizeImageModel(process.env.OPENAI_IMAGE_MODEL);

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

function normalizeImageModel(model) {
  const cleanModel = typeof model === "string" ? model.trim() : "";

  if (!cleanModel) {
    return defaultImageModel;
  }

  const looseModel = cleanModel.toLowerCase().replace(/[\s_-]/g, "");

  if (looseModel === "gptimage2" || looseModel === "gptimge2") {
    return defaultImageModel;
  }

  return cleanModel;
}

app.get("/api/config", (req, res) => {
  res.json({
    hasServerApiKey: Boolean(serverApiKey),
    hasServerBaseUrl: Boolean(serverBaseUrl),
    imageModel: serverImageModel
  });
});

app.get("/healthz", (req, res) => {
  res.status(200).json({ ok: true });
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

  const resolvedModel = normalizeImageModel(model || serverImageModel);
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
