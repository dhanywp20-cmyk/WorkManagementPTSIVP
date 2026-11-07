'use client';
import { useRef } from 'react';
import type * as T from 'three';
import type { Mesin } from './mesin/tipe';

export function useRefMesin() {
  const wadahRef = useRef<HTMLDivElement>(null);
  const mesin = useRef<Mesin | null>(null);
  const pasSetelahTemplate = useRef<boolean | 'langsung'>(false);
  const teksturBayang = useRef<{ bayang: T.Texture; cahaya: T.Texture } | null>(null);
  const gambarLayar = useRef(new Map<string, T.Texture>());
  const sumberTekstur = useRef(new Map<string, string>());
  const gambarTekstur = useRef(new Map<string, HTMLImageElement>());
  const modelImpor = useRef(new Map<string, T.Object3D>());
  const inputGambar = useRef<HTMLInputElement>(null);
  const inputModel = useRef<HTMLInputElement>(null);
  const inputLaptop = useRef<HTMLInputElement>(null);
  return { wadahRef, mesin, pasSetelahTemplate, teksturBayang, gambarLayar, sumberTekstur, gambarTekstur, modelImpor, inputGambar, inputModel,
    inputLaptop };
}
