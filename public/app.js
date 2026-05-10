const form = document.querySelector("#image-form");
const statusEl = document.querySelector("#status");
const previewEl = document.querySelector("#preview");
const revisedPromptEl = document.querySelector("#revisedPrompt");
const metaEl = document.querySelector("#meta");
const downloadButton = document.querySelector("#downloadButton");
const submitButton = document.querySelector("#submitButton");
const apiKeyFieldEl = document.querySelector("#apiKeyField");
const apiKeyInputEl = document.querySelector("#apiKey");
const modelInputEl = document.querySelector("#model");
const serverKeyHintEl = document.querySelector("#serverKeyHint");
const serverBaseUrlHintEl = document.querySelector("#serverBaseUrlHint");

let latestImageUrl = "";

function setStatus(message, isError = false) {
  statusEl.textContent = message;
  statusEl.classList.toggle("error", isError);
}

function clearPreview() {
  latestImageUrl = "";
  previewEl.className = "preview empty";
  previewEl.innerHTML = "<p>生成后的图片会出现在这里</p>";
  revisedPromptEl.classList.add("hidden");
  revisedPromptEl.textContent = "";
  metaEl.textContent = "";
  downloadButton.disabled = true;
}

function showImage(base64, promptText) {
  latestImageUrl = `data:image/png;base64,${base64}`;
  previewEl.className = "preview";
  previewEl.innerHTML = `<img src="${latestImageUrl}" alt="生成结果" />`;
  metaEl.textContent = "已生成";

  if (promptText) {
    revisedPromptEl.classList.remove("hidden");
    revisedPromptEl.textContent = `模型优化后的提示词：${promptText}`;
  }

  downloadButton.disabled = false;
}

async function loadConfig() {
  try {
    const response = await fetch("/api/config");
    const data = await response.json();

    if (data.hasServerApiKey) {
      apiKeyFieldEl.classList.add("hidden");
      serverKeyHintEl.classList.remove("hidden");
      apiKeyInputEl.required = false;
    } else {
      apiKeyFieldEl.classList.remove("hidden");
      serverKeyHintEl.classList.add("hidden");
      apiKeyInputEl.required = true;
    }

    if (data.hasServerBaseUrl) {
      serverBaseUrlHintEl.classList.remove("hidden");
    } else {
      serverBaseUrlHintEl.classList.add("hidden");
    }

    if (data.serverModel) {
      modelInputEl.value = data.serverModel;
    }

    setStatus("准备就绪。");
  } catch (error) {
    apiKeyFieldEl.classList.remove("hidden");
    apiKeyInputEl.required = true;
  }
}

form.addEventListener("submit", async (event) => {
  event.preventDefault();

  const formData = new FormData(form);
  const payload = Object.fromEntries(formData.entries());

  clearPreview();
  setStatus("正在生成，请稍等...");
  submitButton.disabled = true;
  downloadButton.disabled = true;

  try {
    const response = await fetch("/api/generate-image", {
      method: "POST",
      headers: {
        "Content-Type": "application/json"
      },
      body: JSON.stringify(payload)
    });

    const data = await response.json();

    if (!response.ok) {
      throw new Error(data.error || "生成失败。");
    }

    showImage(data.imageBase64, data.revisedPrompt);
    setStatus("生成完成。");
  } catch (error) {
    setStatus(error.message || "生成失败。", true);
  } finally {
    submitButton.disabled = false;
  }
});

downloadButton.addEventListener("click", () => {
  if (!latestImageUrl) {
    return;
  }

  const link = document.createElement("a");
  link.href = latestImageUrl;
  link.download = `openai-image-${Date.now()}.png`;
  link.click();
});

loadConfig();
