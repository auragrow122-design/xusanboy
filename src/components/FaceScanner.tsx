import React, { useEffect, useRef, useState } from 'react';
import { AlertTriangle, Camera, CheckCircle2, RefreshCw, ShieldAlert } from 'lucide-react';
import type { StudentRecord } from '../data/schoolData';

interface FaceScannerProps {
  student: StudentRecord;
  onSuccess: (photos: string[]) => Promise<void>;
  onCancel: () => void;
}

type ScanStage =
  | 'loading_model'
  | 'scanning_gender'
  | 'liveness'
  | 'verifying'
  | 'error_camera'
  | 'error_model'
  | 'error_gender_mismatch'
  | 'error_unsure'
  | 'error_not_live';

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type FaceApiGlobal = any;

declare global {
  interface Window {
    faceapi?: FaceApiGlobal;
  }
}

const FACE_LIB_URL = 'https://cdn.jsdelivr.net/npm/@vladmandic/face-api@1.7.12/dist/face-api.js';
const FACE_MODEL_URL = 'https://cdn.jsdelivr.net/npm/@vladmandic/face-api@1.7.12/model/';

let sharedModelPromise: Promise<FaceApiGlobal> | null = null;

function loadFaceApiModels(): Promise<FaceApiGlobal> {
  if (sharedModelPromise) return sharedModelPromise;

  sharedModelPromise = new Promise((resolve, reject) => {
    const initModels = async () => {
      try {
        const api = window.faceapi;
        if (!api) throw new Error('faceapi not loaded');
        if (api.tf?.ready) await api.tf.ready();
        await Promise.all([
          api.nets.tinyFaceDetector.loadFromUri(FACE_MODEL_URL),
          api.nets.faceLandmark68TinyNet.loadFromUri(FACE_MODEL_URL),
          api.nets.ageGenderNet.loadFromUri(FACE_MODEL_URL),
        ]);
        resolve(api);
      } catch (err) {
        reject(err);
      }
    };

    if (window.faceapi) {
      initModels();
      return;
    }

    const script = document.createElement('script');
    script.src = FACE_LIB_URL;
    script.async = true;
    script.onload = () => initModels();
    script.onerror = () => reject(new Error('Failed to load face-api script'));
    document.head.appendChild(script);
  });

  sharedModelPromise.catch(() => {
    sharedModelPromise = null;
  });

  return sharedModelPromise;
}

