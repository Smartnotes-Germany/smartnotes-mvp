import { BrowserRouter, Routes, Route } from 'react-router-dom';
import { Layout } from './components/Layout';
import { Overview } from './pages/Overview';
import { FlowMode } from './pages/FlowMode';
import { StudyCoach } from './pages/StudyCoach';
import { Progress } from './pages/Progress';

// Placeholder components until real ones are created
const Placeholder = ({ title }: { title: string }) => (
  <div className="flex items-center justify-center h-full text-2xl text-slate-400 font-serif">{title} - Wird geladen...</div>
);

function App() {
  return (
    <BrowserRouter>
      <Routes>
        <Route path="/" element={<Layout />}>
          <Route index element={<Overview />} />
          <Route path="1" element={<Overview />} />
          <Route path="2" element={<FlowMode />} />
          <Route path="4" element={<StudyCoach />} />
          <Route path="5" element={<Progress />} />
        </Route>
      </Routes>
    </BrowserRouter>
  );
}

export default App;
