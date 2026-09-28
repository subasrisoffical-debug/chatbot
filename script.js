/**
 * ChatGPT UI - Full Interactive Logic & n8n Integration
 */

// Default Configuration
const DEFAULT_CONFIG = {
  webhookUrl: "https://subasri2007.app.n8n.cloud/webhook/chat",
  testWebhookUrl: "https://subasri2007.app.n8n.cloud/webhook-test/chat",
  typewriterEnabled: true,
  theme: "dark"
};

// Application State
let appState = {
  config: { ...DEFAULT_CONFIG },
  chats: [],
  currentChatId: null,
  isGenerating: false,
  abortController: null,
  speechSynthUtterance: null,
  speechRecognition: null,
  isRecordingVoice: false
};

// DOM Elements
const elements = {
  appLayout: document.getElementById("appLayout"),
  sidebar: document.getElementById("sidebar"),
  sidebarOverlay: document.getElementById("sidebarOverlay"),
  openSidebarBtn: document.getElementById("openSidebarBtn"),
  closeSidebarBtn: document.getElementById("closeSidebarBtn"),
  newChatBtn: document.getElementById("newChatBtn"),
  navNewChatBtn: document.getElementById("navNewChatBtn"),
  chatHistoryList: document.getElementById("chatHistoryList"),
  connectionStatusText: document.getElementById("connectionStatusText"),
  sidebarStatusPill: document.getElementById("sidebarStatusPill"),
  themeToggleBtn: document.getElementById("themeToggleBtn"),
  chatViewport: document.getElementById("chatViewport"),
  welcomeScreen: document.getElementById("welcomeScreen"),
  messagesContainer: document.getElementById("messagesContainer"),
  scrollBottomBtn: document.getElementById("scrollBottomBtn"),
  chatForm: document.getElementById("chatForm"),
  messageInput: document.getElementById("messageInput"),
  sendBtn: document.getElementById("sendBtn"),
  micBtn: document.getElementById("micBtn"),
  attachBtn: document.getElementById("attachBtn"),
  footnoteEndpoint: document.getElementById("footnoteEndpoint"),
  modelSelector: document.getElementById("modelSelector"),
  modelDropdownMenu: document.getElementById("modelDropdownMenu"),
  switchWebhookItem: document.getElementById("switchWebhookItem"),
  // Settings Modal Elements
  settingsModal: document.getElementById("settingsModal"),
  openSettingsBtn: document.getElementById("openSettingsBtn"),
  settingsIconBtn: document.getElementById("settingsIconBtn"),
  closeSettingsBtn: document.getElementById("closeSettingsBtn"),
  cancelSettingsBtn: document.getElementById("cancelSettingsBtn"),
  saveSettingsBtn: document.getElementById("saveSettingsBtn"),
  webhookUrlInput: document.getElementById("webhookUrlInput"),
  testWebhookBtn: document.getElementById("testWebhookBtn"),
  useProdUrlBtn: document.getElementById("useProdUrlBtn"),
  useTestUrlBtn: document.getElementById("useTestUrlBtn"),
  testResultBox: document.getElementById("testResultBox"),
  typewriterToggle: document.getElementById("typewriterToggle"),
  clearAllChatsBtn: document.getElementById("clearAllChatsBtn"),
  toastContainer: document.getElementById("toastContainer")
};

// ==========================================================================
// Initialization
// ==========================================================================

function init() {
  loadStoredData();
  setupMarkdownRenderer();
  setupEventListeners();
  setupVoiceRecognition();
  applyTheme(appState.config.theme);

  // Initialize or restore active chat
  if (appState.chats.length === 0) {
    createNewChat();
  } else {
    const lastActive = appState.currentChatId || appState.chats[0].id;
    switchToChat(lastActive);
  }

  renderChatHistory();
  updateEndpointFootnote();
}

// Load data from LocalStorage
function loadStoredData() {
  try {
    const savedConfig = localStorage.getItem("chatgpt_n8n_config");
    if (savedConfig) {
      appState.config = { ...DEFAULT_CONFIG, ...JSON.parse(savedConfig) };
    }

    const savedChats = localStorage.getItem("chatgpt_n8n_chats");
    if (savedChats) {
      appState.chats = JSON.parse(savedChats);
    }
  } catch (err) {
    console.error("Failed to load local storage data:", err);
  }
}

// Persist data
function saveChatsToStorage() {
  try {
    localStorage.setItem("chatgpt_n8n_chats", JSON.stringify(appState.chats));
  } catch (err) {
    console.error("Failed to save chats:", err);
  }
}

function saveConfigToStorage() {
  try {
    localStorage.setItem("chatgpt_n8n_config", JSON.stringify(appState.config));
  } catch (err) {
    console.error("Failed to save config:", err);
  }
}