function drawFaceMeshOverlay(
  canvas: HTMLCanvasElement,
  video: HTMLVideoElement,
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  detection: any | null,
  stage: ScanStage,
  progressPct: number,
  pulseTick: number,
) {
  const vw = video.videoWidth;
  const vh = video.videoHeight;
  if (!vw || !vh) return;

  if (canvas.width !== vw || canvas.height !== vh) {
    canvas.width = vw;
    canvas.height = vh;
  }

  const ctx = canvas.getContext('2d');
  if (!ctx) return;
  ctx.clearRect(0, 0, vw, vh);

  if (!detection) return;

  const box = detection.detection.box;
  const pts: Array<{ x: number; y: number }> = detection.landmarks?.positions ?? [];

  const accent =
    stage === 'liveness'
      ? '#10B981' // emerald during liveness confirmation
      : '#38BDF8'; // bright cyan-blue during face scan

  // 1. Subtle glowing face aura inside box
  ctx.save();
  const cx = box.x + box.width / 2;
  const cy = box.y + box.height / 2;
  const grad = ctx.createRadialGradient(cx, cy, box.width * 0.1, cx, cy, box.width * 0.72);
  grad.addColorStop(0, stage === 'liveness' ? 'rgba(16, 185, 129, 0.14)' : 'rgba(56, 189, 248, 0.14)');
  grad.addColorStop(1, 'rgba(37, 99, 235, 0)');
  ctx.fillStyle = grad;
  ctx.fillRect(box.x - 16, box.y - 16, box.width + 32, box.height + 32);

  // 2. Corner targeting brackets locked onto the detected face box
  const pad = 10;
  const x1 = box.x - pad;
  const y1 = box.y - pad;
  const x2 = box.x + box.width + pad;
  const y2 = box.y + box.height + pad;
  const cornerLen = Math.max(18, Math.min(34, box.width * 0.16));

  ctx.strokeStyle = accent;
  ctx.lineWidth = 3.2;
  ctx.lineCap = 'round';
  ctx.shadowColor = accent;
  ctx.shadowBlur = 10;

  ctx.beginPath();
  // Top-left
  ctx.moveTo(x1, y1 + cornerLen);
  ctx.lineTo(x1, y1);
  ctx.lineTo(x1 + cornerLen, y1);
  // Top-right
  ctx.moveTo(x2 - cornerLen, y1);
  ctx.lineTo(x2, y1);
  ctx.lineTo(x2, y1 + cornerLen);
  // Bottom-right
  ctx.moveTo(x2, y2 - cornerLen);
  ctx.lineTo(x2, y2);
  ctx.lineTo(x2 - cornerLen, y2);
  // Bottom-left
  ctx.moveTo(x1 + cornerLen, y2);
  ctx.lineTo(x1, y2);
  ctx.lineTo(x1, y2 - cornerLen);
  ctx.stroke();

  // 3. Scanning laser line clipped to the face bounding box
  const sweep = (Math.sin(pulseTick * 0.14) + 1) / 2;
  const scanY = box.y + sweep * box.height;
  const lineGrad = ctx.createLinearGradient(box.x, scanY, box.x + box.width, scanY);
  lineGrad.addColorStop(0, 'rgba(56, 189, 248, 0)');
  lineGrad.addColorStop(0.5, accent);
  lineGrad.addColorStop(1, 'rgba(56, 189, 248, 0)');
  ctx.strokeStyle = lineGrad;
  ctx.lineWidth = 2.5;
  ctx.beginPath();
  ctx.moveTo(box.x, scanY);
  ctx.lineTo(box.x + box.width, scanY);
  ctx.stroke();

  // 4. Full 68-point facial landmark mesh attached to the face
  if (pts.length >= 68) {
    ctx.shadowBlur = 6;
    ctx.strokeStyle = stage === 'liveness' ? 'rgba(52, 211, 153, 0.72)' : 'rgba(96, 165, 250, 0.72)';
    ctx.lineWidth = 1.4;

    const connectChain = (indices: number[], close = false) => {
      ctx.beginPath();
      indices.forEach((idx, i) => {
        const p = pts[idx];
        if (i === 0) ctx.moveTo(p.x, p.y);
        else ctx.lineTo(p.x, p.y);
      });
      if (close) ctx.closePath();
      ctx.stroke();
    };

    // Jawline (0..16)
    connectChain(Array.from({ length: 17 }, (_, i) => i));
    // Left eyebrow (17..21) & Right eyebrow (22..26)
    connectChain([17, 18, 19, 20, 21]);
    connectChain([22, 23, 24, 25, 26]);
    // Nose bridge (27..30) & nose base (31..35)
    connectChain([27, 28, 29, 30]);
    connectChain([31, 32, 33, 34, 35]);
    // Left eye (36..41) & Right eye (42..47)
    connectChain([36, 37, 38, 39, 40, 41], true);
    connectChain([42, 43, 44, 45, 46, 47], true);
    // Outer lips (48..59)
    connectChain([48, 49, 50, 51, 52, 53, 54, 55, 56, 57, 58, 59], true);

    // Extra biometric triangulation lines (cheeks / forehead / nose-to-jaw)
    ctx.strokeStyle = 'rgba(147, 197, 253, 0.35)';
    ctx.lineWidth = 1;
    const meshPairs: [number, number][] = [
      [1, 36],
      [36, 27],
      [27, 45],
      [45, 15],
      [2, 31],
      [31, 48],
      [14, 35],
      [35, 54],
      [30, 39],
      [30, 42],
      [21, 27],
      [22, 27],
      [8, 57],
      [4, 48],
      [12, 54],
    ];
    ctx.beginPath();
    for (const [a, b] of meshPairs) {
      ctx.moveTo(pts[a].x, pts[a].y);
      ctx.lineTo(pts[b].x, pts[b].y);
    }
    ctx.stroke();

    // Glowing landmark dots
    ctx.fillStyle = '#E0F2FE';
    const keyPoints = [0, 4, 8, 12, 16, 19, 24, 27, 30, 33, 36, 39, 42, 45, 48, 51, 54, 57];
    for (const idx of keyPoints) {
      const p = pts[idx];
      ctx.beginPath();
      ctx.arc(p.x, p.y, 2.3, 0, Math.PI * 2);
      ctx.fill();
    }
  }

  // 5. Progress arc badge attached under face box
  if (progressPct > 0 && progressPct <= 100) {
    ctx.shadowBlur = 0;
    const barW = Math.min(box.width, 160);
    const barX = cx - barW / 2;
    const barY = y2 + 12;
    ctx.fillStyle = 'rgba(15, 23, 42, 0.65)';
    ctx.fillRect(barX, barY, barW, 5);
    ctx.fillStyle = accent;
    ctx.fillRect(barX, barY, (barW * progressPct) / 100, 5);
  }

  ctx.restore();
}

