import OpenAI from 'openai';

const getObjectFromLocalStorage = async function (key) {
    return new Promise((resolve, reject) => {
        try {
            chrome.storage.local.get(key, function (value) {
                resolve(value[key]);
            });
        } catch (ex) {
            reject(ex);
        }
    });
};

const saveObjectInLocalStorage = async function(obj) {
    return new Promise((resolve, reject) => {
      try {
        chrome.storage.local.set(obj, function() {
          resolve();
        });
      } catch (ex) {
        reject(ex);
      }
    });
};

let api_key = await getObjectFromLocalStorage("apiKey");
console.log("api_key", api_key);
const openai = new OpenAI({ apiKey: api_key, dangerouslyAllowBrowser: true });

async function sendPageContent() {
    const textContent = document.body.innerText;
    let text = window.location.href + '\n' + textContent.substring(0, 2000);
    
    // Retrieve the custom prompt, or use the default if not set
    let customPrompt = await getObjectFromLocalStorage("customPrompt");
    let promptTemplate = customPrompt || `
    You are a productivity app, designed to block distractions and keep users focused on their tasks.
    It's obvious what content should be blocked: social media, entertainment, news, and any other non-productive distractions.
	Technical content should be allowed.
    Should a web page with the following url and content be blocked? Answer only YES or NO, followed by a newline and a brief explanation.
    ===
    `;

    let prompt = promptTemplate + text;

    console.log('prompt:', prompt);

    let model = await getObjectFromLocalStorage("model") || 'gpt-3.5-turbo';
    console.log("use model", model);

    const completion = await openai.chat.completions.create({
        messages: [{ role: 'user', content: prompt }],
        model: model,
    });

    let a = completion.choices[0].message.content;
    let info = a.split('\n').slice(1).join('\n');
    let do_block = a.includes("YES");

    console.log("chat response:", a, info, a.split('\n'));

    saveObjectInLocalStorage({
        [window.location.href]: {
                href: window.location.href,
                decision: do_block,
                info: info.trim() 
            }
        });

    console.log("block?", do_block);

    if (do_block) {
        blockPage(info, window.location.href);
    }
}

function blockPage(info, href) {
    window.stop();
    document.querySelector('head').innerHTML = "";
    document.querySelector('body').innerHTML = `
    <div>
        <h1>This page was blocked to keep you focused</h1>
        <h3>${href}, reason for the block:</h3>
        <p>${info}<\p>
    </div>
    `;
}

let cached = await getObjectFromLocalStorage(window.location.href);
console.log("check cached", cached);

if (cached) {
    if (cached.decision) {
        blockPage(cached.info, cached.href);
    }
} else {
    if (document.readyState === 'complete') {
        console.log('Page is already loaded, sending message immediately')
        sendPageContent();
    } else {
        console.log('Page is not loaded, waiting for load event')
        window.addEventListener('load', sendPageContent);
    }
}

