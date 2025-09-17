// Initialize Supabase client - replace <public-anon-key> with actual public key
const supabaseClient = supabase.createClient('https://zlnbchdjdqxjeipylvhl.supabase.co', 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InpsbmJjaGRqZHF4amVpcHlsdmhsIiwicm9sZSI6ImFub24iLCJpYXQiOjE3MDY4ODQ1NzAsImV4cCI6MjAyMjQ2MDU3MH0.qA5Kudwt3__oVJxUXiGrAM-U8nztH7yZgzuS9XQVlZw');

// Check if user has visited before
function checkFirstVisit() {
  // Always hide login overlay - login removed
  document.getElementById('loginOverlay').style.display = 'none';
}

// Chat functionality
let conversationHistory = [];
let chatSessions = [];
let currentChatId = null;
let recognition = null, recognizing = false;
let listeningEl = null;
let selectedModel = localStorage.getItem('selectedModel') || 'Default';

// Load chat sessions from localStorage
function loadChatSessions() {
  const savedSessions = localStorage.getItem('chatSessions');
  if (savedSessions) {
    try {
      chatSessions = JSON.parse(savedSessions);
    } catch (e) {
      console.error("Error parsing saved chat sessions:", e);
      chatSessions = [];
    }
  }
  
  // Create new chat if no sessions exist
  if (chatSessions.length === 0) {
    createNewChat();
  } else {
    // Load the most recent chat
    loadChat(chatSessions[0].id);
  }
}

// Save chat sessions to localStorage
function saveChatSessions() {
  try {
    localStorage.setItem('chatSessions', JSON.stringify(chatSessions));
  } catch (e) {
    console.error("Error saving chat sessions:", e);
  }
}

// Create a new chat session
function createNewChat() {
  const newChatId = Date.now().toString();
  const newChat = {
    id: newChatId,
    title: "New Chat",
    timestamp: Date.now(),
    messages: []
  };
  
  // Add to beginning of array (most recent first)
  chatSessions.unshift(newChat);
  
  // Reset conversation history
  conversationHistory = [];
  
  // Set as current chat
  currentChatId = newChatId;
  
  // Save to localStorage
  saveChatSessions();
  
  // Update UI
  updateChatHistory();
  clearMessages();
  
  return newChatId;
}

// Load a specific chat by ID
function loadChat(chatId) {
  const chatIndex = chatSessions.findIndex(chat => chat.id === chatId);
  
  if (chatIndex >= 0) {
    currentChatId = chatId;
    
    // Move this chat to the top (most recent)
    const chat = chatSessions.splice(chatIndex, 1)[0];
    chatSessions.unshift(chat);
    
    // Update conversation history
    conversationHistory = [...chat.messages];
    
    // Update UI
    updateChatHistory();
    displayMessages(chat.messages);
    
    saveChatSessions();
  }
}

// Delete a chat by ID
function deleteChat(chatId) {
  const chatIndex = chatSessions.findIndex(chat => chat.id === chatId);
  
  if (chatIndex >= 0) {
    chatSessions.splice(chatIndex, 1);
    saveChatSessions();
    
    // If we deleted the current chat, load another one or create new
    if (chatId === currentChatId) {
      if (chatSessions.length > 0) {
        loadChat(chatSessions[0].id);
      } else {
        createNewChat();
      }
    }
    
    updateChatHistory();
  }
}

// Display messages in the UI
function displayMessages(messages) {
  clearMessages();
  
  if (!messages || messages.length === 0) return;
  
  messages.forEach(msg => {
    if (msg.role === 'user' || msg.role === 'assistant') {
      addMessage(msg.content, msg.role);
    }
  });
}

// Clear messages from the UI
function clearMessages() {
  const messagesContainer = document.getElementById('messages');
  if (messagesContainer) {
    messagesContainer.innerHTML = `
      <div class="welcome-screen">
        <div class="welcome-icon">
          <img src="/robot.png" alt="OmenisAI Robot" class="robot-image">
        </div>
        <h1>Welcome to OmenisAI</h1>
        <p>Your intelligent conversation partner</p>
        <div class="suggestion-chips"></div>
      </div>
    `;
    
    // Initialize suggestions
    const mainSuggestions = Object.keys(suggestions);
    updateSuggestionChips(mainSuggestions);
  }
}

// Function to update chat title based on first user message
function updateChatTitle(message) {
  if (!currentChatId) return;
  
  const chatIndex = chatSessions.findIndex(chat => chat.id === currentChatId);
  if (chatIndex >= 0) {
    // Only update if it's "New Chat" or first message
    if (chatSessions[chatIndex].title === "New Chat" || chatSessions[chatIndex].messages.length <= 2) {
      // Limit title length
      let title = message.substring(0, 30);
      if (message.length > 30) title += "...";
      
      chatSessions[chatIndex].title = title;
      saveChatSessions();
      updateChatHistory();
    }
  }
}

// Handle textarea auto-resize
const textarea = document.getElementById('userInput');
if (textarea) {
  textarea.addEventListener('input', function() {
    this.style.height = 'auto';
    this.style.height = Math.min(this.scrollHeight, 200) + 'px';
  });

  // Handle enter key for sending messages
  textarea.addEventListener('keydown', function(e) {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      sendMessage();
    }
  });
}

// Add event listener to send button
document.addEventListener('DOMContentLoaded', function() {
  const sendButton = document.getElementById('sendButton');
  if (sendButton) {
    sendButton.addEventListener('click', sendMessage);
  }
  
  // Load existing chat sessions
  loadChatSessions();
});

