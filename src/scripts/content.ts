console.log('[CONTENT] OFCombine v7');

const observer = () => {
    chrome.runtime.sendMessage({ ping: true }, (response) => { });

    setTimeout(observer, 100);
};

observer();