// Setup Marked.js and Highlight.js
function setupMarkdownRenderer() {
  if (typeof marked !== "undefined") {
    marked.setOptions({
      breaks: true,
      gfm: true,
      highlight: function (code, lang) {
        if (typeof hljs !== "undefined" && lang && hljs.getLanguage(lang)) {
          try {
            return hljs.highlight(code, { language: lang }).value;
          } catch (e) {}
        }
        if (typeof hljs !== "undefined") {
          return hljs.highlightAuto(code).value;
        }
        return code;
      }
    });
  }
}

// Format markdown string to safe HTML
function renderMarkdown(content) {
  if (typeof marked === "undefined") {
    return escapeHtml(content).replace(/\n/g, "<br>");
  }

  try {
    const rawHtml = marked.parse(content);
    // Wrap tables in responsive wrapper
    let sanitized = DOMPurify.sanitize(rawHtml, {
      ADD_TAGS: ["table", "thead", "tbody", "tr", "th", "td"],
      ADD_ATTR: ["class", "id"]
    });

    sanitized = sanitized.replace(/<table>/g, '<div class="table-wrapper"><table>');
    sanitized = sanitized.replace(/<\/table>/g, "</table></div>");

    return sanitized;
  } catch (e) {
    return escapeHtml(content).replace(/\n/g, "<br>");
  }
}

