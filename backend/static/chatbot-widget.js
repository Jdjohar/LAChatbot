(function() {
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
      z-index: 99999999999;
    ` : `
      width: 340px;
      height: 460px;
      background: #ffffff;
      border-radius: 16px;
      box-shadow: 0 12px 24px rgba(0,0,0,0.15);
      z-index: 1000;
      font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif;
      display: flex;
      flex-direction: column;
      overflow: hidden;
      font-size: 14px;
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
    padding: 12px 16px;
    border-radius: 16px 16px 0 0;
    display: flex;
    align-items: center;
    justify-content: space-between;
    position: relative;
  }

  #chatbot-avatar {
    width: 32px;
    height: 32px;
    border-radius: 50%;
    object-fit: cover;
    margin-right: 8px;
    position: relative;
  }

  #chatbot-avatar::after {
    content: '';
    position: absolute;
    bottom: 0;
    right: 0;
    width: 9px;
    height: 9px;
    background-color: #00ff75;
    border: 2px solid ${settings.theme};
    border-radius: 50%;
  }

  #chatbot-title {
    flex: 1;
    text-align: left;
    font-weight: 600;
    font-size: 15px;
    white-space: nowrap;
    overflow: hidden;
    text-overflow: ellipsis;
  }

  #chatbot-minimize-btn {
    background: none;
    border: none;
    color: white;
    font-size: 18px;
    cursor: pointer;
    transition: transform 0.2s ease;
  }

  #chatbot-minimize-btn:hover {
    transform: scale(1.2);
  }

  #chatbot-messages {
    flex: 1;
    overflow-y: auto;
    padding: 12px;
    background-color: #f9fafb;
    scroll-behavior: smooth;
  }

  #chatbot-input {
    display: flex;
    padding: 10px 12px;
    background: #fff;
    border-top: 1px solid #ddd;
  }

  #chatbot-input input {
    flex: 1;
    padding: 10px;
    border: 1px solid #d1d5db;
    border-radius: 8px;
    font-size: 14px;
    outline: none;
    transition: border 0.2s;
  }

  #chatbot-input input:focus {
    border-color: ${settings.theme};
  }

  #chatbot-input button {
    padding: 8px 14px;
    margin-left: 8px;
    background: ${settings.theme};
    color: white;
    border: none;
    border-radius: 8px;
    font-weight: 500;
    cursor: pointer;
    transition: background 0.2s;
  }

  #chatbot-input button:hover {
    background: #143082;
  }

  .message {
    margin: 6px 0;
    padding: 10px 12px;
    border-radius: 8px;
    display: flex;
    align-items: center;
    line-height: 1.4;
  }

  .user {
    background: #e0f2fe;
    margin-left: 15%;
    justify-content: flex-end;
  }

  .bot {
    background: #f3f4f6;
    margin-right: 15%;
    justify-content: flex-start;
  }

  .bot img {
    width: 20px;
    height: 20px;
    border-radius: 50%;
    margin-right: 8px;
  }

  .message a {
    color: ${settings.theme};
    text-decoration: underline;
  }

  .message a:hover {
    text-decoration: none;
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
          isMinimized: true, // Start minimized
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
          if (!res.ok) throw new Error('Failed to fetch settings');
          const settings = await res.json();
          this.setState({ settings }, () => {
            applyStyles(settings, this.state.isMinimized);
            if (!this.state.isMinimized) {
              this.addWelcomeMessage();
              this.fetchChats();
            }
          });
        } catch (err) {
          console.error('Settings fetch error:', err);
          applyStyles(defaultSettings, this.state.isMinimized);
          if (!this.state.isMinimized) {
            this.addWelcomeMessage();
            this.fetchChats();
          }
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
          if (!res.ok) throw new Error('Failed to fetch chats');
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
        } catch (err) {
          console.error('Error fetching chats:', err);
          this.setState(prevState => ({
            messages: [
              ...prevState.messages,
              { sender: 'bot', text: 'Error loading chat history. Please try again.' }
            ]
          }));
        }
      };

      sendMessage = async () => {
        const { input, messages } = this.state;
        if (!input.trim()) return;
        this.setState({ 
          loading: true, 
          messages: [...messages, { sender: 'user', text: input }],
          input: ''
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
          if (!res.ok) {
            console.error('Chat API error:', data);
            this.setState({
              messages: [...this.state.messages, { sender: 'bot', text: data.reply || data.error || 'Error contacting server. Please try again.' }],
              loading: false
            }, this.scrollToBottom);
            return;
          }
          this.setState({
            messages: [...this.state.messages, { sender: 'bot', text: data.reply }],
            loading: false
          }, this.scrollToBottom);
        } catch (err) {
          console.error('Error sending message:', err);
          this.setState({
            messages: [...this.state.messages, { sender: 'bot', text: 'Error contacting server. Please try again.' }],
            loading: false
          }, this.scrollToBottom);
        }
      };

      toggleMinimize = () => {
        this.setState(prevState => {
          const isMinimized = !prevState.isMinimized;
          applyStyles(prevState.settings, isMinimized);
          if (!isMinimized && prevState.messages.length === 0) {
            this.addWelcomeMessage();
            this.fetchChats();
          }
          return { isMinimized };
        });
      };

      scrollToBottom = () => {
        this.messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
      };

      renderMessageText(text) {
        const emailRegex = /\b[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Z|a-z]{2,}\b/g;
        const phoneRegex = /(\+?\d{1,4}[-.\s]?\(?\d{1,3}\)?[-.\s]?\d{1,4}[-.\s]?\d{1,4})/g;
        const urlRegex = /\b(https?:\/\/[^\s<>"']+)|(www\.[^\s<>"']+)\b/g;

        let parts = [];
        let lastIndex = 0;
        const matches = [];

        let match;
        while ((match = emailRegex.exec(text)) !== null) {
          matches.push({ type: 'email', value: match[0], index: match.index, length: match[0].length });
        }
        while ((match = phoneRegex.exec(text)) !== null) {
          matches.push({ type: 'phone', value: match[0], index: match.index, length: match[0].length });
        }
        while ((match = urlRegex.exec(text)) !== null) {
          matches.push({ type: 'url', value: match[0], index: match.index, length: match[0].length });
        }

        matches.sort((a, b) => a.index - b.index);

        matches.forEach(match => {
          if (match.index > lastIndex) {
            parts.push(text.slice(lastIndex, match.index));
          }
          if (match.type === 'email') {
            parts.push(e('a', { href: `mailto:${match.value}` }, match.value));
          } else if (match.type === 'phone') {
            const cleanedPhone = match.value.replace(/[-.\s()]/g, '');
            parts.push(e('a', { href: `tel:${cleanedPhone}` }, match.value));
          } else if (match.type === 'url') {
            const url = match.value.startsWith('www.') ? `https://${match.value}` : match.value;
            parts.push(e('a', { href: url, target: '_blank', rel: 'noopener noreferrer' }, match.value));
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
            loading ? e('div', { className: 'message bot' }, '...') : null,
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
    widgetDiv.innerHTML = '<div style="padding: 10px; color: red;">Failed to load chatbot dependencies. Please try again later.</div>';
  }

  scripts.forEach(script => {
    const scriptTag = document.createElement('script');
    scriptTag.src = script.src;
    scriptTag.async = true;
    scriptTag.onload = () => {
      script.loaded = true;
      onScriptLoad();
    };
    scriptTag.onerror = onScriptError;
    document.head.appendChild(scriptTag);
  });
})();