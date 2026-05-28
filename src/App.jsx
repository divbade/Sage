import { AppProvider, useApp } from './context/AppContext';
import OnboardingScreen from './screens/OnboardingScreen';
import SessionScreen from './screens/SessionScreen';
import QuizScreen from './screens/QuizScreen';
import ResultsScreen from './screens/ResultsScreen';
import { Toaster } from 'react-hot-toast';

function AppContent() {
  const { state } = useApp();

  switch (state.sessionPhase) {
    case 'onboarding':
      return <OnboardingScreen />;
    case 'teaching':
      return <SessionScreen />;
    case 'quiz':
      return <QuizScreen />;
    case 'results':
      return <ResultsScreen />;
    default:
      return <OnboardingScreen />;
  }
}

export default function App() {
  return (
    <AppProvider>
      <AppContent />
      <Toaster
        position="bottom-right"
        toastOptions={{
          duration: 5000,
          style: {
            background: '#FFFFFF',
            color: '#1C1C1E',
            border: '1px solid #E8E6E1',
            borderRadius: '12px',
            fontSize: '14px',
            fontFamily: "'Plus Jakarta Sans', sans-serif",
            boxShadow: '0 4px 12px rgba(0, 0, 0, 0.08)',
          },
          error: {
            iconTheme: {
              primary: '#DC5A5A',
              secondary: '#FFFFFF',
            },
          },
        }}
      />
    </AppProvider>
  );
}
