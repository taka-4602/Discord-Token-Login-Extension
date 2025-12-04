// タブ専用スクリプト - 高機能版
if (document.querySelector('.discord-token-login-popup')) {

    // 既存のstorageポリフィルを使用
    const storage = (() => {
        const hasChromeStorage = typeof chrome !== 'undefined' && chrome.storage && chrome.storage.local;
        if (hasChromeStorage) {
            return {
                get(keys, cb) { try { chrome.storage.local.get(keys, cb); } catch (e) { console.error('chrome.storage.local.get error', e); cb({}); } },
                set(obj, cb) { try { chrome.storage.local.set(obj, cb); } catch (e) { console.error('chrome.storage.local.set error', e); cb && cb(); } },
                clear(cb) { try { chrome.storage.local.clear(cb); } catch (e) { console.error('chrome.storage.local.clear error', e); cb && cb(); } },
                available: true
            };
        }
        return {
            get(keys, cb) {
                const out = {};
                try {
                    const list = Array.isArray(keys) ? keys : (typeof keys === 'object' ? Object.keys(keys) : [keys]);
                    for (const k of list) {
                        const raw = localStorage.getItem(k);
                        out[k] = raw ? JSON.parse(raw) : (typeof keys === 'object' ? keys[k] : undefined);
                    }
                } catch (e) { console.error('localStorage get error', e); }
                cb(out);
            },
            set(obj, cb) {
                try { for (const [k, v] of Object.entries(obj)) { localStorage.setItem(k, JSON.stringify(v)); } } catch (e) { console.error('localStorage set error', e); }
                cb && cb();
            },
            clear(cb) { try { localStorage.clear(); } catch (e) { console.error('localStorage clear error', e); } cb && cb(); },
            available: false
        };
    })();

    // 要素取得
    const exportAllBtn = document.querySelector('#export-all-btn');
    const exportValidBtn = document.querySelector('#export-valid-btn');
    const importFileBtn = document.querySelector('#import-file-btn');
    const importFileInput = document.querySelector('#import-file-input');
    const memoTokenInput = document.querySelector('#memo-token-input');
    const copyTokenBtn = document.querySelector('#copy-token-btn');
    const testTokenBtn = document.querySelector('#test-token-btn');
    
    // 既存script.jsの機能をインポート（簡略化）
    const tokenInput = document.querySelector('#token');
    const submitBtn = document.querySelector('#submit');
    const saveToggle = document.querySelector('#save-toggle');
    const savedAccountsTrigger = document.querySelector('#saved-accounts-trigger');
    const accountListContainer = document.querySelector('#account-list-container');
    const accountList = document.querySelector('#account-list');
    const errorMessage = document.querySelector('#error-message');
    const sortSelect = document.querySelector('#sort-order');
    const clearAllBtn = document.querySelector('#clear-all-btn');
    const memoModal = document.querySelector('#memo-modal');
    const modalAccountName = document.querySelector('#modal-account-name');
    const memoInput = document.querySelector('#memo-input');
    const saveMemoBtn = document.querySelector('#save-memo-btn');
    const cancelMemoBtn = document.querySelector('#cancel-memo-btn');
    const modalClose = document.querySelector('.modal-close');
    
    let currentEditingAccountId = null;

    // Export機能
    if (exportAllBtn) {
        exportAllBtn.addEventListener('click', () => {
            storage.get(['accounts'], (res) => {
                const accounts = res.accounts || [];
                const lines = accounts.map(a => a.token).join('\n');
                downloadText(lines, 'all-tokens.txt');
            });
        });
    }

    if (exportValidBtn) {
        exportValidBtn.addEventListener('click', () => {
            storage.get(['accounts'], (res) => {
                const accounts = res.accounts || [];
                const validTokens = accounts.filter(a => !a.loginFailed).map(a => a.token);
                downloadText(validTokens.join('\n'), 'valid-tokens.txt');
            });
        });
    }

    if (importFileBtn && importFileInput) {
        importFileBtn.addEventListener('click', () => {
            importFileInput.click();
        });

        importFileInput.addEventListener('change', (event) => {
            const file = event.target.files[0];
            if (file && file.type === 'text/plain') {
                const reader = new FileReader();
                reader.onload = (e) => {
                    const tokens = parseTokens(e.target.result);
                    processBulkTokens(tokens);
                };
                reader.readAsText(file);
            }
        });
    }

    // トークンコピー機能
    if (copyTokenBtn) {
        copyTokenBtn.addEventListener('click', async () => {
            try {
                const text = memoTokenInput ? memoTokenInput.value.trim() : '';
                if (!text) return;
                if (navigator.clipboard && navigator.clipboard.writeText) {
                    await navigator.clipboard.writeText(text);
                    showSuccess('Token copied to clipboard');
                }
            } catch (e) {
                console.warn('copy token failed', e);
                showError('Copy failed');
            }
        });
    }

    // トークンテスト機能
    if (testTokenBtn) {
        testTokenBtn.addEventListener('click', async () => {
            const token = memoTokenInput ? memoTokenInput.value.trim() : '';
            if (!token) return;
            
            testTokenBtn.disabled = true;
            testTokenBtn.textContent = 'Testing...';
            
            try {
                const response = await fetch('https://discord.com/api/v9/users/@me', {
                    headers: { 'Authorization': token }
                });
                
                if (response.ok) {
                    showSuccess('Token is valid');
                } else {
                    showError(`Token invalid (${response.status})`);
                }
            } catch (e) {
                showError('Test failed');
            } finally {
                testTokenBtn.disabled = false;
                testTokenBtn.textContent = 'Test';
            }
        });
    }

    // 拡張メモ保存
    if (saveMemoBtn) {
        saveMemoBtn.addEventListener('click', async () => {
            if (currentEditingAccountId && memoInput) {
                const memoText = memoInput.value.trim();
                const newToken = memoTokenInput ? memoTokenInput.value.trim() : null;
                const update = { memo: memoText };
                if (newToken) update.token = newToken;
                
                await updateAccountStatus(currentEditingAccountId, update);
                closeMemoModal();
                renderSavedAccounts();
                showSuccess('Account updated');
            }
        });
    }

    // Clear All機能
    if (clearAllBtn) {
        let clickCount = 0;
        let clickTimer = null;
        
        clearAllBtn.addEventListener('click', () => {
            clickCount++;
            
            if (clickTimer) {
                clearTimeout(clickTimer);
            }
            
            if (clickCount === 1) {
                clearAllBtn.textContent = 'Click Again to Confirm';
                clearAllBtn.style.background = '#ed4245';
                
                clickTimer = setTimeout(() => {
                    clearAllBtn.textContent = 'Clear All';
                    clearAllBtn.style.background = '#f23f42';
                    clickCount = 0;
                }, 2000);
            } else if (clickCount >= 2) {
                clearTimeout(clickTimer);
                storage.clear(() => {
                    showSuccess('All accounts cleared');
                    renderSavedAccounts();
                });
                clearAllBtn.textContent = 'Clear All';
                clearAllBtn.style.background = '#f23f42';
                clickCount = 0;
            }
        });
    }
    
    // ログイン機能
    if (submitBtn && tokenInput) {
        submitBtn.addEventListener('click', () => {
            const token = tokenInput.value.trim();
            if (!token) {
                showError("Please enter a token");
                return;
            }
            
            hideError();
            
            if (saveToggle && saveToggle.checked) {
                fetchAndSaveUser(token).then((success) => {
                    if (success) {
                        login(token);
                    }
                });
            } else {
                login(token);
            }
        });
    }
    
    // ペーストログイン機能
    const pasteLoginBtn = document.querySelector('#paste-login-btn');
    if (pasteLoginBtn && tokenInput) {
        pasteLoginBtn.addEventListener('click', async () => {
            try {
                if (navigator.clipboard && navigator.clipboard.readText) {
                    const text = await navigator.clipboard.readText();
                    const cleanToken = text.trim();
                    if (cleanToken && cleanToken.length > 20) {
                        tokenInput.value = cleanToken;
                        if (saveToggle && saveToggle.checked) {
                            fetchAndSaveUser(cleanToken).then((success) => {
                                if (success) {
                                    login(cleanToken);
                                }
                            });
                        } else {
                            login(cleanToken);
                        }
                    } else {
                        showError('Invalid token in clipboard');
                    }
                } else {
                    showError('Clipboard access not available');
                }
            } catch (e) {
                showError('Failed to read from clipboard');
            }
        });
    }
    
    // アカウントリストの表示切り替え
    if (savedAccountsTrigger && accountListContainer) {
        savedAccountsTrigger.addEventListener('click', () => {
            const isOpen = accountListContainer.classList.contains('open');
            
            if (isOpen) {
                accountListContainer.classList.remove('open');
                savedAccountsTrigger.textContent = 'Show Saved Accounts ▼';
            } else {
                accountListContainer.classList.add('open');
                savedAccountsTrigger.textContent = 'Hide Saved Accounts ▲';
                renderSavedAccounts();
            }
        });
    }
    
    // セーブトグルの処理
    if (saveToggle) {
        saveToggle.addEventListener('change', () => {
            storage.set({ isSaveEnabled: saveToggle.checked });
        });
    }
    
    // Bulk import関連の処理
    const bulkImportContainer = document.querySelector('#bulk-import-container');
    const bulkImportTrigger = document.querySelector('#bulk-import-trigger');
    const uploadFileBtn = document.querySelector('#upload-file-btn');
    const tokenFileInput = document.querySelector('#token-file-input');
    const pasteClipboardBtn = document.querySelector('#paste-clipboard-btn');
    const bulkTokenInput = document.querySelector('#bulk-token-input');
    const processTokensBtn = document.querySelector('#process-tokens-btn');
    const clearTokensBtn = document.querySelector('#clear-tokens-btn');
    
    if (bulkImportTrigger && bulkImportContainer) {
        bulkImportTrigger.addEventListener('click', () => {
            const isHidden = bulkImportContainer.classList.contains('hidden');
            
            if (isHidden) {
                bulkImportContainer.classList.remove('hidden');
                bulkImportTrigger.textContent = 'Bulk Import Tokens ▲';
                if (accountListContainer) {
                    accountListContainer.classList.remove('open');
                    savedAccountsTrigger.textContent = 'Show Saved Accounts ▼';
                }
            } else {
                bulkImportContainer.classList.add('hidden');
                bulkImportTrigger.textContent = 'Bulk Import Tokens ▼';
            }
        });
    }
    
    if (uploadFileBtn && tokenFileInput) {
        uploadFileBtn.addEventListener('click', () => {
            tokenFileInput.click();
        });

        tokenFileInput.addEventListener('change', (event) => {
            const file = event.target.files[0];
            if (file && file.type === 'text/plain') {
                const reader = new FileReader();
                reader.onload = (e) => {
                    if (bulkTokenInput) {
                        bulkTokenInput.value = e.target.result;
                    }
                };
                reader.readAsText(file);
            }
        });
    }
    
    if (pasteClipboardBtn && bulkTokenInput) {
        pasteClipboardBtn.addEventListener('click', async () => {
            try {
                if (navigator.clipboard && navigator.clipboard.readText) {
                    const text = await navigator.clipboard.readText();
                    bulkTokenInput.value = text || '';
                } else {
                    showError('Clipboard API not available');
                }
            } catch (e) {
                showError('Failed to read from clipboard');
            }
        });
    }
    
    if (processTokensBtn && bulkTokenInput) {
        processTokensBtn.addEventListener('click', async () => {
            const text = bulkTokenInput.value.trim();
            if (!text) {
                showError('No tokens entered');
                return;
            }

            const tokens = parseTokens(text);
            if (tokens.length === 0) {
                showError('No valid tokens found');
                return;
            }

            await processBulkTokens(tokens);
            bulkTokenInput.value = '';
        });
    }
    
    if (clearTokensBtn && bulkTokenInput) {
        clearTokensBtn.addEventListener('click', () => {
            bulkTokenInput.value = '';
        });
    }
    
    // ユーティリティ関数
    function downloadText(text, filename) {
        const blob = new Blob([text], { type: 'text/plain;charset=utf-8' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = filename;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        URL.revokeObjectURL(url);
    }

    function showSuccess(message) {
        if (errorMessage) {
            errorMessage.textContent = message;
            errorMessage.style.color = '#3ba55c';
            errorMessage.classList.add('visible');
            setTimeout(() => {
                errorMessage.classList.remove('visible');
                errorMessage.style.color = '#f23f42';
            }, 3000);
        }
    }

    function showError(message) {
        if (errorMessage) {
            errorMessage.textContent = message;
            errorMessage.style.color = '#f23f42';
            errorMessage.classList.add('visible');
            setTimeout(() => {
                errorMessage.classList.remove('visible');
            }, 3000);
        }
    }

    function openMemoModal(account) {
        if (memoModal && modalAccountName && memoInput) {
            currentEditingAccountId = account.id;
            modalAccountName.textContent = account.global_name || account.username;
            memoInput.value = account.memo || '';
            if (memoTokenInput) memoTokenInput.value = account.token || '';
            memoModal.classList.remove('hidden');
            memoInput.focus();
        }
    }

    function closeMemoModal() {
        if (memoModal && memoInput) {
            memoModal.classList.add('hidden');
            currentEditingAccountId = null;
            memoInput.value = '';
            if (memoTokenInput) memoTokenInput.value = '';
        }
    }

    // 既存script.jsから共通関数をコピー（必要部分のみ）
    async function updateAccountStatus(accountId, statusUpdate) {
        return new Promise((resolve) => {
            storage.get(['accounts'], (result) => {
                let accounts = result.accounts || [];
                const accountIndex = accounts.findIndex(acc => acc.id === accountId);
                if (accountIndex !== -1) {
                    accounts[accountIndex] = { ...accounts[accountIndex], ...statusUpdate };
                    storage.set({ accounts }, resolve);
                } else {
                    resolve();
                }
            });
        });
    }

    function parseTokens(text) {
        const tokens = [];
        const lines = text.split(/\r?\n/);
        for (const line of lines) {
            const trimmedLine = line.trim();
            if (!trimmedLine || trimmedLine.startsWith('#') || trimmedLine.startsWith('//')) continue;
            let lineTokens = [];
            if (trimmedLine.includes(',')) {
                lineTokens = trimmedLine.split(',');
            } else if (trimmedLine.includes('/')) {
                lineTokens = trimmedLine.split('/');
            } else if (trimmedLine.includes(' ')) {
                lineTokens = trimmedLine.split(/\s+/);
            } else {
                lineTokens = [trimmedLine];
            }
            for (const token of lineTokens) {
                const cleanToken = token.trim().replace(/^["']|["']$/g, '');
                if (cleanToken && cleanToken.length > 20) {
                    tokens.push(cleanToken);
                }
            }
        }
        return [...new Set(tokens)];
    }

    function saveToStorage(newAccount) {
        return new Promise((resolve) => {
            storage.get(['accounts'], (result) => {
                let accounts = result.accounts || [];
                const existingIndex = accounts.findIndex(acc => acc.id === newAccount.id);
                if (existingIndex !== -1) {
                    accounts[existingIndex] = newAccount;
                } else {
                    accounts.push(newAccount);
                }
                storage.set({ accounts }, resolve);
            });
        });
    }

    async function processBulkTokens(tokens) {
        let successCount = 0;
        let duplicateCount = 0;
        try {
            const existing = await new Promise((resolve) => {
                storage.get(['accounts'], (res) => {
                    const accounts = res.accounts || [];
                    resolve(new Set(accounts.map(a => a.token)));
                });
            });
            for (let i = 0; i < tokens.length; i++) {
                const token = tokens[i];
                if (existing.has(token)) { duplicateCount++; continue; }
                const userInfo = {
                    id: Date.now().toString() + Math.random().toString(36).substr(2, 9),
                    username: `ImportedToken${i + 1}`,
                    global_name: `Imported Token ${i + 1}`,
                    avatar: null,
                    token: token,
                    savedAt: Date.now(),
                    imported: true
                };
                await saveToStorage(userInfo);
                existing.add(token);
                successCount++;
            }
            const msg = duplicateCount > 0
                ? `${successCount}件保存、${duplicateCount}件は重複のためスキップ`
                : `${successCount}件のトークンを保存しました`;
            showSuccess(msg);
            renderSavedAccounts();
        } catch (error) {
            showError(`エラー: ${error.message}`);
        }
    }

    function renderSavedAccounts() {
        accountList.innerHTML = '';
        storage.get(['accounts', 'sortOrder'], (result) => {
            const accounts = result.accounts || [];
            const order = result.sortOrder || 'newest';
            const sorted = sortAccounts(accounts, order);

            if (sorted.length === 0) {
                accountList.innerHTML = '<div style="padding:10px; font-size:12px; text-align:center; color:#949ba4;">No accounts saved</div>';
                return;
            }

            sorted.forEach(acc => {
                const item = document.createElement('div');
                item.className = 'account-item';
                if (acc.memo) item.classList.add('has-memo');
                
                const avatarSrc = acc.avatar || 'https://cdn.discordapp.com/embed/avatars/0.png';
                const statusBadge = acc.imported ? '<span class="status-badge imported">IMPORTED</span>' : '';
                const missStatus = acc.loginFailed ? '<span class="status-badge miss">MISS</span>' : '';
                const memoPreview = acc.memo ? `<div class="memo-preview">${acc.memo}</div>` : '';

                item.innerHTML = `
                    <img src="${avatarSrc}" class="account-avatar" alt="icon" onerror="this.src='https://cdn.discordapp.com/embed/avatars/0.png'">
                    <div class="account-info">
                        <span class="account-username">${acc.global_name || acc.username}${statusBadge}${missStatus}</span>
                        <span class="account-id">${acc.username}</span>
                        ${memoPreview}
                    </div>
                    <div class="account-actions">
                        <span class="memo-icon" title="Edit">Edit</span>
                        <span class="copy-token" title="Copy Token">Copy</span>
                        <div class="delete-btn" title="Remove">Remove</div>
                    </div>
                `;

                const deleteBtn = item.querySelector('.delete-btn');
                const memoIcon = item.querySelector('.memo-icon');
                const copyBtn = item.querySelector('.copy-token');

                // 小さな領域でも確実に押せるよう、バブルを止める
                deleteBtn.addEventListener('click', (e) => {
                    e.stopPropagation();
                    item.classList.add('deleting');
                    setTimeout(() => { removeAccount(acc.id); }, 200);
                });

                memoIcon.addEventListener('click', (e) => {
                    e.stopPropagation();
                    openMemoModal(acc);
                });

                if (copyBtn) {
                    copyBtn.addEventListener('click', async (e) => {
                        e.stopPropagation();
                        try {
                            if (navigator.clipboard && navigator.clipboard.writeText) {
                                await navigator.clipboard.writeText(acc.token || '');
                                showSuccess('Token copied');
                            }
                        } catch (err) {
                            showError('Copy failed');
                        }
                    });
                }

                item.addEventListener('click', (e) => {
                    // アクション領域以外のクリックはログイン
                    const target = e.target;
                    if (!target.classList.contains('memo-icon') &&
                        !target.classList.contains('copy-token') &&
                        !target.classList.contains('delete-btn')) {
                        login(acc.token, acc.id);
                    }
                });

                accountList.appendChild(item);
            });
        });
    }

    function sortAccounts(accounts, order) {
        const arr = [...accounts];
        switch (order) {
            case 'oldest':
                arr.sort((a, b) => (a.savedAt || 0) - (b.savedAt || 0));
                break;
            case 'name_asc':
                arr.sort((a, b) => (a.global_name || a.username || '').localeCompare(b.global_name || b.username || ''));
                break;
            case 'name_desc':
                arr.sort((a, b) => (b.global_name || b.username || '').localeCompare(a.global_name || a.username || ''));
                break;
            case 'imported_first':
                arr.sort((a, b) => (b.imported === true) - (a.imported === true));
                break;
            case 'non_imported_first':
                arr.sort((a, b) => (a.imported === true) - (b.imported === true));
                break;
            case 'miss_first':
                arr.sort((a, b) => (b.loginFailed === true) - (a.loginFailed === true));
                break;
            default:
                arr.sort((a, b) => (b.savedAt || 0) - (a.savedAt || 0));
                break;
        }
        return arr;
    }

    function removeAccount(userId) {
        storage.get(['accounts'], (result) => {
            let accounts = result.accounts || [];
            accounts = accounts.filter(acc => acc.id !== userId);
            storage.set({ accounts }, () => {
                renderSavedAccounts();
            });
        });
    }

    function login(token, accountId = null) {
        window.open("https://discord.com/channels/@me?discordtoken=" + token, '_blank');
    }

    // 初期化
    storage.get(['sortOrder'], (res) => {
        const order = res.sortOrder || 'newest';
        if (sortSelect) sortSelect.value = order;
    });

    if (sortSelect) {
        sortSelect.addEventListener('change', () => {
            storage.set({ sortOrder: sortSelect.value }, () => {
                renderSavedAccounts();
            });
        });
    }

    if (modalClose) {
        modalClose.addEventListener('click', closeMemoModal);
    }

    if (cancelMemoBtn) {
        cancelMemoBtn.addEventListener('click', closeMemoModal);
    }

    if (memoModal) {
        memoModal.addEventListener('click', (e) => {
            if (e.target === memoModal) closeMemoModal();
        });
    }

    // 初回描画
    renderSavedAccounts();
}