// Function to create message element
function createMessageElement(content, role, isGenerating = false) {
  const messageDiv = document.createElement('div');
  messageDiv.className = `message ${role}`;
  
  if (isGenerating) {
    messageDiv.classList.add('generating');
  }
  
  const contentDiv = document.createElement('div');
  contentDiv.className = 'content';
  
  if (role === 'assistant') {
    const typewriterDiv = document.createElement('div');
    typewriterDiv.className = 'typewriter-text';
    
    const cursor = document.createElement('span');
    cursor.className = 'typewriter-cursor';
    
    const processedContent = processContent(content);
    typewriterDiv.innerHTML = processedContent;
    
    // Enhanced typing animation with smooth reveal
    let chars = typewriterDiv.textContent.length;
    const duration = Math.min(chars * 15, 2000); // Faster, smoother animation
    
    typewriterDiv.style.animation = `typewriter ${duration}ms steps(${chars}, end) forwards`;
    typewriterDiv.classList.add('typing');
    
    // Create copy button container for bottom positioning
    const copyButtonContainer = document.createElement('div');
    copyButtonContainer.className = 'copy-button-container';
    
    const copyButton = createCopyButton(() => content);
    copyButton.className = 'copy-button bottom-copy-button';
    copyButton.style.position = 'relative';
    copyButton.style.top = '0';
    copyButton.style.right = '0';
    copyButton.style.marginTop = '0.5rem';
    copyButton.style.opacity = '1';
    
    copyButtonContainer.appendChild(copyButton);
    contentDiv.appendChild(copyButtonContainer);
    
    setTimeout(() => {
      typewriterDiv.querySelectorAll('pre').forEach(pre => {
        const codeBlock = pre.querySelector('code');
        if (codeBlock) {
          const language = codeBlock.className.match(/language-(\w+)/)?.[1] || '';
          if (language && window.hljs && window.hljs.getLanguage(language)) {
            codeBlock.innerHTML = window.hljs.highlight(codeBlock.textContent, {
              language,
              ignoreIllegals: true
            }).value;
          } else if (window.hljs) {
            codeBlock.innerHTML = window.hljs.highlightAuto(codeBlock.textContent).value;
          }
          
          if (!isGenerating) {
            const copyButton = createCopyButton(() => codeBlock.textContent);
            pre.style.position = 'relative';
            pre.appendChild(copyButton);
          }
        }
      });
      
      setTimeout(() => {
        messageDiv.classList.remove('generating');
      }, duration);
      
    }, 10);

    contentDiv.appendChild(typewriterDiv);
    contentDiv.appendChild(cursor);
    
    setTimeout(() => {
      cursor.remove();
      typewriterDiv.classList.add('complete');
      
      if (window.hljs) {
        typewriterDiv.querySelectorAll('pre code').forEach(block => {
          window.hljs.highlightBlock(block);
        });
      }
    }, duration);

  } else {
    // Updated user message styling - removed blue background
    const userContentDiv = document.createElement('div');
    userContentDiv.className = 'user-message-content';
    userContentDiv.innerHTML = processContent(content);
    
    // Add subtle animation effect for user messages
    userContentDiv.style.animation = 'slideInRight 0.3s ease-out';
    
    setTimeout(() => {
      if (!isGenerating) {
        userContentDiv.querySelectorAll('pre').forEach(pre => {
          const codeContent = pre.textContent;
          const copyButton = createCopyButton(() => codeContent);
          pre.style.position = 'relative';
          pre.appendChild(copyButton);
        });
      }
      
      setTimeout(() => {
        messageDiv.classList.remove('generating');
      }, 300);
    }, 10);
    
    contentDiv.appendChild(userContentDiv);
  }

  messageDiv.appendChild(contentDiv);
  return messageDiv;
}

// Function to process input before sending
function processInput(input) {
  // Check if this might be a mathematical input
  const mathPatterns = [
    /[\d+\-*/^=<>~]+/, // Basic math operators
    /\b(?:sin|cos|tan|log|sqrt|pi|theta|alpha|beta|gamma|delta|epsilon|sum|prod|int|lim)\b/i, // Common math terms
    /\(.*\)/, // Parentheses (often used in math)
    /\[.*\]/, // Brackets
    /\{.*\}/, // Braces
    /\b(?:subset|supset|union|intersection|empty|parallel|perpendicular)\b/, // Set notation
    /\b(?:infinity|inf)\b/i, // Infinity
    /\b(?:equation|formula|solve|calculate|derivative|integral|function)\b/i // Math-related terms
  ];
  
  // Only apply replacements if it looks like math content
  const isMathInput = mathPatterns.some(pattern => pattern.test(input));
  
  if (!isMathInput) {
    return input;
  }

  return input
    // Replace operators and symbols, but only in mathematical contexts
    .replace(/->/g, '→')
    .replace(/=>/g, '⇒')
    .replace(/<=>/g, '⇔')
    .replace(/\binf\b|\binfinity\b/gi, '∞')
    .replace(/~=/g, '≈')
    .replace(/!=/g, '≠')
    .replace(/>=/g, '≥')
    .replace(/<=/g, '≤')
    .replace(/\+-/g, '±')
    .replace(/\.\.\./g, '…')
    .replace(/sqrt\((.*?)\)/gi, '√($1)')
    .replace(/\^2(?!\d)/g, '²')
    .replace(/\^3(?!\d)/g, '³');
}

