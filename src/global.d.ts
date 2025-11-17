declare module 'jssip';

export { };

declare global {
  interface Window {
    loadPlayer?: (opts: {
      url: string;
      canvas: HTMLCanvasElement;
      onSourceEstablished?: () => void;
      onVideoDecode?: () => void;
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
    }) => Promise<{ player: any; destroy: () => void }>;
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    JSMpeg?: any;
  }
}
