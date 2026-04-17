import { useEffect, useRef, useCallback } from "react";
import { useNavigate } from "react-router-dom";
import { motion, AnimatePresence } from "framer-motion";
import { usePaperAirplane } from "../context/PaperAirplaneContext";
import useIsDesktop from "../hooks/useIsDesktop";
import TornEdge, { useTornClip } from "./TornEdge";
import PaperPlaneSVG from "./PaperPlaneSVG";

const FOLD_DURATION = 0.4;
const LOOP_DURATION = 0.8;
const FLY_DURATION = 0.6;
const LAND_DURATION = 0.3;
const FADE_OUT_DURATION = 1;
const LOOP_RADIUS = 100;
const DEST_TIMEOUT_MS = 1000;

function usePrefersReducedMotion(): boolean {
  if (typeof window === "undefined") return false;
  return window.matchMedia("(prefers-reduced-motion: reduce)").matches;
}

export default function PaperAirplaneOverlay() {
  const {
    phase,
    originRect,
    destinationRect,
    destinationUrl,
    project,
    setPhase,
    reset,
  } = usePaperAirplane();
  const navigate = useNavigate();
  const isDesktop = useIsDesktop();
  const reducedMotion = usePrefersReducedMotion();
  const skipAnimation = !isDesktop || reducedMotion;

  const destTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const hasNavigatedRef = useRef(false);
  const phaseRef = useRef(phase);
  phaseRef.current = phase;

  const clipStyle = useTornClip(project?.name ?? "default");

  // Cleanup timeout on unmount
  useEffect(() => {
    return () => {
      if (destTimeoutRef.current) clearTimeout(destTimeoutRef.current);
    };
  }, []);

  // Skip animation on mobile or reduced motion -- navigate immediately
  useEffect(() => {
    if (skipAnimation && phase !== "idle" && destinationUrl) {
      navigate(destinationUrl);
      reset();
    }
  }, [skipAnimation, phase, destinationUrl, navigate, reset]);

  // Reset navigation tracking when returning to idle
  useEffect(() => {
    if (phase === "idle") {
      hasNavigatedRef.current = false;
    }
  }, [phase]);

  // Safety timeout: if loop animation doesn't complete within DEST_TIMEOUT_MS,
  // force advance to flying phase so the animation doesn't stall
  useEffect(() => {
    if (phase === "looping") {
      destTimeoutRef.current = setTimeout(() => {
        if (phaseRef.current === "looping") {
          setPhase("flying");
        }
      }, DEST_TIMEOUT_MS);
    }
    return () => {
      if (destTimeoutRef.current) clearTimeout(destTimeoutRef.current);
    };
  }, [phase, setPhase]);

  // Navigate after fold completes
  const handleFoldComplete = useCallback(() => {
    if (phase !== "folding" || !destinationUrl || hasNavigatedRef.current)
      return;
    hasNavigatedRef.current = true;
    navigate(destinationUrl);
    setPhase("looping");
  }, [phase, destinationUrl, navigate, setPhase]);

  // After loop completes, advance to flying
  const handleLoopComplete = useCallback(() => {
    if (phase !== "looping") return;
    setPhase("flying");
  }, [phase, setPhase]);

  // After flying completes, advance to landing
  const handleFlyComplete = useCallback(() => {
    if (phase !== "flying") return;
    setPhase("landing");
  }, [phase, setPhase]);

  // After landing settles, fade out then reset
  const handleLandComplete = useCallback(() => {
    if (phase !== "landing") return;
    setTimeout(() => {
      reset();
    }, FADE_OUT_DURATION * 1000);
  }, [phase, reset]);

  // Don't render on mobile / reduced motion
  if (skipAnimation) return null;

  // Track whether we're active for AnimatePresence exit animations
  const isActive = phase !== "idle" && originRect != null && project != null;
  if (!isActive) return null;

  // Plane dimensions
  const planeWidth = 48;
  const planeHeight = 24;

  // Compute destination landing position (left of blog title, or viewport center fallback)
  const destX = destinationRect
    ? destinationRect.left - 40
    : window.innerWidth / 2;
  const destY = destinationRect
    ? destinationRect.top + destinationRect.height / 2
    : 120;

  // Origin center from the clicked card
  const originCenterX = originRect.left + originRect.width / 2;
  const originCenterY = originRect.top + originRect.height / 2;

  // Loop circle: centered above the card origin
  const loopCenterX = originCenterX;
  const loopCenterY = originCenterY - LOOP_RADIUS - 40;

  // Loop starts/exits at the bottom of the circle
  const loopExitX = loopCenterX;
  const loopExitY = loopCenterY + LOOP_RADIUS;

  // Generate loop-the-loop keyframes (circular path, clockwise from bottom)
  const loopSteps = 16;
  const loopXKeyframes: number[] = [];
  const loopYKeyframes: number[] = [];
  const loopRotateKeyframes: number[] = [];

  for (let i = 0; i <= loopSteps; i++) {
    // Start at bottom of circle (270 deg), sweep clockwise
    const angle = (3 * Math.PI) / 2 - (i / loopSteps) * 2 * Math.PI;
    const x = loopCenterX + LOOP_RADIUS * Math.cos(angle);
    const y = loopCenterY - LOOP_RADIUS * Math.sin(angle);
    loopXKeyframes.push(x - planeWidth / 2);
    loopYKeyframes.push(y - planeHeight / 2);

    // Tangent rotation so nose follows the path
    const tangentAngle =
      (Math.atan2(-Math.cos(angle), -Math.sin(angle)) * 180) / Math.PI;
    loopRotateKeyframes.push(tangentAngle);
  }

  return (
    <AnimatePresence>
      <motion.div
        key="airplane-overlay"
        className="fixed inset-0 pointer-events-none"
        style={{ zIndex: 50 }}
        initial={{ opacity: 1 }}
        exit={{ opacity: 0 }}
      >
        {/* Phase: folding -- card clone morphs into paper airplane */}
        {phase === "folding" && (
          <motion.div
            className="absolute"
            style={{
              top: originRect.top,
              left: originRect.left,
              width: originRect.width,
              height: originRect.height,
              perspective: 800,
            }}
            initial={{ scaleX: 1, rotateY: 0 }}
            animate={{ scaleX: 0.15, rotateY: 45 }}
            transition={{ duration: FOLD_DURATION, ease: "easeInOut" }}
            onAnimationComplete={handleFoldComplete}
          >
            {/* Card content fading out */}
            <motion.div
              className="flex flex-col w-full h-full pl-11 pr-5 pt-5 pb-5 notebook-card"
              style={{
                ...clipStyle,
                transformOrigin: "center center",
              }}
              initial={{ opacity: 1 }}
              animate={{ opacity: 0 }}
              transition={{
                duration: FOLD_DURATION * 0.7,
                ease: "easeIn",
              }}
            >
              <TornEdge seed={project.name} />
              <h4 className="text-base !mt-0 leading-[23px]">
                {project.name}
              </h4>
              <p className="text-sm pt-[15px] leading-[23px] opacity-70 flex-1">
                {project.description}
              </p>
              <span className="text-sm pt-[23px] leading-[23px] underline underline-offset-2">
                {project.linkText}
              </span>
              <p className="text-xs leading-[23px] italic opacity-50">
                {project.stack}
              </p>
            </motion.div>

            {/* Paper plane crossfading in */}
            <motion.div
              className="absolute inset-0 flex items-center justify-center"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              transition={{
                duration: FOLD_DURATION * 0.5,
                delay: FOLD_DURATION * 0.5,
                ease: "easeOut",
              }}
            >
              <PaperPlaneSVG
                className="text-stone-600"
                style={{ width: planeWidth, height: planeHeight }}
              />
            </motion.div>
          </motion.div>
        )}

        {/* Phase: looping -- 360 degree loop-the-loop */}
        {phase === "looping" && (
          <motion.div
            className="absolute"
            style={{ width: planeWidth, height: planeHeight }}
            initial={{
              left: loopXKeyframes[0],
              top: loopYKeyframes[0],
              rotate: loopRotateKeyframes[0],
            }}
            animate={{
              left: loopXKeyframes,
              top: loopYKeyframes,
              rotate: loopRotateKeyframes,
            }}
            transition={{
              duration: LOOP_DURATION,
              ease: "linear",
              times: loopXKeyframes.map(
                (_, i) => i / (loopXKeyframes.length - 1),
              ),
            }}
            onAnimationComplete={handleLoopComplete}
          >
            <PaperPlaneSVG className="text-stone-600 w-full h-full" />
          </motion.div>
        )}

        {/* Phase: flying -- arc from loop exit to destination */}
        {phase === "flying" && (
          <FlyingPlane
            startX={loopExitX - planeWidth / 2}
            startY={loopExitY - planeHeight / 2}
            endX={destX}
            endY={destY}
            planeWidth={planeWidth}
            planeHeight={planeHeight}
            duration={FLY_DURATION}
            onComplete={handleFlyComplete}
          />
        )}

        {/* Phase: landing -- bounce/settle then fade out */}
        {phase === "landing" && (
          <motion.div
            className="absolute"
            style={{
              width: planeWidth,
              height: planeHeight,
              left: destX,
              top: destY - planeHeight / 2,
            }}
            initial={{ x: -8, scale: 1 }}
            animate={{
              x: [-8, 4, -2, 0],
              scale: [1, 1.05, 0.98, 1],
            }}
            transition={{ duration: LAND_DURATION, ease: "easeOut" }}
            onAnimationComplete={handleLandComplete}
          >
            <motion.div
              initial={{ opacity: 1 }}
              animate={{ opacity: 0 }}
              transition={{
                duration: FADE_OUT_DURATION,
                delay: LAND_DURATION,
                ease: "easeOut",
              }}
            >
              <PaperPlaneSVG className="text-stone-600 w-full h-full" />
            </motion.div>
          </motion.div>
        )}
      </motion.div>
    </AnimatePresence>
  );
}

