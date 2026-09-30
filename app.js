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
    ).map((prompt) => ({
      ...prompt,
      rating: Number.isInteger(prompt.rating) && prompt.rating >= 0 && prompt.rating <= 5 ? prompt.rating : 0,
    })) : [];
  } catch {
    return [];
  }
}

let prompts = readPrompts();

function savePrompts() {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(prompts));
}

function updateRatingDisplay(card, rating) {
  const ratingInputs = card.querySelectorAll(".rating-control input");
  ratingInputs.forEach((input) => {
    input.checked = Number(input.value) === rating;
    input.nextElementSibling.classList.toggle("is-selected", Number(input.value) <= rating);
  });
  card.querySelector(".clear-rating").hidden = rating === 0;
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

  const ratingControl = document.createElement("div");
  ratingControl.className = "rating-control";
  const ratingGroup = document.createElement("fieldset");
  const ratingLegend = document.createElement("legend");
  ratingLegend.className = "rating-legend";
  ratingLegend.textContent = `Rate ${prompt.title} effectiveness`;
  ratingGroup.append(ratingLegend);

  for (let value = 1; value <= 5; value += 1) {
    const ratingInput = document.createElement("input");
    ratingInput.className = "rating-input";
    ratingInput.type = "radio";
    ratingInput.name = `rating-${prompt.id}`;
    ratingInput.id = `rating-${prompt.id}-${value}`;
    ratingInput.value = String(value);
    ratingInput.setAttribute("aria-label", `Rate ${value} out of 5`);

    const ratingLabel = document.createElement("label");
    ratingLabel.className = "rating-star";
    ratingLabel.htmlFor = ratingInput.id;
    ratingLabel.textContent = "★";

    ratingInput.addEventListener("change", () => {
      prompt.rating = value;
      savePrompts();
      updateRatingDisplay(card, prompt.rating);
    });

    ratingGroup.append(ratingInput, ratingLabel);
  }

  const clearRating = document.createElement("button");
  clearRating.className = "clear-rating";
  clearRating.type = "button";
  clearRating.textContent = "Clear";
  clearRating.setAttribute("aria-label", `Clear rating for ${prompt.title}`);
  clearRating.addEventListener("click", () => {
    prompt.rating = 0;
    savePrompts();
    updateRatingDisplay(card, prompt.rating);
  });
  ratingControl.append(ratingGroup, clearRating);

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

  card.append(title, preview, ratingControl, deleteButton);
  updateRatingDisplay(card, prompt.rating);
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
    rating: 0,
  });
  savePrompts();
  renderPrompts();
  form.reset();
  titleInput.focus();
});

renderPrompts();