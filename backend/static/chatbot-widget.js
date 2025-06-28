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
    avatar: '',
    welcomeMessage: 'Hello! How can I assist you today?'
  };

  function applyStyles(settings, isMinimized) {
    const style = document.createElement('style');
    style.textContent = `
      #chatbot-widget {
        position: fixed;
        ${settings.position === 'bottom-right' ? 'bottom: 100px; right: 36px;' : 'bottom: 20px; left: 20px;'}
        ${isMinimized ? `
          width: 60px;
          height: 60px;
          background: ${settings.theme};
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
        border-radius: 50%;
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
        scrollbar-width: thin;
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
      .message strong {
        font-weight: bold;
      }
      .message a {
        color: ${settings.theme};
        text-decoration: underline;
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
    if (!window.React || !window.ReactDOM || !window.React.Component) {
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
          const settings = await res.json();
          this.setState({ settings }, () => {
            applyStyles(settings, this.state.isMinimized);
          });
        } catch {
          applyStyles(defaultSettings, this.state.isMinimized);
        }
      };

      addWelcomeMessage = () => {
        this.setState(prev => ({
          messages: [{ sender: 'bot', text: prev.settings.welcomeMessage }]
        }), this.scrollToBottom);
      };

      fetchChats = async () => {
        try {
          const res = await fetch(`${apiUrl}/chats?visitorId=${visitorId}`, {
            headers: { 'X-API-Key': apiKey }
          });
          const chats = await res.json();
          const history = chats.flatMap(c => [
            { sender: 'user', text: c.message },
            ...(c.reply ? [{ sender: 'bot', text: c.reply }] : [])
          ]);

          this.setState(prev => ({
            messages: [{ sender: 'bot', text: prev.settings.welcomeMessage }, ...history]
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
          input: '',
          loading: true,
          messages: [...messages, { sender: 'user', text: input }, { sender: 'bot', text: '...' }]  // new line for typing dots
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
          if (!res.ok) throw new Error(data.error || 'API error');

          // Replace typing dots with actual reply
          this.setState(prev => {
            const updated = [...prev.messages];
            updated.pop(); // remove the '...'
            return {
              messages: [...updated, { sender: 'bot', text: data.reply }],
              loading: false
            };
          }, this.scrollToBottom);
        } catch {
          this.setState(prev => {
            const updated = [...prev.messages];
            updated.pop(); // remove the '...'
            return {
              messages: [...updated, { sender: 'bot', text: 'Server error. Please try again later.' }],
              loading: false
            };
          }, this.scrollToBottom);
        }
      };

      resetSession = async () => {
        try {
          await fetch(`${apiUrl}/chat/reset-session`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ visitorId })
          });
          this.setState({
            messages: [{ sender: 'bot', text: this.state.settings.welcomeMessage }],
            input: '',
            loading: false
          }, this.scrollToBottom);
        } catch (err) {
          console.error('Reset failed:', err);
        }
      };

      scrollToBottom = () => {
        this.messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
      };

      renderMessageText(text) {
        const e = window.React.createElement;
        const markdownLinkRegex = /\[([^\]]+)]\((https?:\/\/[^\s)]+)\)/g;
        const boldRegex = /\*\*(.*?)\*\*/g;

        let formatted = text
          .replace(markdownLinkRegex, '<a href="$2" target="_blank">$1</a>')
          .replace(boldRegex, '<strong>$1</strong>');

        return e('span', { dangerouslySetInnerHTML: { __html: formatted } });
      }

      render() {
        const { messages, input, loading, isMinimized, settings } = this.state;
        if (isMinimized) {
          return window.React.createElement('div', { onClick: this.toggleMinimize }, [
            window.React.createElement('img', {
              id: 'chatbot-minimized-img',
              src: settings.avatar || 'https://jdwebservices.com/lavedaa/wp-content/uploads/2025/06/vicon.png',
              alt: 'Chatbot'
            })
          ]);
        }

        return window.React.createElement('div', null, [
          window.React.createElement('div', { id: 'chatbot-header' }, [
            settings.avatar ? window.React.createElement('img', { id: 'chatbot-avatar', src: settings.avatar }) : null,
            window.React.createElement('span', { id: 'chatbot-title' }, 'Ask LV'),
            window.React.createElement('button', { id: 'chatbot-minimize-btn', onClick: this.toggleMinimize }, '×')
          ]),
          window.React.createElement('div', { id: 'chatbot-messages' }, [
            ...messages.map((msg, i) =>
              window.React.createElement('div', {
                key: i,
                className: `message ${msg.sender}`
              }, this.renderMessageText(msg.text))
            ),
            window.React.createElement('div', { ref: this.messagesEndRef })
          ]),
          window.React.createElement('div', { id: 'chatbot-input' }, [
            window.React.createElement('input', {
              type: 'text',
              value: input,
              onChange: e => this.setState({ input: e.target.value }),
              onKeyPress: e => e.key === 'Enter' && this.sendMessage(),
              placeholder: 'Type your message...',
              disabled: loading
            }),
            window.React.createElement('button', { onClick: this.sendMessage, disabled: loading }, 'Send'),
            window.React.createElement('button', {
              onClick: this.resetSession,
              style: { backgroundColor: '#ef4444' }
            }, 'Reset Chat')
          ])
        ]);
      }

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
    }

    window.ReactDOM.render(e(ChatbotWidget), widgetDiv);
  }

  function onScriptLoad() {
    scriptsLoaded++;
    if (scriptsLoaded === scripts.length) {
      renderWidget();
    }
  }

  function onScriptError(e) {
    console.error('Failed to load script:', e.target.src);
    widgetDiv.innerHTML = '<div style="padding: 10px; color: red;">Failed to load chatbot. Try again later.</div>';
  }

  scripts.forEach(script => {
    const s = document.createElement('script');
    s.src = script.src;
    s.async = true;
    s.onload = onScriptLoad;
    s.onerror = onScriptError;
    document.head.appendChild(s);
  });
})();
