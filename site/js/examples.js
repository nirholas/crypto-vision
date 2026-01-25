// Examples page specific JavaScript

document.addEventListener('DOMContentLoaded', () => {
    initFilters();
    initCopyButtons();
    initRunButtons();
    initCodeExpand();
});

// Filter examples by category
function initFilters() {
    const filterBtns = document.querySelectorAll('.filter-btn');
    const exampleCards = document.querySelectorAll('.example-card');
    
    filterBtns.forEach(btn => {
        btn.addEventListener('click', () => {
            // Update active state
            filterBtns.forEach(b => b.classList.remove('active'));
            btn.classList.add('active');
            
            const filter = btn.dataset.filter;
            
            exampleCards.forEach(card => {
                const tags = card.dataset.tags || '';
                
                if (filter === 'all' || tags.includes(filter)) {
                    card.classList.remove('hidden');
                    card.style.animation = 'fadeIn 0.3s ease';
                } else {
                    card.classList.add('hidden');
                }
            });
        });
    });
}

// Copy code functionality
function initCopyButtons() {
    const exampleCards = document.querySelectorAll('.example-card');
    
    exampleCards.forEach(card => {
        const pre = card.querySelector('pre');
        if (!pre) return;
        
        // Create wrapper
        const wrapper = document.createElement('div');
        wrapper.className = 'code-wrapper';
        pre.parentNode.insertBefore(wrapper, pre);
        wrapper.appendChild(pre);
        
        // Add copy button
        const copyBtn = document.createElement('button');
        copyBtn.className = 'code-copy-btn';
        copyBtn.innerHTML = `
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                <rect x="9" y="9" width="13" height="13" rx="2" ry="2"></rect>
                <path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"></path>
            </svg>
            <span>Copy</span>
        `;
        wrapper.appendChild(copyBtn);
        
        copyBtn.addEventListener('click', async () => {
            const code = pre.querySelector('code').textContent;
            
            try {
                await navigator.clipboard.writeText(code);
                
                copyBtn.innerHTML = `
                    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                        <polyline points="20 6 9 17 4 12"></polyline>
                    </svg>
                    <span>Copied!</span>
                `;
                copyBtn.classList.add('copied');
                
                setTimeout(() => {
                    copyBtn.innerHTML = `
                        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                            <rect x="9" y="9" width="13" height="13" rx="2" ry="2"></rect>
                            <path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"></path>
                        </svg>
                        <span>Copy</span>
                    `;
                    copyBtn.classList.remove('copied');
                }, 2000);
            } catch (err) {
                console.error('Failed to copy:', err);
            }
        });
    });
    
    // Copy all button for CLI
    const copyAllBtns = document.querySelectorAll('.copy-all-btn');
    copyAllBtns.forEach(btn => {
        btn.addEventListener('click', async () => {
            const card = btn.closest('.example-card');
            const code = card.querySelector('pre code').textContent;
            
            try {
                await navigator.clipboard.writeText(code);
                
                const originalHTML = btn.innerHTML;
                btn.innerHTML = `
                    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                        <polyline points="20 6 9 17 4 12"></polyline>
                    </svg>
                    Copied!
                `;
                
                setTimeout(() => {
                    btn.innerHTML = originalHTML;
                }, 2000);
            } catch (err) {
                console.error('Failed to copy:', err);
            }
        });
    });
}

// Run button functionality (shows modal with instructions)
function initRunButtons() {
    const runBtns = document.querySelectorAll('.run-btn');
    
    runBtns.forEach(btn => {
        btn.addEventListener('click', () => {
            const card = btn.closest('.example-card');
            const title = card.querySelector('h3').textContent;
            const code = card.querySelector('pre code').textContent;
            
            showRunModal(title, code);
        });
    });
}