// Function to process content with mathematical symbols and markdown
function processContent(text) {
  // Check if this looks like a mathematical or technical context
  const mathContextPatterns = [
    /[\d+\-*/=<>~]+/, // Mathematical operators
    /\b(?:equation|formula|solve|calculate|math|proof)\b/i, // Math-related words
    /\$[\s\S]*?\$/, // LaTeX delimiters
    /\\[\(\[\{][\s\S]*?\\[\)\]\}]/, // LaTeX brackets
    /\b(?:sin|cos|tan|log|sqrt|pi|theta|alpha|beta|gamma|delta|epsilon|sum|prod|int|lim)\b/i, // Math notation
    /\b(?:theorem|lemma|corollary|axiom|proof|QED)\b/i // Mathematical proof elements
  ];

  const isMathContext = mathContextPatterns.some(pattern => pattern.test(text));

  // Only replace mathematical symbols in likely math contexts
  if (isMathContext) {
    text = text
      .replace(/->/g, '→')
      .replace(/=>/g, '⇒')
      .replace(/<=>/g, '⇔')
      .replace(/\binf\b|\binfinity\b/gi, '∞')
      .replace(/~=/g, '≈')
      .replace(/!=/g, '≠')
      .replace(/>=/g, '≥')
      .replace(/<=/g, '≤')
      .replace(/\+-/g, '±')
      .replace(/\.\.\./g, '…')
      .replace(/sqrt\((.*?)\)/gi, '√($1)')
      .replace(/\^2(?!\d)/g, '²')
      .replace(/\^3(?!\d)/g, '³')
      .replace(/\b(in)\b(?=\s*[A-Z\{])/g, (match, offset, string) => {
        // Check if "in" is used in a mathematical expression by looking at nearby context
        const nearContext = string.slice(Math.max(0, offset - 15), 
          Math.min(string.length, offset + 15));
        return /set|collection|element|member|belongs|⊂|⊃|⊆|⊇|{|}|\[|\]|\(|\)/.test(nearContext) ? '∈' : match;
      });
  }

  // Process markdown and code blocks with syntax highlighting
  if (window.marked) {
    window.marked.setOptions({
      highlight: function(code, language) {
        if (language && window.hljs && window.hljs.getLanguage(language)) {
          try {
            return window.hljs.highlight(code, { language: language }).value;
          } catch (error) {
            console.error('Highlighting error:', error);
          }
        }
        return window.hljs ? window.hljs.highlightAuto(code).value : code;
      },
      langPrefix: 'hljs language-',
      breaks: true,
      gfm: true
    });

    return window.marked.parse(text);
  }

  return text;
}

// Function to create copy button
function createCopyButton(getTextCallback) {
  const button = document.createElement('button');
  button.className = 'copy-button';
  button.innerHTML = `
    <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke="currentColor" width="14" height="14">
      <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M8 16H6a2 2 0 01-2-2V6a2 2 0 012-2h8a2 2 0 012 2v2m-6 12h8a2 2 0 002-2v-8a2 2 0 00-2-2h-8a2 2 0 00-2 2v8a2 2 0 002 2z" />
    </svg>
    <span>Copy</span>
  `;
  
  let timeoutId;
  
  button.addEventListener('click', async () => {
    const text = getTextCallback();
    try {
      await navigator.clipboard.writeText(text);
      button.classList.add('copied');
      button.innerHTML = `
        <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke="currentColor" width="14" height="14">
          <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M5 13l4 4L19 7" />
        </svg>
        <span>Copied!</span>
      `;

      if (timeoutId) clearTimeout(timeoutId);
      
      timeoutId = setTimeout(() => {
        button.classList.remove('copied');
        button.innerHTML = `
          <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke="currentColor" width="14" height="14">
            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M8 16H6a2 2 0 01-2-2V6a2 2 0 012-2h8a2 2 0 012 2v2m-6 12h8a2 2 0 002-2v-8a2 2 0 00-2-2h-8a2 2 0 00-2 2v8a2 2 0 002 2z" />
          </svg>
          <span>Copy</span>
        `;
      }, 2000);
    } catch (err) {
      console.error('Failed to copy text:', err);
    }
  });
  
  return button;
}

// Function to add message to chat
function addMessage(content, role, isGenerating = false) {
  const messagesContainer = document.getElementById('messages');
  if (!messagesContainer) return;
  
  const welcomeScreen = messagesContainer.querySelector('.welcome-screen');
  if (welcomeScreen) {
    welcomeScreen.remove();
  }
  
  const messageElement = createMessageElement(content, role, isGenerating);
  messagesContainer.appendChild(messageElement);
  messagesContainer.scrollTop = messagesContainer.scrollHeight;
  
  return messageElement;
}

// Replace the showTypingIndicator function with a more creative one
function showTypingIndicator() {
  const messagesContainer = document.getElementById('messages');
  if (!messagesContainer) return;
  
  const indicator = document.createElement('div');
  indicator.className = 'thinking-animation';
  indicator.innerHTML = `
    <div class="thinking-container">
      <div class="thinking-robot">
        <img src="/robot.png" alt="Omenis Thinking" class="thinking-robot-img">
        <div class="thinking-bubble">
          <div class="thinking-dots">
            <span></span>
            <span></span>
            <span></span>
          </div>
          <div class="thinking-text">Omenis is thinking</div>
        </div>
      </div>
      <div class="thinking-particles">
        <div class="particle"></div>
        <div class="particle"></div>
        <div class="particle"></div>
        <div class="particle"></div>
        <div class="particle"></div>
      </div>
    </div>
  `;
  
  messagesContainer.appendChild(indicator);
  messagesContainer.scrollTop = messagesContainer.scrollHeight;
  
  return indicator;
}

// Update hideTypingIndicator to match new class
function hideTypingIndicator() {
  const indicator = document.querySelector('.thinking-animation');
  if (indicator) {
    indicator.style.opacity = '0';
    indicator.style.transform = 'scale(0.8)';
    setTimeout(() => {
      indicator.remove();
    }, 300);
  }
}

// Save message to current chat session
function saveMessageToCurrentChat(role, content) {
  if (!currentChatId) return;
  
  const chatIndex = chatSessions.findIndex(chat => chat.id === currentChatId);
  if (chatIndex >= 0) {
    const message = { role, content };
    chatSessions[chatIndex].messages.push(message);
    chatSessions[chatIndex].timestamp = Date.now();
    
    // Update chat title from first user message if needed
    if (role === 'user' && chatSessions[chatIndex].title === "New Chat") {
      updateChatTitle(content);
    }
    
    saveChatSessions();
    updateChatHistory();
  }
}

// Updated API integration - Function to send message to RapidAPI
async function sendToAPI(message) {
  try {
    // Add user message to conversation history
    const newMessage = {
      role: 'user',
      content: message
    };
    conversationHistory.push(newMessage);
    
    // Save message to current chat session
    saveMessageToCurrentChat('user', message);

    // Set up request with timeout
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 60000); // 60 second timeout

    try {
      // Prepare request data for the RapidAPI endpoint
      const contents = conversationHistory.map(m => ({
        role: m.role === 'assistant' ? 'model' : 'user',
        parts: [{ text: m.content }]
      }));
      const data = JSON.stringify({ contents });
      
      // Set up XMLHttpRequest for RapidAPI
      const response = await new Promise((resolve, reject) => {
        const xhr = new XMLHttpRequest();
        xhr.withCredentials = true;

        xhr.addEventListener('readystatechange', function () {
          if (this.readyState === this.DONE) {
            if (this.status >= 200 && this.status < 300) {
              resolve(this.responseText);
            } else {
              reject(new Error(`HTTP error ${this.status}: ${this.responseText}`));
            }
          }
        });

        xhr.addEventListener('error', () => {
          reject(new Error('Network error occurred'));
        });

        xhr.addEventListener('timeout', () => {
          reject(new Error('Request timed out'));
        });

        xhr.open('POST', 'https://gemini-pro-ai.p.rapidapi.com/');
        xhr.setRequestHeader('x-rapidapi-key', '9c8a6d3509msh57773c267fd8d26p16eb47jsn2361fd22e3bd');
        xhr.setRequestHeader('x-rapidapi-host', 'gemini-pro-ai.p.rapidapi.com');
        xhr.setRequestHeader('Content-Type', 'application/json');
        xhr.timeout = 60000; // 60 seconds timeout

        xhr.send(data);
      });

      clearTimeout(timeoutId);

      // Parse the response
      const responseData = JSON.parse(response);
      
      // Extract the assistant's message from the response
      let aiContent;
      
      // Properly handle different response formats from the API
      if (responseData?.candidates?.[0]?.content?.parts?.[0]?.text) {
        aiContent = responseData.candidates[0].content.parts[0].text;
      } else if (responseData.BOT) {
        aiContent = responseData.BOT;
      } else if (responseData.assistant) {
        aiContent = responseData.assistant;
      } else if (responseData.content) {
        aiContent = responseData.content;
      } else if (responseData.message) {
        aiContent = responseData.message;
      } else if (responseData.response) {
        aiContent = responseData.response;
      } else if (responseData.choices && responseData.choices.length > 0) {
        const choice = responseData.choices[0];
        aiContent = choice.message?.content || choice.text || '';
      } else {
        // If we can't find a response property, log the full response and use a fallback
        console.log('Unexpected API response format:', responseData);
        aiContent = "I received your message. Let me think about that...";
        
        // Attempt to extract any string property that might contain the response
        for (const key in responseData) {
          if (typeof responseData[key] === 'string' && responseData[key].length > 20) {
            aiContent = responseData[key];
            break;
          }
        }
      }
      
      // Fallback for empty responses
      if (!aiContent || aiContent.trim() === '' || aiContent.includes("I'm not sure how to respond to that")) {
        // Return a more informative fallback message
        return generateMeaningfulResponse(message);
      }
      
      // Add to conversation history
      conversationHistory.push({
        role: 'assistant',
        content: aiContent
      });
      
      // Save assistant message to current chat session
      saveMessageToCurrentChat('assistant', aiContent);
      
      return aiContent;
    } catch (fetchError) {
      console.error('API fetch error:', fetchError);
      
      if (fetchError.name === 'AbortError') {
        throw new Error('Request timed out. Please try again.');
      } 
      
      // Generate a local fallback response
      return generateMeaningfulResponse(message);
    }
  } catch (error) {
    console.error('API error:', error);
    
    // Generate a more useful fallback response based on the user's query
    return generateMeaningfulResponse(message);
  }
}

