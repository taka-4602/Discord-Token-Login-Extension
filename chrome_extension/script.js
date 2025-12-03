if (document.querySelector('.discord-token-login-popup')) {

    // 安全な storage ポリフィル（chrome.storage が無い場合は localStorage にフォールバック）
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

    const discordLink = document.querySelector('#discord-link');
    if (discordLink) {
        discordLink.addEventListener('click', () => {
            window.open('https://discord.ozeu.net', '_blank');
        });
    }

    const tokenInput = document.querySelector('#token');
    const submitBtn = document.querySelector('#submit');
    const saveToggle = document.querySelector('#save-toggle');
    const savedAccountsTrigger = document.querySelector('#saved-accounts-trigger');
    const accountListContainer = document.querySelector('#account-list-container');
    const accountList = document.querySelector('#account-list');
    const errorMessage = document.querySelector('#error-message');
    const bulkImportTrigger = document.querySelector('#bulk-import-trigger');
    const bulkImportContainer = document.querySelector('#bulk-import-container');
    const tokenFileInput = document.querySelector('#token-file-input');
    const uploadFileBtn = document.querySelector('#upload-file-btn');
    const bulkTokenInput = document.querySelector('#bulk-token-input');
    const processTokensBtn = document.querySelector('#process-tokens-btn');
    const bulkProgress = document.querySelector('#bulk-progress');
    const progressCount = document.querySelector('#progress-count');
    const progressTotal = document.querySelector('#progress-total');
    const progressFill = document.querySelector('#progress-fill');
    const bulkResult = document.querySelector('#bulk-result');
    const clearTokensBtn = document.querySelector('#clear-tokens-btn');
    const pasteClipboardBtn = document.querySelector('#paste-clipboard-btn');
    const pasteLoginBtn = document.querySelector('#paste-login-btn');

    const memoModal = document.querySelector('#memo-modal');
    const modalAccountName = document.querySelector('#modal-account-name');
    const memoInput = document.querySelector('#memo-input');
    const saveMemoBtn = document.querySelector('#save-memo-btn');
    const cancelMemoBtn = document.querySelector('#cancel-memo-btn');
    const modalClose = document.querySelector('.modal-close');

    let currentEditingAccountId = null;

    console.log('Elements found:', {
        bulkImportTrigger: !!bulkImportTrigger,
        bulkImportContainer: !!bulkImportContainer,
        accountListContainer: !!accountListContainer,
        savedAccountsTrigger: !!savedAccountsTrigger
    });

    storage.get(['isSaveEnabled'], (result) => {
        if (saveToggle) saveToggle.checked = result.isSaveEnabled || false;
    });

    if (saveToggle) {
        saveToggle.addEventListener('change', () => {
            storage.set({ isSaveEnabled: saveToggle.checked });
        });
    }

    savedAccountsTrigger.addEventListener('click', () => {
        const isOpen = accountListContainer.classList.contains('open');
        if (!isOpen) {
            renderSavedAccounts();
            accountListContainer.classList.add('open');
            accountListContainer.classList.remove('hidden');
            savedAccountsTrigger.textContent = 'Hide Saved Accounts ▲';
            // 大量インポートが開いていたら閉じる
            if (bulkImportContainer && bulkImportContainer.classList.contains('open')) {
                bulkImportContainer.classList.remove('open');
                bulkImportContainer.classList.add('hidden');
                if (bulkImportTrigger) bulkImportTrigger.textContent = 'Bulk Import Tokens ▼';
            }
        } else {
            accountListContainer.classList.remove('open');
            accountListContainer.classList.add('hidden');
            savedAccountsTrigger.textContent = 'Show Saved Accounts ▼';
        }
    });

    // 大量インポート機能のイベントリスナー
    if (bulkImportTrigger && bulkImportContainer) {
        bulkImportTrigger.addEventListener('click', () => {
            const isOpen = bulkImportContainer.classList.contains('open');
            if (!isOpen) {
                bulkImportContainer.classList.add('open');
                bulkImportContainer.classList.remove('hidden');
                bulkImportTrigger.textContent = 'Hide Bulk Import ▲';
                // アカウント一覧が開いていたら閉じる
                if (accountListContainer && accountListContainer.classList.contains('open')) {
                    accountListContainer.classList.remove('open');
                    accountListContainer.classList.add('hidden');
                    if (savedAccountsTrigger) savedAccountsTrigger.textContent = 'Show Saved Accounts ▼';
                }
            } else {
                bulkImportContainer.classList.remove('open');
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
                    showBulkResultMessage('クリップボードAPIが利用できません');
                }
            } catch (e) {
                showBulkResultMessage('クリップボードからの取得に失敗しました');
            }
        });
    }

    if (processTokensBtn && bulkTokenInput) {
        processTokensBtn.addEventListener('click', async () => {
            const text = bulkTokenInput.value.trim();
            if (!text) {
                showError('トークンが入力されていません');
                return;
            }

            const tokens = parseTokens(text);
            if (tokens.length === 0) {
                showError('有効なトークンが見つかりませんでした');
                return;
            }

            await processBulkTokens(tokens);
        });
    }

    if (clearTokensBtn) {
        clearTokensBtn.addEventListener('click', () => {
            if (bulkTokenInput) bulkTokenInput.value = '';
            if (tokenFileInput) tokenFileInput.value = '';
            hideError();
        });
    }

    tokenInput.addEventListener('input', () => {
        tokenInput.style.border = '1px solid #1E1F22';
        hideError();
    });

    submitBtn.addEventListener('click', async () => {
        const token = tokenInput.value.trim().replace(/^"|"$/g, '');
        hideError();

        if (token === '') {
            triggerShake();
            tokenInput.style.border = '1px solid #f23f42';
            return;
        }

        tokenInput.style.border = '1px solid #5865f2';

        if (saveToggle.checked) {
            const success = await fetchAndSaveUser(token);
            if (!success) return;
        }

        login(token);
    });

    if (pasteLoginBtn) {
        pasteLoginBtn.addEventListener('click', async () => {
            try {
                if (!(navigator.clipboard && navigator.clipboard.readText)) {
                    showError('クリップボードAPIが利用できません');
                    return;
                }
                const clip = (await navigator.clipboard.readText() || '').trim();
                if (!clip) { showError('クリップボードが空です'); return; }
                // 取得したトークンを入力欄へ反映
                if (tokenInput) tokenInput.value = clip;
                // Saveがオンなら保存（通常と同じ扱い）
                if (saveToggle && saveToggle.checked) {
                    const ok = await fetchAndSaveUser(clip);
                    if (!ok) return;
                }
                // 直接ログイン
                login(clip);
            } catch (e) {
                showError('クリップボードの読み取りに失敗しました');
            }
        });
    }

    function login(token, accountId = null) {
        if (accountId) {
            resolveImportedProfileOnFirstLogin(accountId, token);
            recordLoginAttempt(accountId, token);
        }
        window.open("https://discord.com/channels/@me?discordtoken=" + token, '_blank');
    }

    async function resolveImportedProfileOnFirstLogin(accountId, token) {
        try {
            const current = await new Promise((resolve) => {
                storage.get(['accounts'], (res) => {
                    const acc = (res.accounts || []).find(a => a.id === accountId);
                    resolve(acc);
                });
            });
            if (!current || !current.imported) return;

            const response = await fetch('https://discord.com/api/v9/users/@me', {
                headers: { 'Authorization': token }
            });
            if (!response.ok) return;

            const data = await response.json();
            const avatarUrl = getAvatarUrl(data.id, data.avatar, data.discriminator);

            await updateAccountStatus(accountId, {
                // idは不変にし、discordIdフィールドを追加
                discordId: data.id,
                username: data.username,
                global_name: data.global_name,
                avatar: avatarUrl,
                imported: false
            });
            // 一覧は必ず更新（開いていなくても次表示に備え更新）
            renderSavedAccounts();
        } catch (e) {
            console.warn('resolveImportedProfileOnFirstLogin error', e);
        }
    }

    async function recordLoginAttempt(accountId, token) {
        try {
            const response = await fetch('https://discord.com/api/v9/users/@me', {
                headers: { 'Authorization': token }
            });

            if (!response.ok) {
                await updateAccountStatus(accountId, { loginFailed: true });
                setTimeout(() => {
                    if (accountListContainer.classList.contains('open')) {
                        renderSavedAccounts();
                    }
                }, 2000);
            } else {
                await updateAccountStatus(accountId, { loginFailed: false });
            }
        } catch (error) {
            await updateAccountStatus(accountId, { loginFailed: true });
            setTimeout(() => {
                if (accountListContainer.classList.contains('open')) {
                    renderSavedAccounts();
                }
            }, 2000);
        }
    }

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

    async function fetchAndSaveUser(token, existingAccountId = null) {
        try {
            const response = await fetch('https://discord.com/api/v9/users/@me', {
                headers: { 'Authorization': token }
            });

            if (response.status === 401) {
                showError("(401: unauthorized)");
                triggerShake();
                return false;
            }

            if (!response.ok) {
                showError(`Error: ${response.status}`);
                triggerShake();
                return false;
            }

            const data = await response.json();
            const avatarUrl = getAvatarUrl(data.id, data.avatar, data.discriminator);

            // 既存レコード更新モードの場合、idは既存のまま保持
            const targetId = existingAccountId || data.id;
            const userInfo = {
                id: targetId,
                discordId: data.id,
                username: data.username,
                global_name: data.global_name,
                avatar: avatarUrl,
                token: token,
                savedAt: Date.now(),
                imported: false
            };

            // 既存レコードのメモを維持
            if (existingAccountId) {
                const current = await new Promise((resolve) => {
                    storage.get(['accounts'], (res) => {
                        const acc = (res.accounts || []).find(a => a.id === existingAccountId);
                        resolve(acc);
                    });
                });
                if (current && current.memo) {
                    userInfo.memo = current.memo;
                }
            }

            await saveToStorage(userInfo);
            renderSavedAccounts();
            return true;
        } catch (e) {
            showError(e);
            triggerShake();
            return false;
        }
    }

    function triggerShake() {
        tokenInput.classList.remove('shake');
        void tokenInput.offsetWidth;
        tokenInput.classList.add('shake');

        setTimeout(() => {
            tokenInput.classList.remove('shake');
        }, 400);
    }

    function showError(text) {
        tokenInput.style.border = '1px solid #f23f42';
        errorMessage.textContent = text;
        errorMessage.classList.add('visible');
    }

    function hideError() {
        errorMessage.classList.remove('visible');
        setTimeout(() => {
            if (!errorMessage.classList.contains('visible')) errorMessage.textContent = '';
        }, 300);
    }

    function getAvatarUrl(userId, avatarHash, discriminator) {
        if (avatarHash) {
            return `https://cdn.discordapp.com/avatars/${userId}/${avatarHash}.png`;
        }
        const index = BigInt(userId) % 5n;
        return `https://cdn.discordapp.com/embed/avatars/${index}.png`;
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

    function renderSavedAccounts() {
        accountList.innerHTML = '';

        storage.get(['accounts'], (result) => {
            const accounts = result.accounts || [];

            if (accounts.length === 0) {
                accountList.innerHTML = '<div style="padding:10px; font-size:12px; text-align:center; color:#949ba4;">No accounts saved</div>';
                return;
            }

            accounts.forEach(acc => {
                const item = document.createElement('div');
                item.className = 'account-item';

                if (acc.memo) {
                    item.classList.add('has-memo');
                }

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
                    <span class="memo-icon" title="Edit Memo">📝</span>
                    <div class="delete-btn" title="Remove">×</div>
                `;

                const deleteBtn = item.querySelector('.delete-btn');
                const memoIcon = item.querySelector('.memo-icon');

                deleteBtn.addEventListener('click', (e) => {
                    e.stopPropagation();

                    item.classList.add('deleting');

                    setTimeout(() => {
                        removeAccount(acc.id);
                    }, 500);
                });

                memoIcon.addEventListener('click', (e) => {
                    e.stopPropagation();
                    openMemoModal(acc);
                });

                item.addEventListener('click', (e) => {
                    if (!e.target.classList.contains('memo-icon') &&
                        !e.target.classList.contains('delete-btn')) {
                        handleAccountClick(acc);
                    }
                });

                accountList.appendChild(item);
            });
        });
    }

    function handleAccountClick(acc) {
        // メモや削除以外のクリックでログイン処理
        if (acc.imported) {
            // インポート済みは単体入力時の処理をそのまま適用（fetch→保存→ログイン）
            fetchAndSaveUser(acc.token, acc.id).then((ok) => {
                if (ok) {
                    login(acc.token, acc.id);
                }
            });
        } else {
            login(acc.token, acc.id);
        }
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

    function parseTokens(text) {
        const tokens = [];
        const lines = text.split(/\r?\n/);

        for (const line of lines) {
            const trimmedLine = line.trim();
            if (!trimmedLine || trimmedLine.startsWith('#') || trimmedLine.startsWith('//')) {
                continue;
            }

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

    async function processBulkTokens(tokens) {
        let successCount = 0;
        let duplicateCount = 0;
        processTokensBtn.disabled = true;
        processTokensBtn.textContent = 'Processing...';
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
                    id: generateRandomId(),
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
                ? `${successCount}件保存、${duplicateCount}件は重複のためスキップしました`
                : `${successCount}件のトークンを保存しました`;
            showBulkResultMessage(msg);
            if (bulkTokenInput) bulkTokenInput.value = '';
            if (accountListContainer.classList.contains('open')) {
                renderSavedAccounts();
            }
        } catch (error) {
            showBulkResultMessage(`エラーが発生しました: ${error.message}`);
        } finally {
            processTokensBtn.disabled = false;
            processTokensBtn.textContent = 'Process Tokens';
        }
    }

    function generateRandomId() {
        return Date.now().toString() + Math.random().toString(36).substr(2, 9);
    }

    function showBulkResultMessage(message) {
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

    function showBulkProgress(show) {
        if (show) {
            bulkProgress.classList.remove('hidden');
            bulkResult.classList.add('hidden');
        } else {
            bulkProgress.classList.add('hidden');
        }
    }

    function updateProgress(current, total) {
        progressCount.textContent = current;
        progressTotal.textContent = total;
        const percentage = (current / total) * 100;
        progressFill.style.width = percentage + '%';
    }

    function showBulkResult(message, type = 'info') {
        bulkResult.classList.remove('hidden');
        const resultText = bulkResult.querySelector('.result-text');
        resultText.textContent = message;

        bulkResult.className = 'bulk-result ' + type;

        if (type === 'error') {
            bulkResult.style.borderLeftColor = '#f23f42';
        } else if (type === 'success') {
            bulkResult.style.borderLeftColor = '#3ba55c';
        } else if (type === 'warning') {
            bulkResult.style.borderLeftColor = '#faa61a';
        } else {
            bulkResult.style.borderLeftColor = '#5865f2';
        }
    }

    if (saveMemoBtn) {
        saveMemoBtn.addEventListener('click', async () => {
            if (currentEditingAccountId && memoInput) {
                const memoText = memoInput.value.trim();
                await updateAccountStatus(currentEditingAccountId, { memo: memoText });
                closeMemoModal();
                if (accountListContainer.classList.contains('open')) {
                    renderSavedAccounts();
                }
            }
        });
    }

    if (cancelMemoBtn) {
        cancelMemoBtn.addEventListener('click', () => {
            closeMemoModal();
        });
    }

    if (modalClose) {
        modalClose.addEventListener('click', () => {
            closeMemoModal();
        });
    }

    if (memoModal) {
        memoModal.addEventListener('click', (e) => {
            if (e.target === memoModal) {
                closeMemoModal();
            }
        });
    }

    function openMemoModal(account) {
        if (memoModal && modalAccountName && memoInput) {
            currentEditingAccountId = account.id;
            modalAccountName.textContent = account.global_name || account.username;
            memoInput.value = account.memo || '';
            memoModal.classList.remove('hidden');
            memoInput.focus();
        }
    }

    function closeMemoModal() {
        if (memoModal && memoInput) {
            memoModal.classList.add('hidden');
            currentEditingAccountId = null;
            memoInput.value = '';
        }
    }

    document.addEventListener('keydown', (e) => {
        if (e.key === 'Escape' && memoModal && !memoModal.classList.contains('hidden')) {
            closeMemoModal();
        }
    });

    // Clear All ボタン（二度押しで確認、ポップアップ不使用）
    const clearAllBtn = document.querySelector('#clear-all-btn');
    let clearAllConfirmTimer = null;
    if (clearAllBtn) {
        clearAllBtn.addEventListener('click', () => {
            const confirming = clearAllBtn.dataset.confirm === 'true';
            if (!confirming) {
                clearAllBtn.dataset.confirm = 'true';
                const originalText = clearAllBtn.textContent;
                clearAllBtn.textContent = 'Click again to clear all';
                clearAllBtn.style.backgroundColor = '#d21f2b';
                clearAllConfirmTimer = setTimeout(() => {
                    clearAllBtn.dataset.confirm = 'false';
                    clearAllBtn.textContent = originalText;
                    clearAllBtn.style.backgroundColor = '#f23f42';
                }, 3000);
            } else {
                if (clearAllConfirmTimer) { clearTimeout(clearAllConfirmTimer); }
                clearAllBtn.dataset.confirm = 'false';
                storage.clear(() => {
                    if (tokenInput) tokenInput.value = '';
                    if (bulkTokenInput) bulkTokenInput.value = '';
                    if (accountList) accountList.innerHTML = '';
                    hideError();
                    // トリガー表示のリセット
                    if (accountListContainer) accountListContainer.classList.remove('open');
                    if (bulkImportContainer) bulkImportContainer.classList.remove('open');
                });
                clearAllBtn.textContent = 'Cleared';
                setTimeout(() => { clearAllBtn.textContent = 'Clear All'; }, 1500);
            }
        });
    }
}