
import { Component, signal, effect, ViewChild, ElementRef, inject, computed } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormControl, FormGroup, ReactiveFormsModule, Validators } from '@angular/forms';
import { SecurityService } from './services/security.service';
import { AiService } from './services/ai.service';

type ViewState = 'LOGIN' | 'MENU' | 'CREATOR' | 'ROSTER' | 'CHAT' | 'SETTINGS' | 'LIBRARY';

interface Character {
  id: string;
  name: string;
  role: string;
  prompt: string;
  greeting: string;
  memory: string; // Long term summary
}

interface ChatMessage {
  role: 'user' | 'model';
  text: string;
  image?: string;
  timestamp: number;
}

@Component({
  selector: 'app-root',
  standalone: true,
  imports: [CommonModule, ReactiveFormsModule],
  templateUrl: './app.component.html',
  styles: [`
    .cli-btn-primary {
      @apply bg-green-700 text-black font-bold px-4 py-2 hover:bg-green-500 hover:shadow-[0_0_10px_rgba(0,255,0,0.5)] transition-all uppercase border border-green-500;
    }
    .cli-btn-secondary {
      @apply bg-transparent text-green-600 border border-green-800 px-4 py-2 hover:bg-green-900/30 hover:text-green-400 transition-all uppercase;
    }
    .cli-btn-sm {
      @apply bg-green-900/50 border border-green-700 text-xs px-2 py-1 hover:bg-green-700 hover:text-black uppercase;
    }
    .cli-input {
      @apply bg-black border border-green-800 text-green-300 p-2 focus:outline-none focus:border-green-500 font-mono text-sm;
    }
  `]
})
export class AppComponent {
  securityService = inject(SecurityService);
  aiService = inject(AiService);

  // App State
  isAuthenticated = signal(false);
  currentView = signal<ViewState>('MENU'); // Default after login
  loginError = signal(false);
  userKey = signal('');
  
  // Data State
  characters = signal<Character[]>([]);
  activeCharacter = signal<Character | null>(null);
  chatHistory = signal<ChatMessage[]>([]);
  isThinking = signal(false);
  showCommandHelp = signal(false);

  // Menu Config
  menuOptions = [
    { id: '1', emoji: '📂', label: 'LOAD_CHARACTER', view: 'ROSTER', desc: 'Select existing entity' },
    { id: '2', emoji: '🆕', label: 'NEW_CHARACTER', view: 'CREATOR', desc: 'Create new personality matrix' },
    { id: '3', emoji: '⚙️', label: 'SETTINGS', view: 'SETTINGS', desc: 'API & System config' },
    { id: '4', emoji: '📚', label: 'LIBRARY', view: 'LIBRARY', desc: 'Access Lore & Shared files' },
    { id: '5', emoji: '🔒', label: 'LOCK_TERMINAL', view: 'LOGOUT', desc: 'Encrypt & secure session' },
  ];

  // Forms
  charForm = new FormGroup({
    name: new FormControl('', [Validators.required]),
    role: new FormControl('', [Validators.required]),
    prompt: new FormControl('', [Validators.required]),
    greeting: new FormControl('Hello.', [Validators.required]),
  });

  @ViewChild('chatContainer') chatContainer!: ElementRef;

  // Computed
  time = signal(new Date().toLocaleTimeString());
  memoryUsage = computed(() => {
    // Fake metric based on chat length
    const usage = Math.min(100, Math.floor((this.chatHistory().length / 50) * 100));
    return usage;
  });

  constructor() {
    // Clock
    setInterval(() => {
      this.time.set(new Date().toLocaleTimeString());
    }, 1000);
  }

  login(password: string) {
    if (!password) return;
    
    if (!this.securityService.hasVault()) {
      // First time setup
      this.userKey.set(password);
      this.securityService.saveToVault(password, { characters: [] });
      this.isAuthenticated.set(true);
    } else {
      // Try decrypt
      const data = this.securityService.loadFromVault(password);
      if (data) {
        this.userKey.set(password);
        this.characters.set(data.characters || []);
        this.isAuthenticated.set(true);
      } else {
        this.loginError.set(true);
        setTimeout(() => this.loginError.set(false), 2000);
      }
    }
  }

  logout() {
    this.isAuthenticated.set(false);
    this.userKey.set('');
    this.currentView.set('MENU');
  }

  navigate(view: string) {
    if (view === 'LOGOUT') {
      this.logout();
    } else {
      this.currentView.set(view as ViewState);
    }
  }

  // Character Management
  saveCharacter() {
    if (this.charForm.invalid) return;
    
    const newChar: Character = {
      id: Date.now().toString(),
      name: this.charForm.value.name!,
      role: this.charForm.value.role!,
      prompt: this.charForm.value.prompt!,
      greeting: this.charForm.value.greeting!,
      memory: ''
    };

    this.characters.update(chars => [...chars, newChar]);
    this.persistData();
    this.charForm.reset();
    this.currentView.set('ROSTER');
  }

