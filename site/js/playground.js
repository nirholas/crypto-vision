// Playground page JavaScript

document.addEventListener('DOMContentLoaded', () => {
    initEditor();
    initLineNumbers();
    initTools();
    initTabs();
    initToolbarActions();
    initConfig();
    initKeyboardShortcuts();
});

// Editor state
let currentFile = 'main.py';
const files = {
    'main.py': document.getElementById('codeEditor').value,
    'config.json': `{
    "keywords": ["Python programming"],
    "limits": {
        "likes_per_hour": 25,
        "comments_per_hour": 5,
        "follows_per_hour": 15
    },
    "delays": {
        "min": 30,
        "max": 90
    },
    "filters": {
        "min_likes": 10,
        "min_followers": 500,
        "skip_retweets": true
    },
    "ai": {
        "provider": "openai",
        "model": "gpt-4"
    }
}`
};

// Initialize editor
function initEditor() {
    const editor = document.getElementById('codeEditor');
    
    // Tab handling
    editor.addEventListener('keydown', (e) => {
        if (e.key === 'Tab') {
            e.preventDefault();
            
            const start = editor.selectionStart;
            const end = editor.selectionEnd;
            
            if (e.shiftKey) {
                // Outdent
                const lineStart = editor.value.lastIndexOf('\n', start - 1) + 1;
                const lineText = editor.value.substring(lineStart, start);
                
                if (lineText.startsWith('    ')) {
                    editor.value = editor.value.substring(0, lineStart) + 
                                   editor.value.substring(lineStart + 4);
                    editor.selectionStart = editor.selectionEnd = start - 4;
                }
            } else {
                // Indent
                editor.value = editor.value.substring(0, start) + 
                               '    ' + 
                               editor.value.substring(end);
                editor.selectionStart = editor.selectionEnd = start + 4;
            }
            
            updateLineNumbers();
            saveCurrentFile();
        }
    });
    
    // Update line numbers on input
    editor.addEventListener('input', () => {
        updateLineNumbers();
        saveCurrentFile();
    });
    
    // Scroll sync
    editor.addEventListener('scroll', () => {
        const lineNumbers = document.getElementById('lineNumbers');
        lineNumbers.scrollTop = editor.scrollTop;
    });
}

// Line numbers
function initLineNumbers() {
    updateLineNumbers();
}

function updateLineNumbers() {
    const editor = document.getElementById('codeEditor');
    const lineNumbers = document.getElementById('lineNumbers');
    const lines = editor.value.split('\n').length;
    
    let html = '';
    for (let i = 1; i <= lines; i++) {
        html += i + '\n';
    }
    
    lineNumbers.textContent = html;
}

// Save current file
function saveCurrentFile() {
    const editor = document.getElementById('codeEditor');
    files[currentFile] = editor.value;
}

// Load file
function loadFile(filename) {
    saveCurrentFile();
    currentFile = filename;
    
    const editor = document.getElementById('codeEditor');
    editor.value = files[filename] || '';
    
    updateLineNumbers();
    
    // Update tabs
    document.querySelectorAll('.file-tab').forEach(tab => {
        tab.classList.toggle('active', tab.dataset.file === filename);
    });
}

// Tool buttons
function initTools() {
    const toolBtns = document.querySelectorAll('.tool-btn');
    
    toolBtns.forEach(btn => {
        btn.addEventListener('click', () => {
            const tool = btn.dataset.tool;
            
            // Update active state
            toolBtns.forEach(b => b.classList.remove('active'));
            btn.classList.add('active');
            
            // Load template
            loadTemplate(tool);
        });
    });
}

