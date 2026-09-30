const STORAGE_KEY = "prompt-shelf-prompts";
const form = document.querySelector("#prompt-form");
const titleInput = document.querySelector("#prompt-title");
const contentInput = document.querySelector("#prompt-content");
const promptList = document.querySelector("#prompt-list");

function readPrompts() {
  try {
    const saved = JSON.parse(localStorage.getItem(STORAGE_KEY) || "[]");
    return Array.isArray(saved) ? saved.filter((prompt) =>
      prompt && typeof prompt.id === "string" && typeof prompt.title === "string" && typeof prompt.content === "string"
    ) : [];
  } catch {
    return [];
  }
}

let prompts = readPrompts();

function savePrompts() {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(prompts));
}

function makePromptCard(prompt) {
  const card = document.createElement("article");
  card.className = "prompt-card";

  const title = document.createElement("h3");
  title.textContent = prompt.title;

  const preview = document.createElement("p");
  preview.className = "prompt-preview";
  const words = prompt.content.trim().split(/\s+/);
  preview.textContent = words.slice(0, 14).join(" ") + (words.length > 14 ? "..." : "");

  const deleteButton = document.createElement("button");
  deleteButton.className = "delete-button";
  deleteButton.type = "button";
  deleteButton.setAttribute("aria-label", `Delete ${prompt.title}`);
  deleteButton.textContent = "×";
  deleteButton.addEventListener("click", () => {
    prompts = prompts.filter((item) => item.id !== prompt.id);
    savePrompts();
    renderPrompts();
  });

  card.append(title, preview, deleteButton);
  return card;
}

function renderPrompts() {
  promptList.replaceChildren();

  if (prompts.length === 0) {
    const emptyState = document.createElement("div");
    emptyState.className = "empty-state";
    const message = document.createElement("p");
    message.textContent = "Nothing saved here yet.";
    const hint = document.createElement("span");
    hint.textContent = "YOUR NEXT GREAT PROMPT GOES HERE";
    emptyState.append(message, hint);
    promptList.append(emptyState);
    return;
  }

  prompts.forEach((prompt) => promptList.append(makePromptCard(prompt)));
}

form.addEventListener("submit", (event) => {
  event.preventDefault();
  const title = titleInput.value.trim();
  const content = contentInput.value.trim();

  if (!title || !content) return;

  prompts.unshift({
    id: `${Date.now()}-${Math.random().toString(36).slice(2)}`,
    title,
    content,
  });
  savePrompts();
  renderPrompts();
  form.reset();
  titleInput.focus();
});

renderPrompts();