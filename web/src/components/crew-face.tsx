import { useId } from "react";
import type { SessionState } from "../types";
import { LAMP_TONE } from "./crew-face-data";

// The AgentDeck crew member: a brass porthole helmet with a face window and
// a state-tinted signal lamp on top. The waiting state carries an amber
// exclamation bubble chosen in the visual spec.
const FACE = "#eaf1f6";
const RIM = "#7d5518";

function Expression({ state }: { state: SessionState }) {
  switch (state) {
    case "working":
      return (
        <g>
          <path d="M 42 51 L 54 54" stroke={FACE} strokeWidth="3.4" strokeLinecap="round" />
          <path d="M 78 51 L 66 54" stroke={FACE} strokeWidth="3.4" strokeLinecap="round" />
          <circle cx="49" cy="62" r="4.6" fill={FACE} />
          <circle cx="71" cy="62" r="4.6" fill={FACE} />
          <path d="M 53 77 L 67 77" stroke={FACE} strokeWidth="3.4" strokeLinecap="round" />
        </g>
      );
    case "waiting":
      return (
        <g>
          <path d="M 43 49 L 55 49" stroke={FACE} strokeWidth="3.2" strokeLinecap="round" />
          <path d="M 65 49 L 77 49" stroke={FACE} strokeWidth="3.2" strokeLinecap="round" />
          <circle cx="49" cy="61" r="5" fill={FACE} />
          <circle cx="71" cy="61" r="5" fill={FACE} />
          <path d="M 54 77 L 66 77" stroke={FACE} strokeWidth="3.2" strokeLinecap="round" />
        </g>
      );
    case "error":
      return (
        <g>
          <path d="M 44 56 L 54 66 M 54 56 L 44 66" stroke={FACE} strokeWidth="3.6" strokeLinecap="round" />
          <path d="M 66 56 L 76 66 M 76 56 L 66 66" stroke={FACE} strokeWidth="3.6" strokeLinecap="round" />
          <path
            d="M 50 79 Q 55 74 60 79 Q 65 84 70 79"
            stroke={FACE}
            strokeWidth="3.2"
            strokeLinecap="round"
            fill="none"
          />
        </g>
      );
    default:
      return (
        <g>
          <path d="M 43 61 Q 49 67 55 61" stroke={FACE} strokeWidth="3.6" strokeLinecap="round" fill="none" />
          <path d="M 65 61 Q 71 67 77 61" stroke={FACE} strokeWidth="3.6" strokeLinecap="round" fill="none" />
          <path d="M 51 76 Q 60 83 69 76" stroke={FACE} strokeWidth="3.4" strokeLinecap="round" fill="none" />
          <path
            d="M 76 42 L 84 42 L 76 50 L 84 50"
            stroke={FACE}
            strokeWidth="2.6"
            strokeLinecap="round"
            strokeLinejoin="round"
            fill="none"
            opacity="0.85"
          />
        </g>
      );
  }
}

export function CrewFace({ state, size = 26 }: { state: SessionState; size?: number }) {
  const uid = useId();
  const lamp = LAMP_TONE[state];
  return (
    <svg
      className="crew-face"
      data-state={state}
      width={size}
      height={size}
      viewBox="0 0 120 120"
      style={{ overflow: "visible" }}
      aria-hidden
    >
      <defs>
        <radialGradient id={`brass-${uid}`} gradientUnits="userSpaceOnUse" cx="60" cy="44" r="66">
          <stop offset="0" stopColor="#ffe0a0" />
          <stop offset="0.55" stopColor="#ecb75f" />
          <stop offset="1" stopColor="#b87f28" />
        </radialGradient>
        <radialGradient id={`glass-${uid}`} gradientUnits="userSpaceOnUse" cx="60" cy="56" r="36">
          <stop offset="0" stopColor="#12283a" />
          <stop offset="1" stopColor="#081420" />
        </radialGradient>
      </defs>
      <rect x="56" y="13" width="8" height="8" rx="2" fill={RIM} />
      <circle className="crew-face__lamp" cx="60" cy="10" r="6.5" fill={lamp} />
      <circle cx="60" cy="10" r="10.5" fill={lamp} opacity="0.22" />
      <circle cx="60" cy="66" r="46" fill={`url(#brass-${uid})`} stroke={RIM} strokeWidth="2.5" />
      <circle cx="17.5" cy="55" r="3.4" fill={RIM} />
      <circle cx="102.5" cy="55" r="3.4" fill={RIM} />
      <circle cx="28" cy="33" r="3.4" fill={RIM} />
      <circle cx="92" cy="33" r="3.4" fill={RIM} />
      <circle cx="26" cy="93" r="3.4" fill={RIM} />
      <circle cx="94" cy="93" r="3.4" fill={RIM} />
      <circle cx="60" cy="66" r="31" fill={`url(#glass-${uid})`} stroke={RIM} strokeWidth="3" />
      <path d="M 40 50 Q 52 38 72 42" stroke="#cfe3ee" strokeWidth="3" strokeLinecap="round" opacity="0.18" fill="none" />
      <Expression state={state} />
      {state === "waiting" ? (
        <g className="crew-face__bubble">
          <circle cx="112" cy="22" r="15" fill="var(--tone-waiting)" />
          <path d="M 101 33 L 96 40 L 106 36 Z" fill="var(--tone-waiting)" />
          <rect x="109.6" y="13" width="4.8" height="11" rx="2.4" fill="#0b1520" />
          <circle cx="112" cy="30.5" r="2.7" fill="#0b1520" />
        </g>
      ) : null}
    </svg>
  );
}