function escapeHtml(text) {
  const map = {
    "&": "&amp;",
    "<": "&lt;",
    ">": "&gt;",
    '"': "&quot;",
    "'": "&#039;"
  };
  return text.replace(/[&<>"']/g, (m) => map[m]);
}

// ==========================================================================
// Event Listeners
// ==========================================================================

function setupEventListeners() {
  // Sidebar toggling
  elements.openSidebarBtn.addEventListener("click", () => {
    if (window.innerWidth <= 768) {
      elements.sidebar.classList.add("mobile-open");
      elements.sidebarOverlay.classList.add("active");
    } else {
      elements.sidebar.classList.toggle("collapsed");
    }
  });

  elements.closeSidebarBtn.addEventListener("click", () => {
    if (window.innerWidth <= 768) {
      elements.sidebar.classList.remove("mobile-open");
      elements.sidebarOverlay.classList.remove("active");
    } else {
      elements.sidebar.classList.add("collapsed");
    }
  });

  elements.sidebarOverlay.addEventListener("click", () => {
    elements.sidebar.classList.remove("mobile-open");
    elements.sidebarOverlay.classList.remove("active");
  });

  // New Chat buttons
  elements.newChatBtn.addEventListener("click", () => createNewChat());
  elements.navNewChatBtn.addEventListener("click", () => createNewChat());

  // Input & Form
  elements.messageInput.addEventListener("input", handleInputChange);
  elements.messageInput.addEventListener("keydown", handleInputKeydown);
  elements.chatForm.addEventListener("submit", handleFormSubmit);

  // Suggestion Cards click
  document.querySelectorAll(".suggestion-card").forEach((card) => {
    card.addEventListener("click", () => {
      const prompt = card.getAttribute("data-prompt");
      if (prompt) {
        elements.messageInput.value = prompt;
        handleInputChange();
        sendMessage(prompt);
      }
    });
  });

  // Scroll viewport monitoring for bottom button
  elements.chatViewport.addEventListener("scroll", handleViewportScroll);
  elements.scrollBottomBtn.addEventListener("click", scrollToBottom);

  // Model Dropdown
  elements.modelSelector.addEventListener("click", (e) => {
    e.stopPropagation();
    elements.modelDropdownMenu.classList.toggle("show");
  });

  document.addEventListener("click", () => {
    elements.modelDropdownMenu.classList.remove("show");
  });

  elements.switchWebhookItem.addEventListener("click", (e) => {
    e.stopPropagation();
    elements.modelDropdownMenu.classList.remove("show");
    openSettings();
  });

  // Settings Modal triggers
  elements.openSettingsBtn.addEventListener("click", openSettings);
  elements.settingsIconBtn.addEventListener("click", openSettings);
  elements.closeSettingsBtn.addEventListener("click", closeSettings);
  elements.cancelSettingsBtn.addEventListener("click", closeSettings);
  elements.footnoteEndpoint.addEventListener("click", openSettings);

  // Theme Toggle
  elements.themeToggleBtn.addEventListener("click", () => {
    const newTheme = appState.config.theme === "dark" ? "light" : "dark";
    applyTheme(newTheme);
    appState.config.theme = newTheme;
    saveConfigToStorage();
  });

  // Theme buttons in settings modal
  document.querySelectorAll(".theme-btn").forEach((btn) => {
    btn.addEventListener("click", () => {
      const theme = btn.dataset.theme;
      applyTheme(theme);
      appState.config.theme = theme;
      saveConfigToStorage();
      updateThemeButtons();
    });
  });

  // Settings Quick switch URLs
  elements.useProdUrlBtn.addEventListener("click", () => {
    elements.webhookUrlInput.value = DEFAULT_CONFIG.webhookUrl;
    elements.useProdUrlBtn.classList.add("active");
    elements.useTestUrlBtn.classList.remove("active");
  });

  elements.useTestUrlBtn.addEventListener("click", () => {
    elements.webhookUrlInput.value = DEFAULT_CONFIG.testWebhookUrl;
    elements.useTestUrlBtn.classList.add("active");
    elements.useProdUrlBtn.classList.remove("active");
  });

  // Test Webhook connection
  elements.testWebhookBtn.addEventListener("click", testWebhookConnection);

  // Save Settings
  elements.saveSettingsBtn.addEventListener("click", () => {
    const inputUrl = elements.webhookUrlInput.value.trim();
    if (!inputUrl) {
      showToast("Please enter a valid webhook URL", "error");
      return;
    }
    appState.config.webhookUrl = inputUrl;
    appState.config.typewriterEnabled = elements.typewriterToggle.checked;
    saveConfigToStorage();
    updateEndpointFootnote();
    showToast("Settings saved successfully", "success");
    closeSettings();
  });

  // Clear all chats
  elements.clearAllChatsBtn.addEventListener("click", () => {
    if (confirm("Are you sure you want to delete all chat history? This cannot be undone.")) {
      appState.chats = [];
      saveChatsToStorage();
      createNewChat();
      renderChatHistory();
      closeSettings();
      showToast("All chats cleared", "success");
    }
  });

  // Attachment button simulation
  elements.attachBtn.addEventListener("click", () => {
    showToast("File attachment feature: Add documents to chat context", "info");
  });

  // Voice recording button
  elements.micBtn.addEventListener("click", toggleVoiceInput);
}

// Auto-expand textarea
function handleInputChange() {
  const textarea = elements.messageInput;
  textarea.style.height = "auto";
  const newHeight = Math.min(textarea.scrollHeight, 200);
  textarea.style.height = `${newHeight}px`;

  const hasText = textarea.value.trim().length > 0;
  elements.sendBtn.disabled = !hasText && !appState.isGenerating;
}

// Handle Enter and Shift+Enter
function handleInputKeydown(e) {
  if (e.key === "Enter" && !e.shiftKey) {
    e.preventDefault();
    if (!elements.sendBtn.disabled && !appState.isGenerating) {
      elements.chatForm.dispatchEvent(new Event("submit", { cancelable: true }));
    }
  }
}

// Handle form submission
function handleFormSubmit(e) {
  e.preventDefault();
  if (appState.isGenerating) {
    // Act as stop button
    stopGeneration();
    return;
  }

  const query = elements.messageInput.value.trim();
  if (!query) return;

  elements.messageInput.value = "";
  elements.messageInput.style.height = "auto";
  elements.sendBtn.disabled = true;

  sendMessage(query);
}

// Scroll detection
function handleViewportScroll() {
  const vp = elements.chatViewport;
  const isNearBottom = vp.scrollHeight - vp.scrollTop - vp.clientHeight < 120;
  if (isNearBottom) {
    elements.scrollBottomBtn.classList.remove("show");
  } else {
    elements.scrollBottomBtn.classList.add("show");
  }
}

function scrollToBottom(smooth = true) {
  const vp = elements.chatViewport;
  vp.scrollTo({
    top: vp.scrollHeight,
    behavior: smooth ? "smooth" : "auto"
  });
}

// ==========================================================================
// Theme & Settings
// ==========================================================================

function applyTheme(theme) {
  if (theme === "light") {
    document.body.classList.remove("dark-theme");
    document.body.classList.add("light-theme");
  } else {
    document.body.classList.remove("light-theme");
    document.body.classList.add("dark-theme");
  }
  updateThemeButtons();
}

function updateThemeButtons() {
  document.querySelectorAll(".theme-btn").forEach((btn) => {
    btn.classList.toggle("active", btn.dataset.theme === appState.config.theme);
  });
}

function openSettings() {
  elements.webhookUrlInput.value = appState.config.webhookUrl;
  elements.typewriterToggle.checked = appState.config.typewriterEnabled;
  elements.testResultBox.style.display = "none";

  if (appState.config.webhookUrl.includes("webhook-test")) {
    elements.useTestUrlBtn.classList.add("active");
    elements.useProdUrlBtn.classList.remove("active");
  } else {
    elements.useProdUrlBtn.classList.add("active");
    elements.useTestUrlBtn.classList.remove("active");
  }

  elements.settingsModal.classList.add("show");
}

function closeSettings() {
  elements.settingsModal.classList.remove("show");
}

function updateEndpointFootnote() {
  const url = appState.config.webhookUrl;
  const isTest = url.includes("webhook-test");
  elements.footnoteEndpoint.textContent = isTest ? "n8n (Test Webhook)" : "n8n (Production Webhook)";
}

// Ping/Test Webhook connection
async function testWebhookConnection() {
  const targetUrl = elements.webhookUrlInput.value.trim();
  const box = elements.testResultBox;
  box.style.display = "block";
  box.className = "status-box";
  box.innerHTML = "Pinging n8n webhook...";

  try {
    const res = await fetch(targetUrl, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ chatInput: "ping_test", message: "ping_test" })
    });

    if (res.ok) {
      box.className = "status-box success";
      box.innerHTML = `<strong>Connected Successfully!</strong> HTTP status: ${res.status}. Webhook is live and responding.`;
      updateStatusBadge("connected", "n8n Connected");
    } else {
      const data = await res.json().catch(() => ({}));
      if (res.status === 404 && data.message && data.message.includes("not registered")) {
        box.className = "status-box warning";
        box.innerHTML = `
          <strong>Workflow Inactive:</strong> n8n says this webhook is not registered yet.<br>
          <em>Action:</em> Go to your n8n workflow canvas and click <strong>Publish</strong> in the top right, or switch to the Test URL.
        `;
        updateStatusBadge("warning", "n8n Not Active");
      } else {
        box.className = "status-box error";
        box.innerHTML = `<strong>Response Error (${res.status}):</strong> ${data.message || res.statusText}`;
        updateStatusBadge("error", `n8n Error ${res.status}`);
      }
    }
  } catch (err) {
    box.className = "status-box error";
    box.innerHTML = `<strong>Network / CORS Error:</strong> Unable to connect. Please ensure n8n allows CORS or check your network connection.`;
    updateStatusBadge("error", "Connection Failed");
  }
}