// Enhanced fallback response generator
function generateMeaningfulResponse(message) {
  // Check for question patterns
  const isQuestion = /^(?:who|what|when|where|why|how|is|are|can|could|would|should|will|do|does|did|has|have|had)\b/i.test(message) || message.includes('?');
  
  // Check for common topics
  const topics = {
    technology: /\b(?:computer|software|hardware|program|code|app|technology|tech|internet|web|website|online|digital|device|smartphone|laptop|ai|artificial intelligence|machine learning|data|algorithm|coding)\b/i,
    
    science: /\b(?:science|scientific|biology|chemistry|physics|astronomy|space|planet|star|galaxy|universe|quantum|atom|molecule|cell|organism|evolution|theory|experiment|laboratory|energy)\b/i,
    
    health: /\b(?:health|medical|medicine|doctor|hospital|disease|illness|symptom|treatment|therapy|cure|diet|exercise|nutrition|vitamin|protein|carb|fat|weight|fitness|workout|mental health|anxiety|depression|stress)\b/i,
    
    business: /\b(?:business|company|corporation|startup|entrepreneur|marketing|sales|product|service|customer|client|market|industry|economy|economic|finance|investment|stock|profit|revenue|management|strategy|career|job)\b/i,
    
    arts: /\b(?:art|music|film|movie|book|novel|story|write|author|character|plot|painting|drawing|sculpture|creative|design|fashion|style|culture|theater|performance|actor|director|artist|musician|band|song|genre)\b/i,
    
    history: /\b(?:history|historical|ancient|medieval|renaissance|modern|century|decade|year|war|battle|king|queen|president|leader|nation|country|civilization|culture|tradition|artifact|archaeology)\b/i,
    
    philosophy: /\b(?:philosophy|philosophical|ethics|moral|value|belief|religion|spiritual|soul|mind|consciousness|existence|reality|truth|knowledge|wisdom|meaning|purpose|logic|reason|rational|argument|question)\b/i,
    
    personal: /\b(?:I|me|my|mine|myself|you|your|yours|yourself|we|us|our|ours|ourselves|they|them|their|theirs|themselves|he|him|his|himself|she|her|hers|herself|friend|family|relationship|feeling|emotion|life|experience)\b/i
  };
  
  // Detect topic
  let detectedTopic = null;
  let highestScore = 0;
  
  for (const [topic, pattern] of Object.entries(topics)) {
    const matches = (message.match(pattern) || []).length;
    if (matches > highestScore) {
      highestScore = matches;
      detectedTopic = topic;
    }
  }
  
  // Default topic if none detected
  if (!detectedTopic || highestScore < 2) {
    detectedTopic = 'general';
  }
  
  // Topic-specific responses
  const topicResponses = {
    technology: [
      "That's an interesting technology question. From my understanding, this relates to how digital systems and software are designed to solve various problems. The field is constantly evolving with new innovations and approaches.",
      "Technology is advancing rapidly in this area. Many developers and engineers are working on solutions that improve efficiency, user experience, and integration with existing systems.",
      "From a technical perspective, this involves considering both hardware and software components, as well as how users interact with these systems. Modern approaches often emphasize scalability and future-proofing."
    ],
    
    science: [
      "This scientific question touches on fundamental principles about how our universe works. Scientists have developed various theories and conducted numerous experiments to better understand these phenomena.",
      "From a scientific standpoint, this involves careful observation, hypothesis testing, and peer review to establish reliable knowledge. There are often multiple perspectives and ongoing research in this area.",
      "The scientific community has made significant progress in understanding this through both theoretical models and experimental evidence. It's a fascinating area where new discoveries continue to refine our knowledge."
    ],
    
    health: [
      "Health questions like this are important, though I should note I'm not a medical professional. Generally, healthcare approaches focus on evidence-based practices and individualized care.",
      "When it comes to health and wellbeing, it's often recommended to consult with qualified healthcare providers. There are typically various approaches and treatments that may be appropriate depending on individual circumstances.",
      "This health topic has been researched extensively, with guidelines that evolve as new evidence emerges. The consensus among health professionals emphasizes both prevention and appropriate treatment options."
    ],
    
    business: [
      "From a business perspective, this often involves balancing multiple factors including market trends, customer needs, resource allocation, and strategic planning.",
      "Many successful businesses approach this by focusing on value creation, understanding their competitive advantage, and maintaining adaptability in changing market conditions.",
      "Business strategies in this area typically consider both short-term results and long-term sustainability, with increasing emphasis on innovation and stakeholder relationships."
    ],
    
    arts: [
      "The arts provide such a rich lens through which to explore this topic. Creative expression has allowed people throughout history to engage with these ideas in profound and meaningful ways.",
      "Artistic approaches to this vary widely across different cultures, time periods, and individual perspectives. This diversity of expression reflects the multifaceted nature of human experience.",
      "This has been a compelling theme in many artistic works, allowing for exploration of complex emotions, social dynamics, and philosophical questions through creative expression."
    ],
    
    history: [
      "Historically, this has been approached differently across various time periods and cultures. Looking at the historical context helps us understand how perspectives and practices have evolved.",
      "Historical records and analyses offer valuable insights on this topic, though it's important to consider multiple perspectives and the broader context of events and developments.",
      "Throughout history, this has influenced societal structures, cultural practices, and individual experiences in significant ways that continue to shape our understanding today."
    ],
    
    philosophy: [
      "Philosophically, this question has been explored from many angles, with different traditions offering varied perspectives on fundamental principles and implications.",
      "This touches on deep philosophical questions about knowledge, values, and the nature of reality. Thinkers have developed various frameworks to explore these dimensions of human experience.",
      "From a philosophical standpoint, this involves examining underlying assumptions, logical consistency, and broader implications for how we understand ourselves and our world."
    ],
    
    personal: [
      "This kind of personal experience is something many people can relate to in different ways. Our individual perspectives are shaped by our unique circumstances and interpretations.",
      "Personal growth often involves reflecting on these kinds of questions and experiences. Many find it helpful to consider different perspectives and approaches that align with their values.",
      "These personal matters often involve balancing various aspects of our lives and relationships. Finding approaches that work for your specific situation is typically most effective."
    ],
    
    general: [
      "That's an interesting topic to explore. There are multiple perspectives and approaches worth considering as you think about this further.",
      "This is a thoughtful question that people have approached in different ways. Looking at various viewpoints can provide a more comprehensive understanding.",
      "I appreciate your curiosity about this. It's a rich area to explore with various dimensions and considerations that can deepen our understanding."
    ]
  };
  
  // Choose a response based on topic and whether it's a question
  const relevantResponses = topicResponses[detectedTopic];
  const response = relevantResponses[Math.floor(Math.random() * relevantResponses.length)];
  
  const questionPrefix = isQuestion ? 
    "That's a thoughtful question. " : 
    "";
  
  const disclaimer = "\n\n(I'm currently experiencing some limitations in accessing specific information. I've provided a general response, but please feel free to ask for clarification or rephrase your question if this doesn't fully address what you're looking for.)";
  
  return questionPrefix + response + disclaimer;
}

