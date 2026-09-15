import confetti from 'canvas-confetti';

export function fireConfetti(options?: confetti.Options) {
  const count = 180;
  const defaults = {
    origin: { y: 0.7 },
    zIndex: 9999,
  };

  function fire(particleRatio: number, opts: confetti.Options) {
    confetti({
      ...defaults,
      ...opts,
      particleCount: Math.floor(count * particleRatio),
      colors: ['#244680', '#10b981', '#f59e0b', '#38bdf8', '#6366f1'],
    });
  }

  fire(0.25, {
    spread: 26,
    startVelocity: 55,
    ...options,
  });

  fire(0.2, {
    spread: 60,
    ...options,
  });

  fire(0.35, {
    spread: 100,
    decay: 0.91,
    scalar: 0.8,
    ...options,
  });

  fire(0.1, {
    spread: 120,
    startVelocity: 25,
    decay: 0.92,
    scalar: 1.2,
    ...options,
  });

  fire(0.1, {
    spread: 120,
    startVelocity: 45,
    ...options,
  });
}

export function fireFlightSuccess() {
  fireConfetti({
    spread: 70,
    origin: { y: 0.6 },
  });
}
