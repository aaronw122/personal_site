import { Routes, Route } from "react-router-dom";
import Layout from "./components/Layout";
import Home from "./pages/Home";
import About from "./pages/About";
import Experience from "./pages/Experience";
import Writing from "./pages/Writing";
import Lists from "./pages/Lists";
import NotFound from "./pages/NotFound";

export default function App() {
  return (
    <Routes>
      <Route element={<Layout />}>
        <Route path="/" element={<Home />} />
        <Route path="/about" element={<About />} />
        <Route path="/experience" element={<Experience />} />
        <Route path="/writing" element={<Writing />} />
        <Route path="/lists" element={<Lists />} />
        <Route path="*" element={<NotFound />} />
      </Route>
    </Routes>
  );
}
