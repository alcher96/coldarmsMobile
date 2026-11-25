import { createContext, useContext, useState, type ReactNode } from 'react';

import type { Answers } from './types';

/** Черновик анализа между экранами: выбранное видео, обрезка и ответы кнопками. */
type Draft = {
  videoUri?: string;
  videoName?: string;
  /** ширина / высота кадра; < 1 — вертикальное видео */
  videoRatio?: number;
  /** размер файла, байт — для отправки кусками */
  videoBytes?: number;
  /** длина видео, с */
  videoDuration?: number;
  /** выбранный кусок [начало, конец], с — с экрана обрезки; нет — всё видео */
  trim?: [number, number];
  answers: Answers;
  setVideo: (uri: string, name?: string, ratio?: number, bytes?: number, duration?: number) => void;
  setTrim: (t?: [number, number]) => void;
  setAnswer: <K extends keyof Answers>(key: K, value: Answers[K]) => void;
  reset: () => void;
};

const Ctx = createContext<Draft | null>(null);

export function AnalysisDraftProvider({ children }: { children: ReactNode }) {
  const [videoUri, setVideoUri] = useState<string>();
  const [videoName, setVideoName] = useState<string>();
  const [videoRatio, setVideoRatio] = useState<number>();
  const [videoBytes, setVideoBytes] = useState<number>();
  const [videoDuration, setVideoDuration] = useState<number>();
  const [trim, setTrim] = useState<[number, number]>();
  const [answers, setAnswers] = useState<Answers>({ result: 'loss' });
  const value: Draft = {
    videoUri,
    videoName,
    videoRatio,
    videoBytes,
    videoDuration,
    trim,
    answers,
    setVideo: (uri, name, ratio, bytes, duration) => {
      setVideoUri(uri);
      setVideoName(name);
      setVideoRatio(ratio);
      setVideoBytes(bytes);
      setVideoDuration(duration);
      setTrim(undefined);
    },
    setTrim,
    setAnswer: (key, v) => setAnswers((a) => ({ ...a, [key]: v })),
    reset: () => {
      setVideoUri(undefined);
      setVideoName(undefined);
      setVideoRatio(undefined);
      setVideoBytes(undefined);
      setVideoDuration(undefined);
      setTrim(undefined);
      // уровень выбирают до видео (экран «Новый разбор») — новое видео его не сбрасывает
      setAnswers((a) => ({ result: 'loss', ...(a.tier ? { tier: a.tier } : {}) }));
    },
  };
  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}

export function useAnalysisDraft() {
  const v = useContext(Ctx);
  if (!v) throw new Error('useAnalysisDraft вне AnalysisDraftProvider');
  return v;
}
