'use client';

import React, { useState, useEffect, useRef } from 'react';
import { motion, useReducedMotion } from 'framer-motion';

interface BreathingCircleProps {
  onClose?: () => void;
}

type BreathPhase = 'Inhale' | 'Hold (In)' | 'Exhale' | 'Hold (Out)';

const PHASES: { name: BreathPhase; duration: number; instruction: string }[] = [
  { name: 'Inhale', duration: 4, instruction: 'Breathe in slowly through your nose...' },
  { name: 'Hold (In)', duration: 4, instruction: 'Gently hold your breath...' },
  { name: 'Exhale', duration: 4, instruction: 'Release the breath slowly through your mouth...' },
  { name: 'Hold (Out)', duration: 4, instruction: 'Rest before the next breath...' },
];

export default function BreathingCircle({ onClose }: BreathingCircleProps) {
  const [phaseIndex, setPhaseIndex] = useState(0);
  const [secondsRemaining, setSecondsRemaining] = useState(PHASES[0].duration);
  const [cycleCount, setCycleCount] = useState(1);
  const [isActive, setIsActive] = useState(true);
  
  const shouldReduceMotion = useReducedMotion();
  const currentPhase = PHASES[phaseIndex];

  // Screen reader announcer ref
  const announcerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!isActive) return;

    const timer = setInterval(() => {
      setSecondsRemaining((prev) => {
        if (prev <= 1) {
          // Move to next phase
          const nextIndex = (phaseIndex + 1) % PHASES.length;
          setPhaseIndex(nextIndex);
          if (nextIndex === 0) {
            setCycleCount((c) => c + 1);
          }
          return PHASES[nextIndex].duration;
        }
        return prev - 1;
      });
    }, 1000);

    return () => clearInterval(timer);
  }, [phaseIndex, isActive]);

  // Announce phase changes to screen readers
  useEffect(() => {
    if (announcerRef.current) {
      announcerRef.current.textContent = `${currentPhase.name}. ${currentPhase.instruction}. ${secondsRemaining} seconds remaining.`;
    }
  }, [phaseIndex, secondsRemaining, currentPhase]);

  const handleSkip = () => {
    const nextIndex = (phaseIndex + 1) % PHASES.length;
    setPhaseIndex(nextIndex);
    if (nextIndex === 0) {
      setCycleCount((c) => c + 1);
    }
    setSecondsRemaining(PHASES[nextIndex].duration);
  };

  const togglePause = () => {
    setIsActive(!isActive);
  };

  // Determine circle scale based on phase
  let targetScale = 1.0;
  if (currentPhase.name === 'Inhale') {
    // scale up from 1 to 1.8 based on time elapsed
    const elapsed = PHASES[0].duration - secondsRemaining;
    targetScale = 1.0 + (elapsed / PHASES[0].duration) * 0.8;
  } else if (currentPhase.name === 'Hold (In)') {
    targetScale = 1.8;
  } else if (currentPhase.name === 'Exhale') {
    // scale down from 1.8 to 1.0
    const elapsed = PHASES[2].duration - secondsRemaining;
    targetScale = 1.8 - (elapsed / PHASES[2].duration) * 0.8;
  } else if (currentPhase.name === 'Hold (Out)') {
    targetScale = 1.0;
  }

  // Define transition speeds
  const transitionConfig = shouldReduceMotion
    ? { duration: 0 }
    : { type: 'spring', stiffness: 60, damping: 15 };

  return (
    <div className="glass-panel p-8 rounded-[24px] max-w-md w-full mx-auto text-center flex flex-col items-center justify-between border border-[var(--border-light)] shadow-elevated relative overflow-hidden z-10">
      {/* Hidden screen reader announcer */}
      <div 
        ref={announcerRef} 
        className="sr-only" 
        role="timer" 
        aria-live="assertive" 
        aria-atomic="true"
      />

      <div className="w-full flex justify-between items-center mb-6">
        <span className="text-xs uppercase tracking-wider text-[var(--text-secondary)] font-medium">
          Box Breathing • Cycle {cycleCount}
        </span>
        {onClose && (
          <button
            onClick={onClose}
            className="text-xs font-semibold px-3 py-1.5 rounded-[12px] bg-[var(--bg-tertiary)] hover:bg-[var(--accent-crisis)] hover:text-white transition-colors duration-200 focus-visible:outline focus-visible:outline-2 focus-visible:outline-[var(--accent-healing)]"
            aria-label="Exit breathing exercise"
          >
            Exit
          </button>
        )}
      </div>

      {/* Animation Container */}
      <div className="relative w-64 h-64 flex items-center justify-center my-6">
        {/* Outer Ring / Guide */}
        <div className="absolute w-60 h-60 rounded-full border-2 border-dashed border-[var(--accent-healing)] opacity-20" />

        {/* Pulsing Breathing Circle */}
        <motion.div
          animate={{ scale: targetScale }}
          transition={transitionConfig}
          className="w-32 h-32 rounded-full flex flex-col items-center justify-center text-center shadow-lg"
          style={{
            backgroundColor: 'var(--accent-healing)',
            color: 'var(--text-healing)',
          }}
        >
          {/* Inner Circle details */}
          <div className="text-[var(--bg-primary)] mix-blend-difference font-bold text-lg select-none">
            {secondsRemaining}s
          </div>
        </motion.div>
      </div>

      <div className="w-full min-h-[5.5rem] flex flex-col justify-center items-center px-4">
        <h3 className="font-serif font-semibold text-2xl mb-2 text-[var(--text-primary)]">
          {currentPhase.name}
        </h3>
        <p className="text-sm text-[var(--text-secondary)] tracking-wide leading-relaxed text-center max-w-[280px]">
          {currentPhase.instruction}
        </p>
      </div>

      {/* Exercise Controls */}
      <div className="mt-8 flex gap-4 w-full justify-center">
        <button
          onClick={togglePause}
          className="flex-1 max-w-[120px] font-sans font-semibold py-2.5 px-4 rounded-[16px] border border-[var(--border-light)] hover:bg-[var(--bg-tertiary)] transition-colors focus-visible:outline focus-visible:outline-2 focus-visible:outline-[var(--accent-healing)]"
          aria-label={isActive ? 'Pause breathing guide' : 'Resume breathing guide'}
        >
          {isActive ? 'Pause' : 'Resume'}
        </button>

        <button
          onClick={handleSkip}
          className="flex-1 max-w-[120px] font-sans font-semibold py-2.5 px-4 rounded-[16px] bg-[var(--accent-healing)] text-white hover:opacity-90 transition-opacity focus-visible:outline focus-visible:outline-2 focus-visible:outline-[var(--accent-healing)]"
          aria-label="Skip current breath phase"
        >
          Skip
        </button>
      </div>
    </div>
  );
}