function showRunModal(title, code) {
    // Create modal
    const modal = document.createElement('div');
    modal.className = 'run-modal';
    modal.innerHTML = `
        <div class="run-modal-overlay"></div>
        <div class="run-modal-content">
            <div class="run-modal-header">
                <h3>Run: ${title}</h3>
                <button class="run-modal-close">&times;</button>
            </div>
            <div class="run-modal-body">
                <p>To run this example:</p>
                <ol>
                    <li>Save the code to a file (e.g., <code>example.py</code>)</li>
                    <li>Make sure XTools is installed: <code>pip install xtools</code></li>
                    <li>Run: <code>python example.py</code></li>
                </ol>
                
                <div class="run-modal-terminal">
                    <div class="terminal-header">
                        <span class="terminal-dot red"></span>
                        <span class="terminal-dot yellow"></span>
                        <span class="terminal-dot green"></span>
                        <span class="terminal-title">Terminal</span>
                    </div>
                    <pre><code class="language-bash"># Save the code
cat > example.py << 'EOF'
${code}
EOF

# Install dependencies
pip install xtools

# Run the script
python example.py</code></pre>
                </div>
                
                <div class="run-modal-actions">
                    <button class="btn btn-secondary" id="copyTerminalCmd">Copy Commands</button>
                    <a href="playground.html" class="btn btn-primary">Open in Playground</a>
                </div>
            </div>
        </div>
    `;
    
    document.body.appendChild(modal);
    
    // Animate in
    setTimeout(() => modal.classList.add('active'), 10);
    
    // Close handlers
    const closeBtn = modal.querySelector('.run-modal-close');
    const overlay = modal.querySelector('.run-modal-overlay');
    
    const closeModal = () => {
        modal.classList.remove('active');
        setTimeout(() => modal.remove(), 300);
    };
    
    closeBtn.addEventListener('click', closeModal);
    overlay.addEventListener('click', closeModal);
    
    // Copy terminal command
    const copyTerminalBtn = modal.querySelector('#copyTerminalCmd');
    copyTerminalBtn.addEventListener('click', async () => {
        const terminalCode = modal.querySelector('.run-modal-terminal code').textContent;
        
        try {
            await navigator.clipboard.writeText(terminalCode);
            copyTerminalBtn.textContent = 'Copied!';
            setTimeout(() => {
                copyTerminalBtn.textContent = 'Copy Commands';
            }, 2000);
        } catch (err) {
            console.error('Failed to copy:', err);
        }
    });
    
    // ESC to close
    document.addEventListener('keydown', function escHandler(e) {
        if (e.key === 'Escape') {
            closeModal();
            document.removeEventListener('keydown', escHandler);
        }
    });
}

// Expand/collapse long code blocks
function initCodeExpand() {
    const preBlocks = document.querySelectorAll('.example-card pre');
    
    preBlocks.forEach(pre => {
        // Check if code is tall
        if (pre.scrollHeight > 420) {
            pre.classList.add('collapsible');
            
            const expandBtn = document.createElement('button');
            expandBtn.className = 'code-expand-btn';
            expandBtn.innerHTML = `
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                    <polyline points="6 9 12 15 18 9"></polyline>
                </svg>
                <span>Show more</span>
            `;
            
            pre.parentNode.appendChild(expandBtn);
            
            expandBtn.addEventListener('click', () => {
                pre.classList.toggle('expanded');
                
                if (pre.classList.contains('expanded')) {
                    expandBtn.innerHTML = `
                        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                            <polyline points="18 15 12 9 6 15"></polyline>
                        </svg>
                        <span>Show less</span>
                    `;
                } else {
                    expandBtn.innerHTML = `
                        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                            <polyline points="6 9 12 15 18 9"></polyline>
                        </svg>
                        <span>Show more</span>
                    `;
                }
            });
        }
    });
}

