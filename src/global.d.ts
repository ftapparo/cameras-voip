declare module 'jssip';

export {};

declare global {
  interface Window {
    loadPlayer?: (opts: {
      url: string;
      canvas: HTMLCanvasElement;
    }) => () => void;
  }
}
