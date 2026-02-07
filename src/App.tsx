import { BrowserRouter, Routes, Route } from 'react-router-dom';
import { Layout } from './components/Layout';
import { Overview } from './pages/Overview';
import { FlowMode } from './pages/FlowMode';
import { StudyCoach } from './pages/StudyCoach';
import { Progress } from './pages/Progress';

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
