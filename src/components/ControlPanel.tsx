import React, { useEffect, useState } from "react";
import type { Candidate } from "../types";

// Helper to generate fallback avatar URL
const getFallbackAvatarUrl = (name: string) =>
  `https://ui-avatars.com/api/?name=${encodeURIComponent(name)}&background=random&color=fff&size=128`;

// Hook to get image URL with fallback
const useImageWithFallback = (photoUrl: string, name: string) => {
  const [imgSrc, setImgSrc] = useState(getFallbackAvatarUrl(name));

  useEffect(() => {
    setImgSrc(getFallbackAvatarUrl(name));
    const img = new Image();
    img.onload = () => setImgSrc(photoUrl);
    img.src = photoUrl;
  }, [photoUrl, name]);

  return imgSrc;
};

// Component for candidate thumbnail with fallback
const CandidateThumbnail: React.FC<{ photoUrl: string; name: string }> = ({
  photoUrl,
  name,
}) => {
  const imgSrc = useImageWithFallback(photoUrl, name);

  return (
    <img
      src={imgSrc}
      className="w-10 h-10 rounded-full object-cover bg-gray-700"
      alt=""
    />
  );
};

// Component for candidate preview with fallback images
const CandidatePreview: React.FC<{ candidate: Candidate }> = ({
  candidate,
}) => {
  const imgSrc = useImageWithFallback(candidate.photoUrl, candidate.name);

  return (
    <>
      <div
        className="absolute inset-0 bg-cover bg-center opacity-30 blur-sm"
        style={{
          backgroundImage: `url("${imgSrc}")`,
        }}
      />
      <div className="relative z-10 text-center space-y-2 md:space-y-4 p-4">
        <img
          title={candidate.name}
          src={imgSrc}
          className="w-24 h-24 md:w-48 md:h-48 rounded-full border-4 border-pageant-gold mx-auto object-cover shadow-xl"
          alt=""
        />
        <div>
          <div className="text-pageant-gold uppercase tracking-widest text-xs md:text-sm font-bold mb-1">
            {candidate.category || "Candidate"}
          </div>
          <h1 className="text-2xl md:text-5xl font-bold truncate px-2">
            {candidate.name}
          </h1>
        </div>
        <div className="text-lg md:text-xl font-mono opacity-70">
          Current Score: {(candidate.totalPercentage || 0).toFixed(2)}%
        </div>
      </div>
    </>
  );
};

interface ControlPanelProps {
  candidates: Candidate[];
  currentIndex: number;
  setIndex: (index: number, candidates?: Candidate[]) => void;
  loading: boolean;
  error: string | null;
  refresh: (sheetName?: string) => Promise<Candidate[]>;
  isIdle: boolean;
  toggleIdle: (state: boolean) => void;
  categories: string[];
  selectedCategory: string;
  setCategory: (category: string, candidates?: Candidate[]) => void;
}