// Add styles
const style = document.createElement('style');
style.textContent = `
    @keyframes fadeIn {
        from { opacity: 0; transform: translateY(10px); }
        to { opacity: 1; transform: translateY(0); }
    }
    
    .code-wrapper {
        position: relative;
    }
    
    .code-copy-btn {
        position: absolute;
        top: 0.75rem;
        right: 0.75rem;
        display: flex;
        align-items: center;
        gap: 0.4rem;
        padding: 0.4rem 0.75rem;
        background: rgba(255, 255, 255, 0.1);
        border: none;
        border-radius: 6px;
        color: var(--text-secondary);
        font-size: 0.8rem;
        cursor: pointer;
        opacity: 0;
        transition: all 0.2s;
        z-index: 10;
    }
    
    .code-wrapper:hover .code-copy-btn {
        opacity: 1;
    }
    
    .code-copy-btn:hover {
        background: rgba(255, 255, 255, 0.2);
        color: var(--text-primary);
    }
    
    .code-copy-btn.copied {
        color: var(--accent-success);
    }
    
    /* Collapsible code */
    .example-card pre.collapsible:not(.expanded) {
        max-height: 350px;
        overflow: hidden;
        position: relative;
    }
    
    .example-card pre.collapsible:not(.expanded)::after {
        content: '';
        position: absolute;
        bottom: 0;
        left: 0;
        right: 0;
        height: 80px;
        background: linear-gradient(transparent, #1e1e1e);
        pointer-events: none;
    }
    
    .example-card pre.expanded {
        max-height: none;
    }
    
    .code-expand-btn {
        display: flex;
        align-items: center;
        justify-content: center;
        gap: 0.4rem;
        width: 100%;
        padding: 0.75rem;
        background: rgba(255, 255, 255, 0.02);
        border: 1px solid var(--border-color);
        border-top: none;
        border-radius: 0 0 12px 12px;
        color: var(--text-secondary);
        font-size: 0.85rem;
        cursor: pointer;
        transition: all 0.2s;
    }
    
    .code-expand-btn:hover {
        background: rgba(255, 255, 255, 0.05);
        color: var(--text-primary);
    }
    
    /* Run Modal */
    .run-modal {
        position: fixed;
        inset: 0;
        z-index: 1000;
        display: flex;
        align-items: center;
        justify-content: center;
        padding: 1rem;
        opacity: 0;
        visibility: hidden;
        transition: all 0.3s;
    }
    
    .run-modal.active {
        opacity: 1;
        visibility: visible;
    }
    
    .run-modal-overlay {
        position: absolute;
        inset: 0;
        background: rgba(0, 0, 0, 0.7);
        backdrop-filter: blur(4px);
    }
    
    .run-modal-content {
        position: relative;
        background: var(--bg-secondary);
        border: 1px solid var(--border-color);
        border-radius: 16px;
        width: 100%;
        max-width: 700px;
        max-height: 90vh;
        overflow-y: auto;
        transform: scale(0.95);
        transition: transform 0.3s;
    }
    
    .run-modal.active .run-modal-content {
        transform: scale(1);
    }
    
    .run-modal-header {
        display: flex;
        justify-content: space-between;
        align-items: center;
        padding: 1.25rem 1.5rem;
        border-bottom: 1px solid var(--border-color);
    }
    
    .run-modal-header h3 {
        font-size: 1.25rem;
        font-weight: 600;
    }
    
    .run-modal-close {
        width: 32px;
        height: 32px;
        display: flex;
        align-items: center;
        justify-content: center;
        background: transparent;
        border: none;
        border-radius: 8px;
        color: var(--text-muted);
        font-size: 1.5rem;
        cursor: pointer;
        transition: all 0.2s;
    }
    
    .run-modal-close:hover {
        background: rgba(255, 255, 255, 0.1);
        color: var(--text-primary);
    }
    
    .run-modal-body {
        padding: 1.5rem;
    }
    
    .run-modal-body p {
        margin-bottom: 1rem;
        color: var(--text-secondary);
    }
    
    .run-modal-body ol {
        margin-bottom: 1.5rem;
        padding-left: 1.5rem;
    }
    
    .run-modal-body li {
        margin-bottom: 0.5rem;
        color: var(--text-secondary);
    }
    
    .run-modal-body code {
        background: rgba(255, 255, 255, 0.1);
        padding: 0.2em 0.4em;
        border-radius: 4px;
        font-family: 'JetBrains Mono', monospace;
        font-size: 0.875em;
    }
    
    .run-modal-terminal {
        background: #1e1e1e;
        border-radius: 12px;
        overflow: hidden;
        margin-bottom: 1.5rem;
    }
    
    .terminal-header {
        display: flex;
        align-items: center;
        gap: 0.5rem;
        padding: 0.75rem 1rem;
        background: #2d2d2d;
    }
    
    .terminal-dot {
        width: 12px;
        height: 12px;
        border-radius: 50%;
    }
    
    .terminal-dot.red { background: #ff5f57; }
    .terminal-dot.yellow { background: #febc2e; }
    .terminal-dot.green { background: #28c840; }
    
    .terminal-title {
        margin-left: auto;
        color: var(--text-muted);
        font-size: 0.8rem;
    }
    
    .run-modal-terminal pre {
        margin: 0;
        border-radius: 0;
        max-height: 300px;
        overflow-y: auto;
    }
    
    .run-modal-actions {
        display: flex;
        gap: 1rem;
    }
    
    .run-modal-actions .btn {
        flex: 1;
    }
    
    @media (max-width: 768px) {
        .run-modal-actions {
            flex-direction: column;
        }
    }
`;
document.head.appendChild(style);
