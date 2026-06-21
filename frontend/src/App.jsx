import { BrowserRouter, Routes, Route, Navigate } from "react-router-dom";
import { Analytics } from "@vercel/analytics/react";
import Home from "./pages/Home";
import RegionPage from "./pages/Region";
import IncidentsPage from "./pages/Incidents";
import ExercisesPage from "./pages/Exercises";
import PatternsPage from "./pages/Patterns";
import AboutPage from "./pages/About";
import WarRoom from "./pages/WarRoom";
import Impressum from "./pages/Impressum";
import Datenschutz from "./pages/Datenschutz";
import "./index.css";

export default function App() {
  return (
    <BrowserRouter>
      <Routes>
        <Route path="/" element={<Home />} />
        <Route path="/region/:id" element={<RegionPage />} />
        <Route path="/incidents" element={<IncidentsPage />} />
        <Route path="/exercises" element={<ExercisesPage />} />
        <Route path="/warroom" element={<WarRoom />} />
        <Route path="/briefs" element={<PatternsPage />} />
        <Route path="/patterns" element={<Navigate to="/briefs" replace />} />
        <Route path="/about" element={<AboutPage />} />
        <Route path="/impressum" element={<Impressum />} />
        <Route path="/datenschutz" element={<Datenschutz />} />
      </Routes>
      <Analytics />
    </BrowserRouter>
  );
}