// Function to handle sending messages
async function sendMessage() {
  const textarea = document.getElementById('userInput');
  if (!textarea) return;
  
  const userInput = textarea.value.trim();
  if (!userInput) return;

  // Disable the textarea and send button while processing
  textarea.disabled = true;
  const sendButton = document.getElementById('sendButton');
  if (sendButton) sendButton.disabled = true;

  try {
    // Ensure we have a current chat
    if (!currentChatId) {
      createNewChat();
    }

    // Process input to replace symbols in mathematical contexts
    const processedInput = processInput(userInput);

    // Add user message with processed input (mark as generating)
    addMessage(processedInput, 'user', true);
    textarea.value = '';
    textarea.style.height = 'auto';

    // Show typing indicator
    const typingIndicator = showTypingIndicator();

    let aiResponse;
    try {
      // Attempt to send message to API and get response
      aiResponse = await sendToAPI(processedInput);
    } catch (apiError) {
      console.error('API error, using fallback:', apiError);
      // If API fails, generate a local response
      aiResponse = generateMeaningfulResponse(processedInput);
    }
    
    // Hide typing indicator
    hideTypingIndicator();
    
    // Add AI response (mark as generating)
    addMessage(aiResponse, 'assistant', true);
  } catch (error) {
    console.error('Error sending message:', error);
    hideTypingIndicator();
    
    const errorMessage = 'Sorry, I encountered an error while processing your request. Please try again.';
    addMessage(errorMessage, 'assistant');
    
    // Save error message to current chat session
    saveMessageToCurrentChat('assistant', errorMessage);
  } finally {
    // Re-enable the textarea and send button
    textarea.disabled = false;
    if (sendButton) sendButton.disabled = false;
    textarea.focus();
  }
}