function updateStatusBadge(status, label) {
  elements.connectionStatusText.textContent = label;
  const dot = elements.sidebarStatusPill.querySelector(".status-dot");
  if (dot) {
    dot.className = `status-dot ${status === "connected" ? "" : status}`;
  }
}

// ==========================================================================
// Chat Session Management
// ==========================================================================

function createNewChat() {
  const newChat = {
    id: "chat_" + Date.now(),
    title: "New chat",
    createdAt: Date.now(),
    updatedAt: Date.now(),
    messages: []
  };

  appState.chats.unshift(newChat);
  appState.currentChatId = newChat.id;
  saveChatsToStorage();

  renderChatHistory();
  renderCurrentChatMessages();

  if (window.innerWidth <= 768) {
    elements.sidebar.classList.remove("mobile-open");
    elements.sidebarOverlay.classList.remove("active");
  }

  elements.messageInput.focus();
}

function switchToChat(chatId) {
  const chat = appState.chats.find((c) => c.id === chatId);
  if (!chat) return;

  appState.currentChatId = chatId;
  renderChatHistory();
  renderCurrentChatMessages();

  if (window.innerWidth <= 768) {
    elements.sidebar.classList.remove("mobile-open");
    elements.sidebarOverlay.classList.remove("active");
  }
}

function deleteChat(chatId, e) {
  if (e) e.stopPropagation();

  appState.chats = appState.chats.filter((c) => c.id !== chatId);
  saveChatsToStorage();

  if (appState.chats.length === 0) {
    createNewChat();
  } else if (appState.currentChatId === chatId) {
    switchToChat(appState.chats[0].id);
  } else {
    renderChatHistory();
  }
}

function renameChat(chatId, e) {
  if (e) e.stopPropagation();

  const chat = appState.chats.find((c) => c.id === chatId);
  if (!chat) return;

  const newTitle = prompt("Enter conversation title:", chat.title);
  if (newTitle && newTitle.trim()) {
    chat.title = newTitle.trim();
    saveChatsToStorage();
    renderChatHistory();
  }
}

function getCurrentChat() {
  return appState.chats.find((c) => c.id === appState.currentChatId);
}

// Render the sidebar history list grouped by date
function renderChatHistory() {
  const container = elements.chatHistoryList;
  container.innerHTML = "";

  if (appState.chats.length === 0) {
    container.innerHTML = '<div class="history-empty-hint">No past conversations yet.<br>Start chatting below!</div>';
    return;
  }

  // Group by Today, Yesterday, Previous 7 Days, Older
  const groups = {
    Today: [],
    Yesterday: [],
    "Previous 7 Days": [],
    Older: []
  };

  const now = new Date();
  const oneDay = 24 * 60 * 60 * 1000;

  appState.chats.forEach((chat) => {
    const diff = now.getTime() - chat.updatedAt;
    if (diff < oneDay && now.getDate() === new Date(chat.updatedAt).getDate()) {
      groups["Today"].push(chat);
    } else if (diff < 2 * oneDay) {
      groups["Yesterday"].push(chat);
    } else if (diff < 7 * oneDay) {
      groups["Previous 7 Days"].push(chat);
    } else {
      groups["Older"].push(chat);
    }
  });

  Object.entries(groups).forEach(([category, chats]) => {
    if (chats.length === 0) return;

    const label = document.createElement("div");
    label.className = "history-category-label";
    label.textContent = category;
    container.appendChild(label);

    chats.forEach((chat) => {
      const item = document.createElement("div");
      item.className = `history-item ${chat.id === appState.currentChatId ? "active" : ""}`;
      item.addEventListener("click", () => switchToChat(chat.id));

      const title = document.createElement("span");
      title.className = "history-item-title";
      title.textContent = chat.title || "New chat";

      const actions = document.createElement("div");
      actions.className = "history-item-actions";

      // Edit Button
      const editBtn = document.createElement("button");
      editBtn.className = "history-action-btn";
      editBtn.title = "Rename chat";
      editBtn.innerHTML = `
        <svg class="icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
          <path d="M17 3a2.85 2.83 0 1 1 4 4L7.5 20.5 2 22l1.5-5.5Z"/>
        </svg>
      `;
      editBtn.addEventListener("click", (e) => renameChat(chat.id, e));

      // Delete Button
      const deleteBtn = document.createElement("button");
      deleteBtn.className = "history-action-btn";
      deleteBtn.title = "Delete chat";
      deleteBtn.innerHTML = `
        <svg class="icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
          <path d="M3 6h18M19 6v14c0 1-1 2-2 2H7c-1 0-2-1-2-2V6M8 6V4c0-1 1-2 2-2h4c1 0 2 1 2 2v2"/>
        </svg>
      `;
      deleteBtn.addEventListener("click", (e) => deleteChat(chat.id, e));

      actions.appendChild(editBtn);
      actions.appendChild(deleteBtn);

      item.appendChild(title);
      item.appendChild(actions);
      container.appendChild(item);
    });
  });
}