export const FaceScanner: React.FC<FaceScannerProps> = ({ student, onSuccess, onCancel }) => {
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const cancelledRef = useRef(false);

  const [stage, setStage] = useState<ScanStage>('loading_model');
  const [statusText, setStatusText] = useState('Yuz skaneri yuklanmoqda...');
  const [hintText, setHintText] = useState('Kamera ochilmoqda...');
  const [progress, setProgress] = useState(0);
  const [detectedLabel, setDetectedLabel] = useState<string | null>(null);
  const [retrySeed, setRetrySeed] = useState(0);

  const stopStream = () => {
    if (streamRef.current) {
      streamRef.current.getTracks().forEach((t) => t.stop());
      streamRef.current = null;
    }
  };

  useEffect(() => {
    cancelledRef.current = false;
    setStage('loading_model');
    setProgress(0);
    setDetectedLabel(null);
    setStatusText('Skaner modeli tayyorlanmoqda...');
    setHintText('Kamera ochilmoqda...');

    let loopTimer: ReturnType<typeof setTimeout> | null = null;
    let pulseTick = 0;

    const snapFrame = (video: HTMLVideoElement): string | null => {
      try {
        const w = video.videoWidth;
        const h = video.videoHeight;
        if (!w || !h) return null;
        const c = document.createElement('canvas');
        c.width = 280;
        c.height = Math.round((h * 280) / w);
        c.getContext('2d')?.drawImage(video, 0, 0, c.width, c.height);
        return c.toDataURL('image/jpeg', 0.72);
      } catch {
        return null;
      }
    };

    const start = async () => {
      try {
        if (!navigator.mediaDevices?.getUserMedia) {
          throw new Error('no-camera');
        }
        const stream = await navigator.mediaDevices.getUserMedia({
          video: { facingMode: 'user', width: { ideal: 640 }, height: { ideal: 480 } },
          audio: false,
        });

        if (cancelledRef.current) {
          stream.getTracks().forEach((t) => t.stop());
          return;
        }

        streamRef.current = stream;
        const video = videoRef.current;
        if (!video) return;
        video.srcObject = stream;
        await video.play().catch(() => {});

        setHintText('Model yuklanmoqda...');
        let faceapi: FaceApiGlobal;
        try {
          faceapi = await loadFaceApiModels();
        } catch {
          if (!cancelledRef.current) {
            stopStream();
            setStage('error_model');
          }
          return;
        }

        if (cancelledRef.current) return;

        const expectFemale = student.gender === 'qiz';
        const opts = new faceapi.TinyFaceDetectorOptions({ inputSize: 320, scoreThreshold: 0.48 });

        const NEED_FRAMES = 14;
        let goodFrames = 0;
        let matchScoreSum = 0;
        let femaleProbSum = 0;
        let lostFrames = 0;
        const shots: string[] = [];

        setStage('scanning_gender');
        setHintText('Yuzingizni kameraga to‘g‘ri tuting');
        setStatusText('Yuz xususiyatlari tekshirilmoqda...');

        // Phase 1: Face Mesh + Gender Detection
        const runGenderPhase = async () => {
          if (cancelledRef.current || !videoRef.current || !canvasRef.current) return;
          pulseTick++;

          let result = null;
          try {
            result = await faceapi
              .detectSingleFace(videoRef.current, opts)
              .withFaceLandmarks(true)
              .withAgeAndGender();
          } catch {
            // ignore transient frame error
          }

          if (cancelledRef.current || !videoRef.current || !canvasRef.current) return;

          if (result) {
            const pFemale =
              result.gender === 'female'
                ? result.genderProbability
                : 1 - result.genderProbability;
            const matchProb = expectFemale ? pFemale : 1 - pFemale;

            goodFrames++;
            lostFrames = 0;
            femaleProbSum += pFemale;
            matchScoreSum += matchProb;

            const currentPct = Math.round((goodFrames / NEED_FRAMES) * 100);
            setProgress(currentPct);

            const liveGenderText = pFemale >= 0.5 ? 'Qiz bola' : 'O‘g‘il bola';
            setDetectedLabel(
              `Aniqlanmoqda: ${liveGenderText} (${Math.round(Math.max(pFemale, 1 - pFemale) * 100)}%)`,
            );
            setStatusText(`Yuz skanerlanmoqda... ${currentPct}%`);

            if (goodFrames === 4 || goodFrames === 9 || goodFrames === 13) {
              const s = snapFrame(videoRef.current);
              if (s) shots.push(s);
            }

            drawFaceMeshOverlay(
              canvasRef.current,
              videoRef.current,
              result,
              'scanning_gender',
              currentPct,
              pulseTick,
            );
          } else {
            lostFrames++;
            drawFaceMeshOverlay(canvasRef.current, videoRef.current, null, 'scanning_gender', 0, pulseTick);
            if (lostFrames > 3) {
              setDetectedLabel(null);
              setStatusText('Yuz topilmadi — yorug‘roq joyda kameraga qarang');
            }
          }

          if (goodFrames >= NEED_FRAMES) {
            const avgMatch = matchScoreSum / goodFrames;
            const avgFemale = femaleProbSum / goodFrames;
            const detectedAs = avgFemale >= 0.5 ? 'Qiz bola' : 'O‘g‘il bola';

            if (avgMatch >= 0.58) {
              // Passed gender check -> proceed to liveness check!
              startLivenessPhase(detectedAs);
              return;
            }

            stopStream();
            if (avgMatch <= 0.42) {
              setDetectedLabel(detectedAs);
              setStage('error_gender_mismatch');
            } else {
              setStage('error_unsure');
            }
            return;
          }

          loopTimer = setTimeout(runGenderPhase, 140);
        };

        // Phase 2: Real-Time Liveness (Head Turn)
        const startLivenessPhase = (detectedAs: string) => {
          const firstDir = Math.random() < 0.5 ? 'right' : 'left';
          const steps = [firstDir, firstDir === 'right' ? 'left' : 'right'];
          const instruction = (d: string) =>
            d === 'right'
              ? 'Boshingizni sekin o‘ngga buring →'
              : '← Boshingizni sekin chapga buring';

          let stepIdx = 0;
          let seenCenter = false;
          let stepStartedAt = Date.now();

          setStage('liveness');
          setProgress(0);
          setDetectedLabel(`Tasdiqlandi: ${detectedAs}`);
          setHintText('Jonli tekshiruv · 1 / 2');
          setStatusText(instruction(steps[0]));

          const runLivenessTick = async () => {
            if (cancelledRef.current || !videoRef.current || !canvasRef.current) return;
            pulseTick++;

            if (Date.now() - stepStartedAt > 14000) {
              stopStream();
              setStage('error_not_live');
              return;
            }

            let res = null;
            try {
              res = await faceapi
                .detectSingleFace(videoRef.current, opts)
                .withFaceLandmarks(true);
            } catch {
              // ignore frame error
            }

            if (cancelledRef.current || !videoRef.current || !canvasRef.current) return;

            if (res) {
              const p = res.landmarks.positions;
              const jawWidth = Math.max(1, p[16].x - p[0].x);
              const yaw = (p[30].x - p[0].x) / jawWidth;

              if (yaw > 0.42 && yaw < 0.58) {
                seenCenter = true;
              }

              const targetDir = steps[stepIdx];
              const turned =
                seenCenter && (targetDir === 'right' ? yaw < 0.38 : yaw > 0.62);

              drawFaceMeshOverlay(
                canvasRef.current,
                videoRef.current,
                res,
                'liveness',
                ((stepIdx + (turned ? 1 : 0)) / 2) * 100,
                pulseTick,
              );

              if (turned) {
                stepIdx++;
                seenCenter = false;
                stepStartedAt = Date.now();
                const pct = Math.round((stepIdx / 2) * 100);
                setProgress(pct);

                if (stepIdx >= 2) {
                  setStage('verifying');
                  setStatusText('Muvaffaqiyatli tasdiqlandi!');
                  stopStream();
                  await onSuccess(shots);
                  return;
                }

                setHintText('Jonli tekshiruv · 2 / 2');
                setStatusText(instruction(steps[stepIdx]));
              }
            } else {
              drawFaceMeshOverlay(canvasRef.current, videoRef.current, null, 'liveness', 0, pulseTick);
            }

            loopTimer = setTimeout(runLivenessTick, 110);
          };

          runLivenessTick();
        };

        runGenderPhase();
      } catch {
        if (!cancelledRef.current) {
          stopStream();
          setStage('error_camera');
        }
      }
    };

    start();

    return () => {
      cancelledRef.current = true;
      if (loopTimer) clearTimeout(loopTimer);
      stopStream();
    };
  }, [student.id, student.gender, retrySeed]);

  if (stage === 'error_camera') {
    return (
      <div className="rounded-2xl border border-rose-200 bg-rose-50 p-5 text-center space-y-3">
        <Camera className="mx-auto h-10 w-10 text-rose-600" />
        <h3 className="text-base font-extrabold text-slate-900">
          Kamera ochilmadi — davomat belgilanmadi
        </h3>
        <p className="text-sm text-slate-600">
          Yuz skaneridan o‘tmasdan maktabga kelganingiz hisoblanmaydi. Iltimos, brauzer
          sozlamalaridan kameraga ruxsat bering va qayta urinib ko‘ring.
        </p>
        <div className="flex flex-wrap justify-center gap-2.5 pt-1">
          <button
            type="button"
            onClick={() => setRetrySeed((s) => s + 1)}
            className="inline-flex items-center gap-1.5 rounded-xl bg-blue-600 px-4 py-2.5 text-xs font-bold text-white hover:bg-blue-700"
          >
            <RefreshCw className="h-4 w-4" />
            Qayta urinish
          </button>
          <button
            type="button"
            onClick={onCancel}
            className="rounded-xl border border-slate-300 bg-white px-4 py-2.5 text-xs font-bold text-slate-700 hover:bg-slate-50"
          >
            Orqaga
          </button>
        </div>
      </div>
    );
  }

  if (stage === 'error_model') {
    return (
      <div className="rounded-2xl border border-amber-200 bg-amber-50 p-5 text-center space-y-3">
        <AlertTriangle className="mx-auto h-10 w-10 text-amber-600" />
        <h3 className="text-base font-extrabold text-slate-900">
          Skaner modeli yuklanmadi — davomat belgilanmadi
        </h3>
        <p className="text-sm text-slate-600">
          Internet aloqasini tekshiring va yuz skanerini qayta ishga tushiring. Skanerdan o‘tmasdan
          kelganingiz hisoblanmaydi.
        </p>
        <div className="flex justify-center gap-2.5 pt-1">
          <button
            type="button"
            onClick={() => setRetrySeed((s) => s + 1)}
            className="inline-flex items-center gap-1.5 rounded-xl bg-blue-600 px-4 py-2.5 text-xs font-bold text-white hover:bg-blue-700"
          >
            <RefreshCw className="h-4 w-4" />
            Qayta urinish
          </button>
          <button
            type="button"
            onClick={onCancel}
            className="rounded-xl border border-slate-300 bg-white px-4 py-2.5 text-xs font-bold text-slate-700"
          >
            Orqaga
          </button>
        </div>
      </div>
    );
  }

  if (stage === 'error_gender_mismatch') {
    const expectedLabel = student.gender === 'qiz' ? 'Qiz bola' : 'O‘g‘il bola';
    return (
      <div className="rounded-2xl border border-rose-200 bg-rose-50 p-5 text-center space-y-3">
        <ShieldAlert className="mx-auto h-11 w-11 text-rose-600" />
        <h3 className="text-base font-extrabold text-rose-950">
          Skaner rad etdi — maktabga kelganingiz hisoblanmadi!
        </h3>
        <p className="text-sm text-rose-900">
          Akkaunt egasi <strong>{student.name}</strong> ({expectedLabel}), lekin skaner{' '}
          <strong>{detectedLabel}</strong> yuzini aniqladi. Boshqa o‘quvchining akkauntidan
          belgilash mumkin emas.
        </p>
        <div className="flex flex-wrap justify-center gap-2.5 pt-1">
          <button
            type="button"
            onClick={() => setRetrySeed((s) => s + 1)}
            className="inline-flex items-center gap-1.5 rounded-xl bg-blue-600 px-4 py-2.5 text-xs font-bold text-white hover:bg-blue-700"
          >
            <RefreshCw className="h-4 w-4" />
            Qayta skanerlash
          </button>
          <button
            type="button"
            onClick={onCancel}
            className="rounded-xl border border-slate-300 bg-white px-4 py-2.5 text-xs font-bold text-slate-700"
          >
            Orqaga
          </button>
        </div>
      </div>
    );
  }

  if (stage === 'error_unsure' || stage === 'error_not_live') {
    return (
      <div className="rounded-2xl border border-amber-200 bg-amber-50 p-5 text-center space-y-3">
        <AlertTriangle className="mx-auto h-10 w-10 text-amber-600" />
        <h3 className="text-base font-extrabold text-slate-900">
          {stage === 'error_not_live'
            ? 'Jonli odam aniqlanmadi'
            : 'Yuz aniq tekshirilmadi'}
        </h3>
        <p className="text-sm text-slate-700">
          {stage === 'error_not_live'
            ? 'Rasm yoki ekran tasviri qabul qilinmaydi. Kameraga o‘zingiz qarab boshingizni so‘ralgan tomonga buring.'
            : 'Yorug‘roq joyda yuzingizni to‘g‘ri tuting (ko‘zoynak yoki soch yuzni yopmasin). Skanerdan o‘tmasdan davomat belgilanmaydi.'}
        </p>
        <div className="flex justify-center gap-2.5 pt-1">
          <button
            type="button"
            onClick={() => setRetrySeed((s) => s + 1)}
            className="inline-flex items-center gap-1.5 rounded-xl bg-blue-600 px-4 py-2.5 text-xs font-bold text-white hover:bg-blue-700"
          >
            <RefreshCw className="h-4 w-4" />
            Qayta skanerlash
          </button>
          <button
            type="button"
            onClick={onCancel}
            className="rounded-xl border border-slate-300 bg-white px-4 py-2.5 text-xs font-bold text-slate-700"
          >
            Bekor qilish
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-3">
      <div className="relative aspect-[4/3] w-full overflow-hidden rounded-2xl bg-slate-950 border border-slate-200 shadow-inner">
        <video
          ref={videoRef}
          autoPlay
          playsInline
          muted
          className="h-full w-full object-cover scale-x-[-1]"
        />
        <canvas
          ref={canvasRef}
          className="pointer-events-none absolute inset-0 h-full w-full object-cover scale-x-[-1]"
        />

        {/* Top HUD inside camera */}
        <div className="pointer-events-none absolute inset-x-3 top-3 flex items-center justify-between gap-2">
          <span className="rounded-lg bg-slate-950/70 backdrop-blur-xs px-2.5 py-1 text-[11px] font-bold text-sky-200">
            {hintText}
          </span>
          {detectedLabel && (
            <span className="rounded-lg bg-slate-950/70 backdrop-blur-xs px-2.5 py-1 text-[11px] font-bold text-emerald-300">
              {detectedLabel}
            </span>
          )}
        </div>

        {stage === 'verifying' && (
          <div className="absolute inset-0 flex flex-col items-center justify-center bg-emerald-950/70 backdrop-blur-xs text-white">
            <CheckCircle2 className="h-12 w-12 text-emerald-400" />
            <p className="mt-2 text-base font-extrabold">Yuz tasdiqlandi!</p>
          </div>
        )}
      </div>

      {/* Progress Bar & Status */}
      <div className="space-y-1.5">
        <div className="h-2 w-full overflow-hidden rounded-full bg-slate-200">
          <div
            className={`h-full transition-all duration-150 ${
              stage === 'liveness' ? 'bg-emerald-600' : 'bg-blue-600'
            }`}
            style={{ width: `${progress}%` }}
          />
        </div>
        <div className="flex items-center justify-between gap-2 text-xs">
          <span className="font-bold text-blue-700">{statusText}</span>
          <button
            type="button"
            onClick={onCancel}
            className="font-bold text-slate-500 hover:text-rose-600"
          >
            Bekor qilish
          </button>
        </div>
      </div>

      <p className="text-[11px] text-slate-500 leading-relaxed">
        Skaner yuz nuqtalarini va jins mosligini ({student.gender === 'qiz' ? 'Qiz bola' : 'O‘g‘il bola'})
        tekshiradi. Skanerdan o‘tmasdan maktabga kelganingiz hisoblanmaydi.
      </p>
    </div>
  );
};