// Suggestions data structure
const suggestions = {
  "Tell me a story": [
    "Tell me a fairy tale",
    "Share a science fiction story",
    "Tell me a mystery story"
  ],
  "Explain quantum physics": [
    "Explain quantum entanglement",
    "What is Schrödinger's cat?",
    "How does quantum tunneling work?"
  ],
  "Write a poem": [
    "Write a haiku about nature",
    "Write a love sonnet",
    "Write a poem about space"
  ],
  "Solve a math problem": [
    "Help with calculus problem: find dy/dx of y = x^2 * sin(x)",
    "Explain the quadratic formula",
    "Calculate the probability of rolling a sum of 7 with two dice"
  ]
};

// Function to update suggestion chips
function updateSuggestionChips(options) {
  const suggestionChips = document.querySelector('.suggestion-chips');
  if (!suggestionChips) {
    console.warn('Suggestion chips container not found');
    return;
  }
  
  // Clear existing chips
  suggestionChips.innerHTML = '';
  
  // Add new chips
  options.forEach(option => {
    const chip = document.createElement('button');
    chip.className = 'chip';
    chip.textContent = option;
    chip.addEventListener('click', () => {
      const textarea = document.getElementById('userInput');
      if (textarea) {
        textarea.value = option;
        
        if (suggestions[option]) {
          updateSuggestionChips(suggestions[option]);
        } else {
          sendMessage();
          const mainSuggestions = Object.keys(suggestions);
          updateSuggestionChips(mainSuggestions);
        }
      }
    });
    suggestionChips.appendChild(chip);
  });
}

// Initialize new chat button with error handling
function initializeNewChat() {
  const newChatButton = document.getElementById('newChatButton');
  if (!newChatButton) {
    console.warn('New chat button not found');
    return;
  }
  
  newChatButton.addEventListener('click', () => {
    createNewChat();
    
    // Reset messages container with welcome screen
    clearMessages();
  });
}