// Render all messages in current chat
function renderCurrentChatMessages() {
  const chat = getCurrentChat();
  elements.messagesContainer.innerHTML = "";

  if (!chat || chat.messages.length === 0) {
    elements.welcomeScreen.classList.remove("hidden");
    return;
  }

  elements.welcomeScreen.classList.add("hidden");

  chat.messages.forEach((msg) => {
    appendMessageToDOM(msg, false);
  });

  scrollToBottom(false);
  attachCodeBlockEnhancements();
}

// ==========================================================================
// Sending & Handling Messages with n8n Webhook
// ==========================================================================

async function sendMessage(text) {
  const currentChat = getCurrentChat();
  if (!currentChat) return;

  // Auto-generate title from first message
  if (currentChat.messages.length === 0) {
    currentChat.title = text.length > 28 ? text.slice(0, 25) + "..." : text;
    renderChatHistory();
  }

  // 1. Add User Message
  const userMsg = {
    id: "msg_" + Date.now(),
    role: "user",
    content: text,
    timestamp: Date.now()
  };

  currentChat.messages.push(userMsg);
  currentChat.updatedAt = Date.now();
  saveChatsToStorage();

  elements.welcomeScreen.classList.add("hidden");
  appendMessageToDOM(userMsg, true);
  scrollToBottom();

  // 2. Show Assistant Thinking Indicator
  appState.isGenerating = true;
  elements.sendBtn.classList.add("generating");
  elements.sendBtn.disabled = false;

  const tempAssistantId = "msg_ast_" + Date.now();
  const loadingRow = createThinkingMessageElement(tempAssistantId);
  elements.messagesContainer.appendChild(loadingRow);
  scrollToBottom();

  // Setup AbortController for cancel/stop button
  appState.abortController = new AbortController();

  try {
    const payload = {
      chatInput: text,
      message: text,
      prompt: text,
      query: text,
      sessionId: currentChat.id
    };

    const response = await fetch(appState.config.webhookUrl, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Accept: "application/json, text/plain, */*"
      },
      body: JSON.stringify(payload),
      signal: appState.abortController.signal
    });

    // Remove thinking indicator
    loadingRow.remove();

    if (!response.ok) {
      let errorData = null;
      try {
        errorData = await response.json();
      } catch (e) {
        errorData = { message: response.statusText };
      }

      handleWebhookError(response.status, errorData, currentChat);
      return;
    }

    // Parse valid response
    const rawData = await response.text();
    let botReplyText = "";

    try {
      const jsonData = JSON.parse(rawData);
      botReplyText = extractTextFromN8nResponse(jsonData);
    } catch (e) {
      // Direct plain text
      botReplyText = rawData;
    }

    if (!botReplyText || !botReplyText.trim()) {
      botReplyText = "I received your request, but the workflow did not return any text. Please verify your **Respond to Webhook** node in n8n.";
    }

    // Save assistant message to state
    const assistantMsg = {
      id: "msg_" + Date.now(),
      role: "assistant",
      content: botReplyText,
      timestamp: Date.now()
    };

    currentChat.messages.push(assistantMsg);
    currentChat.updatedAt = Date.now();
    saveChatsToStorage();

    // Stream typewriter or instant render
    if (appState.config.typewriterEnabled) {
      await streamTypewriterMessage(assistantMsg);
    } else {
      appendMessageToDOM(assistantMsg, true);
      attachCodeBlockEnhancements();
      scrollToBottom();
    }
  } catch (err) {
    loadingRow.remove();

    if (err.name === "AbortError") {
      showToast("Generation stopped", "info");
    } else {
      console.error("Fetch Error:", err);
      renderErrorMessage(
        "Network or CORS connection error.",
        `Failed to reach: <code>${escapeHtml(appState.config.webhookUrl)}</code>. Make sure your internet is connected and n8n cloud allows incoming requests.`
      );
    }
  } finally {
    appState.isGenerating = false;
    appState.abortController = null;
    elements.sendBtn.classList.remove("generating");
    handleInputChange();
  }
}

