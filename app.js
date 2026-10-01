const STORAGE_KEY = "prompt-shelf-prompts";
const form = document.querySelector("#prompt-form");
const titleInput = document.querySelector("#prompt-title");
const modelInput = document.querySelector("#prompt-model");
const contentInput = document.querySelector("#prompt-content");
const promptList = document.querySelector("#prompt-list");
const formError = document.querySelector("#form-error");

function validateModelName(modelName) {
  if (typeof modelName !== "string" || !modelName.trim()) {
    throw new Error("Model name must be a non-empty string.");
  }
  if (modelName.trim().length > 100) {
    throw new Error("Model name must be 100 characters or fewer.");
  }
  return modelName.trim();
}

function isValidIsoTimestamp(value) {
  if (typeof value !== "string" || !/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{3}Z$/.test(value)) {
    return false;
  }
  const timestamp = new Date(value);
  return !Number.isNaN(timestamp.getTime()) && timestamp.toISOString() === value;
}

function validateMetadata(metadata) {
  if (!metadata || typeof metadata !== "object" || Array.isArray(metadata)) {
    throw new Error("Metadata must be an object.");
  }
  validateModelName(metadata.model);
  if (!isValidIsoTimestamp(metadata.createdAt) || !isValidIsoTimestamp(metadata.updatedAt)) {
    throw new Error("Metadata dates must be valid ISO 8601 timestamps.");
  }
  if (new Date(metadata.updatedAt) < new Date(metadata.createdAt)) {
    throw new Error("updatedAt must be greater than or equal to createdAt.");
  }
  const estimate = metadata.tokenEstimate;
  if (!estimate || !Number.isFinite(estimate.min) || !Number.isFinite(estimate.max) ||
    estimate.min < 0 || estimate.max < 0 || !["high", "medium", "low"].includes(estimate.confidence)) {
    throw new Error("Metadata must contain a valid token estimate.");
  }
  return metadata;
}

function estimateTokens(text, isCode) {
  if (typeof text !== "string") {
    throw new Error("Token estimate content must be a string.");
  }
  if (typeof isCode !== "boolean") {
    throw new Error("isCode must be a boolean.");
  }

  const trimmedText = text.trim();
  const wordCount = trimmedText ? trimmedText.split(/\s+/).length : 0;
  const multiplier = isCode ? 1.3 : 1;
  const min = 0.75 * wordCount * multiplier;
  const max = 0.25 * text.length * multiplier;
  const confidence = max < 1000 ? "high" : max <= 5000 ? "medium" : "low";
  return { min, max, confidence };
}

function trackModel(modelName, content) {
  const model = validateModelName(modelName);
  if (typeof content !== "string") {
    throw new Error("Prompt content must be a string.");
  }
  const timestamp = new Date().toISOString();
  return {
    model,
    createdAt: timestamp,
    updatedAt: timestamp,
    tokenEstimate: estimateTokens(content, false),
  };
}

function updateTimestamps(metadata) {
  if (!metadata || typeof metadata !== "object" || Array.isArray(metadata)) {
    throw new Error("Metadata must be an object.");
  }
  if (!isValidIsoTimestamp(metadata.updatedAt)) {
    throw new Error("Metadata dates must be valid ISO 8601 timestamps.");
  }
  validateMetadata({ ...metadata, updatedAt: metadata.createdAt });
  const createdAtTime = new Date(metadata.createdAt).getTime();
  const updatedAt = new Date(Math.max(Date.now(), createdAtTime)).toISOString();
  return validateMetadata({ ...metadata, updatedAt });
}

