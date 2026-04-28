/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { useState, useEffect, useRef } from "react";
import { motion, AnimatePresence } from "motion/react";
import { 
  Heart, 
  Volume2, 
  Languages, 
  MessageCircle, 
  X, 
  Send, 
  Mic, 
  Sparkles,
  Music
} from "lucide-react";
import FloatingHearts from "./components/FloatingHearts";
import TypewriterText from "./components/TypewriterText";
import { translateText, generateSpeech, chatWithVoice } from "./lib/gemini";
import { playPCM, stopPCM } from "./lib/audio";
import { supabase } from "./lib/supabase";

const ARABIC_CONTENT = [
  "مرحبًا يا نور 🌙✨",
  "كيف حالكِ؟",
  "أنا عادل، صديقكِ الذي يهتم بكِ كثيرًا 🤍",
  "وجودكِ يعني لي الكثير، وكلماتكِ تسعد قلبي",
  "أحبكِ بطريقة جميلة وصادقة 💖",
  "وأتمنى لكِ السعادة في كل لحظة",
  "ستبقين دائمًا مميزة في قلبي 🌹"
];

export default function App() {
  const [isLoaded, setIsLoaded] = useState(false);
  const [showPopup, setShowPopup] = useState(false);
  const [isArabic, setIsArabic] = useState(true);
  const [isChatOpen, setIsChatOpen] = useState(false);
  const [isPlaying, setIsPlaying] = useState(false);
  const [messages, setMessages] = useState<{ role: string; content: string }[]>([]);
  const [input, setInput] = useState("");
  const [isTyping, setIsTyping] = useState(false);
  const [currentLines, setCurrentLines] = useState(ARABIC_CONTENT);
  const [voiceCloned, setVoiceCloned] = useState(false);
  const [cloningProgress, setCloningProgress] = useState(0);

  const chatEndRef = useRef<HTMLDivElement>(null);

  const [isMusicPlaying, setIsMusicPlaying] = useState(false);
  const audioRef = useRef<HTMLAudioElement | null>(null);

  const [isEntered, setIsEntered] = useState(false);

  useEffect(() => {
    setIsLoaded(true);
    audioRef.current = document.getElementById('bg-music') as HTMLAudioElement;
    if (audioRef.current) {
      audioRef.current.src = "https://www.soundhelix.com/examples/mp3/SoundHelix-Song-1.mp3";
      audioRef.current.volume = 0.2;
    }
    loadChatHistory();
  }, []);

  const handleEnter = () => {
    setIsEntered(true);
    // Start music
    if (audioRef.current) {
      audioRef.current.play().catch(console.error);
      setIsMusicPlaying(true);
    }
    // Start auto-reading the text
    handleTTS(currentLines.join(" "));
  };

  const loadChatHistory = async () => {
    try {
      const { data, error } = await supabase
        .from('messages')
        .select('*')
        .order('created_at', { ascending: true });
      
      if (error) throw error;
      if (data && data.length > 0) {
        setMessages(data.map(m => ({ role: m.role, content: m.content })));
      } else {
        // Initial AI Greeting if no history
        const welcome = { 
          role: "model", 
          content: isArabic 
            ? "أهلاً بكِ جيني. يرجى رفع عينة من صوتكِ أدناه، وسأقوم بمحاكاة نبرتكِ الجميلة في ردودي. يمكنكِ اختيار أي أسلوب تريده للحديث!" 
            : "Hello. Please upload a voice sample below, and I will simulate your beautiful tone in my responses. You can choose any style of speech you'd like!" 
        };
        setMessages([welcome]);
      }
    } catch (e) {
      console.warn("Supabase issue:", e);
    }
  };

  const toggleMusic = () => {
    if (!audioRef.current) return;
    if (isMusicPlaying) {
      audioRef.current.pause();
    } else {
      audioRef.current.play().catch(console.error);
    }
    setIsMusicPlaying(!isMusicPlaying);
  };

  useEffect(() => {
    chatEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages, isTyping]);

  const toggleLanguage = async () => {
    const newLang = !isArabic;
    setIsArabic(newLang);
    const target = newLang ? "Arabic" : "English";
    
    // Translate the main content
    const translated = await Promise.all(
      ARABIC_CONTENT.map(async (line) => await translateText(line, target))
    );
    setCurrentLines(translated as string[]);
  };

  const [currentStyle, setCurrentStyle] = useState("emotional");
  const [targetLang, setTargetLang] = useState("Arabic");

  const handleTTS = async (text: string, overrideStyle?: string) => {
    try {
      if (isPlaying) {
        stopPCM();
        setIsPlaying(false);
        return;
      }

      setIsPlaying(true);
      const base64 = await generateSpeech(text, "Kore", overrideStyle || currentStyle);
      if (base64) {
        await playPCM(base64);
      }
      setIsPlaying(false);
    } catch (error) {
      console.error(error);
      setIsPlaying(false);
      stopPCM();
    }
  };

  const handleSendMessage = async () => {
    if (!input.trim()) return;
    
    const userMsg = { 
      role: "user", 
      content: input,
      language: targetLang,
      voice_style: currentStyle 
    };
    setMessages(prev => [...prev, userMsg]);
    setInput("");
    setIsTyping(true);

    // Save user message to Supabase
    try {
      await supabase.from('messages').insert([userMsg]);
    } catch (e) {
      console.error("Supabase Save Error:", e);
    }

    const history = messages.map(m => ({ role: m.role, parts: m.content }));
    const response = await chatWithVoice(`${input} (Please respond in ${targetLang} with a ${currentStyle} tone)`, history);
    
    setIsTyping(false);
    const aiMsg = { 
      role: "model", 
      content: response,
      language: targetLang,
      voice_style: currentStyle 
    };
    setMessages(prev => [...prev, aiMsg]);

    // Save AI message to Supabase
    try {
      await supabase.from('messages').insert([aiMsg]);
    } catch (e) {
      console.error("Supabase Save Error:", e);
    }

    // Automatically speak the AI response
    if (voiceCloned) {
      handleTTS(response);
    }
  };

  const simulateCloning = () => {
    setVoiceCloned(true);
    let progress = 0;
    const interval = setInterval(() => {
      progress += 5;
      setCloningProgress(progress);
      if (progress >= 100) {
        clearInterval(interval);
      }
    }, 100);
  };

  return (
    <div className="relative min-h-screen romantic-gradient flex flex-col items-center justify-center p-6 space-y-12 overflow-hidden">
      <FloatingHearts />
      
      <AnimatePresence>
        {!isEntered && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0, scale: 1.1, filter: "blur(20px)" }}
            className="fixed inset-0 z-[1000] flex flex-col items-center justify-center bg-black/90 backdrop-blur-2xl px-6 text-center"
          >
            <motion.div
              initial={{ y: 20, opacity: 0 }}
              animate={{ y: 0, opacity: 1 }}
              transition={{ delay: 0.5 }}
              className="space-y-8"
            >
              <div className="flex justify-center flex-wrap gap-2">
                {"نور".split("").map((char, i) => (
                  <motion.span 
                    key={i}
                    animate={{ textShadow: ["0 0 10px #ff00ff", "0 0 20px #ff00ff", "0 0 10px #ff00ff"] }}
                    transition={{ repeat: Infinity, duration: 2, delay: i * 0.2 }}
                    className="text-7xl md:text-9xl font-bold font-arabic text-pink-500"
                  >
                    {char}
                  </motion.span>
                ))}
              </div>
              <p className="text-pink-200/60 font-medium tracking-[0.2em] uppercase text-sm">
                A Message from the Heart
              </p>
              <button
                onClick={handleEnter}
                className="group relative px-16 py-4 rounded-full border border-pink-500/30 text-pink-200 font-bold overflow-hidden hover:text-white transition-all active:scale-95"
              >
                <div className="absolute inset-0 bg-pink-500 opacity-0 group-hover:opacity-10 transition-opacity" />
                <span className="relative flex items-center gap-2">
                  {isArabic ? "ادخلي يا نور" : "Enter, Al Noor"}
                  <Sparkles size={18} className="animate-pulse" />
                </span>
              </button>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Atmosphere overlay */}
      <div className="fixed inset-0 pointer-events-none bg-[radial-gradient(circle_at_50%_30%,_rgba(255,0,255,0.05)_0%,_transparent_50%)]" />

      {/* Header controls */}
      <div className="absolute top-6 right-6 flex items-center gap-4 z-50">
        <button 
          onClick={toggleMusic}
          className={`glass-morphism p-3 rounded-full hover:bg-white/10 transition-all text-pink-300 ${isMusicPlaying ? "animate-spin-slow" : ""}`}
          title="Toggle Music"
        >
          <Music size={20} className={isMusicPlaying ? "text-pink-500" : ""} />
        </button>

        <button 
          onClick={toggleLanguage}
          className="glass-morphism p-3 rounded-full hover:bg-white/10 transition-all text-pink-300 flex items-center gap-2 group"
          title="Translate"
        >
          <Languages size={20} className="group-hover:rotate-12 duration-300" />
          <span className="text-xs font-semibold">{isArabic ? "English" : "عربي"}</span>
        </button>
        
        <button 
          onClick={() => handleTTS(currentLines.join(" "))}
          className={`glass-morphism p-3 rounded-full hover:bg-white/10 transition-all ${isPlaying ? "text-pink-500 animate-pulse bg-white/5" : "text-pink-300"}`}
          title={isPlaying ? "Stop Reading" : "Read Text"}
        >
          {isPlaying ? <X size={20} /> : <Volume2 size={20} />}
        </button>
      </div>

      {/* Main Content */}
      <main className="max-w-4xl w-full flex flex-col items-center justify-center text-center space-y-16 z-10">
        <AnimatePresence>
          {isLoaded && (
            <motion.div
              initial={{ opacity: 0, scale: 0.9 }}
              animate={{ opacity: 1, scale: 1 }}
              transition={{ duration: 1.5, ease: "easeOut" }}
              className="relative w-full"
            >
              <TypewriterText lines={currentLines} />
            </motion.div>
          )}
        </AnimatePresence>

        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 5, duration: 1 }}
          className="flex flex-col items-center gap-6"
        >
          <button
            onClick={() => setShowPopup(true)}
            className="group relative glass-morphism px-12 py-5 rounded-full text-xl font-bold text-pink-100 hover:text-white transition-all overflow-hidden flex items-center gap-3 active:scale-95"
          >
            <div className="absolute inset-0 bg-gradient-to-r from-pink-500/20 to-purple-500/20 group-hover:opacity-100 opacity-0 transition-opacity" />
            <Sparkles size={24} className="text-pink-400 group-hover:scale-110 transition-transform" />
            {isArabic ? "اضغطي هنا" : "Click Here"}
          </button>
        </motion.div>
      </main>

      {/* Chat Trigger */}
      <button
        onClick={() => setIsChatOpen(true)}
        className="fixed bottom-8 right-8 z-50 glass-morphism p-5 rounded-full text-pink-400 shadow-2xl hover:scale-110 active:scale-90 transition-all"
      >
        <MessageCircle size={28} />
      </button>

      {/* Popup Overlay */}
      <AnimatePresence>
        {showPopup && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={() => setShowPopup(false)}
            className="fixed inset-0 z-[100] flex items-center justify-center bg-black/60 backdrop-blur-sm p-4"
          >
            <motion.div
              initial={{ scale: 0.5, opacity: 0, y: 50 }}
              animate={{ scale: 1, opacity: 1, y: 0 }}
              exit={{ scale: 0.5, opacity: 0, y: 50 }}
              className="glass-morphism max-w-sm w-full p-8 rounded-3xl text-center space-y-6 relative overflow-hidden"
              onClick={(e) => e.stopPropagation()}
            >
              <div className="absolute top-0 left-0 w-full h-1 bg-gradient-to-r from-pink-500 to-purple-500" />
              <Heart className="mx-auto text-pink-500 fill-pink-500/20" size={64} />
              <h2 className="text-3xl font-bold text-transparent bg-clip-text bg-gradient-to-r from-pink-200 to-purple-200 arabic-text">
                {isArabic ? "أنتِ مميزة جدًا 💖" : "You are very special 💖"}
              </h2>
              <button
                onClick={() => setShowPopup(false)}
                className="w-full py-4 rounded-2xl bg-white/10 hover:bg-white/20 text-pink-200 font-semibold transition-colors"
              >
                {isArabic ? "موافق" : "Close"}
              </button>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Chat Drawer */}
      <AnimatePresence>
        {isChatOpen && (
          <motion.div
            initial={{ x: "100%" }}
            animate={{ x: 0 }}
            exit={{ x: "100%" }}
            className="fixed top-0 right-0 h-screen w-full md:w-[450px] z-[200] glass-morphism flex flex-col shadow-2xl"
          >
            <div className="p-6 border-b border-white/10 flex items-center justify-between">
              <div className="flex items-center gap-4">
                <div className="w-12 h-12 rounded-full border-2 border-pink-500 p-0.5">
                  <div className="w-full h-full rounded-full bg-gradient-to-tr from-pink-600 to-purple-600 flex items-center justify-center">
                    <Heart size={20} className="text-white fill-white" />
                  </div>
                </div>
                <div>
                  <h3 className="font-bold text-pink-100">{isArabic ? "دردشة حب" : "Love Chat"}</h3>
                  <p className="text-xs text-pink-400 font-medium">{voiceCloned ? "Voice Active" : "Online"}</p>
                </div>
              </div>
              <button 
                onClick={() => setIsChatOpen(false)}
                className="p-2 hover:bg-white/10 rounded-lg text-zinc-400"
              >
                <X size={24} />
              </button>
            </div>

            <div className="p-4 border-b border-white/10 glass-morphism space-y-3">
              <div className="flex gap-2 overflow-x-auto pb-1 scrollbar-hide">
                {["emotional", "news", "singing", "breathing"].map((style) => (
                  <button
                    key={style}
                    onClick={() => setCurrentStyle(style)}
                    className={`px-3 py-1 rounded-full text-[10px] uppercase font-bold transition-all border ${
                      currentStyle === style 
                        ? "bg-pink-500 border-pink-500 text-white" 
                        : "bg-white/5 border-white/10 text-pink-300"
                    }`}
                  >
                    {style}
                  </button>
                ))}
              </div>
              <div className="flex gap-2">
                <select 
                  value={targetLang}
                  onChange={(e) => setTargetLang(e.target.value)}
                  className="bg-white/5 border border-white/10 rounded-lg px-3 py-1 text-xs text-pink-200 outline-none w-full"
                >
                  <option value="Arabic" className="bg-zinc-900">Arabic / عربي</option>
                  <option value="English" className="bg-zinc-900">English</option>
                  <option value="French" className="bg-zinc-900">French</option>
                  <option value="Spanish" className="bg-zinc-900">Spanish</option>
                </select>
              </div>
            </div>

            <div className="flex-1 overflow-y-auto p-6 space-y-6 scrollbar-hide">
              {messages.length === 0 && (
                <div className="h-full flex flex-col items-center justify-center text-center p-8 space-y-4 opacity-50">
                  <Heart className="text-pink-500/30" size={48} />
                  <p className="text-sm">
                    {isArabic 
                      ? "ابدئي محادثة جميلة... أنا هنا لأسمعكِ" 
                      : "Start a beautiful conversation... I'm here to listen."}
                  </p>
                  
                  {!voiceCloned ? (
                    <div className="flex flex-col items-center gap-4">
                      <label 
                        className="cursor-pointer flex items-center gap-2 text-xs py-3 px-6 rounded-full bg-pink-500/20 text-pink-300 hover:bg-pink-500/30 transition-all border border-pink-500/30"
                      >
                        <Mic size={14} />
                        {isArabic ? "ارفعي عينة صوتكِ (اختياري)" : "Upload Voice Sample (Optional)"}
                        <input 
                          type="file" 
                          accept="audio/*" 
                          className="hidden" 
                          onChange={simulateCloning}
                        />
                      </label>
                      <button 
                        onClick={simulateCloning}
                        className="text-[10px] text-pink-400/50 hover:text-pink-400 transition-colors underline"
                      >
                        {isArabic ? "تفعيل بدون عينة" : "Activate without sample"}
                      </button>
                    </div>
                  ) : (
                    <div className="w-full max-w-[200px] space-y-2">
                       <p className="text-[10px] uppercase tracking-widest text-pink-400">
                        {cloningProgress < 100 ? "Cloning Voice..." : "Voice Context Synced"}
                       </p>
                       <div className="w-full h-1 bg-white/10 rounded-full overflow-hidden">
                          <motion.div 
                            className="h-full bg-pink-500"
                            initial={{ width: 0 }}
                            animate={{ width: `${cloningProgress}%` }}
                          />
                       </div>
                    </div>
                  )}
                </div>
              )}
              {messages.map((m, i) => (
                <motion.div
                  key={i}
                  initial={{ opacity: 0, x: m.role === "user" ? 20 : -20 }}
                  animate={{ opacity: 1, x: 0 }}
                  className={`flex ${m.role === "user" ? "justify-end" : "justify-start"}`}
                >
                  <div className={`max-w-[80%] p-4 rounded-2xl ${
                    m.role === "user" 
                      ? "bg-pink-600/20 text-pink-50" 
                      : "bg-white/10 text-zinc-100"
                  }`}>
                    {m.content}
                    {m.role === "model" && (
                       <button 
                        onClick={() => handleTTS(m.content)}
                        className="block mt-2 opacity-50 hover:opacity-100 transition-opacity"
                       >
                        <Volume2 size={14} />
                       </button>
                    )}
                  </div>
                </motion.div>
              ))}
              {isTyping && (
                <div className="flex justify-start">
                  <div className="bg-white/10 px-4 py-3 rounded-2xl flex gap-1">
                    <motion.div animate={{ opacity: [0.3, 1, 0.3] }} transition={{ repeat: Infinity, duration: 1 }} className="w-1.5 h-1.5 bg-pink-400 rounded-full" />
                    <motion.div animate={{ opacity: [0.3, 1, 0.3] }} transition={{ repeat: Infinity, duration: 1, delay: 0.2 }} className="w-1.5 h-1.5 bg-pink-400 rounded-full" />
                    <motion.div animate={{ opacity: [0.3, 1, 0.3] }} transition={{ repeat: Infinity, duration: 1, delay: 0.4 }} className="w-1.5 h-1.5 bg-pink-400 rounded-full" />
                  </div>
                </div>
              )}
              <div ref={chatEndRef} />
            </div>

            <div className="p-6 border-t border-white/10 bg-black/40">
              <div className="flex items-center gap-3">
                <input
                  value={input}
                  onChange={(e) => setInput(e.target.value)}
                  onKeyPress={(e) => e.key === "Enter" && handleSendMessage()}
                  placeholder={isArabic ? "اكتبِ رسالة..." : "Type a message..."}
                  className="flex-1 bg-white/5 border border-white/10 rounded-xl px-4 py-3 text-sm focus:outline-none focus:ring-1 focus:ring-pink-500 transition-all"
                />
                <button
                  onClick={handleSendMessage}
                  disabled={!input.trim()}
                  className="p-3 rounded-xl bg-pink-600/20 text-pink-400 hover:bg-pink-600/30 transition-all disabled:opacity-50"
                >
                  <Send size={20} />
                </button>
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Background Ambience */}
      <div className="fixed bottom-6 left-6 text-pink-500/20 flex items-center gap-2">
        <Music size={16} />
        <span className="text-[10px] uppercase tracking-tighter">Romantic Ambience Active</span>
      </div>
    </div>
  );
}