// Stop response generation
function stopGeneration() {
  if (appState.abortController) {
    appState.abortController.abort();
    appState.abortController = null;
  }
  appState.isGenerating = false;
  elements.sendBtn.classList.remove("generating");
  handleInputChange();
}

// Extract response text regardless of n8n output structure
function extractTextFromN8nResponse(data) {
  if (!data) return "";
  if (typeof data === "string") return data;

  if (Array.isArray(data)) {
    if (data.length === 0) return "";
    return extractTextFromN8nResponse(data[0]);
  }

  if (typeof data === "object") {
    // Common keys used in LLM Chain and Respond to Webhook nodes
    if (data.text) return data.text;
    if (data.output) return data.output;
    if (data.message) return data.message;
    if (data.response) return data.response;
    if (data.result) return data.result;
    if (data.content) return data.content;
    if (data.body) return extractTextFromN8nResponse(data.body);

    // If it has a single key with string value
    const keys = Object.keys(data);
    if (keys.length === 1 && typeof data[keys[0]] === "string") {
      return data[keys[0]];
    }

    return JSON.stringify(data, null, 2);
  }

  return String(data);
}

// Handle specific n8n 404 unactivated error or other statuses
function handleWebhookError(status, errorData, currentChat) {
  const errMsg = (errorData && errorData.message) || "";
  const isUnregistered = status === 404 && (errMsg.includes("not registered") || errMsg.includes("POST chat"));

  if (isUnregistered) {
    const errorHtml = `
      <div class="error-banner">
        <div class="error-header">
          <svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" stroke-width="2">
            <path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z"/>
            <line x1="12" y1="9" x2="12" y2="13"/>
            <line x1="12" y1="17" x2="12.01" y2="17"/>
          </svg>
          <span>n8n Workflow Not Active Yet</span>
        </div>
        <p>The production webhook (<code>/webhook/chat</code>) received a 404 because your workflow is currently in <strong>Draft / Inactive</strong> mode.</p>
        <p><strong>To fix this:</strong></p>
        <ol style="margin-left: 20px; font-size: 13px;">
          <li>Open your n8n workflow canvas.</li>
          <li>Click the <strong>Publish</strong> button in the top-right corner to activate it.</li>
          <li>Alternatively, switch to the <strong>Test Webhook URL</strong> if you're testing directly from the canvas.</li>
        </ol>
        <div class="error-actions">
          <button class="btn-retry" id="switchTestUrlQuickBtn">Switch to Test URL (/webhook-test/chat)</button>
          <button class="btn-config" id="openSettingsQuickBtn">Check Settings</button>
        </div>
      </div>
    `;

    const assistantMsg = {
      id: "msg_err_" + Date.now(),
      role: "assistant",
      isRawHtml: true,
      content: errorHtml,
      timestamp: Date.now()
    };

    currentChat.messages.push(assistantMsg);
    saveChatsToStorage();
    appendMessageToDOM(assistantMsg, true);
    scrollToBottom();

    // Attach click events
    setTimeout(() => {
      const switchBtn = document.getElementById("switchTestUrlQuickBtn");
      if (switchBtn) {
        switchBtn.addEventListener("click", () => {
          appState.config.webhookUrl = DEFAULT_CONFIG.testWebhookUrl;
          saveConfigToStorage();
          updateEndpointFootnote();
          showToast("Switched to Test Webhook URL", "success");
        });
      }
      const cfgBtn = document.getElementById("openSettingsQuickBtn");
      if (cfgBtn) {
        cfgBtn.addEventListener("click", openSettings);
      }
    }, 100);
  } else {
    renderErrorMessage(
      `n8n Webhook Error (${status})`,
      `${errMsg || "Failed to process chat message."}`
    );
  }
}

function renderErrorMessage(title, details) {
  const row = document.createElement("div");
  row.className = "message-row assistant";
  row.innerHTML = `
    <div class="assistant-avatar">
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
        <path d="M12 2a10 10 0 1 0 10 10A10 10 0 0 0 12 2zm0 18a8 8 0 1 1 8-8 8 8 0 0 1-8 8z"/>
      </svg>
    </div>
    <div class="message-content-wrapper">
      <div class="error-banner">
        <div class="error-header">${escapeHtml(title)}</div>
        <p>${details}</p>
      </div>
    </div>
  `;
  elements.messagesContainer.appendChild(row);
  scrollToBottom();
}

// ==========================================================================
// DOM Rendering & Formatting
// ==========================================================================

function createThinkingMessageElement(id) {
  const row = document.createElement("div");
  row.className = "message-row assistant";
  row.id = id;
  row.innerHTML = `
    <div class="assistant-avatar">
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
        <path d="M12 2a10 10 0 1 0 10 10A10 10 0 0 0 12 2zm0 18a8 8 0 1 1 8-8 8 8 0 0 1-8 8z"/>
        <path d="M12 6v6l4 2"/>
      </svg>
    </div>
    <div class="message-content-wrapper">
      <div class="typing-dots">
        <span></span>
        <span></span>
        <span></span>
      </div>
    </div>
  `;
  return row;
}

