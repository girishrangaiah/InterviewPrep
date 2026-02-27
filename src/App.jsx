import React, { useState, useEffect, useRef } from 'react';
import { 
  RefreshCw, 
  Download, 
  Send, 
  Search, 
  CheckCircle2, 
  AlertCircle, 
  ChevronDown,
  BookOpen,
  User,
  Layers,
  FileText,
  Loader2
} from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import ReactMarkdown from 'react-markdown';
import { jsPDF } from 'jspdf';
import { clsx } from 'clsx';
import { twMerge } from 'tailwind-merge';

import { SECTORS, SKILLSETS_BY_SECTOR, GLOBAL_SKILLSETS } from './constants.js';
import { generateInterviewQuestions, validateSkillset, generateCertificationGuide } from './services/gemini.js';

function cn(...inputs) {
  return twMerge(clsx(inputs));
}

export default function App() {
  // Form State
  const [sector, setSector] = useState('');
  const [skillset, setSkillset] = useState('');
  const [role, setRole] = useState('');
  const [includeAnswers, setIncludeAnswers] = useState(true);
  const [numQuestions, setNumQuestions] = useState(50);

  // UI State
  const [suggestions, setSuggestions] = useState([]);
  const [isValidating, setIsValidating] = useState(false);
  const [isGenerating, setIsGenerating] = useState(false);
  const [error, setError] = useState(null);
  const [result, setResult] = useState('');
  const [certResult, setCertResult] = useState('');
  const [activeTab, setActiveTab] = useState('interview');
  const [showSuggestions, setShowSuggestions] = useState(false);
  const [isGeneratingCert, setIsGeneratingCert] = useState(false);

  const resultRef = useRef(null);

  // Skillset Hinting Logic
  useEffect(() => {
    const trimmed = skillset.trim();
    if (sector) {
      if (trimmed.length >= 3) {
        const relevant = SKILLSETS_BY_SECTOR[sector] || [];
        const matches = relevant.filter(s => s.toLowerCase().startsWith(trimmed.toLowerCase()));
        setSuggestions(matches);
        setShowSuggestions(matches.length > 0);
      } else {
        setSuggestions([]);
        setShowSuggestions(false);
      }
    } else {
      if (trimmed.length >= 4) {
        const matches = Array.from(new Set(GLOBAL_SKILLSETS))
          .filter(s => s.toLowerCase().startsWith(trimmed.toLowerCase()))
          .slice(0, 10);
        setSuggestions(matches);
        setShowSuggestions(matches.length > 0);
      } else {
        setSuggestions([]);
        setShowSuggestions(false);
      }
    }
  }, [skillset, sector]);

  const handleRefresh = () => {
    setSector('');
    setSkillset('');
    setRole('');
    setIncludeAnswers(true);
    setNumQuestions(50);
    setResult('');
    setCertResult('');
    setActiveTab('interview');
    setError(null);
    setSuggestions([]);
    setShowSuggestions(false);
  };

  const handleGenerate = async () => {
    if (!skillset.trim()) {
      setError('Please enter a skillset.');
      return;
    }

    setError(null);
    setResult('');
    setCertResult('');
    setIsValidating(true);

    const isValid = await validateSkillset(skillset);
    setIsValidating(false);

    if (!isValid) {
      setError('The entered skillset does not exist or is not a recognized professional or academic skill. Please enter a valid skillset.');
      return;
    }

    const isCertSector = sector === 'Certifications';
    
    // Start Interview Questions Generation
    setIsGenerating(true);
    const interviewPromise = (async () => {
      try {
        const params = {
          sector,
          skillset,
          role: role.trim() || undefined,
          includeAnswers,
          numQuestions
        };

        const generator = generateInterviewQuestions(params);
        let fullText = '';
        for await (const chunk of generator) {
          fullText += chunk;
          setResult(fullText);
          if (resultRef.current && activeTab === 'interview') {
            resultRef.current.scrollTop = resultRef.current.scrollHeight;
          }
        }
      } catch (err) {
        setError('An error occurred while generating questions. Please try again.');
        console.error(err);
      } finally {
        setIsGenerating(false);
      }
    })();

    // Start Certification Guide Generation if applicable
    let certPromise = Promise.resolve();
    if (isCertSector) {
      setIsGeneratingCert(true);
      certPromise = (async () => {
        try {
          const generator = generateCertificationGuide(skillset);
          let fullText = '';
          for await (const chunk of generator) {
            fullText += chunk;
            setCertResult(fullText);
          }
        } catch (err) {
          console.error('Cert guide generation error:', err);
        } finally {
          setIsGeneratingCert(false);
        }
      })();
    }

    await Promise.all([interviewPromise, certPromise]);
  };

  const handleDownloadPDF = () => {
    const doc = new jsPDF();
    const pageWidth = doc.internal.pageSize.getWidth();
    const margin = 20;
    let y = 30;

    // Cover Page
    doc.setFontSize(24);
    doc.setTextColor(40, 40, 40);
    doc.text('Interview Preparation Guide', pageWidth / 2, y, { align: 'center' });
    
    y += 20;
    doc.setFontSize(18);
    doc.text(`Skillset: ${skillset}`, pageWidth / 2, y, { align: 'center' });
    
    if (role) {
      y += 10;
      doc.text(`Role: ${role}`, pageWidth / 2, y, { align: 'center' });
    }

    if (sector) {
      y += 10;
      doc.setFontSize(14);
      doc.text(`Sector: ${sector}`, pageWidth / 2, y, { align: 'center' });
    }

    y += 20;
    doc.setFontSize(12);
    doc.setTextColor(100, 100, 100);
    doc.text(`Generated on ${new Date().toLocaleDateString()}`, pageWidth / 2, y, { align: 'center' });

    // Questions Content
    doc.addPage();
    y = 20;
    doc.setFontSize(16);
    doc.setTextColor(0, 0, 0);
    doc.text('Interview Questions & Answers', margin, y);
    y += 10;

    doc.setFontSize(10);
    const lines = doc.splitTextToSize(result, pageWidth - (margin * 2));
    
    lines.forEach((line) => {
      if (y > 280) {
        doc.addPage();
        y = 20;
      }
      doc.text(line, margin, y);
      y += 6;
    });

    // Certification Guide Content
    if (certResult) {
      doc.addPage();
      y = 20;
      doc.setFontSize(16);
      doc.setTextColor(0, 0, 0);
      doc.text('Certification Guide', margin, y);
      y += 10;

      doc.setFontSize(10);
      const certLines = doc.splitTextToSize(certResult, pageWidth - (margin * 2));
      
      certLines.forEach((line) => {
        if (y > 280) {
          doc.addPage();
          y = 20;
        }
        doc.text(line, margin, y);
        y += 6;
      });
    }

    doc.save(`Interview_Guide_${skillset.replace(/\s+/g, '_')}.pdf`);
  };

  return (
    <div className="min-h-screen bg-[#F8FAFC] text-slate-900 font-sans selection:bg-indigo-100">
      {/* Header */}
      <header className="sticky top-0 z-50 bg-white/80 backdrop-blur-md border-b border-slate-200">
        <div className="max-w-7xl mx-auto px-4 h-16 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <div className="w-10 h-10 bg-indigo-600 rounded-xl flex items-center justify-center shadow-lg shadow-indigo-200">
              <BookOpen className="text-white w-6 h-6" />
            </div>
            <div>
              <h1 className="text-xl font-bold tracking-tight text-slate-900">SkillQuest AI</h1>
              <p className="text-xs text-slate-500 font-medium uppercase tracking-wider">Interview Prep Assistant</p>
            </div>
          </div>
          <button 
            onClick={handleRefresh}
            className="flex items-center gap-2 px-4 py-2 text-sm font-semibold text-slate-600 hover:text-indigo-600 hover:bg-indigo-50 rounded-lg transition-all active:scale-95"
          >
            <RefreshCw className={cn("w-4 h-4", isGenerating && "animate-spin")} />
            Refresh
          </button>
        </div>
      </header>

      <main className="max-w-7xl mx-auto px-4 py-8 grid grid-cols-1 lg:grid-cols-12 gap-8">
        {/* Sidebar Controls */}
        <div className="lg:col-span-4 space-y-6">
          <section className="bg-white rounded-2xl shadow-sm border border-slate-200 p-6 space-y-6">
            <div className="space-y-4">
              <label className="block">
                <span className="flex items-center gap-2 text-sm font-bold text-slate-700 mb-2">
                  <Layers className="w-4 h-4 text-indigo-500" />
                  Sector (Optional)
                </span>
                <div className="relative">
                  <select 
                    value={sector}
                    onChange={(e) => setSector(e.target.value)}
                    className="w-full bg-slate-50 border border-slate-200 rounded-xl px-4 py-3 text-sm focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 outline-none transition-all appearance-none"
                  >
                    <option value="">Select Sector</option>
                    {SECTORS.map(s => (
                      <option key={s} value={s}>{s}</option>
                    ))}
                  </select>
                  <ChevronDown className="absolute right-4 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400 pointer-events-none" />
                </div>
              </label>

              <label className="block relative">
                <span className="flex items-center gap-2 text-sm font-bold text-slate-700 mb-2">
                  <Search className="w-4 h-4 text-indigo-500" />
                  Skillset / Subject
                </span>
                <input 
                  type="text"
                  value={skillset}
                  onChange={(e) => setSkillset(e.target.value)}
                  onFocus={() => suggestions.length > 0 && setShowSuggestions(true)}
                  placeholder="e.g. Java, Machine Learning"
                  className="w-full bg-slate-50 border border-slate-200 rounded-xl px-4 py-3 text-sm focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 outline-none transition-all"
                />
                <AnimatePresence>
                  {showSuggestions && (
                    <motion.ul 
                      initial={{ opacity: 0, y: -10 }}
                      animate={{ opacity: 1, y: 0 }}
                      exit={{ opacity: 0, y: -10 }}
                      className="absolute z-10 w-full mt-2 bg-white border border-slate-200 rounded-xl shadow-xl overflow-hidden"
                    >
                      {suggestions.map((s, i) => (
                        <li 
                          key={i}
                          onClick={() => {
                            setSkillset(s);
                            setShowSuggestions(false);
                          }}
                          className="px-4 py-3 text-sm hover:bg-indigo-50 cursor-pointer transition-colors border-b last:border-0 border-slate-100"
                        >
                          {s}
                        </li>
                      ))}
                    </motion.ul>
                  )}
                </AnimatePresence>
              </label>

              <label className="block">
                <span className="flex items-center gap-2 text-sm font-bold text-slate-700 mb-2">
                  <User className="w-4 h-4 text-indigo-500" />
                  Target Role (Optional)
                </span>
                <input 
                  type="text"
                  value={role}
                  onChange={(e) => setRole(e.target.value)}
                  placeholder="e.g. Senior Developer"
                  className="w-full bg-slate-50 border border-slate-200 rounded-xl px-4 py-3 text-sm focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 outline-none transition-all"
                />
              </label>

              <div className="grid grid-cols-2 gap-4">
                <label className="block">
                  <span className="flex items-center gap-2 text-sm font-bold text-slate-700 mb-2">
                    <FileText className="w-4 h-4 text-indigo-500" />
                    Format
                  </span>
                  <select 
                    value={includeAnswers ? 'qa' : 'q'}
                    onChange={(e) => setIncludeAnswers(e.target.value === 'qa')}
                    className="w-full bg-slate-50 border border-slate-200 rounded-xl px-4 py-3 text-sm focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 outline-none transition-all appearance-none"
                  >
                    <option value="qa">Q & A</option>
                    <option value="q">Questions Only</option>
                  </select>
                </label>

                <label className="block">
                  <span className="flex items-center gap-2 text-sm font-bold text-slate-700 mb-2">
                    <Layers className="w-4 h-4 text-indigo-500" />
                    Count
                  </span>
                  <input 
                    type="number"
                    value={numQuestions}
                    onChange={(e) => setNumQuestions(Number(e.target.value))}
                    min="1"
                    max="200"
                    className="w-full bg-slate-50 border border-slate-200 rounded-xl px-4 py-3 text-sm focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 outline-none transition-all"
                  />
                </label>
              </div>
            </div>

            <button 
              onClick={handleGenerate}
              disabled={isGenerating || isValidating}
              className={cn(
                "w-full py-4 rounded-xl font-bold text-white shadow-lg transition-all flex items-center justify-center gap-2 active:scale-[0.98]",
                (isGenerating || isValidating) 
                  ? "bg-slate-400 cursor-not-allowed" 
                  : "bg-indigo-600 hover:bg-indigo-700 shadow-indigo-200"
              )}
            >
              {isValidating ? (
                <>
                  <Loader2 className="w-5 h-5 animate-spin" />
                  Validating Skillset...
                </>
              ) : isGenerating ? (
                <>
                  <Loader2 className="w-5 h-5 animate-spin" />
                  Generating...
                </>
              ) : (
                <>
                  <Send className="w-5 h-5" />
                  Generate Questions
                </>
              )}
            </button>
          </section>

          {error && (
            <motion.div 
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              className="bg-red-50 border border-red-100 rounded-2xl p-4 flex gap-3 text-red-700"
            >
              <AlertCircle className="w-5 h-5 shrink-0" />
              <p className="text-sm font-medium">{error}</p>
            </motion.div>
          )}
        </div>

        {/* Main Content Area */}
        <div className="lg:col-span-8 space-y-6">
          <div className="bg-white rounded-2xl shadow-sm border border-slate-200 flex flex-col h-[calc(100vh-12rem)] min-h-[600px]">
            <div className="p-4 border-b border-slate-100 flex items-center justify-between bg-slate-50/50 rounded-t-2xl">
              <div className="flex items-center gap-1">
                <button 
                  onClick={() => setActiveTab('interview')}
                  className={cn(
                    "px-4 py-2 text-sm font-bold rounded-lg transition-all",
                    activeTab === 'interview' 
                      ? "bg-white text-indigo-600 shadow-sm border border-slate-200" 
                      : "text-slate-500 hover:text-slate-700"
                  )}
                >
                  Interview Guide
                </button>
                {certResult && (
                  <button 
                    onClick={() => setActiveTab('certification')}
                    className={cn(
                      "px-4 py-2 text-sm font-bold rounded-lg transition-all flex items-center gap-2",
                      activeTab === 'certification' 
                        ? "bg-white text-indigo-600 shadow-sm border border-slate-200" 
                        : "text-slate-500 hover:text-slate-700"
                    )}
                  >
                    Certification Guide
                    {isGeneratingCert && <Loader2 className="w-3 h-3 animate-spin" />}
                  </button>
                )}
              </div>
              {(result || certResult) && (!isGenerating && !isGeneratingCert) && (
                <button 
                  onClick={handleDownloadPDF}
                  className="flex items-center gap-2 px-3 py-1.5 text-xs font-bold text-indigo-600 hover:bg-indigo-50 rounded-lg transition-colors"
                >
                  <Download className="w-4 h-4" />
                  Download Complete PDF
                </button>
              )}
            </div>

            <div 
              ref={resultRef}
              className="flex-1 overflow-y-auto p-8 prose prose-slate max-w-none prose-headings:text-slate-900 prose-headings:font-bold prose-p:text-slate-600 prose-li:text-slate-600"
            >
              {!result && !certResult && !isGenerating && !isValidating ? (
                <div className="h-full flex flex-col items-center justify-center text-center space-y-4 opacity-40">
                  <div className="w-16 h-16 bg-slate-100 rounded-full flex items-center justify-center">
                    <FileText className="w-8 h-8 text-slate-400" />
                  </div>
                  <div>
                    <h3 className="text-lg font-bold text-slate-900">No Content Generated</h3>
                    <p className="text-sm max-w-xs mx-auto">Fill in the details on the left and click generate to start your preparation.</p>
                  </div>
                </div>
              ) : (
                <ReactMarkdown>{activeTab === 'interview' ? result : certResult}</ReactMarkdown>
              )}
              {(isGenerating || isGeneratingCert) && (
                <div className="flex items-center gap-2 text-indigo-500 font-medium animate-pulse mt-4">
                  <Loader2 className="w-4 h-4 animate-spin" />
                  AI is crafting your {activeTab === 'interview' ? 'questions' : 'guide'}...
                </div>
              )}
            </div>
          </div>
        </div>
      </main>

      {/* Footer */}
      <footer className="max-w-7xl mx-auto px-4 py-8 border-t border-slate-200 mt-8">
        <div className="flex flex-col md:flex-row items-center justify-between gap-4 text-slate-400 text-xs font-medium uppercase tracking-widest">
          <p>© 2026 SkillQuest AI • Powered by Gemini AI</p>
          <div className="flex items-center gap-6">
            <span className="flex items-center gap-1.5">
              <CheckCircle2 className="w-3.5 h-3.5 text-emerald-500" />
              Industry Standard
            </span>
            <span className="flex items-center gap-1.5">
              <CheckCircle2 className="w-3.5 h-3.5 text-emerald-500" />
              Role Specific
            </span>
          </div>
        </div>
      </footer>
    </div>
  );
}