function loadTemplate(toolName) {
    const templateEl = document.getElementById(`template-${toolName}`);
    if (!templateEl) return;
    
    const config = getConfigValues();
    let template = templateEl.textContent;
    
    // Replace placeholders
    template = template.replace(/\{\{KEYWORD\}\}/g, config.keyword);
    template = template.replace(/\{\{LIMIT\}\}/g, config.limit);
    template = template.replace(/\{\{MIN_DELAY\}\}/g, config.minDelay);
    template = template.replace(/\{\{MAX_DELAY\}\}/g, config.maxDelay);
    template = template.replace(/\{\{MIN_LIKES\}\}/g, config.minLikes);
    template = template.replace(/\{\{MIN_FOLLOWERS\}\}/g, config.minFollowers);
    template = template.replace(/\{\{SKIP_RETWEETS\}\}/g, config.skipRetweets);
    template = template.replace(/\{\{DRY_RUN\}\}/g, config.dryRun);
    template = template.replace(/\{\{AI_PROVIDER\}\}/g, config.aiProvider);
    template = template.replace(/\{\{TONE\}\}/g, config.tone);
    
    // Handle conditional blocks
    if (config.dryRun) {
        template = template.replace(/\{\{#DRY_RUN\}\}([\s\S]*?)\{\{\/DRY_RUN\}\}/g, '$1');
        template = template.replace(/\{\{\^DRY_RUN\}\}[\s\S]*?\{\{\/DRY_RUN\}\}/g, '');
    } else {
        template = template.replace(/\{\{#DRY_RUN\}\}[\s\S]*?\{\{\/DRY_RUN\}\}/g, '');
        template = template.replace(/\{\{\^DRY_RUN\}\}([\s\S]*?)\{\{\/DRY_RUN\}\}/g, '$1');
    }
    
    // Update editor
    const editor = document.getElementById('codeEditor');
    editor.value = template.trim();
    files['main.py'] = editor.value;
    
    updateLineNumbers();
    
    // Switch to main.py tab
    loadFile('main.py');
}

// File tabs
function initTabs() {
    const tabs = document.querySelectorAll('.file-tab');
    
    tabs.forEach(tab => {
        tab.addEventListener('click', () => {
            loadFile(tab.dataset.file);
        });
    });
    
    // Add file button
    const addBtn = document.querySelector('.add-file-btn');
    addBtn.addEventListener('click', () => {
        const filename = prompt('Enter filename:', 'new_file.py');
        if (filename && !files[filename]) {
            files[filename] = '# ' + filename + '\n';
            
            // Create new tab
            const tab = document.createElement('button');
            tab.className = 'file-tab';
            tab.dataset.file = filename;
            tab.innerHTML = `<span class="file-icon">${filename.endsWith('.py') ? '🐍' : '📄'}</span>${filename}`;
            
            tab.addEventListener('click', () => loadFile(filename));
            
            addBtn.parentNode.insertBefore(tab, addBtn);
            loadFile(filename);
        }
    });
}

// Sidebar tabs
function initToolbarActions() {
    // Sidebar tabs
    const sidebarTabs = document.querySelectorAll('.sidebar-tab');
    const sidebarPanels = document.querySelectorAll('.sidebar-panel');
    
    sidebarTabs.forEach(tab => {
        tab.addEventListener('click', () => {
            sidebarTabs.forEach(t => t.classList.remove('active'));
            sidebarPanels.forEach(p => p.classList.remove('active'));
            
            tab.classList.add('active');
            document.getElementById(`${tab.dataset.panel}Panel`).classList.add('active');
        });
    });
    
    // Format button
    document.getElementById('formatBtn').addEventListener('click', formatCode);
    
    // Copy button
    document.getElementById('copyBtn').addEventListener('click', copyCode);
    
    // Download button
    document.getElementById('downloadBtn').addEventListener('click', downloadCode);
    
    // Run button
    document.getElementById('runBtn').addEventListener('click', runCode);
    
    // Clear output button
    document.getElementById('clearOutput').addEventListener('click', () => {
        document.getElementById('outputContent').innerHTML = `
            <div class="output-placeholder">
                <span>🖥️</span>
                <p>Click "Run" to see terminal commands</p>
            </div>
        `;
    });
}

function formatCode() {
    // Basic Python formatting (indent normalization)
    const editor = document.getElementById('codeEditor');
    let code = editor.value;
    
    // Normalize indentation to 4 spaces
    code = code.replace(/\t/g, '    ');
    
    // Remove trailing whitespace
    code = code.split('\n').map(line => line.trimEnd()).join('\n');
    
    // Remove excessive blank lines
    code = code.replace(/\n{3,}/g, '\n\n');
    
    editor.value = code;
    updateLineNumbers();
    saveCurrentFile();
    
    showNotification('Code formatted');
}

async function copyCode() {
    const editor = document.getElementById('codeEditor');
    
    try {
        await navigator.clipboard.writeText(editor.value);
        showNotification('Copied to clipboard');
    } catch (err) {
        console.error('Failed to copy:', err);
    }
}

function downloadCode() {
    const editor = document.getElementById('codeEditor');
    const blob = new Blob([editor.value], { type: 'text/plain' });
    const url = URL.createObjectURL(blob);
    
    const a = document.createElement('a');
    a.href = url;
    a.download = currentFile;
    a.click();
    
    URL.revokeObjectURL(url);
    showNotification(`Downloaded ${currentFile}`);
}

function runCode() {
    const editor = document.getElementById('codeEditor');
    const code = editor.value;
    
    // Switch to output panel
    document.querySelectorAll('.sidebar-tab').forEach(t => t.classList.remove('active'));
    document.querySelectorAll('.sidebar-panel').forEach(p => p.classList.remove('active'));
    document.querySelector('[data-panel="output"]').classList.add('active');
    document.getElementById('outputPanel').classList.add('active');
    
    // Generate output
    const output = document.getElementById('outputContent');
    output.innerHTML = '';
    
    // Add commands
    addOutput('$ # Save the script', 'info');
    addOutput(`$ cat > ${currentFile} << 'EOF'`, 'command');
    addOutput('...', 'info');
    addOutput('EOF', 'command');
    addOutput('', 'info');
    addOutput('$ # Install dependencies', 'info');
    addOutput('$ pip install xtools', 'command');
    addOutput('Requirement already satisfied: xtools', 'info');
    addOutput('', 'info');
    addOutput('$ # Run the script', 'info');
    addOutput(`$ python ${currentFile}`, 'command');
    addOutput('', 'info');
    
    // Simulate output based on code content
    setTimeout(() => {
        if (code.includes('like_by_keyword')) {
            addOutput('🔍 Searching for tweets...', 'info');
            setTimeout(() => {
                addOutput('✅ Liked 10 tweets!', 'success');
                addOutput('  ❤️ @user1: "Python is amazing..."', 'info');
                addOutput('  ❤️ @user2: "Just learned decorators..."', 'info');
                addOutput('  ❤️ @user3: "My first Django app..."', 'info');
            }, 500);
        } else if (code.includes('unfollow')) {
            addOutput('🔍 Analyzing following list...', 'info');
            setTimeout(() => {
                addOutput('📊 Analysis Complete:', 'success');
                addOutput('   Total following: 1,234', 'info');
                addOutput('   Follow you back: 987', 'info');
                addOutput("   Don't follow back: 247", 'info');
            }, 500);
        } else if (code.includes('scrape.replies')) {
            addOutput('🔍 Scraping replies...', 'info');
            setTimeout(() => {
                addOutput('Found 156 replies!', 'success');
                addOutput('@user1: "This is so true!"', 'info');
                addOutput('@user2: "Great thread!"', 'info');
            }, 500);
        } else if (code.includes('ContentGenerator')) {
            addOutput('🤖 Initializing AI...', 'info');
            setTimeout(() => {
                addOutput('📝 Generating contextual replies...', 'info');
                addOutput('💬 Generated: "Great insight! Have you considered..."', 'success');
            }, 500);
        } else {
            addOutput('Running script...', 'info');
            setTimeout(() => {
                addOutput('✅ Script completed successfully', 'success');
            }, 500);
        }
    }, 300);
}

function addOutput(text, type = 'info') {
    const output = document.getElementById('outputContent');
    const line = document.createElement('div');
    line.className = `output-line ${type}`;
    line.textContent = text;
    output.appendChild(line);
    output.scrollTop = output.scrollHeight;
}

// Config
function initConfig() {
    document.getElementById('applyConfig').addEventListener('click', () => {
        // Get current tool
        const activeToolBtn = document.querySelector('.tool-btn.active');
        if (activeToolBtn) {
            loadTemplate(activeToolBtn.dataset.tool);
            showNotification('Config applied to code');
        } else {
            showNotification('Select a tool first', 'warning');
        }
    });
}

function getConfigValues() {
    return {
        keyword: document.getElementById('cfgKeyword').value,
        limit: document.getElementById('cfgLimit').value,
        minDelay: document.getElementById('cfgMinDelay').value,
        maxDelay: document.getElementById('cfgMaxDelay').value,
        minLikes: document.getElementById('cfgMinLikes').value,
        minFollowers: document.getElementById('cfgMinFollowers').value,
        skipRetweets: document.getElementById('cfgSkipRetweets').checked,
        dryRun: document.getElementById('cfgDryRun').checked,
        aiProvider: document.getElementById('cfgAIProvider').value,
        tone: document.getElementById('cfgTone').value
    };
}

// Keyboard shortcuts
function initKeyboardShortcuts() {
    document.addEventListener('keydown', (e) => {
        // Ctrl+Enter to run
        if (e.ctrlKey && e.key === 'Enter') {
            e.preventDefault();
            runCode();
        }
        
        // Ctrl+S to download
        if (e.ctrlKey && e.key === 's') {
            e.preventDefault();
            downloadCode();
        }
        
        // Ctrl+Shift+F to format
        if (e.ctrlKey && e.shiftKey && e.key === 'F') {
            e.preventDefault();
            formatCode();
        }
    });
}

// Notification
function showNotification(message, type = 'success') {
    // Remove existing notification
    const existing = document.querySelector('.notification');
    if (existing) existing.remove();
    
    const notification = document.createElement('div');
    notification.className = `notification ${type}`;
    notification.textContent = message;
    document.body.appendChild(notification);
    
    setTimeout(() => notification.classList.add('show'), 10);
    setTimeout(() => {
        notification.classList.remove('show');
        setTimeout(() => notification.remove(), 300);
    }, 2000);
}

// Add notification styles
const style = document.createElement('style');
style.textContent = `
    .notification {
        position: fixed;
        bottom: 2rem;
        left: 50%;
        transform: translateX(-50%) translateY(100px);
        padding: 0.75rem 1.5rem;
        background: var(--bg-secondary);
        border: 1px solid var(--border-color);
        border-radius: 8px;
        color: var(--text-primary);
        font-size: 0.9rem;
        z-index: 1000;
        opacity: 0;
        transition: all 0.3s;
    }
    
    .notification.show {
        transform: translateX(-50%) translateY(0);
        opacity: 1;
    }
    
    .notification.success {
        border-color: var(--accent-success);
    }
    
    .notification.warning {
        border-color: var(--accent-warning);
    }
`;
document.head.appendChild(style);