function appendMessageToDOM(msg, animate = false) {
  const row = document.createElement("div");
  row.className = `message-row ${msg.role}`;
  row.id = msg.id;

  if (msg.role === "user") {
    row.innerHTML = `<div class="message-bubble">${escapeHtml(msg.content)}</div>`;
  } else {
    // Assistant message
    const renderedBody = msg.isRawHtml ? msg.content : renderMarkdown(msg.content);
    row.innerHTML = `
      <div class="assistant-avatar">
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
          <path d="M12 2a10 10 0 1 0 10 10A10 10 0 0 0 12 2zm0 18a8 8 0 1 1 8-8 8 8 0 0 1-8 8z"/>
          <path d="M12 6v6l4 2"/>
        </svg>
      </div>
      <div class="message-content-wrapper">
        <div class="assistant-markdown">${renderedBody}</div>
        ${!msg.isRawHtml ? createMessageActionsHtml(msg.id) : ""}
      </div>
    `;

    if (!msg.isRawHtml) {
      setupMessageActionButtons(row, msg);
    }
  }

  elements.messagesContainer.appendChild(row);
  return row;
}

// Assistant Action Toolbar (Copy, Read Aloud, Thumbs Up, Regenerate)
function createMessageActionsHtml(msgId) {
  return `
    <div class="message-actions" data-msg-id="${msgId}">
      <button class="msg-action-btn action-copy" title="Copy response">
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
          <rect width="14" height="14" x="8" y="8" rx="2" ry="2"/>
          <path d="M4 16c-1.1 0-2-.9-2-2V4c0-1.1.9-2 2-2h10c1.1 0 2 .9 2 2"/>
        </svg>
        <span>Copy</span>
      </button>
      <button class="msg-action-btn action-tts" title="Read aloud">
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
          <polygon points="11 5 6 9 2 9 2 15 6 15 11 19 11 5"/>
          <path d="M15.54 8.46a5 5 0 0 1 0 7.07"/>
          <path d="M19.07 4.93a10 10 0 0 1 0 14.14"/>
        </svg>
        <span>Listen</span>
      </button>
      <button class="msg-action-btn action-thumbs-up" title="Good response">
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
          <path d="M7 10v12M15 10.5a3.5 3.5 0 0 0-7 0V14h7a2 2 0 0 1 2 2v2a2 2 0 0 1-2 2H9a2 2 0 0 1-2-2V6a2 2 0 0 1 2-2h1.5a3 3 0 0 1 3 3v3.5"/>
        </svg>
      </button>
      <button class="msg-action-btn action-thumbs-down" title="Bad response">
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
          <path d="M17 14V2M9 13.5a3.5 3.5 0 0 0 7 0V10H9a2 2 0 0 1-2-2V6a2 2 0 0 1 2-2h5a2 2 0 0 1 2 2v12a2 2 0 0 1-2 2h-1.5a3 3 0 0 1-3-3V13.5"/>
        </svg>
      </button>
    </div>
  `;
}

function setupMessageActionButtons(rowElement, msg) {
  const copyBtn = rowElement.querySelector(".action-copy");
  if (copyBtn) {
    copyBtn.addEventListener("click", () => {
      navigator.clipboard.writeText(msg.content).then(() => {
        copyBtn.querySelector("span").textContent = "Copied!";
        setTimeout(() => {
          copyBtn.querySelector("span").textContent = "Copy";
        }, 2000);
      });
    });
  }

  const ttsBtn = rowElement.querySelector(".action-tts");
  if (ttsBtn) {
    ttsBtn.addEventListener("click", () => {
      toggleTextToSpeech(msg.content, ttsBtn);
    });
  }

  const upBtn = rowElement.querySelector(".action-thumbs-up");
  const downBtn = rowElement.querySelector(".action-thumbs-down");

  if (upBtn) {
    upBtn.addEventListener("click", () => {
      upBtn.classList.toggle("active");
      if (downBtn) downBtn.classList.remove("active");
    });
  }

  if (downBtn) {
    downBtn.addEventListener("click", () => {
      downBtn.classList.toggle("active");
      if (upBtn) upBtn.classList.remove("active");
    });
  }
}

// Typewriter / Streaming animation
async function streamTypewriterMessage(msg) {
  const row = appendMessageToDOM({ ...msg, content: "" }, true);
  const container = row.querySelector(".assistant-markdown");

  const fullText = msg.content;
  let currentText = "";
  const chunkSize = Math.max(1, Math.floor(fullText.length / 80));
  const delay = 14;

  for (let i = 0; i < fullText.length; i += chunkSize) {
    if (!appState.isGenerating && appState.abortController === null) {
      // Finished or aborted
      break;
    }

    currentText = fullText.slice(0, i + chunkSize);
    container.innerHTML = renderMarkdown(currentText) + '<span class="typing-cursor"></span>';
    scrollToBottom();
    await new Promise((r) => setTimeout(r, delay));
  }

  container.innerHTML = renderMarkdown(fullText);
  attachCodeBlockEnhancements();
  scrollToBottom();
}