export const ControlPanel: React.FC<ControlPanelProps> = ({
  candidates,
  currentIndex,
  setIndex,
  loading,
  error,
  refresh,
  isIdle,
  toggleIdle,
  categories,
  selectedCategory,
  setCategory,
}) => {
  const [selectedFilterCategory, setSelectedFilterCategory] =
    React.useState<string>("All");

  const handleCategoryChange = async (category: string) => {
    // Fetch new data for the selected category/sheet
    const newCandidates = await refresh(category);
    setCategory(category, newCandidates);
  };

  // Auto-select first category if none selected
  useEffect(() => {
    if (!selectedCategory && categories.length > 0) {
      handleCategoryChange(categories[0]);
    }
  }, [categories, selectedCategory]);

  // Auto-scroll to current candidate in list
  useEffect(() => {
    const el = document.getElementById(`candidate-row-${currentIndex}`);
    if (el) {
      el.scrollIntoView({ behavior: "smooth", block: "center" });
    }
  }, [currentIndex]);

  const handleCandidateClick = async (index: number) => {
    // User wants fetch on click.
    const newCandidates = await refresh(selectedCategory);
    setIndex(index, newCandidates);
  };

  // Show loading state
  if (loading && candidates.length === 0 && categories.length === 0)
    return <div className="p-8 text-white">Loading data...</div>;

  // Show error state
  if (error && candidates.length === 0)
    return <div className="p-8 text-red-500">Error: {error}</div>;

  // Show waiting state if categories loaded but no category selected yet
  if (candidates.length === 0 && categories.length > 0 && !selectedCategory)
    return <div className="p-8 text-white">Selecting category...</div>;

  const currentCandidate = candidates[currentIndex];

  // Filter Logic for candidates within selected category
  const filterCategories = [
    "All",
    ...Array.from(new Set(candidates.map((c) => c.category || "General"))),
  ];

  const filteredCandidates = candidates
    .map((c, i) => ({ ...c, originalIndex: i }))
    .filter(
      (c) =>
        selectedFilterCategory === "All" ||
        (c.category || "General") === selectedFilterCategory,
    );

  return (
    <div className="h-screen w-screen overflow-hidden bg-gray-900 text-white flex flex-col-reverse md:flex-row">
      {/* Sidebar / List - Bottom on Mobile, Left on Desktop */}
      <div className="w-full md:w-1/3 border-t md:border-t-0 md:border-r border-gray-800 flex flex-col h-1/2 md:h-full bg-gray-900">
        <div className="p-4 border-b border-gray-800 bg-gray-900 sticky top-0 z-10 space-y-3">
          <div className="flex justify-between items-center">
            <h2 className="text-xl font-bold text-pageant-gold">Candidates</h2>

            {/* Idle Toggle */}
            <button
              onClick={() => toggleIdle(!isIdle)}
              className={`px-3 py-1 rounded text-xs font-bold uppercase tracking-wider transition-colors border
                                ${
                                  isIdle
                                    ? "bg-red-600 border-red-600 text-white animate-pulse"
                                    : "bg-transparent border-gray-600 text-gray-400 hover:border-gray-400 hover:text-white"
                                }
                            `}
            >
              {isIdle ? "ON AIR: IDLE" : "SET IDLE"}
            </button>
          </div>

          {/* Category/Sheet Selector */}
          <div className="space-y-1">
            <label className="text-xs text-gray-400 uppercase tracking-wider font-semibold">
              Category (Sheet)
            </label>
            <select
              title="Select Category"
              value={selectedCategory}
              onChange={(e) => handleCategoryChange(e.target.value)}
              className="w-full bg-gray-800 text-white border border-gray-700 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-pageant-gold focus:border-transparent cursor-pointer hover:bg-gray-700 transition-colors"
            >
              {categories.length === 0 ? (
                <option value="Sheet1">Sheet1</option>
              ) : (
                categories.map((cat) => (
                  <option key={cat} value={cat}>
                    {cat}
                  </option>
                ))
              )}
            </select>
          </div>

          <div className="flex justify-between items-center text-xs text-gray-500">
            <span>
              {filteredCandidates.length} / {candidates.length} Shown
            </span>
            <span className="text-pageant-gold font-semibold">
              {selectedCategory}
            </span>
          </div>

          {/* Candidate Filter within Category */}
          <div className="flex space-x-2 overflow-x-auto pb-2 scrollbar-hide">
            {filterCategories.map((cat) => (
              <button
                key={cat}
                onClick={() => setSelectedFilterCategory(cat)}
                className={`px-3 py-1 rounded-full text-xs font-bold whitespace-nowrap transition-colors
                                    ${
                                      selectedFilterCategory === cat
                                        ? "bg-pageant-gold text-black"
                                        : "bg-gray-800 text-gray-400 hover:bg-gray-700"
                                    }
                                `}
              >
                {cat}
              </button>
            ))}
          </div>

          <button
            onClick={() => refresh(selectedCategory)}
            className="text-xs bg-gray-800 p-3 rounded hover:bg-gray-700 w-full flex justify-center items-center space-x-2 touch-manipulation"
          >
            <span>Force Refresh Data</span>
            {loading && (
              <span className="animate-spin h-3 w-3 border-2 border-white border-t-transparent rounded-full"></span>
            )}
          </button>
        </div>
        <div className="overflow-y-auto flex-1 p-2 md:p-0">
          {filteredCandidates.map((c) => (
            <div
              key={c.originalIndex}
              id={`candidate-row-${c.originalIndex}`}
              onClick={() => handleCandidateClick(c.originalIndex)}
              className={`p-4 border-b border-gray-800 cursor-pointer hover:bg-gray-800 transition-colors flex items-center space-x-3 active:bg-gray-700
                                ${currentIndex === c.originalIndex ? "bg-pageant-purple text-white border-l-4 border-l-pageant-gold" : "text-gray-300"}
                            `}
            >
              <div className="font-mono text-sm opacity-50 w-6">
                {c.originalIndex + 1}
              </div>
              <CandidateThumbnail photoUrl={c.photoUrl} name={c.name} />
              <div className="flex-1 min-w-0">
                <div className="font-bold truncate">{c.name}</div>
                {c.category && (
                  <div className="text-xs opacity-70 uppercase truncate">
                    {c.category}
                  </div>
                )}
              </div>
              {currentIndex === c.originalIndex && (
                <div className="text-xs bg-pageant-gold text-black px-2 py-1 rounded font-bold">
                  LIVE
                </div>
              )}
            </div>
          ))}
        </div>
      </div>

      {/* Main Control Area - Top on Mobile, Right on Desktop */}
      <div className="flex-1 flex flex-col h-1/2 md:h-full overflow-hidden bg-black relative">
        {/* Live Preview (Simulated) */}
        <div className="flex-1 relative flex items-center justify-center bg-gray-900 border-b border-gray-800 m-4 md:m-8 rounded-xl overflow-hidden shadow-2xl border border-gray-700">
          {currentCandidate ? (
            <CandidatePreview candidate={currentCandidate} />
          ) : (
            <div className="text-gray-500">No Candidate Selected</div>
          )}
        </div>

        {/* Controls Bar */}
        <div className="h-auto md:h-24 bg-gray-800 border-t border-gray-700 p-4 flex items-center justify-between px-4 md:px-8 shrink-0">
          <button
            onClick={() => setIndex(Math.max(0, currentIndex - 1))}
            disabled={currentIndex === 0}
            className="bg-gray-700 hover:bg-gray-600 disabled:opacity-50 text-white px-4 md:px-6 py-3 rounded-lg font-bold flex items-center space-x-2 transition-transform active:scale-95 touch-manipulation flex-1 md:flex-none justify-center mr-2 md:mr-0"
          >
            <svg
              xmlns="http://www.w3.org/2000/svg"
              className="h-5 w-5"
              viewBox="0 0 20 20"
              fill="currentColor"
            >
              <path
                fillRule="evenodd"
                d="M12.707 5.293a1 1 0 010 1.414L9.414 10l3.293 3.293a1 1 0 01-1.414 1.414l-4-4a1 1 0 010-1.414l4-4a1 1 0 011.414 0z"
                clipRule="evenodd"
              />
            </svg>
            <span className="hidden md:inline">PREV</span>
          </button>

          <div className="text-center hidden md:block">
            <div className="text-pageant-gold font-bold text-sm">
              CONTROLLER
            </div>
          </div>

          <button
            onClick={() =>
              setIndex(Math.min(candidates.length - 1, currentIndex + 1))
            }
            disabled={currentIndex >= candidates.length - 1}
            className="bg-pageant-purple hover:bg-indigo-600 disabled:opacity-50 text-white px-4 md:px-6 py-3 rounded-lg font-bold flex items-center space-x-2 transition-transform active:scale-95 shadow-lg border border-white/10 touch-manipulation flex-1 md:flex-none justify-center ml-2 md:ml-0"
          >
            <span>NEXT</span>
            <svg
              xmlns="http://www.w3.org/2000/svg"
              className="h-5 w-5"
              viewBox="0 0 20 20"
              fill="currentColor"
            >
              <path
                fillRule="evenodd"
                d="M7.293 14.707a1 1 0 010-1.414L10.586 10 7.293 6.707a1 1 0 011.414-1.414l4 4a1 1 0 010 1.414l-4 4a1 1 0 01-1.414 0z"
                clipRule="evenodd"
              />
            </svg>
          </button>
        </div>
      </div>
    </div>
  );
};
