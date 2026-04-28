import { motion } from "motion/react";
import { Heart } from "lucide-react";
import { useEffect, useState } from "react";

export default function FloatingHearts() {
  const [hearts, setHearts] = useState<{ id: number; left: string; size: number; duration: number; delay: number }[]>([]);

  useEffect(() => {
    const newHearts = Array.from({ length: 20 }).map((_, i) => ({
      id: i,
      left: `${Math.random() * 100}%`,
      size: Math.random() * 20 + 10,
      duration: Math.random() * 10 + 10,
      delay: Math.random() * 5,
    }));
    setHearts(newHearts);
  }, []);

  return (
    <div className="fixed inset-0 pointer-events-none z-0 overflow-hidden">
      {hearts.map((heart) => (
        <motion.div
          key={heart.id}
          initial={{ y: "110vh", opacity: 0, scale: 0.5 }}
          animate={{
            y: "-10vh",
            opacity: [0, 0.8, 0.8, 0],
            x: [0, 20, -20, 0],
            rotate: [0, 45, -45, 0],
            scale: [0.5, 1, 1.2, 0.8],
          }}
          transition={{
            duration: heart.duration,
            repeat: Infinity,
            delay: heart.delay,
            ease: "linear",
          }}
          style={{
            position: "absolute",
            left: heart.left,
          }}
        >
          <Heart
            className="text-pink-500/30 fill-pink-500/20"
            size={heart.size}
          />
        </motion.div>
      ))}
    </div>
  );
}
