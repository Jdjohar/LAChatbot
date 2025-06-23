(function () {
  const widgetDiv = document.createElement('div');
  widgetDiv.id = 'chatbot-widget';
  document.body.appendChild(widgetDiv);

  const widgetScript = document.currentScript;
  const userId = widgetScript.dataset.userId;
  const apiKey = widgetScript.dataset.apiKey;
  const apiUrl = 'https://lachatbot.onrender.com';

  let visitorId = localStorage.getItem('chatbot_visitor_id');
  if (!visitorId) {
    visitorId = 'visitor_' + Math.random().toString(36).substr(2, 9);
    localStorage.setItem('chatbot_visitor_id', visitorId);
  }

  const defaultSettings = {
    theme: '#1e3a8a',
    position: 'bottom-right',
    avatar: '',
    welcomeMessage: 'Hello! How can I assist you today?'
  };

  const notificationSound = new Audio('https://www.soundjay.com/buttons/sounds/button-3.mp3');

  function applyStyles(settings, isMinimized) {
    const style = document.createElement('style');
    style.textContent = `
      #chatbot-widget {
        position: fixed;
        ${settings.position === 'bottom-right' ? 'bottom: 100px; right: 36px;' : 'bottom: 20px; left: 20px;'}
        transition: all 0.3s ease-in-out;
        ${isMinimized ? `
          width: 60px;
          height: 60px;
          background: ${settings.theme};
          border-radius: 50%;
          cursor: pointer;
          display: flex;
          align-items: center;
          justify-content: center;
          z-index: 99999999999;
        ` : `
          width: 340px;
          height: 440px;
          background: #ffffff;
          border-radius: 16px;
          box-shadow: 0 8px 20px rgba(0,0,0,0.2);
          z-index: 100000;
          font-family: 'Segoe UI', sans-serif;
          display: flex;
          flex-direction: column;
        `}
      }
      #chatbot-minimized-img {
        width: 55px;
        height: 55px;
        object-fit: cover;
        border-radius: 50%;
      }
      #chatbot-header {
        background: ${settings.theme};
        color: white;
        padding: 12px;
        border-radius: 16px 16px 0 0;
        display: flex;
        align-items: center;
        justify-content: space-between;
      }
      #chatbot-avatar {
        width: 32px;
        height: 32px;
        border-radius: 50%;
        object-fit: cover;
        margin-right: 10px;
      }
      #chatbot-title {
        flex: 1;
        text-align: center;
        font-weight: bold;
      }
      #chatbot-minimize-btn {
        background: none;
        border: none;
        color: white;
        font-size: 20px;
        cursor: pointer;
      }
      #chatbot-messages {
        flex: 1;
        overflow-y: auto;
        padding: 12px;
        display: flex;
        flex-direction: column;
        gap: 6px;
      }
      #chatbot-input {
        display: flex;
        padding: 10px;
        border-top: 1px solid #e5e7eb;
        background: #f9fafb;
      }
      #chatbot-input input {
        flex: 1;
        padding: 10px;
        border: 1px solid #d1d5db;
        border-radius: 8px;
        font-size: 14px;
      }
      #chatbot-input button {
        padding: 10px 14px;
        margin-left: 6px;
        background: ${settings.theme};
        color: white;
        border: none;
        border-radius: 8px;
        cursor: pointer;
        font-weight: bold;
      }
      .message {
        max-width: 80%;
        word-break: break-word;
        overflow-wrap: break-word;
        white-space: pre-wrap;
        padding: 10px 14px;
        border-radius: 18px;
        display: inline-block;
        animation: fadeIn 0.3s ease-in-out;
        transition: all 0.2s ease-in-out;
        font-size: 14px;
        line-height: 1.4;
      }
      .user {
        align-self: flex-end;
        background: #dcfce7;
        border-bottom-right-radius: 4px;
      }
      .bot {
        align-self: flex-start;
        background: #f3f4f6;
        border-bottom-left-radius: 4px;
      }
      .bot img {
        width: 20px;
        height: 20px;
        border-radius: 50%;
        margin-right: 6px;
      }
      .message a {
        display: inline-block;
        color: ${settings.theme};
        text-decoration: none;
        max-width: 200px;
        overflow: hidden;
        text-overflow: ellipsis;
        white-space: nowrap;
      }
      .message a:hover {
        text-decoration: underline;
      }
      @keyframes fadeIn {
        from { opacity: 0; transform: translateY(4px); }
        to { opacity: 1; transform: translateY(0); }
      }
    `;
    document.head.appendChild(style);
  }

  const scripts = [
    { src: 'https://cdn.jsdelivr.net/npm/react@18.3.1/umd/react.production.min.js', loaded: false },
    { src: 'https://cdn.jsdelivr.net/npm/react-dom@18.3.1/umd/react-dom.production.min.js', loaded: false }
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
          messages: [],
          input: '',
          loading: false,
          isMinimized: true,
          settings: defaultSettings
        };
        this.messagesEndRef = window.React.createRef();
      }

      componentDidMount() {
        this.fetchSettings();
      }

      fetchSettings = async () => {
        try {
          const res = await fetch(`${apiUrl}/widget/settings/${userId}`);
          if (!res.ok) throw new Error('Settings load failed');
          const settings = await res.json();
          this.setState({ settings }, () => {
            applyStyles(settings, this.state.isMinimized);
            if (!this.state.isMinimized) {
              this.addWelcomeMessage();
              this.fetchChats();
            }
          });
        } catch {
          applyStyles(defaultSettings, this.state.isMinimized);
        }
      };

      addWelcomeMessage = () => {
        this.setState(prevState => ({
          messages: [{ sender: 'bot', text: prevState.settings.welcomeMessage }]
        }));
      };

      fetchChats = async () => {
        try {
          const res = await fetch(`${apiUrl}/chats?visitorId=${visitorId}`, {
            headers: { 'X-API-Key': apiKey }
          });
          const chats = await res.json();
          this.setState(prevState => ({
            messages: [
              { sender: 'bot', text: prevState.settings.welcomeMessage },
              ...chats.flatMap(c => [
                { sender: 'user', text: c.message },
                ...(c.reply ? [{ sender: 'bot', text: c.reply }] : [])
              ])
            ]
          }), this.scrollToBottom);
        } catch {
          this.setState(prev => ({
            messages: [...prev.messages, { sender: 'bot', text: 'Failed to load chat history.' }]
          }));
        }
      };

      sendMessage = async () => {
        const { input, messages } = this.state;
        if (!input.trim()) return;

        this.setState({ 
          loading: true, 
          input: '',
          messages: [...messages, { sender: 'user', text: input }]
        }, this.scrollToBottom);

        try {
          const res = await fetch(`${apiUrl}/chat`, {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
              'X-API-Key': apiKey
            },
            body: JSON.stringify({ message: input, visitorId })
          });
          const data = await res.json();
          if (res.ok) {
            notificationSound.play().catch(() => {});
            this.setState(prev => ({
              messages: [...prev.messages, { sender: 'bot', text: data.reply }],
              loading: false
            }), this.scrollToBottom);
          } else {
            this.setState(prev => ({
              messages: [...prev.messages, { sender: 'bot', text: data.reply || 'Server error' }],
              loading: false
            }), this.scrollToBottom);
          }
        } catch {
          this.setState(prev => ({
            messages: [...prev.messages, { sender: 'bot', text: 'Network error.' }],
            loading: false
          }), this.scrollToBottom);
        }
      };

      toggleMinimize = () => {
        this.setState(prev => {
          const minimized = !prev.isMinimized;
          applyStyles(prev.settings, minimized);
          if (!minimized && prev.messages.length === 0) {
            this.addWelcomeMessage();
            this.fetchChats();
          }
          return { isMinimized: minimized };
        });
      };

      scrollToBottom = () => {
        this.messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
      };

      renderMessageText(text) {
        const emailRegex = /\b[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Z|a-z]{2,}\b/g;
        const phoneRegex = /(\+?\d{1,4}[-.\s]?\(?\d{1,3}\)?[-.\s]?\d{1,4}[-.\s]?\d{1,4})/g;
        const urlRegex = /\b(https?:\/\/[^\s<>"']+)|(www\.[^\s<>"']+)\b/g;

        let parts = [], lastIndex = 0;
        const matches = [];

        let match;
        while ((match = emailRegex.exec(text))) matches.push({ type: 'email', value: match[0], index: match.index, length: match[0].length });
        while ((match = phoneRegex.exec(text))) matches.push({ type: 'phone', value: match[0], index: match.index, length: match[0].length });
        while ((match = urlRegex.exec(text))) matches.push({ type: 'url', value: match[0], index: match.index, length: match[0].length });

        matches.sort((a, b) => a.index - b.index);

        matches.forEach(match => {
          if (match.index > lastIndex) parts.push(text.slice(lastIndex, match.index));
          if (match.type === 'email') {
            parts.push(e('a', { href: `mailto:${match.value}` }, match.value));
          } else if (match.type === 'phone') {
            parts.push(e('a', { href: `tel:${match.value.replace(/[-.\s()]/g, '')}` }, match.value));
          } else if (match.type === 'url') {
            const displayText = match.value.length > 30 ? match.value.slice(0, 30) + '…' : match.value;
            const href = match.value.startsWith('www.') ? `https://${match.value}` : match.value;
            parts.push(e('a', {
              href: href,
              target: '_blank',
              rel: 'noopener noreferrer',
              style: {
                maxWidth: '200px',
                overflow: 'hidden',
                textOverflow: 'ellipsis',
                whiteSpace: 'nowrap',
                display: 'inline-block'
              }
            }, displayText));
          }
          lastIndex = match.index + match.length;
        });

        if (lastIndex < text.length) {
          parts.push(text.slice(lastIndex));
        }

        return parts.length > 0 ? parts : text;
      }

      render() {
        const { messages, input, loading, isMinimized, settings } = this.state;
        if (isMinimized) {
          return e('div', { onClick: this.toggleMinimize }, [
            e('img', {
              id: 'chatbot-minimized-img',
              src: settings.avatar || 'https://jdwebservices.com/lavedaa/wp-content/uploads/2025/06/vicon.png',
              alt: 'Chatbot'
            })
          ]);
        }
        return e('div', null, [
          e('div', { id: 'chatbot-header' }, [
            settings.avatar ? e('img', { id: 'chatbot-avatar', src: settings.avatar, alt: 'Avatar' }) : null,
            e('span', { id: 'chatbot-title' }, 'Ask LV'),
            e('button', { id: 'chatbot-minimize-btn', onClick: this.toggleMinimize }, '−')
          ]),
          e('div', { id: 'chatbot-messages' },
            messages.map((msg, i) =>
              e('div', { key: i, className: `message ${msg.sender}` }, [
                msg.sender === 'bot' && settings.avatar ? e('img', { src: settings.avatar, alt: 'Bot' }) : null,
                e('span', null, this.renderMessageText(msg.text))
              ])
            ),
            loading ? e('div', { className: 'message bot' }, 'Typing...') : null,
            e('div', { ref: this.messagesEndRef })
          ),
          e('div', { id: 'chatbot-input' }, [
            e('input', {
              type: 'text',
              value: input,
              onChange: e => this.setState({ input: e.target.value }),
              onKeyPress: e => e.key === 'Enter' && this.sendMessage(),
              placeholder: 'Type your message...',
              disabled: loading
            }),
            e('button', { onClick: this.sendMessage, disabled: loading }, 'Send')
          ])
        ]);
      }
    }

    window.ReactDOM.render(e(ChatbotWidget), widgetDiv);
  }

  function onScriptLoad() {
    scriptsLoaded++;
    if (scriptsLoaded === scripts.length) {
      renderWidget();
    }
  }

  function onScriptError() {
    widgetDiv.innerHTML = '<div style="padding: 10px; color: red;">Failed to load chatbot dependencies.</div>';
  }

  scripts.forEach(script => {
    const tag = document.createElement('script');
    tag.src = script.src;
    tag.async = true;
    tag.onload = () => {
      script.loaded = true;
      onScriptLoad();
    };
    tag.onerror = onScriptError;
    document.head.appendChild(tag);
  });
})();
