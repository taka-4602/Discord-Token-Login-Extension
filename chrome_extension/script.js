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
    const errorMessage = document.querySelector('#error-message');

    chrome.storage.local.get(['isSaveEnabled'], (result) => {
        saveToggle.checked = result.isSaveEnabled || false;
    });

    saveToggle.addEventListener('change', () => {
        chrome.storage.local.set({ isSaveEnabled: saveToggle.checked });
    });

    savedAccountsTrigger.addEventListener('click', () => {
        const isOpen = accountListContainer.classList.contains('open');
        
        if (!isOpen) {
            renderSavedAccounts();
            accountListContainer.classList.add('open');
            savedAccountsTrigger.textContent = 'Hide Saved Accounts ▲';
        } else {
            accountListContainer.classList.remove('open');
            savedAccountsTrigger.textContent = 'Show Saved Accounts ▼';
        }
    });

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
    });

    function login(token) {
        window.open("https://discord.com/channels/@me?discordtoken=" + token, '_blank');
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
            }

            accounts.forEach(acc => {
                const item = document.createElement('div');
                item.className = 'account-item';
                
                item.innerHTML = `
                    <img src="${acc.avatar}" class="account-avatar" alt="icon">
                    <div class="account-info">
                        <span class="account-username">${acc.global_name || acc.username}</span>
                        <span class="account-id">${acc.username}</span>
                    </div>
                    <div class="delete-btn" title="Remove">×</div>
                `;

                const deleteBtn = item.querySelector('.delete-btn');

                deleteBtn.addEventListener('click', (e) => {
                    e.stopPropagation();

                    item.classList.add('deleting');

                    setTimeout(() => {
                        removeAccount(acc.id);
                    }, 500);
                });

                item.addEventListener('click', () => {
                    login(acc.token);
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
}