  deleteCharacter(id: string) {
    if (confirm('CONFIRM DELETION? THIS ACTION CANNOT BE UNDONE.')) {
      this.characters.update(chars => chars.filter(c => c.id !== id));
      this.persistData();
    }
  }

  persistData() {
    this.securityService.saveToVault(this.userKey(), { characters: this.characters() });
  }

  // Chat Logic
  startChat(char: Character) {
    this.activeCharacter.set(char);
    this.chatHistory.set([]); // Reset for session (persisted chat not implemented in this simple demo)
    this.currentView.set('CHAT');
    
    // Add greeting if history empty
    // (Handled in template for visual, but logic-wise we wait for user input usually)
  }

  exitChat() {
    this.activeCharacter.set(null);
    this.currentView.set('MENU');
  }

  async handleChatInput(inputEl: HTMLInputElement) {
    const text = inputEl.value.trim();
    if (!text) return;
    
    inputEl.value = ''; // Clear input

    // Command Parsing
    if (text.startsWith('/')) {
      await this.executeCommand(text);
      return;
    }

    // Normal Message
    this.addMessage('user', text);
    this.processAiTurn();
  }

  addMessage(role: 'user' | 'model', text: string, image?: string) {
    this.chatHistory.update(h => [...h, { role, text, image, timestamp: Date.now() }]);
    this.scrollToBottom();
  }

  scrollToBottom() {
    setTimeout(() => {
      if (this.chatContainer) {
        this.chatContainer.nativeElement.scrollTop = this.chatContainer.nativeElement.scrollHeight;
      }
    }, 100);
  }

  async executeCommand(cmdStr: string) {
    const parts = cmdStr.split(' ');
    const cmd = parts[0].toLowerCase();
    const args = parts.slice(1).join(' ');

    this.addMessage('user', cmdStr);

    switch (cmd) {
      case '/help':
        this.showCommandHelp.set(!this.showCommandHelp());
        this.addMessage('model', '📋 COMMAND LIST:\n/help - Toggle this menu\n/image [prompt] - Generate visual\n/summarize - Force memory compression\n/quit - Exit chat\n/clear - Clear screen\n/topic [text] - Inject topic guidance');
        break;
      
      case '/image':
        if (!args) {
          this.addMessage('model', '⚠️ ERROR: Missing prompt. Usage: /image a cyberpunk city');
          return;
        }
        this.isThinking.set(true);
        const img = await this.aiService.generateImage(args);
        this.isThinking.set(false);
        if (img) {
          this.addMessage('model', `Generating visual artifact for: "${args}"...`, img);
        } else {
          this.addMessage('model', '⚠️ ERROR: Visual generation system failed.');
        }
        break;

      case '/quit':
        this.exitChat();
        break;

      case '/clear':
        this.chatHistory.set([]);
        break;

      case '/summarize':
        await this.summarizeContext();
        break;

      case '/topic':
        this.addMessage('model', `✅ TOPIC INJECTED: Focused on "${args}"`);
        // We would inject this into context in a real sophisticated app
        break;

      default:
        this.addMessage('model', `⚠️ UNKNOWN COMMAND: ${cmd}`);
    }
  }

  async summarizeContext() {
    this.isThinking.set(true);
    const historyText = this.chatHistory().map(m => `${m.role}: ${m.text}`).join('\n');
    const summary = await this.aiService.summarize(historyText);
    this.isThinking.set(false);
    
    // Update character memory
    if (this.activeCharacter()) {
      const char = this.activeCharacter()!;
      char.memory = summary;
      this.persistData(); // Update storage
      this.addMessage('model', `🧠 MEMORY COMPRESSED:\n"${summary}"`);
    }
  }

  async processAiTurn() {
    if (!this.activeCharacter()) return;
    
    this.isThinking.set(true);
    const char = this.activeCharacter()!;
    
    // Construct context with memory
    const systemPrompt = `
      You are playing the role of ${char.name}.
      ROLE: ${char.role}
      DESCRIPTION: ${char.prompt}
      
      CURRENT MEMORY: ${char.memory}
      
      INSTRUCTIONS:
      - Stay in character.
      - Use emojis occasionally if it fits the character.
      - Keep responses concise (under 200 words) for CLI readability.
    `;

    // Get last few messages for context
    const recentHistory = this.chatHistory().slice(-10).map(h => ({
      role: h.role,
      text: h.text
    }));

    // Last user message is already in history, but API needs 'prompt' separate or chat structure.
    // For this simple service wrapper, we pass the last user message as prompt and others as history.
    const lastUserMsg = recentHistory[recentHistory.length - 1]; // This is the one we just added
    const historyForAi = recentHistory.slice(0, -1);

    const response = await this.aiService.generateResponse(
      lastUserMsg.text, 
      systemPrompt, 
      historyForAi
    );

    this.isThinking.set(false);
    this.addMessage('model', response);
    
    // Auto summarize every 15 messages
    if (this.chatHistory().length % 15 === 0) {
      this.summarizeContext();
    }
  }
}
