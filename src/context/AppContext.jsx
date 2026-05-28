import { createContext, useContext, useReducer, useCallback } from 'react';

const AppContext = createContext(null);

const initialState = {
  topic: '',
  contextSelection: '',
  selfAssessment: '',
  uploadedFiles: [],
  uploadedContext: '',
  openingConfidence: null,
  conversationHistory: [],
  knowledgePanelState: {
    overall_score: 0,
    concepts: [],
    gaps: [],
  },
  sessionPhase: 'onboarding', // 'onboarding' | 'teaching' | 'quiz' | 'results'
  sessionMode: 'explanation', // 'explanation' | 'misconception' | 'problem' | 'connection'
  topicType: null,            // 'procedural' | 'conceptual'
  exchangeCount: 0,
  modeHistory: [],            // [{ mode, startedAtExchange }]
  quizQuestions: [],
  quizResults: [],
  resultsReflection: {},
  panelFrozen: false,
  previousConfidence: null, // for "teach again" flow
};

function appReducer(state, action) {
  switch (action.type) {
    case 'SET_TOPIC':
      return { ...state, topic: action.payload };
    case 'SET_CONTEXT':
      return { ...state, contextSelection: action.payload };
    case 'SET_ASSESSMENT':
      return { ...state, selfAssessment: action.payload };
    case 'ADD_FILE':
      return {
        ...state,
        uploadedFiles: [...state.uploadedFiles, action.payload],
        uploadedContext: [...state.uploadedFiles, action.payload]
          .map((f) => f.text)
          .join('\n\n---\n\n'),
      };
    case 'REMOVE_FILE': {
      const remaining = state.uploadedFiles.filter((_, i) => i !== action.payload);
      return {
        ...state,
        uploadedFiles: remaining,
        uploadedContext: remaining.map((f) => f.text).join('\n\n---\n\n'),
      };
    }
    case 'SET_CONFIDENCE':
      return { ...state, openingConfidence: action.payload };
    case 'ADD_MESSAGE':
      return {
        ...state,
        conversationHistory: [...state.conversationHistory, action.payload],
      };
    case 'APPEND_TO_LAST_MESSAGE': {
      const history = [...state.conversationHistory];
      if (history.length > 0) {
        history[history.length - 1] = {
          ...history[history.length - 1],
          content: history[history.length - 1].content + action.payload,
        };
      }
      return { ...state, conversationHistory: history };
    }
    case 'UPDATE_KNOWLEDGE_PANEL':
      return { ...state, knowledgePanelState: action.payload };
    case 'SET_PHASE':
      return { ...state, sessionPhase: action.payload };
    case 'SET_SESSION_MODE':
      return { ...state, sessionMode: action.payload };
    case 'SET_TOPIC_TYPE':
      return { ...state, topicType: action.payload };
    case 'INCREMENT_EXCHANGE':
      return { ...state, exchangeCount: state.exchangeCount + 1 };
    case 'ADD_MODE_HISTORY':
      return { ...state, modeHistory: [...state.modeHistory, action.payload] };
    case 'SET_PANEL_FROZEN':
      return { ...state, panelFrozen: action.payload };
    case 'SET_QUIZ_QUESTIONS':
      return { ...state, quizQuestions: action.payload };
    case 'SET_QUIZ_RESULTS':
      return { ...state, quizResults: action.payload };
    case 'SET_REFLECTION':
      return { ...state, resultsReflection: action.payload };
    case 'RESET_FULL':
      return { ...initialState };
    case 'RESET_RETEACH':
      return {
        ...initialState,
        topic: state.topic,
        contextSelection: state.contextSelection,
        selfAssessment: state.selfAssessment,
        uploadedFiles: state.uploadedFiles,
        uploadedContext: state.uploadedContext,
        previousConfidence: state.openingConfidence,
      };
    default:
      return state;
  }
}

export function AppProvider({ children }) {
  const [state, dispatch] = useReducer(appReducer, initialState);

  const actions = useCallback(() => ({
    setTopic: (topic) => dispatch({ type: 'SET_TOPIC', payload: topic }),
    setContext: (ctx) => dispatch({ type: 'SET_CONTEXT', payload: ctx }),
    setAssessment: (text) => dispatch({ type: 'SET_ASSESSMENT', payload: text }),
    addFile: (file) => dispatch({ type: 'ADD_FILE', payload: file }),
    removeFile: (index) => dispatch({ type: 'REMOVE_FILE', payload: index }),
    setConfidence: (rating) => dispatch({ type: 'SET_CONFIDENCE', payload: rating }),
    addMessage: (msg) => dispatch({ type: 'ADD_MESSAGE', payload: msg }),
    appendToLastMessage: (text) => dispatch({ type: 'APPEND_TO_LAST_MESSAGE', payload: text }),
    updateKnowledgePanel: (data) => dispatch({ type: 'UPDATE_KNOWLEDGE_PANEL', payload: data }),
    setPhase: (phase) => dispatch({ type: 'SET_PHASE', payload: phase }),
    setSessionMode: (mode) => dispatch({ type: 'SET_SESSION_MODE', payload: mode }),
    setTopicType: (type) => dispatch({ type: 'SET_TOPIC_TYPE', payload: type }),
    incrementExchange: () => dispatch({ type: 'INCREMENT_EXCHANGE' }),
    addModeHistory: (entry) => dispatch({ type: 'ADD_MODE_HISTORY', payload: entry }),
    setPanelFrozen: (frozen) => dispatch({ type: 'SET_PANEL_FROZEN', payload: frozen }),
    setQuizQuestions: (questions) => dispatch({ type: 'SET_QUIZ_QUESTIONS', payload: questions }),
    setQuizResults: (results) => dispatch({ type: 'SET_QUIZ_RESULTS', payload: results }),
    setReflection: (reflection) => dispatch({ type: 'SET_REFLECTION', payload: reflection }),
    resetFull: () => dispatch({ type: 'RESET_FULL' }),
    resetReteach: () => dispatch({ type: 'RESET_RETEACH' }),
  }), []);

  return (
    <AppContext.Provider value={{ state, dispatch, ...actions() }}>
      {children}
    </AppContext.Provider>
  );
}

/* eslint-disable react-refresh/only-export-components */
export function useApp() {
  const context = useContext(AppContext);
  if (!context) {
    throw new Error('useApp must be used within an AppProvider');
  }
  return context;
}
