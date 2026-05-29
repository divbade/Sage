import { useState, useEffect } from 'react';
import { useApp } from '../context/AppContext';
import SageAvatar from '../components/SageAvatar';
import { generateResultsReflection } from '../services/claude';
import toast from 'react-hot-toast';

export default function ResultsScreen() {
  const {
    state,
    setReflection,
    resetFull,
    resetReteach,
    setPhase,
  } = useApp();

  const [loading, setLoading] = useState(true);

  const {
    topic,
    contextSelection,
    openingConfidence,
    knowledgePanelState,
    quizResults,
    resultsReflection,
    uploadedFiles,
    preGeneratedQuiz,
  } = state;

  const totalCorrect = quizResults.filter((r) => r.result === 'correct').length;
  const scorePercentage = quizResults.length > 0
    ? Math.round((totalCorrect / quizResults.length) * 100)
    : 0;

  const loadReflection = async () => {
    try {
      const reflection = await generateResultsReflection({
        topic,
        openingConfidence,
        quizResults,
        knowledgePanelState,
        contextSelection,
      });
      setReflection(reflection);
    } catch (err) {
      toast.error(`Failed to generate reflection: ${err.message}`);
      setReflection({
        calibration_reflection: 'Unable to generate reflection at this time.',
        study_recommendation: 'Review the concepts that Sage struggled with below.',
      });
    } finally {
      setLoading(false);
    }
  };

  // Generate reflection on mount
  useEffect(() => {
    loadReflection();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Save to localStorage
  useEffect(() => {
    if (!loading) {
      try {
        const sessionData = {
          timestamp: Date.now(),
          topic: state.topic,
          contextSelection: state.contextSelection,
          selfAssessment: state.selfAssessment,
          uploadedFileNames: state.uploadedFiles.map((f) => f.name),
          openingConfidence: state.openingConfidence,
          conversationHistory: state.conversationHistory,
          finalKnowledgePanelState: state.knowledgePanelState,
          quizResults: state.quizResults,
          resultsReflection: state.resultsReflection,
          preGeneratedQuiz: state.preGeneratedQuiz,
        };
        localStorage.setItem(
          `sage_session_${sessionData.timestamp}`,
          JSON.stringify(sessionData)
        );
      } catch {
        // localStorage might be full — not critical
      }
    }
  }, [loading, state]);

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

  const pillConfig = {
    low: { label: 'Getting it', bg: '#FCE8E6', text: '#A82B2B', border: '#FAD2CD' },
    medium: { label: 'Mostly there', bg: '#FFF6E6', text: '#B8801A', border: '#FFE7C2' },
    high: { label: 'Solid', bg: '#EAF6EC', text: '#15803D', border: '#D5F0DB' },
  };

  const handleTeachAnother = () => {
    resetFull();
    setPhase('onboarding');
  };

  const handleTeachAgain = () => {
    resetReteach();
    setPhase('onboarding');
  };

  const conceptsToReview = quizResults.filter(
    (r) => r.was_taught === false || r.result === 'incorrect'
  );

  return (
    <div className="min-h-screen flex items-start justify-center px-6 py-16 md:py-24 bg-cream">
      <div className="w-full max-w-3xl" style={{ display: 'flex', flexDirection: 'column', gap: 48 }}>
        {/* Section 1: Quiz Results Summary */}
        <section className="animate-slide-up">
          <h1 style={{ fontSize: 24, fontWeight: 600, color: '#1C1C1E', marginBottom: 28, letterSpacing: '-0.01em' }}>
            How did Sage do?
          </h1>

          <div
            style={{
              background: '#FFFFFF',
              borderRadius: 16,
              padding: '32px 36px',
              border: '1px solid #E0DED8',
              boxShadow: '0 2px 12px rgba(0,0,0,0.06)',
            }}
          >
            <div className="flex items-center gap-5" style={{ marginBottom: 28 }}>
              <SageAvatar size="lg" state={totalCorrect >= 3 ? 'happy' : 'neutral'} />
              <div>
                <p style={{ fontSize: 22, fontWeight: 600, color: '#1C1C1E' }}>
                  {totalCorrect} out of {quizResults.length}
                </p>
                <p style={{ fontSize: 14, color: '#7A7975', marginTop: 6, lineHeight: 1.55 }}>
                  {totalCorrect >= 3
                    ? 'You taught Sage well.'
                    : 'Sage still has some gaps — see what to review below.'}
                </p>
              </div>
            </div>

            {/* Quiz question cards */}
            <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
              {quizResults.map((result, idx) => (
                <div
                  key={idx}
                  className="animate-slide-up"
                  style={{
                    borderRadius: 12,
                    border: `1px solid ${getResultBorderColor(result.result)}`,
                    background: '#FAFAF7',
                    padding: '20px 24px',
                    animationDelay: `${idx * 100}ms`,
                  }}
                >
                  <div className="flex items-start gap-4">
                    <span style={{ fontSize: 20, marginTop: 1 }}>{getResultIcon(result.result)}</span>
                    <div className="flex-1">
                      <p style={{ fontSize: 15, fontWeight: 600, color: '#3D3D3A', marginBottom: 8, lineHeight: 1.4 }}>
                        {result.question}
                      </p>
                      <p style={{ fontSize: 13, color: '#7A7975', marginBottom: 8, lineHeight: 1.55 }}>
                        Sage answered: "{result.sage_answer}"
                      </p>
                      <p style={{ fontSize: 12, color: '#9B9A96', fontStyle: 'italic', lineHeight: 1.55 }}>
                        {result.explanation}
                      </p>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </section>

        {/* Section 2: Calibration Comparison */}
        <section className="animate-slide-up" style={{ animationDelay: '200ms' }}>
          <h2 style={{ fontSize: 20, fontWeight: 600, color: '#1C1C1E', marginBottom: 28 }}>
            How well did you know it?
          </h2>

          <div
            style={{
              background: '#FFFFFF',
              borderRadius: 16,
              padding: '32px 36px',
              border: '1px solid #E0DED8',
              boxShadow: '0 2px 12px rgba(0,0,0,0.06)',
            }}
          >
            {/* Before / After comparison */}
            <div className="grid grid-cols-2 gap-8" style={{ marginBottom: 28 }}>
              <div className="text-center">
                <p style={{ fontSize: 11, fontWeight: 600, color: '#9B9A96', textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: 10 }}>
                  Your confidence
                </p>
                <div style={{ fontSize: 42, fontWeight: 700, color: '#3b82f6' }}>
                  {openingConfidence}
                  <span style={{ fontSize: 16, color: '#9B9A96', fontWeight: 500 }}>/5</span>
                </div>
                <p style={{ fontSize: 11, color: '#9B9A96', marginTop: 6, fontWeight: 500, letterSpacing: '0.04em', textTransform: 'uppercase' }}>Before teaching</p>
              </div>
              <div className="text-center">
                <p style={{ fontSize: 11, fontWeight: 600, color: '#9B9A96', textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: 10 }}>
                  Sage's score
                </p>
                <div style={{
                  fontSize: 42,
                  fontWeight: 700,
                  color: scorePercentage >= 75 ? '#2F9E4A' : scorePercentage >= 50 ? '#E8A020' : '#DC5A5A',
                }}>
                  {scorePercentage}
                  <span style={{ fontSize: 16, color: '#9B9A96', fontWeight: 500 }}>%</span>
                </div>
                <p style={{ fontSize: 11, color: '#9B9A96', marginTop: 6, fontWeight: 500, letterSpacing: '0.04em', textTransform: 'uppercase' }}>Quiz performance</p>
              </div>
            </div>

            {/* Separator */}
            <div style={{ height: 1, background: '#E0DED8', marginBottom: 24 }} />

            {/* Calibration reflection */}
            {loading ? (
              <div className="h-12 flex items-center justify-center">
                <div className="flex gap-2">
                  <div className="w-2.5 h-2.5 rounded-full bg-navy-600 animate-pulse-dot" style={{ animationDelay: '0ms' }} />
                  <div className="w-2.5 h-2.5 rounded-full bg-navy-600 animate-pulse-dot" style={{ animationDelay: '200ms' }} />
                  <div className="w-2.5 h-2.5 rounded-full bg-navy-600 animate-pulse-dot" style={{ animationDelay: '400ms' }} />
                </div>
              </div>
            ) : (
              <p className="animate-fade-in" style={{ fontSize: 14, color: '#5A5955', lineHeight: 1.65 }}>
                {resultsReflection.calibration_reflection}
              </p>
            )}
          </div>
        </section>

        {/* Section 3: What to focus on next */}
        <section className="animate-slide-up" style={{ animationDelay: '400ms' }}>
          <h2 style={{ fontSize: 20, fontWeight: 600, color: '#1C1C1E', marginBottom: 28 }}>
            What to focus on next.
          </h2>

          <div
            style={{
              background: '#FFFFFF',
              borderRadius: 16,
              padding: '32px 36px',
              border: '1px solid #E0DED8',
              boxShadow: '0 2px 12px rgba(0,0,0,0.06)',
            }}
          >
            {/* Study recommendation */}
            {!loading && resultsReflection.study_recommendation && (
              <p className="animate-fade-in" style={{ fontSize: 14, color: '#5A5955', lineHeight: 1.65, marginBottom: 28 }}>
                {resultsReflection.study_recommendation}
              </p>
            )}

            {/* Concepts to review */}
            {conceptsToReview.length > 0 && (
              <div style={{ marginBottom: 28 }}>
                <h3 style={{ fontSize: 11, fontWeight: 600, color: '#9B9A96', textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: 14 }}>
                  Concepts to review
                </h3>
                <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                  {conceptsToReview.map((result, idx) => {
                    const conceptName = preGeneratedQuiz?.find(q => q.id === result.question_id)?.concept || result.question;
                    return (
                      <div
                        key={idx}
                        style={{
                          borderRadius: 12,
                          padding: '16px 20px',
                          background: '#FAFAF7',
                          border: '1px solid #E0DED8',
                        }}
                      >
                        <div className="flex items-center justify-between" style={{ marginBottom: 8 }}>
                          <span style={{ fontSize: 14, fontWeight: 600, color: '#3D3D3A' }}>
                            {conceptName}
                          </span>
                          <span
                            style={{
                              fontSize: 11,
                              fontWeight: 500,
                              color: result.was_taught === false ? '#A82B2B' : '#B8801A',
                              background: result.was_taught === false ? '#FCE8E6' : '#FFF6E6',
                              border: `1px solid ${result.was_taught === false ? '#FAD2CD' : '#FFE7C2'}`,
                              borderRadius: 999,
                              padding: '2px 10px',
                              whiteSpace: 'nowrap',
                            }}
                          >
                            {result.was_taught === false ? 'Never taught' : 'Missed question'}
                          </span>
                        </div>
                        <p style={{ fontSize: 12, color: '#7A7975', fontStyle: 'italic', lineHeight: 1.55 }}>
                          "{result.question}"
                        </p>
                      </div>
                    );
                  })}
                </div>
              </div>
            )}

            {/* Gaps */}
            {knowledgePanelState.gaps.length > 0 && (
              <div style={{ marginBottom: 28 }}>
                <h3 style={{ fontSize: 12, fontWeight: 500, color: '#9B9A96', marginBottom: 12 }}>
                  Things Sage never fully understood from your explanation
                </h3>
                <ul style={{ listStyle: 'none', padding: 0, margin: 0, display: 'flex', flexDirection: 'column', gap: 10 }}>
                  {knowledgePanelState.gaps.map((gap, idx) => (
                    <li key={idx} style={{ display: 'flex', alignItems: 'flex-start', gap: 10, fontSize: 14, color: '#5A5955', lineHeight: 1.55 }}>
                      <span style={{ color: '#E8A020', marginTop: 3, fontSize: 8 }}>●</span>
                      {gap}
                    </li>
                  ))}
                </ul>
              </div>
            )}

            {/* Uploaded files note */}
            {uploadedFiles.length > 0 && (
              <div
                style={{
                  padding: '14px 20px',
                  borderRadius: 10,
                  background: 'rgba(59,130,246,0.06)',
                  border: '1px solid rgba(59,130,246,0.1)',
                  fontSize: 14,
                  color: '#3b82f6',
                  fontWeight: 500,
                }}
              >
                These concepts appear in your uploaded materials — look there first.
              </div>
            )}
          </div>
        </section>

        {/* Action buttons */}
        <div className="flex flex-col sm:flex-row gap-4 animate-slide-up" style={{ animationDelay: '600ms', paddingBottom: 80 }}>
          <button
            onClick={handleTeachAnother}
            className="flex-1 rounded-xl bg-accent-amber text-charcoal font-semibold btn-hover-lift"
            style={{ height: 52, fontSize: 14, boxShadow: '0 2px 12px rgba(245,166,35,0.2)' }}
          >
            Teach another topic
          </button>
          <button
            onClick={handleTeachAgain}
            className="flex-1 rounded-xl font-semibold hover:border-accent-amber hover:text-accent-amber transition-all duration-200 btn-hover-lift"
            style={{ height: 52, fontSize: 14, border: '2px solid #E0DED8', color: '#5A5955', background: 'transparent' }}
          >
            Teach this topic again
          </button>
        </div>
      </div>
    </div>
  );
}
