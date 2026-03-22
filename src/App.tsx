/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { BrowserRouter as Router, Routes, Route } from 'react-router-dom';
import { LanguageProvider } from './context/LanguageContext';
import Layout from './components/Layout';
import Landing from './pages/Landing';
import Awakening from './pages/Awakening';
import Mindset from './pages/Mindset';
import Power from './pages/Power';
import Challenge from './pages/Challenge';
import Inner from './pages/Inner';
import Rules from './pages/Rules';
import Void from './pages/Void';
import Diary from './pages/Diary';
import DailyQuote from './pages/DailyQuote';

export default function App() {
  return (
    <LanguageProvider>
      <Router>
        <Routes>
          <Route path="/" element={<Layout />}>
            <Route index element={<Landing />} />
            <Route path="awakening" element={<Awakening />} />
            <Route path="mindset" element={<Mindset />} />
            <Route path="power" element={<Power />} />
            <Route path="challenge" element={<Challenge />} />
            <Route path="inner" element={<Inner />} />
            <Route path="rules" element={<Rules />} />
            <Route path="diary" element={<Diary />} />
            <Route path="daily-quote" element={<DailyQuote />} />
            <Route path="void" element={<Void />} />
            <Route path="*" element={<Landing />} />
          </Route>
        </Routes>
      </Router>
    </LanguageProvider>
  );
}
