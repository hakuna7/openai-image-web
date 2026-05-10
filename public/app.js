const form = document.querySelector("#image-form");
const statusEl = document.querySelector("#status");
const previewEl = document.querySelector("#preview");
const revisedPromptEl = document.querySelector("#revisedPrompt");
const metaEl = document.querySelector("#meta");
const historyGridEl = document.querySelector("#historyGrid");
const lightboxEl = document.querySelector("#lightbox");
const lightboxImageEl = document.querySelector("#lightboxImage");
const closeLightboxButton = document.querySelector("#closeLightboxButton");
const downloadButton = document.querySelector("#downloadButton");
const clearHistoryButton = document.querySelector("#clearHistoryButton");
const submitButton = document.querySelector("#submitButton");
const cancelButton = document.querySelector("#cancelButton");
const optimizeButton = document.querySelector("#optimizeButton");
const apiKeyFieldEl = document.querySelector("#apiKeyField");
const apiKeyInputEl = document.querySelector("#apiKey");
const baseUrlInputEl = document.querySelector("#baseUrl");
const imageModelInputEl = document.querySelector("#imageModel");
const textModelInputEl = document.querySelector("#textModel");
const promptInputEl = document.querySelector("#prompt");
const serverKeyHintEl = document.querySelector("#serverKeyHint");
const serverBaseUrlHintEl = document.querySelector("#serverBaseUrlHint");

let latestImageUrl = "";
let activeGenerateController = null;
const imageHistory = [];

function setStatus(message, isError = false) {
  statusEl.textContent = message;
  statusEl.classList.toggle("error", isError);
}

function setGenerating(isGenerating) {
  submitButton.disabled = isGenerating;
  optimizeButton.disabled = isGenerating;
  cancelButton.classList.toggle("hidden", !isGenerating);
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
  addToHistory(latestImageUrl);
}

function renderHistory() {
  if (!imageHistory.length) {
    historyGridEl.className = "history-grid empty";
    historyGridEl.innerHTML = "<p>还没有历史图片</p>";
    clearHistoryButton.disabled = true;
    return;
  }

  historyGridEl.className = "history-grid";
  historyGridEl.innerHTML = imageHistory
    .map(
      (item, index) => `
        <article class="history-item">
          <button class="history-preview" type="button" data-history-index="${index}">
            <img src="${item.url}" alt="历史生成 ${index + 1}" />
          </button>
          <a class="history-download" href="${item.url}" download="openai-image-${item.createdAt}.png">下载</a>
        </article>
      `
    )
    .join("");
  clearHistoryButton.disabled = false;
}

function addToHistory(url) {
  imageHistory.unshift({
    url,
    createdAt: Date.now()
  });

  imageHistory.splice(8);
  renderHistory();
}

function openLightbox(url) {
  if (!url) {
    return;
  }

  lightboxImageEl.src = url;
  lightboxEl.classList.remove("hidden");
  closeLightboxButton.focus();
}

function closeLightbox() {
  lightboxEl.classList.add("hidden");
  lightboxImageEl.removeAttribute("src");
}

function getSharedPayload() {
  return {
    apiKey: apiKeyInputEl.value,
    baseUrl: baseUrlInputEl.value
  };
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

    serverBaseUrlHintEl.classList.toggle("hidden", !data.hasServerBaseUrl);

    if (data.imageModel) {
      imageModelInputEl.value = data.imageModel;
    }

    if (data.textModel) {
      textModelInputEl.value = data.textModel;
    }

    setStatus("准备就绪。");
  } catch (error) {
    apiKeyFieldEl.classList.remove("hidden");
    apiKeyInputEl.required = true;
  }
}

optimizeButton.addEventListener("click", async () => {
  const prompt = promptInputEl.value.trim();

  if (!prompt) {
    setStatus("请先输入要优化的提示词。", true);
    promptInputEl.focus();
    return;
  }

  optimizeButton.disabled = true;
  setStatus("正在优化提示词...");

  try {
    const response = await fetch("/api/optimize-prompt", {
      method: "POST",
      headers: {
        "Content-Type": "application/json"
      },
      body: JSON.stringify({
        ...getSharedPayload(),
        model: textModelInputEl.value,
        prompt
      })
    });

    const data = await response.json();

    if (!response.ok) {
      throw new Error(data.error || "优化失败。");
    }

    promptInputEl.value = data.optimizedPrompt;
    setStatus(data.fallback ? "文本模型暂时不可用，已使用本地优化。" : "提示词已优化。");
  } catch (error) {
    setStatus(error.message || "优化失败。", true);
  } finally {
    optimizeButton.disabled = false;
  }
});

form.addEventListener("submit", async (event) => {
  event.preventDefault();

  const formData = new FormData(form);
  const payload = Object.fromEntries(formData.entries());

  clearPreview();
  setStatus("正在生成，请稍等...");
  setGenerating(true);
  downloadButton.disabled = true;

  activeGenerateController = new AbortController();

  try {
    const response = await fetch("/api/generate-image", {
      method: "POST",
      headers: {
        "Content-Type": "application/json"
      },
      body: JSON.stringify(payload),
      signal: activeGenerateController.signal
    });

    const data = await response.json();

    if (!response.ok) {
      throw new Error(data.error || "生成失败。");
    }

    showImage(data.imageBase64, data.revisedPrompt);
    setStatus("生成完成。");
  } catch (error) {
    if (error.name === "AbortError") {
      setStatus("已中止本次生成。");
      return;
    }

    setStatus(error.message || "生成失败。", true);
  } finally {
    activeGenerateController = null;
    setGenerating(false);
  }
});

cancelButton.addEventListener("click", () => {
  if (activeGenerateController) {
    activeGenerateController.abort();
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

previewEl.addEventListener("click", () => {
  openLightbox(latestImageUrl);
});

historyGridEl.addEventListener("click", (event) => {
  const button = event.target.closest("[data-history-index]");

  if (!button) {
    return;
  }

  const item = imageHistory[Number(button.dataset.historyIndex)];

  if (!item) {
    return;
  }

  latestImageUrl = item.url;
  previewEl.className = "preview";
  previewEl.innerHTML = `<img src="${latestImageUrl}" alt="历史生成预览" />`;
  metaEl.textContent = "历史预览";
  downloadButton.disabled = false;
  openLightbox(latestImageUrl);
});

clearHistoryButton.addEventListener("click", () => {
  imageHistory.length = 0;
  renderHistory();
});

closeLightboxButton.addEventListener("click", closeLightbox);

lightboxEl.addEventListener("click", (event) => {
  if (event.target === lightboxEl) {
    closeLightbox();
  }
});

window.addEventListener("keydown", (event) => {
  if (event.key === "Escape" && !lightboxEl.classList.contains("hidden")) {
    closeLightbox();
  }
});

loadConfig();
renderHistory();
