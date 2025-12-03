if (document.querySelector('.discord-token-login-popup')) {

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
    const errorMessage = document.querySelector('#error-message');    // 大量インポート関連の要素
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
    
    // メモ機能関連の要素
    const memoModal = document.querySelector('#memo-modal');
    const modalAccountName = document.querySelector('#modal-account-name');
    const memoInput = document.querySelector('#memo-input');
    const saveMemoBtn = document.querySelector('#save-memo-btn');
    const cancelMemoBtn = document.querySelector('#cancel-memo-btn');
    const modalClose = document.querySelector('.modal-close');
    
    let currentEditingAccountId = null;

    // デバッグ用：要素の存在確認
    console.log('Elements found:', {
        bulkImportTrigger: !!bulkImportTrigger,
        bulkImportContainer: !!bulkImportContainer,
        accountListContainer: !!accountListContainer,
        savedAccountsTrigger: !!savedAccountsTrigger
    });

    chrome.storage.local.get(['isSaveEnabled'], (result) => {
        saveToggle.checked = result.isSaveEnabled || false;
    });

    saveToggle.addEventListener('change', () => {
        chrome.storage.local.set({ isSaveEnabled: saveToggle.checked });
    });    savedAccountsTrigger.addEventListener('click', () => {
        const isOpen = accountListContainer.classList.contains('open');
        
        if (!isOpen) {
            renderSavedAccounts();
            accountListContainer.classList.add('open');
            savedAccountsTrigger.textContent = 'Hide Saved Accounts ▲';
            // 大量インポートが開いていたら閉じる
            if (bulkImportContainer && bulkImportContainer.classList.contains('open')) {
                bulkImportContainer.classList.remove('open');
                if (bulkImportTrigger) {
                    bulkImportTrigger.textContent = 'Bulk Import Tokens ▼';
                }
            }
        } else {
            accountListContainer.classList.remove('open');
            savedAccountsTrigger.textContent = 'Show Saved Accounts ▼';
        }
    });// 大量インポート機能のイベントリスナー
    if (bulkImportTrigger && bulkImportContainer) {
        bulkImportTrigger.addEventListener('click', () => {
            const isOpen = bulkImportContainer.classList.contains('open');
            
            if (!isOpen) {
                bulkImportContainer.classList.add('open');
                bulkImportTrigger.textContent = 'Hide Bulk Import ▲';
                // アカウント一覧が開いていたら閉じる
                if (accountListContainer && accountListContainer.classList.contains('open')) {
                    accountListContainer.classList.remove('open');
                    if (savedAccountsTrigger) {
                        savedAccountsTrigger.textContent = 'Show Saved Accounts ▼';
                    }
                }
            } else {
                bulkImportContainer.classList.remove('open');
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
    }    if (processTokensBtn && bulkTokenInput) {
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
            // const isAlreadySaved = await checkTokenExists(token);
            // if (!isAlreadySaved) {
            const success = await fetchAndSaveUser(token);
            //    if (!success) return; 
            // } else {
            //    console.log("Token already saved");
            // }
            if (!success) return;
        }

        login(token);
    });    function login(token, accountId = null) {
        // ログイン試行を記録
        if (accountId) {
            recordLoginAttempt(accountId, token);
        }
        
        window.open("https://discord.com/channels/@me?discordtoken=" + token, '_blank');
    }

    async function recordLoginAttempt(accountId, token) {
        try {
            // 簡単なトークン検証を試行（ただし失敗しても続行）
            const response = await fetch('https://discord.com/api/v9/users/@me', {
                headers: { 'Authorization': token }
            });
            
            if (!response.ok) {
                // ログイン失敗を記録
                await updateAccountStatus(accountId, { loginFailed: true });
                setTimeout(() => {
                    if (accountListContainer.classList.contains('open')) {
                        renderSavedAccounts();
                    }
                }, 2000); // 2秒後に再描画してmissステータスを表示
            } else {
                // 成功した場合はmissフラグを削除
                await updateAccountStatus(accountId, { loginFailed: false });
            }
        } catch (error) {
            // エラーの場合もmissとして記録
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
            chrome.storage.local.get(['accounts'], (result) => {
                let accounts = result.accounts || [];
                const accountIndex = accounts.findIndex(acc => acc.id === accountId);
                
                if (accountIndex !== -1) {
                    accounts[accountIndex] = { ...accounts[accountIndex], ...statusUpdate };
                    chrome.storage.local.set({ accounts: accounts }, resolve);
                } else {
                    resolve();
                }
            });
        });
    }

    // function checkTokenExists(token) {
    //     return new Promise((resolve) => {
    //         chrome.storage.local.get(['accounts'], (result) => {
    //             const accounts = result.accounts || [];
    //             const exists = accounts.some(acc => acc.token === token);
    //             resolve(exists);
    //         });
    //     });
    // }

    async function fetchAndSaveUser(token) {
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
            
            const userInfo = {
                id: data.id,
                username: data.username,
                global_name: data.global_name,
                avatar: avatarUrl,
                token: token,
                savedAt: Date.now()
            };

            await saveToStorage(userInfo);
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
            if(!errorMessage.classList.contains('visible')) errorMessage.textContent = '';
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
            chrome.storage.local.get(['accounts'], (result) => {
                let accounts = result.accounts || [];
                const existingIndex = accounts.findIndex(acc => acc.id === newAccount.id);

                if (existingIndex !== -1) {
                    accounts[existingIndex] = newAccount;
                } else {
                    accounts.push(newAccount);
                }

                chrome.storage.local.set({ accounts: accounts }, resolve);
            });
        });
    }

    function renderSavedAccounts() {
        accountList.innerHTML = '';
        
        chrome.storage.local.get(['accounts'], (result) => {
            const accounts = result.accounts || [];
            
            if (accounts.length === 0) {
                accountList.innerHTML = '<div style="padding:10px; font-size:12px; text-align:center; color:#949ba4;">No accounts saved</div>';
                return;
            }            accounts.forEach(acc => {
                const item = document.createElement('div');
                item.className = 'account-item';
                
                // メモがある場合のクラス追加
                if (acc.memo) {
                    item.classList.add('has-memo');
                }
                
                // インポートされたトークンかどうかで表示を変える
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
                `;                const deleteBtn = item.querySelector('.delete-btn');
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
                    // メモアイコンや削除ボタンがクリックされた場合はログインしない
                    if (!e.target.classList.contains('memo-icon') && 
                        !e.target.classList.contains('delete-btn')) {
                        login(acc.token, acc.id);
                    }
                });

                accountList.appendChild(item);
            });
        });
    }

    function removeAccount(userId) {
        chrome.storage.local.get(['accounts'], (result) => {
            let accounts = result.accounts || [];
            accounts = accounts.filter(acc => acc.id !== userId);
            chrome.storage.local.set({ accounts: accounts }, () => {
                renderSavedAccounts();
            });
        });
    }

    // 大量トークン処理用の関数群
    function parseTokens(text) {
        const tokens = [];
        const lines = text.split(/\r?\n/);
        
        for (const line of lines) {
            const trimmedLine = line.trim();
            if (!trimmedLine || trimmedLine.startsWith('#') || trimmedLine.startsWith('//')) {
                continue; // 空行やコメント行をスキップ
            }
            
            // 各種フォーマットに対応
            let lineTokens = [];
            
            // カンマ区切り: token,token
            if (trimmedLine.includes(',')) {
                lineTokens = trimmedLine.split(',');
            }
            // スラッシュ区切り: token/token
            else if (trimmedLine.includes('/')) {
                lineTokens = trimmedLine.split('/');
            }
            // スペース区切り: token token
            else if (trimmedLine.includes(' ')) {
                lineTokens = trimmedLine.split(/\s+/);
            }
            // 単一トークン
            else {
                lineTokens = [trimmedLine];
            }
            
            // トークンを整形して追加
            for (const token of lineTokens) {
                const cleanToken = token.trim().replace(/^["']|["']$/g, '');
                if (cleanToken && cleanToken.length > 20) { // 最小長チェック
                    tokens.push(cleanToken);
                }
            }
        }
        
        // 重複を除去
        return [...new Set(tokens)];
    }

    async function processBulkTokens(tokens) {
        let successCount = 0;
        
        processTokensBtn.disabled = true;
        processTokensBtn.textContent = 'Processing...';
        
        try {
            for (let i = 0; i < tokens.length; i++) {
                const token = tokens[i];
                
                // 検証なしで直接保存
                const userInfo = {
                    id: generateRandomId(),
                    username: `ImportedToken${i + 1}`,
                    global_name: `Imported Token ${i + 1}`,
                    avatar: null,
                    token: token,
                    savedAt: Date.now(),
                    imported: true // インポートされたトークンであることを示すフラグ
                };

                await saveToStorage(userInfo);
                successCount++;
            }
            
            // 結果表示
            showBulkResultMessage(`${successCount}件のトークンを保存しました`);
            
            // アカウント一覧を更新
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
        // 簡易的な結果表示（既存のエラーメッセージ要素を活用）
        if (errorMessage) {
            errorMessage.textContent = message;
            errorMessage.style.color = '#3ba55c'; // 成功色
            errorMessage.classList.add('visible');
            
            setTimeout(() => {
                errorMessage.classList.remove('visible');
                errorMessage.style.color = '#f23f42'; // 元の色に戻す
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
        
        // 結果タイプに応じてスタイルを変更
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

    // メモ機能のイベントリスナー
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

    // モーダルの外側クリックで閉じる
    if (memoModal) {
        memoModal.addEventListener('click', (e) => {
            if (e.target === memoModal) {
                closeMemoModal();
            }
        });
    }

    // メモ機能の関数群
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

    // Escキーでモーダルを閉じる
    document.addEventListener('keydown', (e) => {
        if (e.key === 'Escape' && memoModal && !memoModal.classList.contains('hidden')) {
            closeMemoModal();
        }
    });
}