// Documentation page specific JavaScript

document.addEventListener('DOMContentLoaded', () => {
    initSidebarNavigation();
    initSearch();
    initScrollSpy();
    initMobileSidebar();
    initCopyCodeButtons();
});

// Sidebar navigation - smooth scroll and active states
function initSidebarNavigation() {
    const sidebarLinks = document.querySelectorAll('.sidebar-nav a');
    
    sidebarLinks.forEach(link => {
        link.addEventListener('click', (e) => {
            e.preventDefault();
            const targetId = link.getAttribute('href').substring(1);
            const target = document.getElementById(targetId);
            
            if (target) {
                // Remove active from all links
                sidebarLinks.forEach(l => l.classList.remove('active'));
                link.classList.add('active');
                
                // Scroll to target
                const navHeight = 80;
                const targetPosition = target.getBoundingClientRect().top + window.pageYOffset - navHeight - 20;
                
                window.scrollTo({
                    top: targetPosition,
                    behavior: 'smooth'
                });
                
                // Update URL without scrolling
                history.pushState(null, null, `#${targetId}`);
            }
        });
    });
}

// Search functionality
function initSearch() {
    const searchInput = document.querySelector('.search-input');
    if (!searchInput) return;
    
    const sidebarLinks = document.querySelectorAll('.sidebar-nav a');
    const navSections = document.querySelectorAll('.nav-section');
    
    searchInput.addEventListener('input', (e) => {
        const query = e.target.value.toLowerCase().trim();
        
        if (query === '') {
            // Show all
            navSections.forEach(section => section.style.display = 'block');
            sidebarLinks.forEach(link => link.style.display = 'block');
            return;
        }
        
        // Filter links
        navSections.forEach(section => {
            const links = section.querySelectorAll('a');
            let hasVisibleLinks = false;
            
            links.forEach(link => {
                const text = link.textContent.toLowerCase();
                const href = link.getAttribute('href').toLowerCase();
                
                if (text.includes(query) || href.includes(query)) {
                    link.style.display = 'block';
                    hasVisibleLinks = true;
                } else {
                    link.style.display = 'none';
                }
            });
            
            // Show/hide section based on visible links
            section.style.display = hasVisibleLinks ? 'block' : 'none';
        });
    });
    
    // Keyboard shortcut
    document.addEventListener('keydown', (e) => {
        if (e.key === '/' && document.activeElement !== searchInput) {
            e.preventDefault();
            searchInput.focus();
        }
        
        if (e.key === 'Escape' && document.activeElement === searchInput) {
            searchInput.value = '';
            searchInput.dispatchEvent(new Event('input'));
            searchInput.blur();
        }
    });
}

// Scroll spy - highlight current section in sidebar
function initScrollSpy() {
    const sections = document.querySelectorAll('.doc-section');
    const sidebarLinks = document.querySelectorAll('.sidebar-nav a');
    
    if (sections.length === 0) return;
    
    const options = {
        rootMargin: '-100px 0px -70% 0px',
        threshold: 0
    };
    
    const observer = new IntersectionObserver((entries) => {
        entries.forEach(entry => {
            if (entry.isIntersecting) {
                const id = entry.target.id;
                
                sidebarLinks.forEach(link => {
                    link.classList.remove('active');
                    if (link.getAttribute('href') === `#${id}`) {
                        link.classList.add('active');
                        
                        // Scroll sidebar to show active link
                        const sidebar = document.querySelector('.docs-sidebar');
                        if (sidebar) {
                            const linkTop = link.offsetTop;
                            const sidebarHeight = sidebar.clientHeight;
                            const scrollTop = sidebar.scrollTop;
                            
                            if (linkTop < scrollTop || linkTop > scrollTop + sidebarHeight - 100) {
                                sidebar.scrollTo({
                                    top: linkTop - sidebarHeight / 3,
                                    behavior: 'smooth'
                                });
                            }
                        }
                    }
                });
            }
        });
    }, options);
    
    sections.forEach(section => {
        observer.observe(section);
    });
}

