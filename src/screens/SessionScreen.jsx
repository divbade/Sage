import { useState, useRef, useEffect, useCallback } from 'react';
import { useApp } from '../context/AppContext';
import SageAvatar from '../components/SageAvatar';
import TypingIndicator from '../components/TypingIndicator';
import PhaseBadge from '../components/PhaseBadge';
import ScoreDisplay from '../components/ScoreDisplay';
import ConceptCard from '../components/ConceptCard';
import { streamConversationResponse, updateKnowledgePanel, detectTopicType } from '../services/claude';
import toast from 'react-hot-toast';

export default function SessionScreen() {
  const {
    state,
    addMessage,
    appendToLastMessage,
    updateKnowledgePanel: updatePanel,
    setPhase,
    setPanelFrozen,
    setSessionMode,
    setTopicType,
    incrementExchange,
    addModeHistory,
  } = useApp();

  const [input, setInput] = useState('');
  const [isGenerating, setIsGenerating] = useState(false);
  const [showNudge, setShowNudge] = useState(false);
  const messagesEndRef = useRef(null);
  const inputRef = useRef(null);

  const {
    topic,
    contextSelection,
    selfAssessment,
    uploadedChunks,
    conversationHistory,
    knowledgePanelState,
    sessionPhase,
    panelFrozen,
    sessionMode,
    topicType,
    exchangeCount,
    preGeneratedQuiz,
  } = state;

  // Direct knowledge panel update since Claude's API has no 15 RPM limit
  const schedulePanelUpdate = useCallback(async (historyToUse) => {
    try {
      const panelData = await updateKnowledgePanel({
        topic,
        uploadedChunks,
        conversationHistory: historyToUse,
        preGeneratedQuiz,
      });
      updatePanel(panelData);
    } catch (err) {
      console.error("Panel update failed:", err);
    }
  }, [topic, uploadedChunks, preGeneratedQuiz, updatePanel]);

  // Auto-scroll to bottom of chat
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [conversationHistory, isGenerating]);

  // Topic Detection (fires after the first user message)
  useEffect(() => {
    if (exchangeCount === 1 && !topicType) {
      const userMessages = conversationHistory.filter(m => m.role === 'user');
      const firstMsg = userMessages[1]?.content || userMessages[0]?.content;
      detectTopicType(topic, firstMsg).then(type => {
        setTopicType(type);
      });
    }
  }, [exchangeCount, topicType, topic, conversationHistory, setTopicType]);

  // Mode Transitions State Machine
  useEffect(() => {
    if (exchangeCount === 5 && sessionMode === 'explanation') {
      setSessionMode('misconception');
      const transitionMsg = { type: 'transition', label: 'Sage wants to check its understanding' };
      addMessage(transitionMsg);
      addModeHistory({ mode: 'misconception', startedAtExchange: 5 });
      setTimeout(() => {
        triggerAutoResponse('misconception', [...conversationHistory, transitionMsg]);
      }, 600);
    } else if (exchangeCount === 7 && sessionMode === 'misconception') {
      const nextMode = topicType === 'procedural' ? 'problem' : 'connection';
      setSessionMode(nextMode);
      const transitionMsg = {
        type: 'transition',
        label: nextMode === 'problem' 
          ? 'Sage is going to try a practice problem'
          : 'Sage wants to connect what it\'s learned'
      };
      addMessage(transitionMsg);
      addModeHistory({ mode: nextMode, startedAtExchange: 7 });
      setTimeout(() => {
        triggerAutoResponse(nextMode, [...conversationHistory, transitionMsg]);
      }, 600);
    } else if (exchangeCount === 9 && (sessionMode === 'problem' || sessionMode === 'connection')) {
      setSessionMode('explanation');
      addMessage({ type: 'transition', label: 'Back to teaching' });
      addModeHistory({ mode: 'explanation', startedAtExchange: 9 });
      setTimeout(() => setShowNudge(true), 1500); // Trigger nudge after returning to explanation
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [exchangeCount]);

  const triggerAutoResponse = async (targetMode, historyForCall) => {
    setIsGenerating(true);
    // Add empty assistant message to stream into
    addMessage({ role: 'assistant', content: '' });

    try {
      await streamConversationResponse({
        topic,
        contextSelection,
        selfAssessment,
        uploadedChunks,
        conversationHistory: historyForCall,
        sessionMode: targetMode,
        onChunk: (chunk) => {
          appendToLastMessage(chunk);
        },
        onComplete: async (fullText) => {
          const updatedHistory = [
            ...historyForCall,
            { role: 'assistant', content: fullText },
          ];
          schedulePanelUpdate(updatedHistory);
        },
        onError: (err) => {
          toast.error(`Failed to get response: ${err.message}`);
        },
      });
    } catch {
      // Error already handled
    } finally {
      setIsGenerating(false);
      inputRef.current?.focus();
    }
  };

  const handleSageGreeting = async () => {
    setIsGenerating(true);
    // Add synthetic user greeting to history
    addMessage({ role: 'user', content: `I want to teach you about ${topic}. Let me start explaining.` });
    // Add empty assistant message to stream into
    addMessage({ role: 'assistant', content: '' });

    try {
      await streamConversationResponse({
        topic,
        contextSelection,
        selfAssessment,
        uploadedChunks,
        conversationHistory: [
          { role: 'user', content: `I want to teach you about ${topic}. Let me start explaining.` },
        ],
        sessionMode,
        onChunk: (chunk) => {
          appendToLastMessage(chunk);
        },
        onComplete: async (fullText) => {
          const updatedHistory = [
            { role: 'user', content: `I want to teach you about ${topic}. Let me start explaining.` },
            { role: 'assistant', content: fullText },
          ];
          schedulePanelUpdate(updatedHistory);
        },
        onError: (err) => {
          toast.error(`Failed to get response: ${err.message}`);
        },
      });
    } catch {
      // Error already handled by onError
    } finally {
      setIsGenerating(false);
    }
  };

  // Send initial greeting from Sage
  useEffect(() => {
    if (conversationHistory.length === 0 && sessionPhase === 'teaching') {
      setTimeout(() => {
        handleSageGreeting();
      }, 0);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const handleSend = useCallback(async () => {
    const text = input.trim();
    if (!text || isGenerating) return;

    setInput('');

    // Add user message
    addMessage({ role: 'user', content: text });
    incrementExchange();

    // Build current history for API call (include the new user message)
    const currentHistory = [
      ...conversationHistory,
      { role: 'user', content: text },
    ];

    // Add empty assistant message to stream into
    addMessage({ role: 'assistant', content: '' });
    setIsGenerating(true);

    try {
      const fullText = await streamConversationResponse({
        topic,
        contextSelection,
        selfAssessment,
        uploadedChunks,
        conversationHistory: currentHistory,
        sessionMode,
        onChunk: (chunk) => {
          appendToLastMessage(chunk);
        },
        onError: (err) => {
          toast.error(`Failed to get response: ${err.message}`);
        },
      });

      const updatedHistory = [
        ...currentHistory,
        { role: 'assistant', content: fullText },
      ];
      schedulePanelUpdate(updatedHistory);
    } catch {
      // Error already handled
    } finally {
      setIsGenerating(false);
      inputRef.current?.focus();
    }
  }, [input, isGenerating, conversationHistory, topic, contextSelection, selfAssessment, uploadedChunks, preGeneratedQuiz, addMessage, appendToLastMessage, schedulePanelUpdate]);

  const handleKeyDown = (e) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  };

  const handleFinishTeaching = () => {
    setPanelFrozen(true);
    setPhase('quiz');
  };

  const contextLabels = {
    exam_prep: 'Exam prep',
    assignment: 'Class assignment',
    curious: 'Just curious',
    other: 'Other',
  };

  // Filter out the synthetic first message for display
  const displayMessages = conversationHistory.filter(
    (msg, idx) => !(idx === 0 && msg.role === 'user' && msg.content.includes('I want to teach you about'))
  );

  return (
    <div className="h-screen flex flex-col bg-cream">
      {/* Main content */}
      <div className="flex-1 flex flex-col md:flex-row overflow-hidden">
        {/* Left: Chat */}
        <div className="flex-1 md:w-3/5 flex flex-col min-w-0 bg-cream" style={{ padding: 0 }}>
          {/* Session header */}
          <header
            className="flex-shrink-0"
            style={{
              padding: '16px 24px',
              borderBottom: '1px solid #E8E6E0',
              background: '#FFFFFF',
            }}
          >
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <SageAvatar size="md" state={isGenerating ? 'thinking' : 'neutral'} />
                <div>
                  <h1 style={{ fontSize: 17, fontWeight: 600, color: '#1C1C1E', letterSpacing: '-0.01em' }}>{topic}</h1>
                  <p style={{ fontSize: 12, color: '#9B9A96', fontWeight: 500, textTransform: 'uppercase', letterSpacing: '0.06em', marginTop: 2 }}>
                    {contextLabels[contextSelection]}
                  </p>
                </div>
              </div>
              <PhaseBadge phase={sessionPhase} />
            </div>
          </header>

          {/* Messages */}
          <div className="flex-1 overflow-y-auto" style={{ padding: 24 }}>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
              {displayMessages.map((msg, idx) => {
                if (msg.type === 'transition') {
                  return (
                    <div key={idx} className="animate-fade-in flex items-center justify-center my-4 opacity-70">
                      <div className="h-px bg-navy-300 flex-1 max-w-[100px]"></div>
                      <span className="mx-4 text-[11px] font-semibold tracking-wider uppercase text-navy-400 text-center">
                        {msg.label}
                      </span>
                      <div className="h-px bg-navy-300 flex-1 max-w-[100px]"></div>
                    </div>
                  );
                }

                const isAssistant = msg.role === 'assistant';
                const isLastAssistant = isAssistant && idx === displayMessages.length - 1;
                const avatarState = isLastAssistant && isGenerating ? 'thinking' : 'neutral';

                return (
                  <div
                    key={idx}
                    className="animate-fade-in"
                    style={{
                      display: 'flex',
                      gap: 12,
                      justifyContent: isAssistant ? 'flex-start' : 'flex-end',
                      alignItems: 'flex-start',
                    }}
                  >
                    {isAssistant && <SageAvatar size="sm" state={avatarState} />}
                    <div
                      style={{
                        maxWidth: '78%',
                        padding: 16,
                        fontSize: 14,
                        lineHeight: 1.65,
                        ...(isAssistant
                          ? {
                              background: '#FEF9EC',
                              borderRadius: '4px 16px 16px 16px',
                              color: '#3D3D3A',
                            }
                          : {
                              background: '#F0EFEA',
                              borderRadius: '16px 4px 16px 16px',
                              color: '#1C1C1E',
                            }),
                      }}
                    >
                      {msg.content || (isAssistant && isGenerating && idx === displayMessages.length - 1 ? (
                        <TypingIndicator />
                      ) : null)}
                    </div>
                  </div>
                );
              })}
              <div ref={messagesEndRef} />
            </div>
          </div>

          {/* Nudge */}
          {showNudge && !panelFrozen && (
            <div
              className="animate-fade-in"
              style={{
                margin: '0 24px 12px',
                padding: '14px 20px',
                borderRadius: 12,
                background: '#FEF3DC',
                border: '1px solid rgba(245,166,35,0.2)',
                fontSize: 13,
                color: '#B8801A',
                fontWeight: 500,
              }}
            >
              You've covered a lot — feel free to wrap up whenever you're ready.
            </div>
          )}

          {/* Finish Teaching Button */}
          {!panelFrozen && (
            <div style={{ padding: '0 24px 16px', display: 'flex', justifyContent: 'center' }}>
              <button
                onClick={handleFinishTeaching}
                disabled={conversationHistory.length < 3 || isGenerating}
                className="btn-hover-lift disabled:opacity-30 disabled:cursor-not-allowed"
                style={{
                  height: 52,
                  width: '100%',
                  maxWidth: 420,
                  borderRadius: 14,
                  fontWeight: 600,
                  fontSize: 14,
                  cursor: 'pointer',
                  transition: 'all 0.2s ease',
                  background: showNudge ? '#F5A623' : 'transparent',
                  color: showNudge ? '#1C1C1E' : '#5A5955',
                  border: showNudge ? 'none' : '2px solid #E0DED8',
                  boxShadow: showNudge ? '0 2px 12px rgba(245,166,35,0.25)' : 'none',
                }}
              >
                I've explained everything — test Sage now
              </button>
            </div>
          )}

          {/* Input */}
          <div
            className="flex-shrink-0"
            style={{
              padding: '16px 24px',
              borderTop: '1px solid #E8E6E0',
              background: '#FFFFFF',
            }}
          >
            <div className="flex gap-3">
              <input
                ref={inputRef}
                type="text"
                value={input}
                onChange={(e) => setInput(e.target.value)}
                onKeyDown={handleKeyDown}
                disabled={isGenerating || panelFrozen}
                placeholder={isGenerating ? 'Sage is thinking...' : 'Explain your topic to Sage...'}
                className="flex-1 rounded-xl bg-cream border border-navy-700 text-navy-100 placeholder:text-navy-500 disabled:opacity-50 transition-all duration-200"
                style={{ height: 48, padding: '0 16px', fontSize: 14 }}
              />
              <button
                onClick={handleSend}
                disabled={!input.trim() || isGenerating || panelFrozen}
                className="rounded-xl bg-accent-amber text-charcoal font-semibold hover:opacity-90 transition-all duration-200 disabled:opacity-40 disabled:cursor-not-allowed btn-hover-lift"
                style={{ padding: '0 24px', height: 48, fontSize: 14 }}
              >
                Send
              </button>
            </div>
          </div>
        </div>

        {/* Vertical divider */}
        <div className="hidden md:block" style={{ width: 1, background: '#E8E6E0', flexShrink: 0 }} />

        {/* Right: Knowledge Panel */}
        <div
          className="md:w-2/5 overflow-y-auto"
          style={{ background: '#F5F4F0', padding: 16 }}
        >
          {/* Knowledge panel card */}
          <div
            style={{
              background: '#FFFFFF',
              borderRadius: 16,
              padding: 24,
              boxShadow: '0 2px 12px rgba(0,0,0,0.08)',
              minHeight: 'calc(100% - 32px)',
            }}
          >
            <h2 style={{ fontSize: 11, fontWeight: 600, color: '#9B9A96', textTransform: 'uppercase', letterSpacing: '0.08em', marginBottom: 24 }}>
              What Sage understands so far
            </h2>

            {panelFrozen && (
              <div
                className="animate-fade-in"
                style={{
                  marginBottom: 20,
                  padding: '10px 16px',
                  borderRadius: 10,
                  background: '#FEF3DC',
                  border: '1px solid rgba(245,166,35,0.15)',
                  fontSize: 12,
                  color: '#B8801A',
                  textAlign: 'center',
                  fontWeight: 500,
                }}
              >
                Sage's final knowledge state — about to be tested
              </div>
            )}

            {/* Overall Score */}
            <div className="flex justify-center" style={{ marginBottom: 28 }}>
              <ScoreDisplay score={knowledgePanelState.overall_score} />
            </div>

            {/* Concept Cards */}
            <div style={{ marginBottom: 24 }}>
              {knowledgePanelState.concepts.map((concept, idx) => (
                <ConceptCard key={concept.name + idx} concept={concept} index={idx} />
              ))}
              {knowledgePanelState.concepts.length === 0 && (
                <div style={{ textAlign: 'center', padding: '32px 0', color: '#9B9A96', fontSize: 13 }}>
                  <p>Start teaching and Sage's understanding will appear here.</p>
                </div>
              )}
            </div>

            {/* Gaps */}
            {knowledgePanelState.gaps.length > 0 && (
              <div
                className="animate-fade-in"
                style={{
                  background: '#FFFBF0',
                  borderRadius: 10,
                  padding: '12px 14px',
                }}
              >
                <h3 style={{ fontSize: 12, fontWeight: 500, color: '#9B9A96', marginBottom: 10 }}>
                  Help Sage understand these better
                </h3>
                <ul style={{ listStyle: 'none', padding: 0, margin: 0, display: 'flex', flexDirection: 'column', gap: 8 }}>
                  {knowledgePanelState.gaps.map((gap, idx) => (
                    <li
                      key={idx}
                      style={{ display: 'flex', alignItems: 'flex-start', gap: 8, fontSize: 13, color: '#5A5955', lineHeight: 1.55 }}
                    >
                      <span style={{ color: '#E8A020', marginTop: 2, fontSize: 8, lineHeight: '18px' }}>●</span>
                      {gap}
                    </li>
                  ))}
                </ul>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
