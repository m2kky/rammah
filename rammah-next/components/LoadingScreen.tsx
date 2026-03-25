"use client";
import { motion, AnimatePresence } from "motion/react";
import { useEffect, useState } from "react";
import { ShapeGreen, ShapeOrange, ShapeBlue, ShapeRed } from "./ICRLShapes";

const shapes = [ShapeGreen, ShapeOrange, ShapeBlue, ShapeRed];

export default function LoadingScreen({ onComplete }: { onComplete: () => void }) {
  const [index, setIndex] = useState(0);
  const [isExiting, setIsExiting] = useState(false);

  useEffect(() => {
    if (index < shapes.length - 1) {
      const timer = setTimeout(() => setIndex((prev) => prev + 1), 700);
      return () => clearTimeout(timer);
    } else {
      const timer = setTimeout(() => {
        setIsExiting(true);
        setTimeout(onComplete, 800);
      }, 1000);
      return () => clearTimeout(timer);
    }
  }, [index, onComplete]);

  const CurrentShape = shapes[index];

  return (
    <motion.div
      className="fixed inset-0 z-[9999] flex flex-col items-center justify-center bg-[#1A1A2E]"
      initial={{ opacity: 1 }}
      animate={{ opacity: isExiting ? 0 : 1 }}
      transition={{ duration: 0.8 }}
    >
      <div className="h-40 flex items-center justify-center relative w-full">
        <AnimatePresence>
          <motion.div
            key={index}
            initial={{ scale: 0.5, opacity: 0, rotate: -30 }}
            animate={{ scale: 1, opacity: 1, rotate: 0 }}
            exit={{ scale: 1.5, opacity: 0, rotate: 30 }}
            transition={{ duration: 0.5, ease: "easeInOut" }}
            className="absolute flex items-center justify-center"
          >
            <CurrentShape className="w-24 h-24 md:w-32 md:h-32" />
          </motion.div>
        </AnimatePresence>
      </div>
      <motion.div
        initial={{ opacity: 0, y: 10, filter: "blur(5px)" }}
        animate={{ opacity: 1, y: 0, filter: "blur(0px)" }}
        transition={{ delay: 0.4, duration: 1 }}
        className="mt-8 text-4xl md:text-5xl font-bold text-white tracking-widest uppercase"
      >
        Ramah
      </motion.div>
    </motion.div>
  );
}
