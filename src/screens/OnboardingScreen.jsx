import { useState, useRef, useEffect } from 'react';
import { useApp } from '../context/AppContext';
import SageAvatar from '../components/SageAvatar';
import FileDropzone from '../components/FileDropzone';
import { checkContextLength } from '../services/fileParser';

const CONTEXT_OPTIONS = [
  { id: 'exam_prep', emoji: '📝', label: 'Exam prep' },
  { id: 'assignment', emoji: '📚', label: 'Class assignment' },
  { id: 'curious', emoji: '🔍', label: 'Just curious' },
  { id: 'other', emoji: '🎯', label: 'Other' },
];

function StepNumber({ number }) {
  return (
    <div
      style={{
        width: 28,
        height: 28,
        borderRadius: '50%',
        background: '#FEF3DC',
        color: '#D4941C',
        fontSize: 13,
        fontWeight: 600,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        flexShrink: 0,
        border: '1px solid #F5D89A',
      }}
    >
      {number}
    </div>
  );
}

export default function OnboardingScreen() {
  const { state, setTopic, setContext, setAssessment, addFile, setConfidence, setPhase } = useApp();
  const [currentStep, setCurrentStep] = useState(1);
  const [topicInput, setTopicInput] = useState('');
  const [assessmentInput, setAssessmentInput] = useState('');
  const [truncationNotice, setTruncationNotice] = useState(null);
  const [selectedConfidence, setSelectedConfidence] = useState(null);
  const bottomRef = useRef(null);

  // Auto-scroll down when step changes
  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth', block: 'end' });
  }, [currentStep]);

  const handleTopicSubmit = () => {
    if (!topicInput.trim()) return;
    setTopic(topicInput.trim());
    setCurrentStep(2);
  };

  const handleContextSelect = (id) => {
    setContext(id);
    setCurrentStep(3);
  };

  const handleAssessmentContinue = () => {
    setAssessment(assessmentInput.trim());
    setCurrentStep(4);
  };

  const handleFileContinue = () => {
    setCurrentStep(5);
  };

  const handleFileProcessed = (file) => {
    addFile(file);
    const notice = checkContextLength(
      [...state.uploadedFiles, file].map((f) => f.text).join('\n\n')
    );
    if (notice.truncated) {
      setTruncationNotice(notice.message);
    }
  };

  const handleConfidenceSelect = (rating) => {
    setSelectedConfidence(rating);
    // Small delay to show the selection animation before transitioning
    setTimeout(() => {
      setConfidence(rating);
      setPhase('teaching');
    }, 200);
  };

  return (
    <div className="min-h-screen flex items-start justify-center px-6 py-16 md:py-24">
      <div className="w-full max-w-[520px]">
        {/* Welcome block */}
        <div className="text-center animate-fade-in" style={{ paddingTop: 48, paddingBottom: 48 }}>
          <div className="flex justify-center mb-5">
            <SageAvatar size="lg" state="neutral" />
          </div>
          <h1 style={{ fontSize: 28, fontWeight: 700 }} className="text-navy-100 tracking-tight">
            Hi, I'm Sage.
          </h1>
          <p className="mt-3 text-navy-400" style={{ fontSize: 15, fontWeight: 400, maxWidth: 380, margin: '12px auto 0' }}>
            Teach me something — I'll ask questions, and we'll figure out together what you actually know.
          </p>
        </div>

        {/* Step 1: Topic Input */}
        <div className="animate-slide-up" style={{ marginBottom: 32 }}>
          <div className="flex items-start gap-3 mb-4">
            <StepNumber number={1} />
            <label style={{ fontSize: 16, fontWeight: 600 }} className="text-navy-100 pt-0.5">
              What do you want to teach Sage today?
            </label>
          </div>
          <div style={{ paddingLeft: 40 }}>
            <input
              type="text"
              value={topicInput}
              onChange={(e) => setTopicInput(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && handleTopicSubmit()}
              placeholder="e.g., Photosynthesis, Supply and demand, The causes of World War I"
              className="w-full rounded-xl bg-white border border-navy-700 text-navy-100 placeholder:text-navy-500 truncate transition-all duration-200"
              style={{ height: 52, padding: '0 20px', fontSize: 15 }}
              autoFocus
            />
            <div className="flex justify-center" style={{ marginTop: 32 }}>
              <button
                onClick={handleTopicSubmit}
                disabled={!topicInput.trim()}
                className="rounded-xl bg-accent-amber text-charcoal font-semibold text-[15px] btn-hover-lift disabled:opacity-40 disabled:cursor-not-allowed disabled:transform-none"
                style={{ height: 52, maxWidth: 320, width: '100%' }}
              >
                Let's go
              </button>
            </div>
          </div>
        </div>

        {/* Step 2: Context Selection */}
        {currentStep >= 2 && (
          <div className="animate-slide-up" style={{ marginTop: 32 }}>
            <div className="flex items-start gap-3 mb-4">
              <StepNumber number={2} />
              <label style={{ fontSize: 16, fontWeight: 600 }} className="text-navy-100 pt-0.5">
                What's this for?
              </label>
            </div>
            <div className="flex flex-wrap gap-3" style={{ paddingLeft: 40 }}>
              {CONTEXT_OPTIONS.map((opt) => (
                <button
                  key={opt.id}
                  onClick={() => handleContextSelect(opt.id)}
                  className="transition-all duration-200"
                  style={{
                    height: 44,
                    padding: '0 16px',
                    borderRadius: 10,
                    fontSize: 14,
                    fontWeight: 500,
                    display: 'flex',
                    alignItems: 'center',
                    gap: 8,
                    background: state.contextSelection === opt.id ? '#FEF3DC' : '#F5F4F0',
                    border: state.contextSelection === opt.id ? '1.5px solid #F5A623' : '1.5px solid transparent',
                    color: state.contextSelection === opt.id ? '#B8801A' : '#3D3D3A',
                    cursor: 'pointer',
                  }}
                >
                  <span style={{ fontSize: 16 }}>{opt.emoji}</span>
                  {opt.label}
                </button>
              ))}
            </div>
          </div>
        )}

        {/* Step 3: Self-Assessment */}
        {currentStep >= 3 && (
          <div className="animate-slide-up" style={{ marginTop: 32 }}>
            <div className="flex items-start gap-3 mb-2">
              <StepNumber number={3} />
              <label style={{ fontSize: 16, fontWeight: 600 }} className="text-navy-100 pt-0.5">
                Anything you already feel solid on, or anything you're specifically confused about?
              </label>
            </div>
            <div style={{ paddingLeft: 40 }}>
              <p className="text-navy-400 mb-4" style={{ fontSize: 13, fontWeight: 400 }}>
                Optional — this helps Sage ask better questions.
              </p>
              <textarea
                value={assessmentInput}
                onChange={(e) => setAssessmentInput(e.target.value)}
                placeholder="e.g., I understand the basic definition but I'm fuzzy on how it connects to market failure, or I've never studied this before."
                rows={4}
                className="w-full rounded-xl bg-white border border-navy-700 text-navy-100 placeholder:text-navy-500 resize-none transition-all duration-200"
                style={{ padding: '14px 20px', fontSize: 14, lineHeight: 1.65 }}
              />
              <div className="mt-5 flex justify-center">
                {assessmentInput.trim() ? (
                  <button
                    onClick={handleAssessmentContinue}
                    className="rounded-xl border-2 border-navy-700 text-navy-200 font-semibold text-[14px] hover:border-accent-amber hover:text-accent-amber transition-all duration-200 btn-hover-lift"
                    style={{ height: 48, width: '100%', maxWidth: 320 }}
                  >
                    Continue
                  </button>
                ) : (
                  <button
                    onClick={handleAssessmentContinue}
                    className="py-2.5 text-navy-400 text-sm font-semibold hover:underline hover:text-navy-300 transition-colors"
                  >
                    Skip
                  </button>
                )}
              </div>
            </div>
          </div>
        )}

        {/* Step 4: File Upload */}
        {currentStep >= 4 && (
          <div className="animate-slide-up" style={{ marginTop: 32 }}>
            <div className="flex items-start gap-3 mb-2">
              <StepNumber number={4} />
              <label style={{ fontSize: 16, fontWeight: 600 }} className="text-navy-100 pt-0.5">
                Got any notes or materials? Upload them and Sage will use them.
              </label>
            </div>
            <div style={{ paddingLeft: 40 }}>
              <p className="text-navy-400 mb-4" style={{ fontSize: 13, fontWeight: 400 }}>
                Optional — lecture notes, a textbook chapter, a syllabus, slides. Sage will ground its questions in your actual course material.
              </p>

              <FileDropzone
                onFileProcessed={handleFileProcessed}
                maxFiles={3}
                existingFiles={state.uploadedFiles}
              />

              {truncationNotice && (
                <div className="mt-4 flex items-center gap-2 text-sm text-accent-amber animate-fade-in font-medium">
                  <svg className="w-4 h-4 flex-shrink-0" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                    <circle cx="12" cy="12" r="10" />
                    <line x1="12" y1="8" x2="12" y2="12" />
                    <line x1="12" y1="16" x2="12.01" y2="16" />
                  </svg>
                  {truncationNotice}
                </div>
              )}

              <div className="mt-5 flex justify-center">
                {state.uploadedFiles.length > 0 ? (
                  <button
                    onClick={handleFileContinue}
                    className="rounded-xl border-2 border-navy-700 text-navy-200 font-semibold text-[14px] hover:border-accent-amber hover:text-accent-amber transition-all duration-200 btn-hover-lift"
                    style={{ height: 48, width: '100%', maxWidth: 320 }}
                  >
                    Continue
                  </button>
                ) : (
                  <button
                    onClick={handleFileContinue}
                    className="py-2.5 text-navy-400 text-sm font-semibold hover:underline hover:text-navy-300 transition-colors"
                  >
                    Skip
                  </button>
                )}
              </div>
            </div>
          </div>
        )}

        {/* Step 5: Confidence Calibration */}
        {currentStep >= 5 && (
          <div className="animate-slide-up" style={{ marginTop: 32 }}>
            <div className="flex items-start gap-3 mb-2">
              <StepNumber number={5} />
              <label style={{ fontSize: 16, fontWeight: 600 }} className="text-navy-100 pt-0.5 leading-snug">
                Last thing — before you start teaching, how confident are you that you could explain{' '}
                <span className="text-accent-amber">{state.topic}</span> to someone who has never heard of it?
              </label>
            </div>
            <div style={{ paddingLeft: 40 }}>
              {state.previousConfidence && (
                <p className="text-sm text-accent-amber mb-5 animate-fade-in font-medium">
                  Last time you rated yourself {state.previousConfidence}/5. How about now?
                </p>
              )}

              <div className="flex gap-3 mt-6 justify-center">
                {[1, 2, 3, 4, 5].map((n) => (
                  <button
                    key={n}
                    onClick={() => handleConfidenceSelect(n)}
                    style={{
                      width: 64,
                      height: 64,
                      borderRadius: 16,
                      fontSize: 24,
                      fontWeight: 600,
                      border: selectedConfidence === n ? '2px solid #F5A623' : '1.5px solid #E0DED8',
                      background: selectedConfidence === n ? '#F5A623' : '#FFFFFF',
                      color: selectedConfidence === n ? '#1C1C1E' : '#3D3D3A',
                      cursor: 'pointer',
                      transition: 'all 0.15s ease-out',
                      transform: selectedConfidence === n ? 'scale(1.1)' : 'scale(1)',
                      boxShadow: selectedConfidence === n ? '0 4px 14px rgba(245,166,35,0.3)' : '0 1px 3px rgba(0,0,0,0.04)',
                    }}
                  >
                    {n}
                  </button>
                ))}
              </div>
              <div className="flex justify-between mt-4 px-1" style={{ maxWidth: 340, margin: '14px auto 0' }}>
                <span style={{ fontSize: 11, color: '#9B9A96', fontWeight: 500, letterSpacing: '0.04em' }}>Not at all</span>
                <span style={{ fontSize: 11, color: '#9B9A96', fontWeight: 500, letterSpacing: '0.04em' }}>Somewhat</span>
                <span style={{ fontSize: 11, color: '#9B9A96', fontWeight: 500, letterSpacing: '0.04em' }}>Very confident</span>
              </div>
            </div>
          </div>
        )}
        {/* Dummy spacer for auto-scrolling to ensure bottom padding */}
        <div ref={bottomRef} style={{ height: 120, width: '100%' }} />
      </div>
    </div>
  );
}
