import React, { useState, useEffect, useCallback } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { 
  ChevronLeft, 
  ChevronRight, 
  Volume2, 
  Gamepad2, 
  BookOpen, 
  RotateCcw, 
  Star, 
  Trophy,
  Home
} from 'lucide-react';
import { ALPHABET_DATA, AlphabetItem } from './constants';

type AppMode = 'welcome' | 'learn' | 'quiz' | 'congrats';

export default function App() {
  const [mode, setMode] = useState<AppMode>('welcome');
  const [currentIndex, setCurrentIndex] = useState(0);
  const [quizQuestion, setQuizQuestion] = useState<{
    letter: string;
    options: AlphabetItem[];
    correctIndex: number;
  } | null>(null);
  const [quizFeedback, setQuizFeedback] = useState<'correct' | 'wrong' | null>(null);
  const [stars, setStars] = useState(0);

  // Web Speech API
  const speak = useCallback((text: string) => {
    if ('speechSynthesis' in window) {
      window.speechSynthesis.cancel();
      const utterance = new SpeechSynthesisUtterance(text);
      utterance.lang = 'en-US';
      utterance.rate = 0.6;
      window.speechSynthesis.speak(utterance);
    }
  }, []);

  const handleNext = () => {
    if (currentIndex < ALPHABET_DATA.length - 1) {
      setCurrentIndex(prev => prev + 1);
    } else {
      setMode('congrats');
    }
  };

  const handlePrev = () => {
    if (currentIndex > 0) {
      setCurrentIndex(prev => prev - 1);
    }
  };

  const startQuiz = useCallback(() => {
    const randomIndex = Math.floor(Math.random() * ALPHABET_DATA.length);
    const correctItem = ALPHABET_DATA[randomIndex];
    
    // Pick 2 random wrong options
    const others = ALPHABET_DATA.filter(item => item.letter !== correctItem.letter);
    const wrongOptions = [...others].sort(() => 0.5 - Math.random()).slice(0, 2);
    
    const options = [correctItem, ...wrongOptions].sort(() => 0.5 - Math.random());
    const correctIdx = options.findIndex(o => o.letter === correctItem.letter);

    setQuizQuestion({
      letter: correctItem.letter,
      options,
      correctIndex: correctIdx
    });
    setQuizFeedback(null);
    setMode('quiz');
    speak(`Find the letter ${correctItem.letter}`);
  }, [speak]);

  const handleQuizAnswer = (index: number) => {
    if (!quizQuestion) return;

    if (index === quizQuestion.correctIndex) {
      setQuizFeedback('correct');
      setStars(prev => prev + 1);
      speak("Great job! Awesome!");
      setTimeout(() => {
        startQuiz();
      }, 2000);
    } else {
      setQuizFeedback('wrong');
      speak("Try again, you can do it!");
      setTimeout(() => setQuizFeedback(null), 1000);
    }
  };

  useEffect(() => {
    if (mode === 'learn') {
      const item = ALPHABET_DATA[currentIndex];
      speak(`${item.letter} is for ${item.word}`);
    }
  }, [currentIndex, mode, speak]);

  const renderWelcome = () => (
    <motion.div 
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      className="flex flex-col items-center justify-center h-full text-center p-6"
    >
      <div className="text-9xl mb-8 animate-float">🎨 🍎 🧸</div>
      <h1 className="text-7xl lg:text-8xl font-bold text-sky-600 mb-4 tracking-tight">ABC Adventure</h1>
      <p className="text-3xl text-slate-500 mb-12">Let's learn and play together!</p>
      
      <div className="flex flex-col sm:flex-row gap-6 w-full max-w-2xl justify-center">
        <button 
          onClick={() => { setMode('learn'); setCurrentIndex(0); }}
          className="btn-bubble bg-emerald-400 text-white py-8 px-10 rounded-[2.5rem] text-4xl font-bold shadow-xl flex items-center justify-center gap-4 flex-1"
        >
          <BookOpen size={40} />
          Learn ABC
        </button>
        <button 
          onClick={startQuiz}
          className="btn-bubble bg-orange-400 text-white py-8 px-10 rounded-[2.5rem] text-4xl font-bold shadow-xl flex items-center justify-center gap-4 flex-1"
        >
          <Gamepad2 size={40} />
          Play Game
        </button>
      </div>
    </motion.div>
  );

  const renderLearn = () => {
    const item = ALPHABET_DATA[currentIndex];
    return (
      <div className="flex flex-col min-h-full p-4 lg:p-6 xl:p-8">
        <div className="flex justify-between items-center mb-4 lg:mb-6 shrink-0">
          <button onClick={() => setMode('welcome')} className="p-4 bg-white rounded-full shadow-md text-slate-400 hover:text-sky-500 transition-colors">
            <Home size={32} />
          </button>
          <div className="bg-white px-8 py-2 rounded-full shadow-sm text-slate-500 text-2xl font-bold">
            {currentIndex + 1} / 26
          </div>
          <button onClick={startQuiz} className="p-4 bg-orange-100 text-orange-500 rounded-full shadow-sm hover:bg-orange-200 transition-colors">
            <Gamepad2 size={32} />
          </button>
        </div>

        <div className="flex-1 flex flex-col lg:flex-row items-center justify-center gap-4 lg:gap-10 min-h-0">
          <AnimatePresence mode="wait">
            <motion.div
              key={item.letter}
              initial={{ opacity: 0, scale: 0.9 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.9 }}
              className="w-full max-w-2xl aspect-[4/5] sm:aspect-video lg:aspect-square flex flex-col items-center justify-center min-h-0"
            >
              <div className={`kid-card w-full h-full flex flex-col items-center justify-center relative overflow-hidden p-4 sm:p-6 lg:p-8`}>
                <div className={`absolute top-0 left-0 w-full h-6 ${item.color}`} />
                
                <div className="flex flex-col lg:flex-row items-center justify-center gap-4 lg:gap-12">
                  <button 
                    onClick={() => speak(item.letter)}
                    className="text-[7rem] sm:text-[9rem] md:text-[10rem] lg:text-[16rem] font-bold text-slate-800 leading-none btn-bubble"
                  >
                    {item.letter}<span className="text-slate-400 text-4xl sm:text-5xl md:text-6xl lg:text-9xl">{item.letter.toLowerCase()}</span>
                  </button>
                  
                  <div className="flex flex-col items-center">
                    <div className="text-[5rem] sm:text-[6rem] md:text-[7rem] lg:text-[14rem] mb-2 lg:mb-4 animate-float">{item.emoji}</div>
                    <button 
                      onClick={() => speak(item.word)}
                      className="text-3xl sm:text-4xl md:text-5xl lg:text-7xl font-bold text-slate-600 btn-bubble"
                    >
                      {item.word}
                    </button>
                  </div>
                </div>
              </div>
            </motion.div>
          </AnimatePresence>
        </div>

        <div className="flex justify-between items-center gap-4 sm:gap-6 lg:gap-8 mt-4 lg:mt-8 pb-2 lg:pb-4 shrink-0">
          <button 
            onClick={handlePrev}
            disabled={currentIndex === 0}
            className={`w-16 h-16 sm:w-20 sm:h-20 lg:w-32 lg:h-32 rounded-full shadow-xl flex items-center justify-center btn-bubble ${currentIndex === 0 ? 'bg-slate-200 text-slate-400' : 'bg-white text-sky-500'}`}
          >
            <ChevronLeft size={40} className="lg:w-16 lg:h-16" />
          </button>
          
          <button 
            onClick={() => speak(`${item.letter} is for ${item.word}`)}
            className="w-20 h-20 sm:w-24 sm:h-24 lg:w-40 lg:h-40 bg-sky-500 text-white rounded-full shadow-2xl flex items-center justify-center btn-bubble shrink-0"
          >
            <Volume2 size={36} className="lg:w-14 lg:h-14" />
          </button>

          <button 
            onClick={handleNext}
            className="w-16 h-16 sm:w-20 sm:h-20 lg:w-32 lg:h-32 bg-emerald-400 text-white rounded-full shadow-xl flex items-center justify-center btn-bubble shrink-0"
          >
            <ChevronRight size={40} className="lg:w-16 lg:h-16" />
          </button>
        </div>
      </div>
    );
  };

  const renderQuiz = () => {
    if (!quizQuestion) return null;
    return (
      <div className="flex flex-col h-full p-6 lg:p-10">
        <div className="flex justify-between items-center mb-10">
          <button onClick={() => setMode('welcome')} className="p-4 bg-white rounded-full shadow-md text-slate-400 hover:text-sky-500 transition-colors">
            <Home size={32} />
          </button>
          <div className="flex items-center gap-4 bg-yellow-100 px-8 py-2 rounded-full text-yellow-700 text-2xl font-bold shadow-sm">
            <Star size={32} fill="currentColor" /> {stars}
          </div>
          <button onClick={() => setMode('learn')} className="p-4 bg-emerald-100 text-emerald-500 rounded-full shadow-sm hover:bg-emerald-200 transition-colors">
            <BookOpen size={32} />
          </button>
        </div>

        <div className="text-center mb-12">
          <h2 className="text-4xl lg:text-5xl font-bold text-slate-600 mb-4">Where is the letter...</h2>
          <div className="text-[12rem] lg:text-[15rem] font-bold text-sky-600 leading-none drop-shadow-lg">{quizQuestion.letter}</div>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-3 gap-8 flex-1 max-w-6xl mx-auto w-full">
          {quizQuestion.options.map((option, idx) => (
            <motion.button
              key={idx}
              whileTap={{ scale: 0.95 }}
              onClick={() => handleQuizAnswer(idx)}
              className={`kid-card p-10 flex flex-col items-center justify-center gap-6 text-center relative overflow-hidden transition-all ${
                quizFeedback === 'correct' && idx === quizQuestion.correctIndex ? 'border-emerald-400 bg-emerald-50 ring-8 ring-emerald-100' : 
                quizFeedback === 'wrong' && idx !== quizQuestion.correctIndex ? 'opacity-50 grayscale' : 'hover:shadow-2xl'
              }`}
            >
              <div className="text-9xl lg:text-[10rem]">{option.emoji}</div>
              <div className="text-4xl lg:text-5xl font-bold text-slate-700">{option.word}</div>
              {quizFeedback === 'correct' && idx === quizQuestion.correctIndex && (
                <div className="absolute top-4 right-4 text-5xl text-emerald-500 animate-bounce">✨</div>
              )}
            </motion.button>
          ))}
        </div>

        {quizFeedback === 'correct' && (
          <motion.div 
            initial={{ scale: 0, rotate: -20 }}
            animate={{ scale: 1, rotate: 0 }}
            className="fixed inset-0 flex items-center justify-center pointer-events-none z-50"
          >
            <div className="bg-white p-16 rounded-[3rem] shadow-2xl text-center border-8 border-emerald-100">
              <div className="text-9xl mb-4">🌟</div>
              <div className="text-6xl font-bold text-emerald-500">Awesome!</div>
            </div>
          </motion.div>
        )}
      </div>
    );
  };

  const renderCongrats = () => (
    <motion.div 
      initial={{ opacity: 0, scale: 0.8 }}
      animate={{ opacity: 1, scale: 1 }}
      className="flex flex-col items-center justify-center h-full text-center p-6"
    >
      <div className="text-9xl mb-8">🏆</div>
      <h1 className="text-5xl font-bold text-sky-600 mb-4">You Did It!</h1>
      <p className="text-2xl text-slate-500 mb-12">You learned all the letters!</p>
      
      <div className="flex flex-wrap justify-center gap-2 mb-12 max-w-md">
        {Array.from({ length: 10 }).map((_, i) => (
          <motion.div
            key={i}
            animate={{ rotate: 360 }}
            transition={{ duration: 2, repeat: Infinity, ease: "linear", delay: i * 0.2 }}
            className="text-3xl"
          >
            ⭐
          </motion.div>
        ))}
      </div>

      <button 
        onClick={() => { setMode('welcome'); setCurrentIndex(0); }}
        className="btn-bubble bg-sky-500 text-white px-12 py-6 rounded-3xl text-3xl font-bold shadow-lg flex items-center gap-3"
      >
        <RotateCcw size={32} />
        Play Again
      </button>
    </motion.div>
  );

  return (
    <div className="min-h-screen h-[100dvh] w-full bg-sky-50 relative overflow-x-hidden overflow-y-auto font-sans">
      {/* Background Decorations */}
      <div className="absolute -top-40 -left-40 w-96 h-96 bg-yellow-200 rounded-full blur-[100px] opacity-40 pointer-events-none" />
      <div className="absolute -bottom-40 -right-40 w-96 h-96 bg-pink-200 rounded-full blur-[100px] opacity-40 pointer-events-none" />
      <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[800px] h-[800px] bg-sky-200 rounded-full blur-[150px] opacity-20 pointer-events-none" />
      
      <main className="min-h-full relative z-10 max-w-[1920px] mx-auto">
        {mode === 'welcome' && renderWelcome()}
        {mode === 'learn' && renderLearn()}
        {mode === 'quiz' && renderQuiz()}
        {mode === 'congrats' && renderCongrats()}
      </main>
    </div>
  );
}