function readPrompts() {
  try {
    const saved = JSON.parse(localStorage.getItem(STORAGE_KEY) || "[]");
    let migrated = false;
    const loaded = Array.isArray(saved) ? saved.filter((prompt) =>
      prompt && typeof prompt.id === "string" && typeof prompt.title === "string" && typeof prompt.content === "string"
    ).map((prompt) => {
      let metadata = prompt.metadata;
      try {
        validateMetadata(metadata);
      } catch {
        metadata = trackModel("Unspecified", prompt.content);
        migrated = true;
      }
      return {
        ...prompt,
        metadata,
        rating: Number.isInteger(prompt.rating) && prompt.rating >= 0 && prompt.rating <= 5 ? prompt.rating : 0,
        notes: Array.isArray(prompt.notes) ? prompt.notes.filter((note) =>
          note && typeof note.id === "string" && typeof note.content === "string"
        ) : [],
      };
    }) : [];
    if (migrated) localStorage.setItem(STORAGE_KEY, JSON.stringify(loaded));
    return loaded;
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

function makeNoteEditor(prompt, note = null) {
  const editor = document.createElement("div");
  editor.className = "note-editor";

  const textarea = document.createElement("textarea");
  textarea.rows = 3;
  textarea.maxLength = 2000;
  textarea.placeholder = "Write a note...";
  textarea.setAttribute("aria-label", `Note for ${prompt.title}`);
  textarea.value = note ? note.content : "";
  textarea.required = true;

  const actions = document.createElement("div");
  actions.className = "note-actions";

  const saveButton = document.createElement("button");
  saveButton.className = "note-save-button";
  saveButton.type = "button";
  saveButton.textContent = "Save note";
  saveButton.addEventListener("click", () => {
    const content = textarea.value.trim();
    if (!content) {
      textarea.focus();
      return;
    }

    if (note) {
      note.content = content;
      note.updatedAt = Date.now();
    } else {
      prompt.notes.push({
        id: `${Date.now()}-${Math.random().toString(36).slice(2)}`,
        content,
        updatedAt: Date.now(),
      });
    }
    savePrompts();
    renderPrompts();
  });

  actions.append(saveButton);

  if (note) {
    const deleteButton = document.createElement("button");
    deleteButton.className = "note-delete-button";
    deleteButton.type = "button";
    deleteButton.textContent = "Delete";
    deleteButton.setAttribute("aria-label", `Delete note for ${prompt.title}`);
    deleteButton.addEventListener("click", () => {
      prompt.notes = prompt.notes.filter((item) => item.id !== note.id);
      savePrompts();
      renderPrompts();
    });
    actions.append(deleteButton);
  }

  editor.append(textarea, actions);
  return editor;
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

  const metadata = document.createElement("dl");
  metadata.className = "prompt-metadata";
  const modelTerm = document.createElement("dt");
  modelTerm.textContent = "MODEL";
  const modelValue = document.createElement("dd");
  modelValue.textContent = prompt.metadata.model;
  const createdTerm = document.createElement("dt");
  createdTerm.textContent = "CREATED";
  const createdValue = document.createElement("dd");
  createdValue.textContent = new Date(prompt.metadata.createdAt).toLocaleString();
  const updatedTerm = document.createElement("dt");
  updatedTerm.textContent = "UPDATED";
  const updatedValue = document.createElement("dd");
  updatedValue.textContent = new Date(prompt.metadata.updatedAt).toLocaleString();
  const tokensTerm = document.createElement("dt");
  tokensTerm.textContent = "TOKENS";
  const tokensValue = document.createElement("dd");
  tokensValue.className = `token-confidence confidence-${prompt.metadata.tokenEstimate.confidence}`;
  tokensValue.textContent = `${prompt.metadata.tokenEstimate.min.toFixed(0)}-${prompt.metadata.tokenEstimate.max.toFixed(0)} · ${prompt.metadata.tokenEstimate.confidence}`;
  metadata.append(modelTerm, modelValue, createdTerm, createdValue, updatedTerm, updatedValue, tokensTerm, tokensValue);

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

  const notesSection = document.createElement("section");
  notesSection.className = "prompt-notes";
  const notesHeading = document.createElement("h4");
  notesHeading.textContent = "Notes";
  notesSection.append(notesHeading);

  const addNoteButton = document.createElement("button");
  addNoteButton.className = "add-note-button";
  addNoteButton.type = "button";
  addNoteButton.textContent = "Add note";
  addNoteButton.setAttribute("aria-label", `Add note to ${prompt.title}`);
  addNoteButton.addEventListener("click", () => {
    if (!notesSection.querySelector(".new-note-editor")) {
      const editor = makeNoteEditor(prompt);
      editor.classList.add("new-note-editor");
      notesSection.insertBefore(editor, addNoteButton);
      editor.querySelector("textarea").focus();
    }
  });
  notesSection.append(addNoteButton);

  prompt.notes.forEach((note) => notesSection.insertBefore(makeNoteEditor(prompt, note), addNoteButton));

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

  card.append(title, preview, metadata, ratingControl, notesSection, deleteButton);
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

  [...prompts]
    .sort((first, second) => new Date(second.metadata.createdAt) - new Date(first.metadata.createdAt))
    .forEach((prompt) => promptList.append(makePromptCard(prompt)));
}

form.addEventListener("submit", (event) => {
  event.preventDefault();
  formError.hidden = true;
  try {
    const title = titleInput.value.trim();
    const model = validateModelName(modelInput.value);
    const content = contentInput.value.trim();

    if (!title || !content) return;

    prompts.unshift({
      id: `${Date.now()}-${Math.random().toString(36).slice(2)}`,
      title,
      content,
      metadata: trackModel(model, content),
      rating: 0,
      notes: [],
    });
    savePrompts();
    renderPrompts();
    form.reset();
    titleInput.focus();
  } catch (error) {
    formError.textContent = error instanceof Error ? error.message : "Unable to save this prompt.";
    formError.hidden = false;
  }
});

renderPrompts();