// Code Block Copy Button & Header insertion
function attachCodeBlockEnhancements() {
  const pres = elements.messagesContainer.querySelectorAll("pre:not(.enhanced)");

  pres.forEach((pre) => {
    pre.classList.add("enhanced");
    const code = pre.querySelector("code");
    if (!code) return;

    // Detect language from class (e.g. language-js)
    let lang = "code";
    code.classList.forEach((cls) => {
      if (cls.startsWith("language-")) {
        lang = cls.replace("language-", "");
      }
    });

    const wrapper = document.createElement("div");
    wrapper.className = "code-block-wrapper";

    const header = document.createElement("div");
    header.className = "code-header";
    header.innerHTML = `
      <span>${lang}</span>
      <button class="copy-code-btn">
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
          <rect width="14" height="14" x="8" y="8" rx="2" ry="2"/>
          <path d="M4 16c-1.1 0-2-.9-2-2V4c0-1.1.9-2 2-2h10c1.1 0 2 .9 2 2"/>
        </svg>
        <span>Copy code</span>
      </button>
    `;

    const copyBtn = header.querySelector(".copy-code-btn");
    copyBtn.addEventListener("click", () => {
      navigator.clipboard.writeText(code.innerText).then(() => {
        copyBtn.querySelector("span").textContent = "Copied!";
        setTimeout(() => {
          copyBtn.querySelector("span").textContent = "Copy code";
        }, 2000);
      });
    });

    pre.parentNode.insertBefore(wrapper, pre);
    wrapper.appendChild(header);
    wrapper.appendChild(pre);
  });
}

// ==========================================================================
// Speech / Voice (TTS & STT)
// ==========================================================================

function toggleTextToSpeech(text, btn) {
  if (!("speechSynthesis" in window)) {
    showToast("Text-to-speech not supported in this browser", "error");
    return;
  }

  if (window.speechSynthesis.speaking) {
    window.speechSynthesis.cancel();
    btn.querySelector("span").textContent = "Listen";
    return;
  }

  const plainText = text.replace(/[#*_`>\[\]]/g, "");
  const utterance = new SpeechSynthesisUtterance(plainText);
  utterance.rate = 1.0;
  utterance.pitch = 1.0;

  btn.querySelector("span").textContent = "Stop";

  utterance.onend = () => {
    btn.querySelector("span").textContent = "Listen";
  };

  utterance.onerror = () => {
    btn.querySelector("span").textContent = "Listen";
  };

  window.speechSynthesis.speak(utterance);
}

function setupVoiceRecognition() {
  const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
  if (!SpeechRecognition) {
    elements.micBtn.style.opacity = "0.4";
    elements.micBtn.title = "Voice recognition not supported in this browser";
    return;
  }

  const recognition = new SpeechRecognition();
  recognition.continuous = false;
  recognition.interimResults = true;
  recognition.lang = "en-US";

  recognition.onstart = () => {
    appState.isRecordingVoice = true;
    elements.micBtn.classList.add("recording");
    elements.messageInput.placeholder = "Listening... speak now";
  };

  recognition.onresult = (event) => {
    let transcript = "";
    for (let i = event.resultIndex; i < event.results.length; ++i) {
      transcript += event.results[i][0].transcript;
    }
    elements.messageInput.value = transcript;
    handleInputChange();
  };

  recognition.onend = () => {
    appState.isRecordingVoice = false;
    elements.micBtn.classList.remove("recording");
    elements.messageInput.placeholder = "Ask anything about banking, accounts...";
  };

  recognition.onerror = (e) => {
    appState.isRecordingVoice = false;
    elements.micBtn.classList.remove("recording");
    elements.messageInput.placeholder = "Ask anything about banking, accounts...";
    if (e.error !== "no-speech") {
      showToast(`Voice error: ${e.error}`, "error");
    }
  };

  appState.speechRecognition = recognition;
}

function toggleVoiceInput() {
  if (!appState.speechRecognition) {
    showToast("Voice input is not supported in this browser.", "info");
    return;
  }

  if (appState.isRecordingVoice) {
    appState.speechRecognition.stop();
  } else {
    try {
      appState.speechRecognition.start();
    } catch (e) {
      console.warn("Speech recognition already active:", e);
    }
  }
}

// ==========================================================================
// Toast Utility
// ==========================================================================

function showToast(message, type = "info") {
  const toast = document.createElement("div");
  toast.className = `toast ${type}`;
  toast.textContent = message;

  elements.toastContainer.appendChild(toast);

  setTimeout(() => {
    toast.style.opacity = "0";
    toast.style.transform = "translateX(50px)";
    toast.style.transition = "all 0.3s ease";
    setTimeout(() => toast.remove(), 300);
  }, 3500);
}

// Launch application on DOM ready
document.addEventListener("DOMContentLoaded", init);