/** Flying phase as a separate component for isolation */
interface FlyingPlaneProps {
  startX: number;
  startY: number;
  endX: number;
  endY: number;
  planeWidth: number;
  planeHeight: number;
  duration: number;
  onComplete: () => void;
}

function FlyingPlane({
  startX,
  startY,
  endX,
  endY,
  planeWidth,
  planeHeight,
  duration,
  onComplete,
}: FlyingPlaneProps) {
  // Gentle arc: midpoint offset upward for a natural flight path
  const midX = (startX + endX) / 2;
  const midY = Math.min(startY, endY) - 60;

  // Rotation angle pointing toward destination
  const dx = endX - startX;
  const dy = endY - startY;
  const angle = (Math.atan2(dy, dx) * 180) / Math.PI;

  // 3-point arc keyframes (start, mid-arc peak, destination)
  const xKeys = [startX, midX, endX];
  const yKeys = [startY, midY, endY];
  const rotateKeys = [
    angle - 20, // launch with slight upward tilt
    angle - 10, // mid-arc
    angle, // arrive pointing at target
  ];

  return (
    <motion.div
      className="absolute"
      style={{ width: planeWidth, height: planeHeight }}
      initial={{
        left: xKeys[0],
        top: yKeys[0],
        rotate: rotateKeys[0],
        scale: 1,
      }}
      animate={{
        left: xKeys,
        top: yKeys,
        rotate: rotateKeys,
        scale: [1, 0.9, 0.85],
      }}
      transition={{
        duration,
        ease: "easeOut",
        times: [0, 0.4, 1],
      }}
      onAnimationComplete={onComplete}
    >
      <PaperPlaneSVG className="text-stone-600 w-full h-full" />
    </motion.div>
  );
}
