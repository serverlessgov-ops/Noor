import { motion, AnimatePresence } from "motion/react";
import { useEffect, useState } from "react";

interface TypewriterTextProps {
  lines: string[];
  onComplete?: () => void;
}

export default function TypewriterText({ lines, onComplete }: TypewriterTextProps) {
  const [currentLineIndex, setCurrentLineIndex] = useState(0);
  const [displayedLines, setDisplayedLines] = useState<string[]>([]);
  const [isTyping, setIsTyping] = useState(true);

  useEffect(() => {
    if (currentLineIndex < lines.length) {
      const line = lines[currentLineIndex];
      let charIndex = 0;
      
      setDisplayedLines(prev => [...prev, ""]);
      
      const interval = setInterval(() => {
        if (charIndex < line.length) {
          setDisplayedLines(prev => {
            const updated = [...prev];
            updated[currentLineIndex] = line.slice(0, charIndex + 1);
            return updated;
          });
          charIndex++;
        } else {
          clearInterval(interval);
          setCurrentLineIndex(prev => prev + 1);
        }
      }, 50);

      return () => clearInterval(interval);
    } else {
      setIsTyping(false);
      onComplete?.();
    }
  }, [currentLineIndex, lines]);

  return (
    <div className="flex flex-col gap-4 text-center items-center justify-center arabic-text">
      <AnimatePresence mode="popLayout">
        {displayedLines.map((line, index) => (
          <motion.p
            key={index}
            initial={{ opacity: 0, y: 10, filter: "blur(4px)" }}
            animate={{ opacity: 1, y: 0, filter: "blur(0px)" }}
            className={`text-xl md:text-3xl lg:text-4xl leading-relaxed text-zinc-100 font-medium ${
              index === displayedLines.length - 1 && isTyping ? "animate-glow" : ""
            }`}
          >
            {line}
          </motion.p>
        ))}
      </AnimatePresence>
    </div>
  );
}
