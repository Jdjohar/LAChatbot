// chatbot-widget.js
(function () {
  const widgetDiv = document.createElement('div');
  widgetDiv.id = 'chatbot-widget';
  document.body.appendChild(widgetDiv);

  const widgetScript = document.currentScript;
  const userId = widgetScript.dataset.userId;
  const apiKey = widgetScript.dataset.apiKey;
  const apiUrl = 'https://lachatbot.onrender.com';
  // const apiUrl = 'http://localhost:3000';

  let visitorId = localStorage.getItem('chatbot_visitor_id');
  if (!visitorId) {
    visitorId = 'visitor_' + Math.random().toString(36).substr(2, 9);
    localStorage.setItem('chatbot_visitor_id', visitorId);
  }

  const defaultSettings = {
    theme: '#1e3a8a',
    position: 'bottom-right',
    avatar: 'https://www.lavedaa.com/wp-content/uploads/2025/07/item.png',
    welcomeMessage: 'Welcome to La Vedaa, I’m your Ayurvedic wellness expert, how can I help you?'
  };

  (function injectDefaultStyles() {
    const style = document.createElement('style');
    style.textContent = `
      #chatbot-widget {
        position: fixed;
        ${defaultSettings.position === 'bottom-right' ? 'bottom: 100px; right: 36px;' : 'bottom: 20px; left: 20px;'}
        width: 60px;
        height: 60px;
        border-radius: 50%;
        cursor: pointer;
        display: flex;
        align-items: center;
        justify-content: center;
        z-index: 999999999;
      }
      @keyframes fadeIn {
        from { opacity: 0; transform: scale(0.95); }
        to { opacity: 1; transform: scale(1); }
      }
      #chatbot-minimized-img {
        width: 55px;
        height: 55px;
        object-fit: cover;
        border: 2px solid #fff;
        box-shadow: 2px 2px 10px #cfcfcf;
        border-radius: 50%;
      }
      #chatbot-online-dot {
        position: absolute;
        bottom: 6px;
        right: 6px;
        width: 14px;
        height: 14px;
        background-color: #10b981;
        border: 2px solid white;
        border-radius: 50%;
        z-index: 1000000;
      }
      /* Add more CSS here as per default applyStyles for minimized */
    `;
    document.head.appendChild(style);
  })();


  function applyStyles(settings, isMinimized) {
    const style = document.createElement('style');
    style.textContent = `
      #chatbot-widget {
        position: fixed;
        ${settings.position === 'bottom-right' ? 'bottom: 100px; right: 36px;' : 'bottom: 20px; left: 20px;'}
        ${isMinimized ? `
          width: 60px;
          height: 60px;
          border-radius: 50%;
          cursor: pointer;
          display: flex;
          align-items: center;
          justify-content: center;
          z-index: 999999999;
        ` : `
          width: 320px;
          height: 520px;
          background: #fff;
          border-radius: 12px;
          box-shadow: 0 6px 12px rgba(0,0,0,0.2);
          z-index: 1000;
          font-family: "Segoe UI", sans-serif;
          display: flex;
          flex-direction: column;
          animation: fadeIn 0.3s ease;
        `}
      }
      @keyframes fadeIn {
        from { opacity: 0; transform: scale(0.95); }
        to { opacity: 1; transform: scale(1); }
      }
      #chatbot-minimized-img {
        width: 55px;
        height: 55px;
        object-fit: cover;
        border: 2px solid #fff;
        box-shadow: 2px 2px 10px #cfcfcf;
        border-radius: 50%;
      }
      #chatbot-online-dot {
        position: absolute;
        bottom: 6px;
        right: 6px;
        width: 14px;
        height: 14px;
        background-color: #10b981;
        border: 2px solid white;
        border-radius: 50%;
        z-index: 1000000;
      }
      #chatbot-header {
        background: ${settings.theme};
        color: white;
        padding: 10px;
        border-radius: 12px 12px 0 0;
        display: flex;
        align-items: center;
        justify-content: space-between;
      }
      #chatbot-avatar {
        width: 30px;
        height: 30px;
        border-radius: 50%;
        object-fit: cover;
        margin-right: 10px;
      }
      #chatbot-title {
        flex: 1;
        text-align: center;
        font-weight: 600;
      }
      #chatbot-minimize-btn {
        background: none;
        border: none;
        color: white;
        font-size: 18px;
        cursor: pointer;
      }
      #chatbot-messages {
        flex: 1;
        height: 320px;
        overflow-y: auto;
        padding: 10px;
        display: flex;
        flex-direction: column;
      }
      #chatbot-input {
        display: flex;
        padding: 10px;
        border-top: 1px solid #ddd;
        flex-direction: column;
        gap: 5px;
      }
      #chatbot-input input {
        flex: 1;
        padding: 8px;
        border: 1px solid #ddd;
        border-radius: 5px;
        font-size: 14px;
      }
      #chatbot-input button {
        padding: 8px 12px;
        background: ${settings.theme};
        color: white;
        border: none;
        border-radius: 5px;
        cursor: pointer;
      }
      .message {
        margin: 5px 0;
        padding: 8px 10px;
        border-radius: 8px;
        display: inline-block;
        max-width: 85%;
        word-break: break-word;
      }
      .user {
        background: #000;
        align-self: flex-end;
        color: #fff;
      }
      .bot {
        background: #f2f2f2;
        color: #000;
        align-self: flex-start;
      }
      .message a {
        color: ${settings.theme};
        text-decoration: underline;
      }
      .quick-buttons button {
        margin: 4px;
        padding: 0px 12px;
        background-color: ${settings.theme};
        color: white;
        border: none;
        border-radius: 5px;
        cursor: pointer;
      }
    `;
    document.head.appendChild(style);
  }

  const scripts = [
    { src: 'https://cdn.jsdelivr.net/npm/react@18.3.1/umd/react.production.min.js' },
    { src: 'https://cdn.jsdelivr.net/npm/react-dom@18.3.1/umd/react-dom.production.min.js' }
  ];

  let scriptsLoaded = 0;

  function renderWidget() {
    if (!window.React || !window.ReactDOM) {
      widgetDiv.innerHTML = '<div style="padding: 10px; color: red;">Failed to load chatbot dependencies.</div>';
      return;
    }

    const e = window.React.createElement;
    class ChatbotWidget extends window.React.Component {
      constructor(props) {
        super(props);
        this.state = {
          messages: [{ sender: 'bot', text: defaultSettings.welcomeMessage }],
          input: '',
          loading: false,
          isMinimized: true,
          keywords: [],
          showQuickButtons: true,
          settings: defaultSettings
        };
        this.messagesEndRef = window.React.createRef();
      }

      scrollToBottom = () => {
        this.messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
      };
      componentDidMount() {
        this.fetchKeywords();
        const saved = localStorage.getItem('chatbot_messages');
        if (saved) {
          this.setState({ messages: JSON.parse(saved) });
        } else {
          this.setState({
            messages: [{ sender: 'bot', text: defaultSettings.welcomeMessage }],
            showQuickButtons: true
          });
        }
      }
      handleButton = (type) => {
        let reply;
        if (type === 'men') {
          reply = `Here are our men’s products:<br>
          - La Vedaa Men Care Capsules – <a href="https://www.lavedaa.com/product/men-care-capsules/" target="_blank">View</a><br>
          - La Vedaa Men Care & Energy Booster Combo – <a href="https://www.lavedaa.com/product/combo-of-men-care-energy-booster-capsules/" target="_blank">View</a><br>
          - La Vedaa Energy Booster Capsules – <a href="https://www.lavedaa.com/product/energy-booster-capsules/" target="_blank">View</a>
          - La Vedaa Deep Sleep Capsules – <a href="https://www.lavedaa.com/product/deep-sleep-capsules/" target="_blank">View</a><br>
          - La Vedaa Happy Heart Capsules – <a href="https://www.lavedaa.com/product/happy-heart-capsules/" target="_blank">View</a><br>
    `;
        } else {
          reply = `Here are our women’s products:<br>
          - La Vedaa Women Care Capsules – <a href="https://www.lavedaa.com/product/women-care-capsules/" target="_blank">View</a><br>
          - La Vedaa Women Care & Energy Booster Combo – <a href="https://www.lavedaa.com/product/combo-of-women-care-energy-booster-capsules/" target="_blank">View</a><br>
          - La Vedaa Energy Booster Capsules – <a href="https://www.lavedaa.com/product/energy-booster-capsules/" target="_blank">View</a>
          - La Vedaa Deep Sleep Capsules – <a href="https://www.lavedaa.com/product/deep-sleep-capsules/" target="_blank">View</a><br>
          - La Vedaa Happy Heart Capsules – <a href="https://www.lavedaa.com/product/happy-heart-capsules/" target="_blank">View</a><br>
    `;
        }

        this.setState(prev => ({
          messages: [...prev.messages, { sender: 'user', text: type }, { sender: 'bot', text: reply }],
          showQuickButtons: false  // ✅ hide after selection
        }), this.scrollToBottom);
      };


      fetchKeywords = async () => {
        try {
          const response = await fetch('https://lachatbot.onrender.com/admin/keywords');
          const data = await response.json();
          if (data.success && Array.isArray(data.keywords)) {
            this.setState({ keywords: data.keywords });
          }
        } catch (err) {
          console.error("Failed to fetch keywords:", err);
        }
      };
handleInput = () => {
  const { input, messages, keywords } = this.state;
  if (!input.trim()) return; // avoid empty messages

  const lowerInput = input.toLowerCase();
  let matched = null;

  // Step 1: Check greetings
  const greetings = ['hello', 'hi', 'hey', 'namaste'];
  if (greetings.some(greet => lowerInput.includes(greet))) {
    matched = "Hello! 👋 I’m your Ayurvedic wellness expert. Are you looking for products for men or women, or do you have a specific health concern?";
  }

  const productLinks = {
    "La Vedaa Deep Sleep Capsules": "https://www.lavedaa.com/product/deep-sleep-capsules/",
    "La Vedaa Men Care Capsules": "https://www.lavedaa.com/product/men-care-capsules/",
    "La Vedaa Men Care & Energy Booster Combo": "https://www.lavedaa.com/product/combo-of-men-care-energy-booster-capsules/",
    "La Vedaa Happy Heart Capsules": "https://www.lavedaa.com/product/happy-heart-capsules/",
    "La Vedaa Energy Booster Capsules": "https://www.lavedaa.com/product/energy-booster-capsules/",
    "La Vedaa Women Care Capsules": "https://www.lavedaa.com/product/women-care-capsules/",
    "La Vedaa Women Care & Energy Booster Combo": "https://www.lavedaa.com/product/combo-of-women-care-energy-booster-capsules/"
  };

  // Step 2: Check keywords if no greeting matched
  if (!matched) {
    for (const keyword of keywords) {
      if (lowerInput.includes(keyword.phrase.toLowerCase())) {
        const url = productLinks[keyword.product];
        if (url) {
          matched = `Wow, yes!, We recommend our <b>${keyword.product}</b> – <a href="${url}" target="_blank">View</a>`;
        } else {
          matched = `Wow, yes!, We recommend our <b>${keyword.product}</b>.`;
        }
        break;
      }
    }
  }

  // Step 3: Fallback message
  const botReply = matched || "I'm sorry; I don't have information regarding this.";

  // Add user message and placeholder immediately
  this.setState({
    input: '',
    messages: [...messages, { sender: 'user', text: input }, { sender: 'bot', text: '...' }],
    showQuickButtons: false // Temporarily hide quick buttons during loading
  }, () => {
    this.scrollToBottom();

    // After 1500ms delay, update messages and showQuickButtons
    setTimeout(() => {
      this.setState(prevState => {
        const newMessages = [...prevState.messages];
        // Find the last bot message which is '...' and replace it
        for (let i = newMessages.length - 1; i >= 0; i--) {
          if (newMessages[i].sender === 'bot' && newMessages[i].text === '...') {
            newMessages[i].text = botReply;
            break;
          }
        }
        // Save messages to localStorage here after update
        localStorage.setItem('chatbot_messages', JSON.stringify(newMessages));
        // Save to DB here after update
        saveChatToDB(userId, visitorId, input, botReply);
        return { 
          messages: newMessages,
          showQuickButtons: matched && greetings.some(greet => lowerInput.includes(greet)) ? true : !matched // Update quick buttons after delay
        };
      }, this.scrollToBottom);
    }, 1500); // 1.5 seconds delay before showing actual reply and quick buttons
  });
};




      render() {
        const { messages, input, isMinimized, settings } = this.state;
        if (isMinimized) {
          return e('div', { onClick: () => this.setState({ isMinimized: false }, () => applyStyles(settings, false)) }, [
            e('div', { style: { position: 'relative', width: '60px', height: '60px', cursor: 'pointer' } }, [
              // Avatar Image
              e('img', {
                id: 'chatbot-minimized-img',
                src: settings.avatar,
                alt: 'Chatbot',
                style: { width: '60px', height: '60px', borderRadius: '50%', position: 'absolute', top: 0, left: 0, zIndex: 1 }
              }),
              // SVG curved text - single instance, bigger font, slightly outside circle
              e('svg', {
                width: 120,
                height: 120,
                viewBox: '0 0 120 120',
                style: { position: 'absolute', top: -27, left: -27, zIndex: 2, pointerEvents: 'none' }
              }, [
                e('defs', null, [
                  e('path', { id: 'circlePath', d: 'M60,60 m-45,0 a45,45 0 1,1 90,0 a45,45 0 1,1 -90,0' }),
                  e('linearGradient', { id: 'textGradient', x1: '0%', y1: '0%', x2: '100%', y2: '0%' }, [
                    e('stop', { offset: '0%', style: { stopColor: '#016a6d', stopOpacity: 1 } }),
                    e('stop', { offset: '100%', style: { stopColor: '#016a6d', stopOpacity: 1 } })
                  ])
                ]),
                e('text', {
                  fontSize: 20,
                  fontWeight: '900',
                  fontFamily: '"Segoe UI", "Poppins", sans-serif',
                  textAnchor: 'middle',
                  fill: 'url(#textGradient)',
                  stroke: '#ffffff',          // White border
                  strokeWidth: 0.6,           // Thickness of the border
                  style: {
                    filter: 'drop-shadow(0 1px 1px rgba(0,0,0,0.4))',
                    textTransform: 'uppercase'
                  }
                }, [
                  e('textPath', { href: '#circlePath', startOffset: '25%' }, 'ASK LV')
                ])
              ])

            ]),
            e('div', { id: 'chatbot-online-dot' })
          ]);
        }



        return e('div', null, [
          e('div', { id: 'chatbot-header' }, [
            e('img', { id: 'chatbot-avatar', src: settings.avatar }),
            e('span', { id: 'chatbot-title' }, 'Ask LV'),
            e('button', { id: 'chatbot-minimize-btn', onClick: () => this.setState({ isMinimized: true }, () => applyStyles(settings, true)) }, '×')
          ]),
          e('div', { id: 'chatbot-messages' }, [
            ...messages.map((msg, i) =>
              e('div', { key: i, className: `message ${msg.sender}` }, e('span', { dangerouslySetInnerHTML: { __html: msg.text.replace(/\n/g, '<br>') } }))
            ),
            this.state.showQuickButtons && e('div', { className: 'quick-buttons' }, [
              e('button', { onClick: () => this.handleButton('men') }, 'Men'),
              e('button', { onClick: () => this.handleButton('women') }, 'Women')
            ]),
            e('div', { ref: this.messagesEndRef })
          ]),
          e('button', {
            onClick: () => {
              localStorage.removeItem('chatbot_messages');
              this.setState({
                messages: [{ sender: 'bot', text: defaultSettings.welcomeMessage }],
                showQuickButtons: true
              });
            },
            style: {
              padding: '0px 0px',
              margin: '12px auto',
              backgroundColor: '#1e3a8a',    // your theme color
              color: '#fff',
              border: 'none',
              borderRadius: '24px',
              cursor: 'pointer',
              fontWeight: '600',
              fontSize: '14px',
              boxShadow: '0 4px 8px rgba(30, 58, 138, 0.3)',
              transition: 'background-color 0.3s ease',
              display: 'block',
              textAlign: 'center',
              width: '140px',
            },
            onMouseEnter: e => e.currentTarget.style.backgroundColor = '#153a75',
            onMouseLeave: e => e.currentTarget.style.backgroundColor = '#1e3a8a'
          }, 'Reset Chat'),
          e('div', { id: 'chatbot-input' }, [
            e('input', {
              type: 'text', value: input,
              onChange: e => this.setState({ input: e.target.value }),
              onKeyPress: e => e.key === 'Enter' && this.handleInput(),
              placeholder: 'Type your message...'
            }),
            e('button', { onClick: this.handleInput }, 'Send')
          ])
        ]);
      }
    }

    window.ReactDOM.render(e(ChatbotWidget), widgetDiv);
  }
  function saveChatToDB(userId, visitorId, message, reply) {
    fetch(`${apiUrl}/save-chat`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': apiKey
      },
      body: JSON.stringify({
        userId,
        visitorId,
        message,
        reply
      })
    }).catch(err => console.error('Save chat error:', err));
  }
  function onScriptLoad() {
    scriptsLoaded++;
    if (scriptsLoaded === scripts.length) {
      renderWidget();
    }
  }

  // Load required scripts
  scripts.forEach(scriptData => {
    const script = document.createElement('script');
    script.src = scriptData.src;
    script.onload = onScriptLoad;
    script.onerror = () => {
      console.error(`Failed to load script: ${scriptData.src}`);
    };
    document.head.appendChild(script);
  });
})();