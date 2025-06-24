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

  const style = document.createElement('style');
  style.textContent = `
    * {
      user-select: none !important;
    }
    #chatbot-widget {
      position: fixed;
      bottom: 30px;
      right: 30px;
      z-index: 100000;
      font-family: 'Segoe UI', sans-serif;
    }
    .chat-button {
      background: #1e3a8a;
      color: #fff;
      border: none;
      border-radius: 50%;
      width: 60px;
      height: 60px;
      box-shadow: 0 4px 12px rgba(0,0,0,0.15);
      cursor: pointer;
      font-size: 24px;
    }
    .chat-window {
      width: 360px;
      height: 540px;
      background: #fff;
      border-radius: 20px;
      box-shadow: 0 8px 30px rgba(0,0,0,0.2);
      display: flex;
      flex-direction: column;
      overflow: hidden;
    }
    .chat-header {
      background: #1e3a8a;
      color: #fff;
      padding: 16px;
      font-weight: 600;
      display: flex;
      justify-content: space-between;
      align-items: center;
    }
    .chat-body {
      flex: 1;
      padding: 12px;
      overflow-y: auto;
      background: #f9fafb;
    }
    .chat-footer {
      padding: 12px;
      border-top: 1px solid #e5e7eb;
      display: flex;
      gap: 8px;
    }
    .chat-input {
      flex: 1;
      padding: 8px 12px;
      border-radius: 10px;
      border: 1px solid #d1d5db;
    }
    .chat-send {
      background: #1e3a8a;
      color: #fff;
      border: none;
      border-radius: 10px;
      padding: 0 16px;
      cursor: pointer;
    }
    .chat-message {
      max-width: 80%;
      margin-bottom: 10px;
      padding: 10px 14px;
      border-radius: 16px;
      clear: both;
      word-wrap: break-word;
    }
    .bot-message {
      background: #e5e7eb;
      float: left;
    }
    .user-message {
      background: #1e3a8a;
      color: #fff;
      float: right;
    }
    .reset-btn {
      background: transparent;
      border: 1px solid #1e3a8a;
      border-radius: 10px;
      color: #1e3a8a;
      padding: 6px 12px;
      margin-top: 8px;
      cursor: pointer;
    }
  `;
  document.head.appendChild(style);

  const e = window.React.createElement;
  const ChatbotWidget = class extends React.Component {
    constructor(props) {
      super(props);
      this.state = {
        open: false,
        messages: [],
        input: '',
        loading: false
      };
      this.ref = React.createRef();
    }

    componentDidMount() {
      this.fetchWelcome();
    }

    fetchWelcome = async () => {
      try {
        const res = await fetch(`${apiUrl}/widget/settings/${userId}`);
        const data = await res.json();
        this.setState({ messages: [{ sender: 'bot', text: data.welcomeMessage }] });
      } catch {
        this.setState({ messages: [{ sender: 'bot', text: 'Welcome! How can I help?' }] });
      }
    };

    toggleWidget = () => {
      this.setState(prev => ({ open: !prev.open }));
    };

    sendMessage = async () => {
      const { input, messages } = this.state;
      if (!input.trim()) return;
      this.setState({ input: '', messages: [...messages, { sender: 'user', text: input }], loading: true });

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
        this.setState(prev => ({
          messages: [...prev.messages, { sender: 'bot', text: data.reply }],
          loading: false
        }));
      } catch {
        this.setState(prev => ({
          messages: [...prev.messages, { sender: 'bot', text: 'Something went wrong.' }],
          loading: false
        }));
      }
    };

    resetSession = async () => {
      await fetch(`${apiUrl}/chat/reset-session`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ visitorId })
      });
      this.fetchWelcome();
    };

    render() {
      const { open, messages, input, loading } = this.state;
      return e('div', null, [
        !open && e('button', { className: 'chat-button', onClick: this.toggleWidget }, '💬'),
        open && e('div', { className: 'chat-window' }, [
          e('div', { className: 'chat-header' }, [
            e('span', null, 'Ask LV'),
            e('button', { onClick: this.toggleWidget, style: { background: 'none', border: 'none', color: '#fff', fontSize: '16px' } }, '×')
          ]),
          e('div', { className: 'chat-body', ref: this.ref },
            messages.map((m, i) => e('div', {
              key: i,
              className: `chat-message ${m.sender === 'user' ? 'user-message' : 'bot-message'}`
            }, m.text))
          ),
          e('div', { className: 'chat-footer' }, [
            e('input', {
              className: 'chat-input',
              value: input,
              onChange: e => this.setState({ input: e.target.value }),
              onKeyDown: e => e.key === 'Enter' && this.sendMessage(),
              placeholder: 'Type your message...'
            }),
            e('button', { className: 'chat-send', onClick: this.sendMessage, disabled: loading }, 'Send'),
            e('button', { className: 'reset-btn', onClick: this.resetSession }, 'Reset Session')
          ])
        ])
      ]);
    }
  };

  const s1 = document.createElement('script');
  s1.src = 'https://cdn.jsdelivr.net/npm/react@18/umd/react.production.min.js';
  const s2 = document.createElement('script');
  s2.src = 'https://cdn.jsdelivr.net/npm/react-dom@18/umd/react-dom.production.min.js';
  s2.onload = () => {
    ReactDOM.render(React.createElement(ChatbotWidget), widgetDiv);
  };
  document.head.appendChild(s1);
  document.head.appendChild(s2);
})();
