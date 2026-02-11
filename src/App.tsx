import { BrowserRouter, Routes, Route, Navigate } from "react-router-dom";
import { useScores } from "./hooks/useScores";
import { usePresentationController } from "./hooks/usePresentation";
import { Spotlight } from "./components/Spotlight";
import { ControlPanel } from "./components/ControlPanel";
import { IdleScreen } from "./components/IdleScreen";

function ScoreboardApp() {
  // Sync state between tabs/windows
  const {
    currentIndex,
    setIndex,
    remoteCandidates,
    isIdle,
    toggleIdle,
    selectedCategory,
    setCategory,
  } = usePresentationController(0);

  // Use selected category for fetching scores
  const {
    candidates: localCandidates,
    loading,
    error,
    refresh,
    categories,
  } = useScores(selectedCategory);

  // Prefer remote candidates if available (from Controller), otherwise use local (initial load/Controller itself)
  const candidates =
    remoteCandidates.length > 0 ? remoteCandidates : localCandidates;

  return (
    <Routes>
      {/* Viewer Route - Display Only */}
      <Route
        path="/view"
        element={
          isIdle ? (
            <IdleScreen />
          ) : (
            <div className="h-screen w-screen overflow-hidden bg-black">
              {loading && candidates.length === 0 && (
                <div className="text-white p-10">Loading...</div>
              )}
              {!loading && error && candidates.length === 0 && (
                <div className="text-red-500 p-10">{error}</div>
              )}
              {!loading && !error && candidates.length === 0 && (
                <div className="flex h-screen items-center justify-center text-white">
                  No candidates found. Waiting for Controller...
                </div>
              )}
              {candidates.length > 0 && (
                <Spotlight
                  candidate={
                    candidates[
                      currentIndex >= candidates.length ? 0 : currentIndex
                    ]
                  }
                  onNext={() =>
                    setIndex(Math.min(candidates.length - 1, currentIndex + 1))
                  }
                  onPrev={() => setIndex(Math.max(0, currentIndex - 1))}
                  currentIndex={currentIndex}
                  totalCandidates={candidates.length}
                  controlsVisible={false}
                  activeCategory={selectedCategory}
                />
              )}
            </div>
          )
        }
      />

      {/* Controller Route */}
      <Route
        path="/admin"
        element={
          <ControlPanel
            candidates={candidates}
            currentIndex={currentIndex}
            setIndex={setIndex}
            loading={loading}
            error={error}
            refresh={refresh}
            isIdle={isIdle}
            toggleIdle={toggleIdle}
            categories={categories}
            selectedCategory={selectedCategory}
            setCategory={setCategory}
          />
        }
      />

      {/* Controller Route Alias */}
      <Route
        path="/controller"
        element={
          <ControlPanel
            candidates={candidates}
            currentIndex={currentIndex}
            setIndex={setIndex}
            loading={loading}
            error={error}
            refresh={refresh}
            isIdle={isIdle}
            toggleIdle={toggleIdle}
            categories={categories}
            selectedCategory={selectedCategory}
            setCategory={setCategory}
          />
        }
      />

      {/* Default Route - Redirect to Admin for ease of use, or Viewer? 
          User said "Controller for new window". 
          Let's make / default to Viewer for safety, and add a link to Admin.
      */}
      <Route path="/" element={<Navigate to="/view" replace />} />
    </Routes>
  );
}

function App() {
  return (
    <BrowserRouter>
      <ScoreboardApp />
    </BrowserRouter>
  );
}

export default App;
