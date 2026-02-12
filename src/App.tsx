import { BrowserRouter, Navigate, Route, Routes } from 'react-router-dom';
import { Layout } from './components/Layout';
import { Overview } from './pages/Overview';
import { FlowMode } from './pages/FlowMode';
import { StudyCoach } from './pages/StudyCoach';
import { Progress } from './pages/Progress';
import { APP_ROUTES, ROUTE_SEGMENTS } from './routes';

const appRoutes = [
  { path: ROUTE_SEGMENTS.overview, element: <Overview /> },
  { path: ROUTE_SEGMENTS.flowMode, element: <FlowMode /> },
  { path: ROUTE_SEGMENTS.studyCoach, element: <StudyCoach /> },
  { path: ROUTE_SEGMENTS.progress, element: <Progress /> },
];

function App() {
  return (
    <BrowserRouter>
      <Routes>
        <Route path="/" element={<Layout />}>
          <Route index element={<Navigate to={APP_ROUTES.overview} replace />} />
          {appRoutes.map((route) => (
            <Route key={route.path} path={route.path} element={route.element} />
          ))}
          <Route path="*" element={<Navigate to={APP_ROUTES.overview} replace />} />
        </Route>
      </Routes>
    </BrowserRouter>
  );
}

export default App;
