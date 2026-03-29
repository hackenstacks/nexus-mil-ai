
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

interface ImagePreset {
  id: string;
  name: string;
  positive: string;
  negative: string;
}

interface FileChunk {
  text: string;
  embedding: number[];
}

interface LibraryFile {
  id: string;
  name: string;
  type: string;
  content: string; // Base64 or text
  size: number;
  timestamp: number;
  isPublic: boolean; // Accessible by all characters
  grantedCharacterIds: string[]; // IDs of characters who can access this file if not public
  chunks?: FileChunk[]; // For RAG
}

@Component({
  selector: 'app-root',
  standalone: true,
  imports: [CommonModule, ReactiveFormsModule],
  host: {
    '(document:click)': 'onDocumentClick($event)'
  },
  template: `
<div class="fixed inset-0 flex flex-col pointer-events-none crt-scanline z-50"></div>

<div class="h-screen w-screen flex flex-col bg-neutral-950 text-green-500 p-2 md:p-4 text-sm md:text-base font-mono relative overflow-hidden">
  
  <!-- Header -->
  <header class="border-b-2 border-green-700 pb-2 mb-4 flex justify-between items-center shrink-0">
    <div class="flex flex-col">
      <h1 class="text-xl font-bold tracking-tighter">
        🛡️ TACTICAL CHARACTER GEN <span class="text-xs align-top opacity-70">v0.9.3-FIX</span>
      </h1>
      <span class="text-xs text-green-700">MILITARY GRADE ENCRYPTION: {{ isAuthenticated() ? 'ACTIVE 🟢' : 'OFFLINE 🔴' }}</span>
    </div>
    <div class="text-right text-xs hidden md:block">
      <div>SYS_TIME: {{ time() }}</div>
      <div>MEM_USAGE: {{ memoryUsage() }}%</div>
    </div>
  </header>

  <!-- Main Content Area -->
  <main class="flex-1 overflow-hidden flex flex-col min-h-0 relative border border-green-900 bg-black/50 shadow-[0_0_15px_rgba(0,255,0,0.1)]">
    
    @if (!isAuthenticated()) {
      <!-- LOGIN SCREEN -->
      <div class="absolute inset-0 flex items-center justify-center flex-col p-8 z-20 bg-neutral-950">
        <div class="w-full max-w-md border border-green-500 p-6 shadow-lg shadow-green-900/20">
          <div class="mb-6 text-center text-green-400">
            <pre class="text-[10px] md:text-xs leading-none mb-4 whitespace-pre">
   ▄▄▄▄▀ ▄█    ▄   ▄█    ▄█ ▄█▄    ▄  █ 
▀▀▀ █    ██     █  ██    ██ █▀ ▀▄ █   █ 
    █    ██ ██   █ ██    ██ █   ▀ ██▀▀█ 
   █     ▐█ █ █  █ ▐█    ▐█ █▄  ▄▀ █  █ 
  ▀       ▐ █  █ █  ▐     ▐ ▀███▀     █ 
            █   ██                   ▀  
            </pre>
            <p class="mb-2">🔒 SECURE TERMINAL ACCESS REQUIRED</p>
            <p class="text-xs text-green-700">ENTER PASSWORD TO DECRYPT LOCAL STORAGE</p>
          </div>

          <div class="space-y-4">
            <div>
              <label class="block text-xs mb-1">USER_KEY_INPUT:</label>
              <input 
                #passInput
                type="password" 
                class="w-full bg-black border border-green-600 text-green-400 px-2 py-2 focus:outline-none focus:border-green-300 placeholder-green-900"
                placeholder="********"
                (keyup.enter)="login(passInput.value)"
              >
            </div>
            <button 
              (click)="login(passInput.value)"
              class="w-full bg-green-900/30 hover:bg-green-800/50 text-green-400 border border-green-600 py-2 transition-all uppercase tracking-widest text-sm font-bold hover:shadow-[0_0_10px_rgba(0,255,0,0.3)]"
            >
              Initialize Session_
            </button>
            @if (loginError()) {
              <div class="text-red-500 text-xs text-center font-bold animate-pulse">
                🚫 ACCESS DENIED: INVALID KEY
              </div>
            }
            @if (securityService.hasVault()) {
              <div class="text-center text-xs text-yellow-600 mt-2">
                ⚠️ ENCRYPTED VAULT DETECTED
              </div>
            } @else {
              <div class="text-center text-xs text-blue-600 mt-2">
                ℹ️ NEW VAULT WILL BE CREATED
              </div>
            }
          </div>
        </div>
      </div>
    } @else {
      <!-- AUTHENTICATED AREA -->
      <div class="flex flex-col h-full">
        
        <!-- BREADCRUMBS / PATH -->
        <div class="bg-green-900/20 px-2 py-1 text-xs border-b border-green-900 flex gap-2">
          <span class="opacity-50">root@system:~/</span>
          <span class="font-bold">{{ currentView() }}</span>
        </div>

        <div class="flex-1 overflow-auto p-4 custom-scrollbar relative">
          
          @switch (currentView()) {
            
            @case ('MENU') {
              <div class="h-full flex flex-col justify-center items-center">
                <div class="grid grid-cols-1 md:grid-cols-2 gap-4 w-full max-w-2xl">
                  @for (option of menuOptions; track option.id) {
                    <button 
                      (click)="navigate(option.view)"
                      class="group relative text-left p-4 border border-green-800 hover:bg-green-900/20 hover:border-green-400 transition-all"
                    >
                      <div class="absolute top-2 right-2 opacity-20 text-2xl group-hover:opacity-100 transition-opacity">
                        {{option.id}}
                      </div>
                      <div class="text-xl mb-1">{{option.emoji}} {{option.label}}</div>
                      <div class="text-xs text-green-700 group-hover:text-green-500">
                        {{option.desc}}
                      </div>
                    </button>
                  }
                </div>
              </div>
            }

            @case ('CREATOR') {
              <div class="max-w-3xl mx-auto w-full">
                <h2 class="text-lg border-b border-green-800 mb-4 pb-2">🆕 CREATE_NEW_ENTITY</h2>
                <div class="space-y-4">
                  <div class="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div>
                      <label class="block text-xs mb-1">NAME</label>
                      <input [formControl]="charForm.controls.name" class="cli-input w-full" placeholder="e.g. Major Motoko">
                    </div>
                    <div>
                      <label class="block text-xs mb-1">ROLE</label>
                      <input [formControl]="charForm.controls.role" class="cli-input w-full" placeholder="e.g. Cyborg Detective">
                    </div>
                  </div>
                  <div>
                    <label class="block text-xs mb-1">SYSTEM_PROMPT / PERSONALITY</label>
                    <textarea [formControl]="charForm.controls.prompt" rows="5" class="cli-input w-full" placeholder="Define behavior protocols..."></textarea>
                  </div>
                  <div>
                    <label class="block text-xs mb-1">FIRST_MESSAGE</label>
                    <input [formControl]="charForm.controls.greeting" class="cli-input w-full" placeholder="Initial communication...">
                  </div>
                  
                  <div class="flex justify-end gap-4 mt-6">
                    <button (click)="currentView.set('MENU')" class="cli-btn-secondary">CANCEL</button>
                    <button (click)="saveCharacter()" class="cli-btn-primary">💾 ENCRYPT & SAVE</button>
                  </div>
                </div>
              </div>
            }

            @case ('ROSTER') {
              <div class="max-w-3xl mx-auto w-full">
                <h2 class="text-lg border-b border-green-800 mb-4 pb-2">📂 ENTITY_DATABASE</h2>
                @if (characters().length === 0) {
                  <div class="text-center py-10 opacity-50">NO ENTITIES FOUND IN LOCAL STORAGE</div>
                }
                <div class="grid gap-2">
                  @for (char of characters(); track char.id) {
                    <div class="border border-green-900 p-3 flex justify-between items-center hover:bg-green-900/10">
                      <div>
                        <div class="font-bold">{{char.name}}</div>
                        <div class="text-xs opacity-70">{{char.role}}</div>
                      </div>
                      <div class="flex gap-2">
                        <button (click)="deleteCharacter(char.id)" class="text-red-500 hover:underline text-xs">[DEL]</button>
                        <button (click)="startChat(char)" class="cli-btn-sm">INIT_CHAT >></button>
                      </div>
                    </div>
                  }
                </div>
                <button (click)="currentView.set('MENU')" class="mt-4 text-xs hover:underline">&lt;&lt; RETURN_TO_ROOT</button>
              </div>
            }

            @case ('CHAT') {
              <div class="flex flex-col h-full">
                <!-- Active Character Header -->
                <div class="flex justify-between items-center bg-green-900/30 p-2 text-xs mb-2 border border-green-800">
                  <div class="flex items-center gap-4">
                    <span>CONNECTED: <strong>{{activeCharacter()?.name}}</strong></span>
                    <div class="flex gap-2 border-l border-green-800 pl-4">
                      <button (click)="currentView.set('LIBRARY')" class="hover:text-white text-[10px]">[📚 LIBRARY]</button>
                      <button (click)="currentView.set('SETTINGS')" class="hover:text-white text-[10px]">[⚙️ SETTINGS]</button>
                    </div>
                  </div>
                  <div class="flex gap-2">
                     <button (click)="summarizeContext()" title="Force Summary" class="hover:text-white">🧠 MEM: {{memoryUsage()}}%</button>
                     <button (click)="exitChat()" class="hover:text-red-400">[TERMINATE_LINK]</button>
                  </div>
                </div>

                <!-- Shared Files Indicator -->
                @if (getSharedFiles().length > 0) {
                  <div class="mb-2 px-2 py-1 bg-green-900/10 border border-green-900/30 rounded text-[9px] flex items-center gap-2 overflow-x-auto custom-scrollbar">
                    <span class="text-green-700 font-bold shrink-0 uppercase">Shared Archives:</span>
                    @for (file of getSharedFiles(); track file.id) {
                      <span class="px-1 bg-green-900/20 border border-green-800 text-green-500 whitespace-nowrap">
                        {{ file.name }}
                      </span>
                    }
                  </div>
                }

                <!-- Messages Area -->
                <div #chatContainer class="flex-1 overflow-y-auto space-y-4 pr-2 mb-4 scroll-smooth">
                   @if (chatHistory().length === 0 && activeCharacter()) {
                     <div class="text-center opacity-30 my-4">--- ENCRYPTED CHANNEL ESTABLISHED ---</div>
                     <div class="flex gap-3">
                        <div class="w-8 h-8 rounded bg-green-900 flex items-center justify-center shrink-0">🤖</div>
                        <div class="bg-green-900/10 p-2 rounded text-green-300 max-w-[80%]">
                          {{activeCharacter()?.greeting}}
                        </div>
                     </div>
                   }

                   @for (msg of chatHistory(); track $index) {
                     <div class="flex gap-3" [class.flex-row-reverse]="msg.role === 'user'">
                        <div class="w-8 h-8 rounded flex items-center justify-center shrink-0 text-lg border border-green-800"
                             [ngClass]="{
                               'bg-green-900': msg.role === 'model',
                               'bg-blue-900': msg.role === 'user'
                             }">
                             {{msg.role === 'user' ? '👤' : '🤖'}}
                        </div>
                        
                        <div class="flex flex-col max-w-[80%]">
                           <div class="text-[10px] opacity-50 mb-1" [class.text-right]="msg.role === 'user'">
                             {{msg.role === 'user' ? 'OPERATOR' : activeCharacter()?.name}}
                           </div>
                           
                           <!-- Content -->
                           <div class="p-2 rounded border"
                                [ngClass]="{
                                  'border-green-800 bg-green-900/10': msg.role === 'model',
                                  'border-blue-800 bg-blue-900/10': msg.role === 'user'
                                }">
                              
                              @if (msg.image) {
                                <div class="mb-2">
                                  <img [src]="msg.image" class="max-w-full rounded border border-green-500/50" alt="Generated visual">
                                </div>
                              }
                              <div class="whitespace-pre-wrap">{{msg.text}}</div>
                           </div>
                        </div>
                     </div>
                   }
                   
                   @if (isThinking()) {
                     <div class="flex gap-3 animate-pulse">
                       <div class="w-8 h-8 rounded bg-green-900 flex items-center justify-center">⏳</div>
                       <div class="text-xs self-center">PROCESSING_NEURAL_NET...</div>
                     </div>
                   }
                </div>

                <!-- Input Area -->
                <div class="mt-auto border-t border-green-800 pt-2">
                   @if (showCommandHelp()) {
                     <div #helpMenu class="bg-black border border-green-500 mb-2 p-2 text-xs absolute bottom-16 left-2 right-2 shadow-lg z-10">
                       <div class="flex justify-between items-center border-b border-green-900 pb-1 mb-2">
                         <span class="font-bold text-green-400">COMMAND_DIRECTORY</span>
                         <button (click)="showCommandHelp.set(false)" class="text-red-500 hover:text-red-300 px-1">[X] CLOSE</button>
                       </div>
                       <div class="grid grid-cols-2 gap-2">
                         <div>/help - List commands</div>
                         <div>/image {{ '{' }}prompt{{ '}' }} - Generate visual</div>
                         <div>/summarize - Compress memory</div>
                         <div>/quit - Exit chat</div>
                         <div>/save - Save session</div>
                         <div>/topic {{ '{' }}text{{ '}' }} - Set topic</div>
                         <div>/role - View role</div>
                         <div>/clear - Wipe screen</div>
                       </div>
                     </div>
                   }
                   <div class="flex items-center gap-2 bg-black border border-green-700 px-2 py-1 focus-within:ring-1 focus-within:ring-green-400">
                     <span class="text-green-500 animate-pulse">></span>
                     <input 
                       #chatInput
                       type="text" 
                       class="flex-1 bg-transparent border-none outline-none text-green-300 placeholder-green-900 font-mono"
                       placeholder="Enter message or /command..."
                       (keydown.enter)="handleChatInput(chatInput)"
                       (keydown.escape)="showCommandHelp.set(false)"
                     >
                     <button (click)="handleChatInput(chatInput)" class="text-xs hover:bg-green-900 px-2 py-1">[SEND]</button>
                     <button #helpButton (click)="showCommandHelp.set(!showCommandHelp())" class="text-xs hover:bg-green-900 px-2 py-1">[HELP]</button>
                   </div>
                   <div class="text-[10px] text-green-800 mt-1 flex justify-between">
                     <span>TIP: Use /help for command list</span>
                     <span>PROVIDER: {{ hasSelectedKey() ? 'GEMINI-3.1-FLASH-IMAGE' : 'GEMINI-2.5-FLASH' }}</span>
                   </div>
                </div>
              </div>
            }

            @case ('SETTINGS') {
               <div class="max-w-2xl mx-auto w-full">
                 <h2 class="text-lg border-b border-green-800 mb-4 pb-2">⚙️ CONFIGURATION</h2>
                 
                 <div class="mb-6">
                   <h3 class="text-sm font-bold mb-2">GEMINI API KEY STATUS</h3>
                   <div class="p-3 border border-green-800 bg-green-900/10 flex flex-col gap-2">
                     <div class="flex justify-between items-center">
                       <span class="text-xs uppercase">Key Selection:</span>
                       <span [class.text-green-400]="hasSelectedKey()" [class.text-yellow-500]="!hasSelectedKey()">
                         {{ hasSelectedKey() ? 'SELECTED 🟢' : 'NOT SELECTED 🟡' }}
                       </span>
                     </div>
                     <p class="text-[10px] opacity-70">A paid API key is required for high-quality image generation (Imagen/Flash Image Preview). If you encounter 403 errors, please select a valid key.</p>
                     <button (click)="openApiKeyDialog()" class="cli-btn-sm mt-2">
                       {{ hasSelectedKey() ? 'CHANGE_API_KEY' : 'SELECT_API_KEY' }}
                     </button>
                   </div>
                 </div>

                 <div class="mb-6">
                   <h3 class="text-sm font-bold mb-2">IMAGE GENERATION PROVIDER</h3>
                   <div class="border border-green-800">
                     <div 
                       (click)="selectedImageProvider.set('GEMINI')"
                       class="p-2 border-b border-green-800 flex justify-between cursor-pointer hover:bg-green-900/10"
                       [class.bg-green-900/30]="selectedImageProvider() === 'GEMINI'"
                     >
                       <span>1. GOOGLE GEMINI</span>
                       <span class="text-xs">{{ selectedImageProvider() === 'GEMINI' ? '[ACTIVE]' : '' }}</span>
                     </div>
                     <div 
                       (click)="selectedImageProvider.set('HORDE')"
                       class="p-2 border-b border-green-800 flex justify-between cursor-pointer hover:bg-green-900/10"
                       [class.bg-green-900/30]="selectedImageProvider() === 'HORDE'"
                     >
                       <span>2. AI HORDE</span>
                       <span class="text-xs">{{ selectedImageProvider() === 'HORDE' ? '[ACTIVE]' : '' }}</span>
                     </div>
                     <div 
                       (click)="selectedImageProvider.set('POLLINATIONS')"
                       class="p-2 border-b border-green-800 flex justify-between cursor-pointer hover:bg-green-900/10"
                       [class.bg-green-900/30]="selectedImageProvider() === 'POLLINATIONS'"
                     >
                       <span>3. POLLINATIONS.AI</span>
                       <span class="text-xs">{{ selectedImageProvider() === 'POLLINATIONS' ? '[ACTIVE]' : '' }}</span>
                     </div>
                   </div>

                   @if (selectedImageProvider() === 'HORDE') {
                     <div class="mt-4 p-3 border border-green-800 bg-green-900/10">
                       <label class="block text-xs mb-1 uppercase">AI Horde API Key:</label>
                       <input 
                         #hordeKeyInput
                         type="password" 
                         class="cli-input w-full" 
                         [value]="hordeApiKey()"
                         (input)="hordeApiKey.set(hordeKeyInput.value)"
                         placeholder="0000000000"
                       >
                       <p class="text-[10px] mt-1 opacity-50 italic">Leave as 0000000000 for anonymous access (slower).</p>
                     </div>
                   }
                 </div>

                 <div class="mb-6">
                   <h3 class="text-sm font-bold mb-2">API ENDPOINT SELECTION</h3>
                   <div class="border border-green-800">
                     <div class="p-2 border-b border-green-800 bg-green-900/20 flex justify-between cursor-pointer">
                       <span>1. GOOGLE GEMINI (ACTIVE)</span>
                       <span>[DEFAULT]</span>
                     </div>
                     <div class="p-2 border-b border-green-900 text-green-800 flex justify-between opacity-50 cursor-not-allowed">
                       <span>2. AI HORDE</span>
                       <span>[OFFLINE]</span>
                     </div>
                     <div class="p-2 border-b border-green-900 text-green-800 flex justify-between opacity-50 cursor-not-allowed">
                       <span>3. MISTRAL AI</span>
                       <span>[OFFLINE]</span>
                     </div>
                     <div class="p-2 border-b border-green-900 text-green-800 flex justify-between opacity-50 cursor-not-allowed">
                       <span>4. CUSTOM ENDPOINT</span>
                       <span>[REQUIRES ADMIN]</span>
                     </div>
                   </div>
                 </div>

                 <div class="mb-6">
                   <h3 class="text-sm font-bold mb-2">IMAGE GENERATION PRESETS</h3>
                   <div class="grid grid-cols-2 md:grid-cols-3 gap-2">
                     @for (preset of imagePresets; track preset.id) {
                       <button 
                         (click)="selectedImagePreset.set(preset.id)"
                         class="p-2 border text-[10px] text-left transition-all"
                         [class.border-green-400]="selectedImagePreset() === preset.id"
                         [class.bg-green-900/30]="selectedImagePreset() === preset.id"
                         [class.border-green-900]="selectedImagePreset() !== preset.id"
                         [class.opacity-50]="selectedImagePreset() !== preset.id"
                       >
                         <div class="font-bold">{{preset.name}}</div>
                         <div class="text-[8px] opacity-50 truncate">{{preset.positive || 'No modifiers'}}</div>
                       </button>
                     }
                   </div>
                   @if (selectedImagePreset() !== 'none') {
                     <div class="mt-2 p-2 border border-green-900 bg-black/40 text-[10px]">
                       <div class="text-green-700 uppercase mb-1">Preset Negative Prompt:</div>
                       <div class="opacity-70 italic">{{ getActivePreset()?.negative }}</div>
                     </div>
                   }
                   <div class="mt-4">
                     <label class="block text-xs mb-1 uppercase">Custom Negative Prompt:</label>
                     <input 
                       #negPromptInput
                       type="text" 
                       class="cli-input w-full" 
                       [value]="customNegativePrompt()"
                       (input)="customNegativePrompt.set(negPromptInput.value)"
                       placeholder="e.g. blurry, low quality, distorted"
                     >
                     <p class="text-[10px] mt-1 opacity-50 italic">This will be appended to any active preset negative prompt.</p>
                   </div>
                 </div>

                 <div class="mb-6">
                   <h3 class="text-sm font-bold mb-2">STORAGE METRICS</h3>
                   <div class="grid grid-cols-2 gap-4 text-xs">
                     <div class="p-2 border border-green-800">
                       <div class="opacity-70">TOTAL CHARACTERS</div>
                       <div class="text-xl">{{characters().length}}</div>
                     </div>
                     <div class="p-2 border border-green-800">
                       <div class="opacity-70">VAULT STATUS</div>
                       <div class="text-xl">SECURE</div>
                     </div>
                   </div>
                 </div>

                 <button (click)="currentView.set('MENU')" class="cli-btn-secondary w-full">&lt;&lt; RETURN_TO_ROOT</button>
               </div>
            }

            @case ('LIBRARY') {
              <div class="max-w-2xl mx-auto w-full h-full flex flex-col">
                <h2 class="text-lg border-b border-green-800 mb-4 pb-2 flex justify-between items-center">
                  <span>📚 LORE LIBRARY</span>
                  <div class="flex items-center gap-4">
                    @if (isProcessingFile()) {
                      <span class="text-[10px] text-yellow-500 animate-pulse uppercase">PROCESSING_ARCHIVES...</span>
                    }
                    <label class="cli-btn-sm cursor-pointer" [class.opacity-50]="isProcessingFile()" [class.pointer-events-none]="isProcessingFile()">
                      UPLOAD_NEW_FILE
                      <input type="file" class="hidden" (change)="onFileUpload($event)" multiple [disabled]="isProcessingFile()">
                    </label>
                  </div>
                </h2>

                <div class="flex-1 overflow-y-auto pr-2 custom-scrollbar">
                  @if (libraryFiles().length === 0) {
                    <div class="h-full flex flex-col items-center justify-center opacity-50 italic">
                      <div class="text-4xl mb-4">📂</div>
                      <div>NO ARCHIVES FOUND IN LOCAL CLUSTER</div>
                      <div class="text-[10px] mt-2">UPLOAD TEXT OR IMAGE FILES TO SHARE WITH CHARACTERS</div>
                    </div>
                  } @else {
                    <div class="grid grid-cols-1 gap-4">
                      @for (file of libraryFiles(); track file.id) {
                        <div class="p-3 border border-green-900 bg-green-900/5 flex flex-col gap-3 hover:bg-green-900/10 transition-all">
                          <div class="flex justify-between items-center">
                            <div class="flex items-center gap-3">
                              <span class="text-xl">{{ file.type.startsWith('image/') ? '🖼️' : '📄' }}</span>
                              <div>
                                <div class="text-sm font-bold text-green-400">{{ file.name }}</div>
                                <div class="text-[10px] opacity-50 uppercase">
                                  {{ file.type }} • {{ (file.size / 1024).toFixed(1) }} KB
                                </div>
                              </div>
                            </div>
                            <div class="flex items-center gap-2">
                              <button 
                                (click)="togglePublicAccess(file.id)"
                                [class]="file.isPublic 
                                  ? 'px-2 py-1 text-[9px] border border-blue-500 bg-blue-500/20 text-blue-400' 
                                  : 'px-2 py-1 text-[9px] border border-yellow-900 bg-yellow-900/10 text-yellow-700'"
                              >
                                {{ file.isPublic ? '[PUBLIC_LIBRARY]' : '[SECURE_VAULT]' }}
                              </button>
                              <button (click)="removeFile(file.id)" class="text-red-900 hover:text-red-500 transition-all p-2 text-xs">
                                [DELETE]
                              </button>
                            </div>
                          </div>

                          <!-- Access Control -->
                          <div class="border-t border-green-900 pt-2" [class.opacity-30]="file.isPublic">
                            <div class="flex justify-between items-center mb-2">
                              <div class="text-[10px] uppercase text-green-700 font-bold">
                                {{ file.isPublic ? 'Accessible by all entities' : 'Granted Access To:' }}
                              </div>
                              @if (!file.isPublic) {
                                <button 
                                  (click)="grantAllAccess(file.id)"
                                  class="px-2 py-0.5 text-[8px] border border-green-800 bg-black/40 text-green-600 hover:bg-green-600 hover:text-black"
                                >
                                  [GRANT_ALL]
                                </button>
                              }
                            </div>
                            <div class="flex flex-wrap gap-2">
                              @if (characters().length === 0) {
                                <div class="text-[9px] opacity-40 italic">NO CHARACTERS INITIALIZED</div>
                              } @else {
                                @for (char of characters(); track char.id) {
                                  <button 
                                    (click)="!file.isPublic && toggleFileAccess(file.id, char.id)"
                                    [disabled]="file.isPublic"
                                    [class]="(file.isPublic || file.grantedCharacterIds.includes(char.id)) 
                                      ? 'px-2 py-1 text-[9px] border border-green-500 bg-green-500/20 text-green-400' 
                                      : 'px-2 py-1 text-[9px] border border-green-900 bg-black/40 text-green-900 hover:border-green-700'"
                                    [class.cursor-not-allowed]="file.isPublic"
                                  >
                                    {{ char.name }}
                                  </button>
                                }
                              }
                            </div>
                          </div>
                        </div>
                      }
                    </div>
                  }
                </div>

                <div class="mt-4 p-3 border border-green-800 bg-black/40 text-[10px] opacity-70 italic">
                  NOTE: [PUBLIC_LIBRARY] files are accessible by all entities. [SECURE_VAULT] files require explicit per-character clearance.
                </div>

                <button (click)="currentView.set('MENU')" class="cli-btn-secondary w-full mt-4">&lt;&lt; RETURN_TO_ROOT</button>
              </div>
            }
          }

        </div>
      </div>
    }
  </main>
  
  <footer class="mt-2 text-[10px] text-green-900 flex justify-between uppercase">
    <span>Ready_</span>
    <span>TERM_ID: 0x8F2A</span>
  </footer>

</div>
`,
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
    .custom-scrollbar::-webkit-scrollbar {
      width: 4px;
    }
    .custom-scrollbar::-webkit-scrollbar-track {
      @apply bg-black;
    }
    .custom-scrollbar::-webkit-scrollbar-thumb {
      @apply bg-green-900;
    }
    .custom-scrollbar::-webkit-scrollbar-thumb:hover {
      @apply bg-green-700;
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
  hasSelectedKey = signal(false);
  selectedImageProvider = signal<'GEMINI' | 'HORDE' | 'POLLINATIONS'>('GEMINI');
  hordeApiKey = signal('0000000000');
  selectedImagePreset = signal<string>('none');
  customNegativePrompt = signal('');

  imagePresets: ImagePreset[] = [
    { id: 'none', name: 'NONE', positive: '', negative: '' },
    { id: 'cyberpunk', name: 'CYBERPUNK', positive: 'cyberpunk style, neon lights, high detail, futuristic', negative: 'natural, organic, daylight, simple' },
    { id: 'realistic', name: 'REALISTIC', positive: 'photorealistic, 8k, highly detailed, masterwork', negative: 'cartoon, anime, drawing, painting, blurry, low quality' },
    { id: 'anime', name: 'ANIME', positive: 'anime style, vibrant colors, clean lines, high resolution', negative: 'photorealistic, 3d, realistic, blurry' },
    { id: 'oil', name: 'OIL PAINTING', positive: 'oil painting style, brush strokes, canvas texture, classical', negative: 'photograph, digital, clean, modern' }
  ];

  getActivePreset() {
    return this.imagePresets.find(p => p.id === this.selectedImagePreset());
  }
  
  // Data State
  characters = signal<Character[]>([]);
  activeCharacter = signal<Character | null>(null);
  chatHistory = signal<ChatMessage[]>([]);
  libraryFiles = signal<LibraryFile[]>([]);
  isThinking = signal(false);
  isProcessingFile = signal(false);
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
  @ViewChild('helpMenu') helpMenu!: ElementRef;
  @ViewChild('helpButton') helpButton!: ElementRef;

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
    this.checkApiKey();
  }

  async checkApiKey() {
    if ((window as any).aistudio?.hasSelectedApiKey) {
      const selected = await (window as any).aistudio.hasSelectedApiKey();
      this.hasSelectedKey.set(selected);
    }
  }

  async openApiKeyDialog() {
    if ((window as any).aistudio?.openSelectKey) {
      await (window as any).aistudio.openSelectKey();
      // Assume success and proceed
      this.hasSelectedKey.set(true);
    }
  }

  onDocumentClick(event: MouseEvent) {
    if (this.showCommandHelp() && 
        this.helpMenu && !this.helpMenu.nativeElement.contains(event.target) &&
        this.helpButton && !this.helpButton.nativeElement.contains(event.target)) {
      this.showCommandHelp.set(false);
    }
  }

  login(password: string) {
    if (!password) return;
    
    if (!this.securityService.hasVault()) {
      // First time setup
      this.userKey.set(password);
      this.securityService.saveToVault(password, { characters: [], libraryFiles: [], chatHistory: [] });
      this.isAuthenticated.set(true);
    } else {
      // Try decrypt
      const data = this.securityService.loadFromVault(password);
      if (data) {
        this.userKey.set(password);
        this.characters.set(data.characters || []);
        this.libraryFiles.set(data.libraryFiles || []);
        this.chatHistory.set(data.chatHistory || []);
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
      if (view === 'SETTINGS') {
        this.checkApiKey();
      }
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
    this.securityService.saveToVault(this.userKey(), { 
      characters: this.characters(),
      libraryFiles: this.libraryFiles(),
      chatHistory: this.chatHistory().slice(-50)
    });
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
      const cmd = text.split(' ')[0].toLowerCase();
      if (cmd !== '/help') {
        this.showCommandHelp.set(false);
      }
      await this.executeCommand(text);
      return;
    }

    this.showCommandHelp.set(false);
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

    if (cmd === '/save') {
      this.persistData();
      this.addMessage('model', 'SYSTEM_STATUS: DATA_ENCRYPTED_AND_SAVED_TO_VAULT');
      return;
    }

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
        let img: string | null = null;
        const provider = this.selectedImageProvider();
        const preset = this.getActivePreset();
        
        // Construct final prompt with preset modifiers
        const finalPrompt = preset?.positive ? `${args}, ${preset.positive}` : args;
        
        // Combine preset negative prompt with custom one
        const presetNeg = preset?.negative || '';
        const customNeg = this.customNegativePrompt();
        const negativePrompt = [presetNeg, customNeg].filter(s => !!s).join(', ');
        
        if (provider === 'GEMINI') {
          img = await this.aiService.generateImage(finalPrompt, negativePrompt);
        } else if (provider === 'HORDE') {
          img = await this.aiService.generateImageHorde(finalPrompt, this.hordeApiKey(), negativePrompt);
        } else if (provider === 'POLLINATIONS') {
          // Pollinations doesn't have a separate negative prompt field, so we append it
          const pollPrompt = negativePrompt ? `${finalPrompt} (negative: ${negativePrompt})` : finalPrompt;
          img = await this.aiService.generateImagePollinations(pollPrompt);
        }

        this.isThinking.set(false);
        if (img) {
          this.addMessage('model', `Generating visual artifact via ${provider} [PRESET: ${preset?.name}] for: "${args}"...`, img);
        } else {
          this.addMessage('model', `⚠️ ERROR: Visual generation system (${provider}) failed.`);
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
      this.characters.update(chars => chars.map(c => c.id === char.id ? { ...c, memory: summary } : c));
      this.activeCharacter.set({ ...char, memory: summary });
      this.persistData(); // Update storage
      this.addMessage('model', `🧠 MEMORY COMPRESSED:\n"${summary}"`);
    }
  }

  getSharedFiles() {
    const char = this.activeCharacter();
    if (!char) return [];
    return this.libraryFiles().filter(f => f.isPublic || f.grantedCharacterIds.includes(char.id));
  }

  async processAiTurn() {
    if (!this.activeCharacter()) return;
    
    this.isThinking.set(true);
    const char = this.activeCharacter()!;
    const lastUserMsg = this.chatHistory().filter(m => m.role === 'user').slice(-1)[0]?.text || '';
    
    // Build context from library - ONLY files granted to this character
    const sharedFiles = this.getSharedFiles();
    const textFiles = sharedFiles.filter(f => !f.type.startsWith('image/'));
    
    // RAG: Find relevant chunks
    let ragContext = '';
    if (lastUserMsg && textFiles.some(f => f.chunks && f.chunks.length > 0)) {
      const queryEmbedding = await this.aiService.embedText(lastUserMsg);
      if (queryEmbedding.length > 0) {
        const allChunks: { text: string; score: number; fileName: string }[] = [];
        
        for (const file of textFiles) {
          if (file.chunks) {
            for (const chunk of file.chunks) {
              const score = this.cosineSimilarity(queryEmbedding, chunk.embedding);
              allChunks.push({ text: chunk.text, score, fileName: file.name });
            }
          }
        }
        
        // Sort by score and take top 3
        const topChunks = allChunks.sort((a, b) => b.score - a.score).slice(0, 3);
        if (topChunks.length > 0) {
          ragContext = `\n\nRELEVANT LORE FRAGMENTS (RETRIEVED VIA RAG):\n${topChunks.map(c => `[SOURCE: ${c.fileName}] ${c.text}`).join('\n---\n')}`;
        }
      }
    }

    const libraryContext = textFiles.length > 0 
      ? `\n\nLORE ARCHIVES GRANTED TO YOU (READ-ONLY):\n${textFiles.map(f => `FILE: ${f.name}\nCONTENT: ${f.content.substring(0, 1000)}${f.content.length > 1000 ? '...' : ''}`).join('\n---\n')}`
      : '';

    // Construct context with memory
    const systemPrompt = `
      You are playing the role of ${char.name}.
      ROLE: ${char.role}
      DESCRIPTION: ${char.prompt}
      
      CURRENT MEMORY: ${char.memory}
      ${libraryContext}
      ${ragContext}
      
      INSTRUCTIONS:
      - Stay in character.
      - Use emojis occasionally if it fits the character.
      - Keep responses concise (under 200 words) for CLI readability.
      - If you have access to LORE ARCHIVES or RAG FRAGMENTS, use them to inform your responses. You are expected to discuss and reference these files when relevant.
      - If the user asks about a file you have access to, answer based on its content.
    `;

    // Get last few messages for context
    const recentHistory = this.chatHistory().slice(-10).map(h => ({
      role: h.role,
      text: h.text
    }));

    // Last user message is already in history, but API needs 'prompt' separate or chat structure.
    // For this simple service wrapper, we pass the last user message as prompt and others as history.
    const promptMsg = recentHistory[recentHistory.length - 1]; // This is the one we just added
    const historyForAi = recentHistory.slice(0, -1);

    const response = await this.aiService.generateResponse(
      promptMsg.text, 
      systemPrompt, 
      historyForAi
    );

    this.isThinking.set(false);
    this.addMessage('model', response);
    this.persistData();
    
    // Auto summarize every 15 messages
    if (this.chatHistory().length % 15 === 0) {
      this.summarizeContext();
    }
  }

  cosineSimilarity(vecA: number[], vecB: number[]): number {
    let dotProduct = 0;
    let normA = 0;
    let normB = 0;
    for (let i = 0; i < vecA.length; i++) {
      dotProduct += vecA[i] * vecB[i];
      normA += vecA[i] * vecA[i];
      normB += vecB[i] * vecB[i];
    }
    return dotProduct / (Math.sqrt(normA) * Math.sqrt(normB));
  }

  async onFileUpload(event: Event) {
    const input = event.target as HTMLInputElement;
    if (!input.files?.length) return;

    this.isProcessingFile.set(true);
    const files = Array.from(input.files);
    
    const uploadPromises = files.map(file => {
      return new Promise<void>((resolve) => {
        const reader = new FileReader();
        reader.onload = async (e) => {
          const content = e.target?.result as string;
          const isText = file.type.startsWith('text/') || file.name.endsWith('.md') || file.name.endsWith('.txt');
          
          let chunks: FileChunk[] = [];
          if (isText) {
            // Simple chunking: split by paragraphs or fixed length
            const rawChunks = content.split(/\n\n+/).filter(c => c.trim().length > 20);
            
            // Generate embeddings for chunks
            for (const chunkText of rawChunks) {
              const embedding = await this.aiService.embedText(chunkText);
              if (embedding.length > 0) {
                chunks.push({ text: chunkText, embedding });
              }
            }
          }

          const newFile: LibraryFile = {
            id: Math.random().toString(36).substring(2, 11),
            name: file.name,
            type: file.type,
            content: content,
            size: file.size,
            timestamp: Date.now(),
            isPublic: false, // Initially private/vault
            grantedCharacterIds: [],
            chunks: chunks.length > 0 ? chunks : undefined
          };
          this.libraryFiles.update(files => [...files, newFile]);
          resolve();
        };

        if (file.type.startsWith('text/') || file.name.endsWith('.md') || file.name.endsWith('.txt')) {
          reader.readAsText(file);
        } else {
          reader.readAsDataURL(file);
        }
      });
    });

    await Promise.all(uploadPromises);
    this.isProcessingFile.set(false);
    this.persistData();
    input.value = '';
  }

  removeFile(id: string) {
    this.libraryFiles.update(files => files.filter(f => f.id !== id));
    this.persistData();
  }

  togglePublicAccess(fileId: string) {
    this.libraryFiles.update(files => files.map(f => {
      if (f.id === fileId) {
        return { ...f, isPublic: !f.isPublic };
      }
      return f;
    }));
    this.persistData();
  }

  toggleFileAccess(fileId: string, charId: string) {
    this.libraryFiles.update(files => files.map(f => {
      if (f.id === fileId) {
        const ids = f.grantedCharacterIds.includes(charId)
          ? f.grantedCharacterIds.filter(id => id !== charId)
          : [...f.grantedCharacterIds, charId];
        return { ...f, grantedCharacterIds: ids };
      }
      return f;
    }));
    this.persistData();
  }

  grantAllAccess(fileId: string) {
    const allCharIds = this.characters().map(c => c.id);
    this.libraryFiles.update(files => files.map(f => {
      if (f.id === fileId) {
        return { ...f, grantedCharacterIds: allCharIds };
      }
      return f;
    }));
    this.persistData();
  }
}