// Mobile sidebar toggle
function initMobileSidebar() {
    // Create mobile toggle button
    const toggleBtn = document.createElement('button');
    toggleBtn.className = 'mobile-sidebar-toggle';
    toggleBtn.innerHTML = `
        <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
            <path d="M4 6h16M4 12h16M4 18h16"/>
        </svg>
        <span>Menu</span>
    `;
    
    const docsContent = document.querySelector('.docs-content');
    if (docsContent && window.innerWidth <= 768) {
        docsContent.insertBefore(toggleBtn, docsContent.firstChild);
    }
    
    const sidebar = document.querySelector('.docs-sidebar');
    
    toggleBtn.addEventListener('click', () => {
        sidebar.classList.toggle('mobile-open');
        toggleBtn.classList.toggle('active');
    });
    
    // Close sidebar when clicking a link on mobile
    const sidebarLinks = document.querySelectorAll('.sidebar-nav a');
    sidebarLinks.forEach(link => {
        link.addEventListener('click', () => {
            if (window.innerWidth <= 768) {
                sidebar.classList.remove('mobile-open');
                toggleBtn.classList.remove('active');
            }
        });
    });
}

// Add copy buttons to code blocks
function initCopyCodeButtons() {
    const codeBlocks = document.querySelectorAll('pre');
    
    codeBlocks.forEach(block => {
        const wrapper = document.createElement('div');
        wrapper.className = 'code-block-wrapper';
        block.parentNode.insertBefore(wrapper, block);
        wrapper.appendChild(block);
        
        const copyBtn = document.createElement('button');
        copyBtn.className = 'copy-code-btn';
        copyBtn.innerHTML = `
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                <rect x="9" y="9" width="13" height="13" rx="2" ry="2"></rect>
                <path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"></path>
            </svg>
        `;
        copyBtn.title = 'Copy code';
        
        wrapper.appendChild(copyBtn);
        
        copyBtn.addEventListener('click', async () => {
            const code = block.querySelector('code').textContent;
            
            try {
                await navigator.clipboard.writeText(code);
                copyBtn.classList.add('copied');
                copyBtn.innerHTML = `
                    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                        <polyline points="20 6 9 17 4 12"></polyline>
                    </svg>
                `;
                
                setTimeout(() => {
                    copyBtn.classList.remove('copied');
                    copyBtn.innerHTML = `
                        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                            <rect x="9" y="9" width="13" height="13" rx="2" ry="2"></rect>
                            <path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"></path>
                        </svg>
                    `;
                }, 2000);
            } catch (err) {
                console.error('Failed to copy:', err);
            }
        });
    });
}

// Add styles for copy button
const style = document.createElement('style');
style.textContent = `
    .code-block-wrapper {
        position: relative;
    }
    
    .copy-code-btn {
        position: absolute;
        top: 0.75rem;
        right: 0.75rem;
        padding: 0.5rem;
        background: rgba(255, 255, 255, 0.1);
        border: none;
        border-radius: 6px;
        cursor: pointer;
        opacity: 0;
        transition: all 0.2s;
        color: var(--text-secondary);
    }
    
    .code-block-wrapper:hover .copy-code-btn {
        opacity: 1;
    }
    
    .copy-code-btn:hover {
        background: rgba(255, 255, 255, 0.2);
        color: var(--text-primary);
    }
    
    .copy-code-btn.copied {
        color: var(--accent-success);
    }
    
    .mobile-sidebar-toggle {
        display: none;
        align-items: center;
        gap: 0.5rem;
        padding: 0.75rem 1rem;
        background: var(--bg-secondary);
        border: 1px solid var(--border-color);
        border-radius: 8px;
        color: var(--text-primary);
        cursor: pointer;
        margin-bottom: 1.5rem;
        width: 100%;
        justify-content: center;
    }
    
    .mobile-sidebar-toggle:hover {
        background: rgba(255, 255, 255, 0.05);
    }
    
    @media (max-width: 768px) {
        .mobile-sidebar-toggle {
            display: flex;
        }
        
        .docs-sidebar {
            display: none;
        }
        
        .docs-sidebar.mobile-open {
            display: block;
        }
    }
`;
document.head.appendChild(style);
