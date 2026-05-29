import { useState, useEffect } from 'react';
import { useApp } from '../context/AppContext';
import SageAvatar from '../components/SageAvatar';
import TypingIndicator from '../components/TypingIndicator';
import { generateQuizAnswers } from '../services/claude';
import toast from 'react-hot-toast';

export default function QuizScreen() {
  const { state, setQuizResults, setPhase, setPanelFrozen } = useApp();
  const [previewMode, setPreviewMode] = useState(true);
  const [loading, setLoading] = useState(false);
  const [currentQuestion, setCurrentQuestion] = useState(0);
  const [questionPhase, setQuestionPhase] = useState('thinking'); // 'thinking' | 'revealed'
  const [allRevealed, setAllRevealed] = useState(false);

  const { topic, conversationHistory, quizResults, preGeneratedQuiz } = state;

  const evaluateQuiz = async () => {
    setPreviewMode(false);
    setLoading(true);
    try {
      const results = await generateQuizAnswers({
        topic,
        conversationHistory,
        preGeneratedQuiz,
      });
      setQuizResults(results);
    } catch (err) {
      toast.error(`Failed to generate quiz: ${err.message}`);
    } finally {
      setLoading(false);
    }
  };

  const handleGoBack = () => {
    setPanelFrozen(false);
    setPhase('teaching');
  };

  // Auto-advance through questions
  useEffect(() => {
    if (loading || allRevealed || quizResults.length === 0) return;

    if (questionPhase === 'thinking') {
      // 1.5s "thinking" delay
      const timer = setTimeout(() => {
        setQuestionPhase('revealed');
      }, 1500);
      return () => clearTimeout(timer);
    }

    if (questionPhase === 'revealed') {
      // 2s pause then advance
      const timer = setTimeout(() => {
        if (currentQuestion < quizResults.length - 1) {
          setCurrentQuestion((prev) => prev + 1);
          setQuestionPhase('thinking');
        } else {
          setAllRevealed(true);
        }
      }, 2000);
      return () => clearTimeout(timer);
    }
  }, [loading, currentQuestion, questionPhase, allRevealed, quizResults.length]);

  const getResultIcon = (result) => {
    switch (result) {
      case 'correct': return '✅';
      case 'partial': return '🟡';
      case 'incorrect': return '❌';
      default: return '❓';
    }
  };

  const getResultBorderColor = (result) => {
    switch (result) {
      case 'correct': return 'rgba(47,158,74,0.2)';
      case 'partial': return 'rgba(232,160,32,0.2)';
      case 'incorrect': return 'rgba(220,90,90,0.2)';
      default: return '#E0DED8';
    }
  };

  const totalCorrect = quizResults.filter((r) => r.result === 'correct').length;
  const totalPartial = quizResults.filter((r) => r.result === 'partial').length;
  const scorePercentage = quizResults.length > 0
    ? ((totalCorrect + totalPartial * 0.5) / quizResults.length) * 100
    : 0;

  // Preview state
  if (previewMode) {
    return (
      <div className="min-h-screen flex items-center justify-center px-4 bg-cream">
        <div className="w-full max-w-xl text-center animate-fade-in">
          <div className="flex justify-center mb-6">
            <SageAvatar size="lg" state="neutral" />
          </div>
          <h2 className="text-navy-100 mb-6" style={{ fontSize: 24, fontWeight: 600, letterSpacing: '-0.01em' }}>
            Sage will be tested on:
          </h2>
          <div className="flex flex-wrap justify-center gap-3 mb-10">
            {preGeneratedQuiz && preGeneratedQuiz.length > 0 ? (
              preGeneratedQuiz.map((q, idx) => (
                <div
                  key={idx}
                  style={{
                    background: '#FFFFFF',
                    border: '1px solid #E0DED8',
                    borderRadius: 999,
                    padding: '8px 16px',
                    fontSize: 14,
                    fontWeight: 500,
                    color: '#3D3D3A',
                    boxShadow: '0 2px 8px rgba(0,0,0,0.04)'
                  }}
                >
                  {q.concept}
                </div>
              ))
            ) : (
              <div
                style={{
                  background: '#FFFFFF',
                  border: '1px solid #E0DED8',
                  borderRadius: 999,
                  padding: '8px 16px',
                  fontSize: 14,
                  fontWeight: 500,
                  color: '#7A7975',
                  fontStyle: 'italic',
                }}
              >
                The concepts you just explained
              </div>
            )}
          </div>
          
          <div className="flex flex-col sm:flex-row gap-4 justify-center">
            <button
              onClick={handleGoBack}
              className="rounded-xl font-semibold hover:border-accent-amber hover:text-accent-amber transition-all duration-200 btn-hover-lift"
              style={{ height: 48, padding: '0 24px', fontSize: 14, border: '2px solid #E0DED8', color: '#5A5955', background: 'transparent' }}
            >
              Go back and keep teaching
            </button>
            <button
              onClick={evaluateQuiz}
              className="rounded-xl bg-accent-amber text-charcoal font-semibold btn-hover-lift"
              style={{ height: 48, padding: '0 24px', fontSize: 14, boxShadow: '0 2px 12px rgba(245,166,35,0.2)' }}
            >
              Start the quiz
            </button>
          </div>
        </div>
      </div>
    );
  }

  // Loading state
  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center px-4 bg-cream">
        <div className="text-center animate-fade-in">
          <div className="flex justify-center">
            <SageAvatar size="lg" state="thinking" />
          </div>
          <h2 className="mt-5 text-navy-100" style={{ fontSize: 18, fontWeight: 600 }}>
            Sage is taking the quiz...
          </h2>
          <p className="mt-2 text-navy-400" style={{ fontSize: 14, fontWeight: 400 }}>
            Evaluating everything you taught.
          </p>
          <div className="mt-5">
            <TypingIndicator />
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen flex items-start justify-center px-6 py-24 md:py-32 bg-cream">
      <div className="w-full max-w-2xl">
        {/* Header */}
        <div className="text-center mb-20 animate-fade-in">
          <h1 className="text-navy-100" style={{ fontSize: 24, fontWeight: 600, letterSpacing: '-0.01em' }}>
            Let's see what Sage learned.
          </h1>
          <p className="mt-6 text-navy-400 max-w-xl mx-auto" style={{ fontSize: 14, fontWeight: 400, lineHeight: 1.65 }}>
            Sage will now answer some questions based only on what you taught. Watch how it does.
          </p>
        </div>

        {/* Progress dots */}
        <div className="flex justify-center gap-4 mb-20">
          {quizResults.map((_, idx) => {
            let bg = '#E0DED8';
            if (idx < currentQuestion) {
              bg = quizResults[idx].result === 'correct' ? '#2F9E4A' :
                   quizResults[idx].result === 'partial' ? '#E8A020' : '#DC5A5A';
            } else if (idx === currentQuestion) {
              bg = '#F5A623';
            }
            return (
              <div
                key={idx}
                style={{
                  width: 10,
                  height: 10,
                  borderRadius: '50%',
                  background: bg,
                  transition: 'all 0.3s ease',
                  transform: idx === currentQuestion ? 'scale(1.3)' : 'scale(1)',
                }}
              />
            );
          })}
        </div>

        {/* Current question card */}
        {!allRevealed && quizResults[currentQuestion] && (
          <div className="animate-scale-in" key={currentQuestion}>
            <div
              style={{
                background: '#FFFFFF',
                borderRadius: 16,
                padding: '32px 36px',
                border: `1.5px solid ${questionPhase === 'revealed' ? getResultBorderColor(quizResults[currentQuestion].result) : '#E0DED8'}`,
                boxShadow: '0 2px 12px rgba(0,0,0,0.06)',
                transition: 'border-color 0.3s ease',
              }}
            >
              {/* Question number */}
              <div style={{ fontSize: 11, fontWeight: 600, color: '#9B9A96', textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: 16 }}>
                Question {currentQuestion + 1} of {quizResults.length}
              </div>

              {/* Question text */}
              <h3 style={{ fontSize: 16, fontWeight: 600, color: '#1C1C1E', marginBottom: 24, lineHeight: 1.45 }}>
                {quizResults[currentQuestion].question}
              </h3>

              {/* Sage thinking or answer */}
              {questionPhase === 'thinking' ? (
                <div className="flex items-center gap-3">
                  <SageAvatar size="sm" state="thinking" />
                  <div style={{ background: '#FEF9EC', borderRadius: '4px 14px 14px 14px', padding: '12px 18px' }}>
                    <TypingIndicator />
                  </div>
                </div>
              ) : (
                <div className="animate-fade-in" style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
                  {/* Sage's answer */}
                  <div className="flex items-start gap-3">
                    <SageAvatar size="sm" state="neutral" />
                    <div className="flex-1">
                      <div className="flex items-center gap-2 mb-2">
                        <span style={{ fontSize: 13, fontWeight: 500, color: '#5A5955' }}>Sage's answer</span>
                        <span style={{ fontSize: 16 }}>{getResultIcon(quizResults[currentQuestion].result)}</span>
                      </div>
                      <p style={{
                        fontSize: 14,
                        color: '#3D3D3A',
                        background: '#FEF9EC',
                        borderRadius: '4px 14px 14px 14px',
                        padding: '14px 18px',
                        lineHeight: 1.6,
                      }}>
                        {quizResults[currentQuestion].sage_answer}
                      </p>
                      {quizResults[currentQuestion].was_taught === false && (
                        <p style={{ fontSize: 12, color: '#DC5A5A', fontStyle: 'italic', marginTop: 8 }}>
                          Sage was never taught this — it wasn't covered in your explanation.
                        </p>
                      )}
                    </div>
                  </div>

                  {/* Correct answer */}
                  <div style={{ paddingLeft: 44 }}>
                    <p style={{ fontSize: 11, fontWeight: 600, color: '#2F9E4A', textTransform: 'uppercase', letterSpacing: '0.04em', marginBottom: 4 }}>Correct answer</p>
                    <p style={{ fontSize: 13, color: '#3D3D3A', lineHeight: 1.55 }}>{quizResults[currentQuestion].correct_answer}</p>
                  </div>

                  {/* Explanation */}
                  <div style={{ paddingLeft: 44 }}>
                    <p style={{ fontSize: 12, color: '#7A7975', fontStyle: 'italic', lineHeight: 1.55 }}>
                      {quizResults[currentQuestion].explanation}
                    </p>
                  </div>
                </div>
              )}
            </div>
          </div>
        )}

        {/* Final score */}
        {allRevealed && (
          <div className="animate-scale-in">
            <div
              className="text-center"
              style={{
                background: '#FFFFFF',
                borderRadius: 16,
                padding: '48px 40px',
                border: '1px solid #E0DED8',
                boxShadow: '0 2px 12px rgba(0,0,0,0.06)',
              }}
            >
              {/* Score circle */}
              <div className="relative mx-auto" style={{ width: 120, height: 120, marginBottom: 32 }}>
                <svg className="w-full h-full -rotate-90" viewBox="0 0 100 100">
                  <circle
                    cx="50" cy="50" r="42" fill="none"
                    stroke="rgba(0, 0, 0, 0.05)" strokeWidth="8"
                  />
                  <circle
                    cx="50" cy="50" r="42" fill="none"
                    stroke={scorePercentage >= 75 ? '#2F9E4A' : scorePercentage >= 50 ? '#E8A020' : '#DC5A5A'}
                    strokeWidth="8" strokeLinecap="round"
                    strokeDasharray={`${2 * Math.PI * 42}`}
                    strokeDashoffset={`${2 * Math.PI * 42 * (1 - scorePercentage / 100)}`}
                    style={{ transition: 'all 0.7s ease-out' }}
                  />
                </svg>
                <div className="absolute inset-0 flex flex-col items-center justify-center">
                  <span style={{ fontSize: 36, fontWeight: 700, color: '#1C1C1E' }}>{totalCorrect}</span>
                  <span style={{ fontSize: 11, fontWeight: 500, color: '#9B9A96', textTransform: 'uppercase', letterSpacing: '0.06em' }}>out of {quizResults.length}</span>
                </div>
              </div>

              <h2 style={{ fontSize: 18, fontWeight: 600, color: '#1C1C1E', marginBottom: 12 }}>
                Sage got {totalCorrect} out of {quizResults.length}.
              </h2>
              <p className="text-navy-400" style={{ fontSize: 14, fontWeight: 400, maxWidth: 380, margin: '0 auto 36px', lineHeight: 1.65 }}>
                {totalCorrect >= 3
                  ? "You taught Sage well."
                  : totalCorrect >= 2
                    ? "Sage picked up some of what you taught, but has a few gaps."
                    : "Sage still has some gaps — see what to review below."
                }
              </p>

              <button
                onClick={() => setPhase('results')}
                className="rounded-xl bg-accent-amber text-charcoal font-semibold btn-hover-lift"
                style={{ padding: '0 32px', height: 48, fontSize: 14 }}
              >
                See your full results
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
