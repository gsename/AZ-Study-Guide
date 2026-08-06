import { HashRouter, Routes, Route, Navigate } from 'react-router-dom'
import Layout from './components/Layout'
import Dashboard from './pages/Dashboard'
import DomainsList from './pages/DomainsList'
import DomainDetail from './pages/DomainDetail'
import ObjectiveDetail from './pages/ObjectiveDetail'
import Quiz from './pages/Quiz'
import Review from './pages/Review'
import ExamStart from './pages/ExamStart'
import ExamSession from './pages/ExamSession'
import ExamResult from './pages/ExamResult'
import Labs from './pages/Labs'
import { getDefaultCertId } from './certifications'

function App() {
  return (
    <HashRouter>
      <Routes>
        <Route path="/" element={<Navigate to={`/${getDefaultCertId()}`} replace />} />
        <Route path="/:certId" element={<Layout />}>
          <Route index element={<Dashboard />} />
          <Route path="domains" element={<DomainsList />} />
          <Route path="domains/:domainId" element={<DomainDetail />} />
          <Route path="objectives/:objectiveId" element={<ObjectiveDetail />} />
          <Route path="objectives/:objectiveId/quiz" element={<Quiz />} />
          <Route path="review" element={<Review />} />
          {/* Same component: with no `objectiveId` it draws from the review
              selection instead of an objective's pool. */}
          <Route path="review/quiz" element={<Quiz />} />
          <Route path="exam" element={<ExamStart />} />
          <Route path="exam/session" element={<ExamSession />} />
          <Route path="exam/results/:resultId" element={<ExamResult />} />
          <Route path="labs" element={<Labs />} />
        </Route>
      </Routes>
    </HashRouter>
  )
}

export default App
