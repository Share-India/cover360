'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { chatInsure } from '../../../utils/api';

export default function AskAIPage() {
  const router = useRouter();
  const [chatMessages, setChatMessages] = useState([]);
  const [chatInput, setChatInput] = useState("");
  const [isChatLoading, setIsChatLoading] = useState(false);

  const handleChatSubmit = async (e) => {
    e.preventDefault();
    if (!chatInput.trim()) return;
    
    const userMsg = { sender: 'user', text: chatInput };
    const updatedMessages = [...chatMessages, userMsg];
    setChatMessages(updatedMessages);
    setChatInput("");
    setIsChatLoading(true);
    
    try {
      const response = await chatInsure(updatedMessages);
      
      let aiMsg = null;
      try {
        let replyString = typeof response.reply === 'string' ? response.reply : JSON.stringify(response.reply);
        // Strip out any markdown code blocks (e.g. ```json ... ```)
        replyString = replyString.replace(/```json/gi, '').replace(/```/g, '').trim();
        const replyObj = JSON.parse(replyString);
        aiMsg = { sender: 'ai', ...replyObj };
      } catch (e) {
        // Fallback for regular text
        aiMsg = { sender: 'ai', type: 'chat', message: typeof response.reply === 'string' ? response.reply : JSON.stringify(response.reply) };
      }
      
      setChatMessages(prev => [...prev, aiMsg]);
    } catch (error) {
      console.error(error);
      const errorMsg = { sender: 'ai', type: 'chat', message: `System Error: ${error.message || "I couldn't process your request right now."}` };
      setChatMessages(prev => [...prev, errorMsg]);
    } finally {
      setIsChatLoading(false);
    }
  };

  return (
    <div className="p-4 sm:p-8" style={{ height: '100%', display: 'flex', flexDirection: 'column' }}>
      
      <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.75rem', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.25rem' }}>
        <div>
          <h1 style={{ fontSize: 'clamp(1.5rem, 5vw, 2rem)', fontWeight: 800, color: '#0f172a' }}>Motor Advisor</h1>
          <p style={{ color: '#64748b', marginTop: '0.5rem' }}>Your expert Insurance Advisor</p>
        </div>
        <button 
          onClick={() => router.push('/dashboard')}
          style={{ padding: '0.75rem 1.5rem', background: '#f1f5f9', color: '#334155', border: 'none', borderRadius: '8px', fontWeight: 600, cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '0.5rem' }}
        >
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><line x1="19" y1="12" x2="5" y2="12"></line><polyline points="12 19 5 12 12 5"></polyline></svg>
          Back to Dashboard
        </button>
      </div>

      <div style={{ flex: 1, minHeight: '420px', background: 'white', borderRadius: '16px', boxShadow: '0 4px 6px rgba(0,0,0,0.05)', display: 'flex', flexDirection: 'column', border: '1px solid #e2e8f0', overflow: 'hidden' }}>
        
        {/* Chat Messages */}
        <div className="p-4 sm:p-8" style={{ flex: 1, overflowY: 'auto', background: '#f8fafc', display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
          {chatMessages.length === 0 && (
            <div style={{ textAlign: 'center', color: '#64748b', fontSize: '1rem', marginTop: '4rem', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '1rem' }}>
              <div style={{ width: '64px', height: '64px', background: '#eff6ff', borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                 <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="#3b82f6" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><rect x="3" y="11" width="18" height="10" rx="2"></rect><circle cx="12" cy="5" r="2"></circle><path d="M12 7v4"></path><line x1="8" y1="16" x2="8" y2="16"></line><line x1="16" y1="16" x2="16" y2="16"></line></svg>
              </div>
              <div>
                <h3 style={{ fontSize: '1.25rem', fontWeight: 700, color: '#0f172a', marginBottom: '0.5rem' }}>Hi! I'm Motor Advisor.</h3>
                <p>Ask me anything about your insurance recommendations or request an analysis.</p>
              </div>
            </div>
          )}
          
          {chatMessages.map((msg, idx) => (
            <div key={idx} style={{ alignSelf: msg.sender === 'user' ? 'flex-end' : 'flex-start', maxWidth: msg.sender === 'user' ? '85%' : '92%' }}>
              <div style={{ 
                background: msg.sender === 'user' ? '#3b82f6' : 'white', 
                color: msg.sender === 'user' ? 'white' : '#1e293b', 
                padding: '1rem 1.25rem', 
                borderRadius: msg.sender === 'user' ? '16px 16px 4px 16px' : '16px 16px 16px 4px', 
                border: msg.sender === 'user' ? 'none' : '1px solid #e2e8f0', 
                fontSize: '1rem', 
                lineHeight: '1.6', 
                boxShadow: '0 1px 3px rgba(0,0,0,0.05)', 
                whiteSpace: 'pre-wrap' 
              }}>
                {msg.message || msg.text}
              </div>
            </div>
          ))}
          
          {isChatLoading && (
            <div style={{ alignSelf: 'flex-start', maxWidth: '85%' }}>
              <div style={{ background: 'white', color: '#64748b', padding: '1rem 1.25rem', borderRadius: '16px 16px 16px 4px', border: '1px solid #e2e8f0', fontSize: '1rem', boxShadow: '0 1px 3px rgba(0,0,0,0.05)' }}>
                <span style={{ display: 'flex', gap: '4px' }}>
                  <span style={{ animation: 'bounce 1.4s infinite ease-in-out both', animationDelay: '-0.32s' }}>.</span>
                  <span style={{ animation: 'bounce 1.4s infinite ease-in-out both', animationDelay: '-0.16s' }}>.</span>
                  <span style={{ animation: 'bounce 1.4s infinite ease-in-out both' }}>.</span>
                </span>
              </div>
            </div>
          )}
        </div>
        
        {/* Chat Input */}
        <form onSubmit={handleChatSubmit} className="p-3 sm:px-8 sm:py-6" style={{ borderTop: '1px solid #e2e8f0', background: 'white', display: 'flex', gap: '0.75rem', alignItems: 'center' }}>
          <input 
            type="text" 
            value={chatInput}
            onChange={(e) => setChatInput(e.target.value)}
            placeholder="Type your question..."
            style={{ flex: 1, minWidth: 0, padding: '0.85rem 1.25rem', borderRadius: '30px', border: '1px solid #cbd5e1', outline: 'none', fontSize: '1rem', background: '#f8fafc' }}
          />
          <button 
            type="submit"
            disabled={isChatLoading || !chatInput.trim()}
            style={{ background: chatInput.trim() ? '#3b82f6' : '#94a3b8', color: 'white', border: 'none', borderRadius: '30px', padding: '0.85rem 1.25rem', display: 'flex', alignItems: 'center', gap: '0.5rem', fontWeight: 600, cursor: chatInput.trim() ? 'pointer' : 'not-allowed', transition: 'background 0.2s', fontSize: '1rem' }}
          >
            Send
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><line x1="22" y1="2" x2="11" y2="13"></line><polygon points="22 2 15 22 11 13 2 9 22 2"></polygon></svg>
          </button>
        </form>

      </div>
    </div>
  );
}