// Update chat history UI
function updateChatHistory() {
  const chatHistoryContainer = document.querySelector('.chat-history-container');
  if (!chatHistoryContainer) {
    // Create the container if it doesn't exist
    const chatHistoryElement = document.getElementById('chatHistory');
    if (chatHistoryElement) {
      chatHistoryElement.innerHTML = '<div class="chat-history-container"></div>';
      updateChatHistory(); // Call again after creating container
      return;
    }
  }
  
  if (chatHistoryContainer) {
    chatHistoryContainer.innerHTML = '';
    
    if (chatSessions.length === 0) {
      chatHistoryContainer.innerHTML = '<div class="no-history-message">No chat history found</div>';
      return;
    }
    
    // Add heading
    const heading = document.createElement('div');
    heading.className = 'chatlist-heading';
    heading.textContent = 'Recent Conversations';
    chatHistoryContainer.appendChild(heading);
    
    // Add chat items
    chatSessions.forEach(chat => {
      const chatItem = document.createElement('div');
      chatItem.className = 'chat-history-item';
      if (chat.id === currentChatId) {
        chatItem.classList.add('active');
      }
      
      // Format date
      const date = new Date(chat.timestamp);
      const formattedDate = date.toLocaleDateString() + ' ' + 
                           date.toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'});
      
      chatItem.innerHTML = `
        <div class="chat-history-content">
          <div class="chat-history-title">${chat.title}</div>
          <div class="chat-history-date">${formattedDate}</div>
        </div>
        <div class="chat-history-actions">
          <button class="chat-history-button chat-history-delete" data-id="${chat.id}">
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
              <path d="M3 6h18M19 6v14a2 2 0 01-2 2V6a2 2 0 012-2h8a2 2 0 012 2v2m-6 12h8a2 2 0 002-2v-8a2 2 0 00-2-2h-8a2 2 0 00-2 2v8a2 2 0 002 2z" />
          </button>
        </div>
      `;
      
      // Add click event to load this chat
      chatItem.addEventListener('click', (e) => {
        // Only load if not clicking the delete button
        if (!e.target.closest('.chat-history-delete')) {
          loadChat(chat.id);
        }
      });
      
      chatHistoryContainer.appendChild(chatItem);
    });
    
    // Add delete event listeners
    const deleteButtons = chatHistoryContainer.querySelectorAll('.chat-history-delete');
    deleteButtons.forEach(button => {
      button.addEventListener('click', (e) => {
        e.stopPropagation();
        const chatId = button.dataset.id;
        deleteChat(chatId);
      });
    });
  }
}

// Check login state on page load - simplified
document.addEventListener('DOMContentLoaded', async () => {
  checkFirstVisit();
  
  // Initialize new chat button
  initializeNewChat();
  
  // Initialize suggestions
  const mainSuggestions = Object.keys(suggestions);
  updateSuggestionChips(mainSuggestions);
  
  // Initialize textarea handlers with error checking
  const textarea = document.getElementById('userInput');
  if (textarea) {
    textarea.addEventListener('input', function() {
      this.style.height = 'auto';
      this.style.height = Math.min(this.scrollHeight, 200) + 'px';
    });

    textarea.addEventListener('keydown', function(e) {
      if (e.key === 'Enter' && !e.shiftKey) {
        e.preventDefault();
        sendMessage();
      }
    });
  } else {
    console.warn('Textarea element not found');
  }

  // Initialize send button with error checking
  const sendButton = document.getElementById('sendButton');
  if (sendButton) {
    sendButton.addEventListener('click', sendMessage);
  } else {
    console.warn('Send button element not found');
  }
  
  // Initialize menu functionality
  initializeMenuFunctionality();
  initializeModelMenu();
  initializeUpdates(); // init updates
  
  // Load chat sessions from local storage
  loadChatSessions();
  
  // Initialize speech recognition
  setupSpeech();
});

// Function to initialize MathJax config
function initMathConfig() {
  window.MathJax = {
    tex: {
      inlineMath: [['$', '$'], ['\\(', '\\)']],
      displayMath: [['$$', '$$'], ['\\[', '\\]']],
      processEscapes: true,
      processEnvironments: true
    },
    options: {
      skipHtmlTags: ['script', 'noscript', 'style', 'textarea', 'pre']
    }
  };
}

// Initialize menu functionality
function initializeMenuFunctionality() {
  const menuButton = document.getElementById('menuButton');
  const menuPanel = document.getElementById('menuPanel');
  const menuOverlay = document.getElementById('menuOverlay');
  const menuClose = document.getElementById('menuClose');
  
  if (!menuButton || !menuPanel || !menuOverlay || !menuClose) {
    console.warn('Menu elements not found');
    return;
  }

  menuButton.addEventListener('click', toggleMenu);
  menuClose.addEventListener('click', () => {
    toggleMenu();
    const developerContent = document.getElementById('developerContent');
    if (developerContent) {
      developerContent.style.display = 'none';
    }
  });
  
  menuOverlay.addEventListener('click', () => {
    toggleMenu();
    const developerContent = document.getElementById('developerContent');
    if (developerContent) {
      developerContent.style.display = 'none';
    }
  });

  const historyToggle = document.getElementById('historyToggle');
  const chatHistory = document.getElementById('chatHistory');
  if (historyToggle && chatHistory) {
    historyToggle.addEventListener('click', () => {
      chatHistory.style.display = chatHistory.style.display === 'none' ? 'block' : 'none';
      updateChatHistory();
    });
  }

  const aboutToggle = document.getElementById('aboutToggle');
  const aboutContent = document.getElementById('aboutContent');
  if (aboutToggle && aboutContent) {
    aboutToggle.addEventListener('click', () => {
      aboutContent.style.display = aboutContent.style.display === 'none' ? 'block' : 'none';
    });
  }

  const developerToggle = document.getElementById('developerToggle');
  const developerContent = document.getElementById('developerContent');
  if (developerToggle && developerContent) {
    developerToggle.addEventListener('click', () => {
      developerContent.style.display = developerContent.style.display === 'none' ? 'block' : 'none';
      
      if (developerContent.style.display === 'block') {
        if (chatHistory) chatHistory.style.display = 'none';
        if (aboutContent) aboutContent.style.display = 'none';
      }
    });
  }

  const modelToggle = document.getElementById('modelToggle');
  const modelContent = document.getElementById('modelContent');
  if (modelToggle && modelContent) {
    modelToggle.addEventListener('click', () => {
      modelContent.style.display = modelContent.style.display === 'none' ? 'block' : 'none';
    });
  }

  const updatesToggle = document.getElementById('updatesToggle');
  if (updatesToggle) {
    updatesToggle.addEventListener('click', () => {
      const updatesOverlay = document.getElementById('updatesOverlay');
      if (updatesOverlay) {
        updatesOverlay.style.display = 'block';
        toggleMenu();
        renderUpdates(document.getElementById('updatesGrid'), document.getElementById('updatesTicker'));
      }
    });
  }
}

// Function to initialize model menu
function initializeModelMenu() {
  const models = ['Default', 'KmR si', 'oM 5i'];
  const details = {
    'Default': 'Balanced default mode for general conversations.',
    'KmR si': 'Powerful reasoning and coding assistance.',
    'oM 5i': 'Fast, multimodal-ready responses with strong capabilities.'
  };
  const listEl = document.getElementById('modelList');
  const detailsEl = document.getElementById('modelDetails');
  if (!listEl || !detailsEl) return;
  listEl.innerHTML = '';
  models.forEach(name => {
    const btn = document.createElement('button');
    btn.className = 'model-item' + (name === selectedModel ? ' active' : '');
    btn.textContent = name;
    const badge = document.createElement('span'); badge.className = 'model-active-badge'; badge.textContent = 'active';
    if (name !== selectedModel) badge.style.display = 'none'; btn.appendChild(badge);
    btn.addEventListener('click', () => {
      selectedModel = name;
      localStorage.setItem('selectedModel', selectedModel);
      Array.from(listEl.children).forEach(c => { c.classList.remove('active'); const b=c.querySelector('.model-active-badge'); if (b) b.style.display='none'; });
      btn.classList.add('active'); badge.style.display='inline-flex';
      detailsEl.textContent = details[name];
    });
    listEl.appendChild(btn);
  });
  detailsEl.textContent = details[selectedModel] || '';
}

// Function to setup speech recognition
function setupSpeech() {
  const btn = document.getElementById('speakButton');
  if (!btn) return;
  const SR = window.SpeechRecognition || window.webkitSpeechRecognition;
  if (!SR) { btn.disabled = true; btn.title = 'Speech not supported'; return; }
  recognition = new SR(); recognition.lang = 'en-US'; recognition.interimResults = true;
  recognition.onstart = ()=>{ showListeningIndicator(); };
  recognition.onresult = (e)=>{ const t = Array.from(e.results).map(r=>r[0].transcript).join(' ');
    const ta = document.getElementById('userInput'); if (ta) ta.value = t.trim(); };
  recognition.onend = async ()=>{ recognizing=false; hideListeningIndicator(); btn.classList.remove('recording');
    const ta=document.getElementById('userInput'); if (ta && ta.value.trim()) await sendMessage(); };
  btn.addEventListener('click', ()=>{ if (!recognition) return;
    if (!recognizing){ recognizing=true; btn.classList.add('recording'); recognition.start(); }
    else { recognizing=false; btn.classList.remove('recording'); recognition.stop(); } });
}

function showListeningIndicator() {
  if (!listeningEl) {
    listeningEl = document.createElement('div');
    listeningEl.className = 'listening-indicator';
    listeningEl.innerHTML = '<img src="/robot.png" alt=""/><span>Listening…</span>';
    document.body.appendChild(listeningEl);
  }
  listeningEl.style.display = 'flex';
}

function hideListeningIndicator() { if (listeningEl) listeningEl.style.display = 'none'; }

// Initialize updates
function initializeUpdates() {
  const overlay = document.getElementById('updatesOverlay');
  const grid = document.getElementById('updatesGrid');
  const ticker = document.getElementById('updatesTicker');
  const open = document.getElementById('updatesToggle');
  const close = document.getElementById('updatesClose');
  if (!overlay || !grid || !ticker || !open || !close) return;
  open.addEventListener('click', () => {
    overlay.style.display = 'block';
    toggleMenu();
    renderUpdates(grid, ticker);
  });
  close.addEventListener('click', () => {
    overlay.style.display = 'none';
  });
}

// Render updates
function renderUpdates(grid, ticker) {
  const updatesData = [
    {cat:'ai', icon:'🧠', title:'Model refresh', text:'Improved reasoning and code reliability.', tag:'AI Changes'},
    {cat:'free', icon:'💸', title:'Free tier expanded', text:'Higher daily limits for casual use.', tag:'Free Use'},
    {cat:'edu', icon:'🎓', title:'Education pack', text:'New classroom templates and guides.', tag:'Education'},
    {cat:'code', icon:'</>', title:'Code tools', text:'Inline explanations for errors.', tag:'Coding'},
    {cat:'daily', icon:'🗞️', title:'Daily article', text:'Best prompts for research workflows.', tag:'Daily'},
  ];
  
  grid.innerHTML = updatesData.map(u => `
    <div class="update-card ${u.cat}">
      <div class="update-meta"><span>${u.icon}</span><span class="tag ${u.cat}">${u.tag}</span></div>
      <div class="update-title">${u.title}</div>
      <div class="update-text">${u.text}</div>
    </div>`).join('');
  
  const items = updatesData.map(u => `<span class="ticker-item"><span class="ticker-tag tag ${u.cat}">${u.tag}</span><strong>${u.title}</strong> — ${u.text}</span>`).join('');
  ticker.innerHTML = `<div class="ticker-track">${items}${items}</div>`;
}

function toggleMenu(force) {
  const overlay = document.getElementById('menuOverlay');
  const panel = document.getElementById('menuPanel');
  if (!overlay || !panel) return;
  const isActive = typeof force === 'boolean' ? force : !panel.classList.contains('active');
  panel.classList.toggle('active', isActive);
  overlay.classList.toggle('active', isActive);
}